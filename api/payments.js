const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/payments/create-payment-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/create-payment-intent', auth, [
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('projectId').isMongoId().withMessage('Valid project ID required'),
  body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, projectId, currency = 'usd' } = req.body;

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      owner: req.userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: {
          userId: req.userId.toString()
        }
      });
      customerId = customer.id;
      
      // Update user with customer ID
      await User.findByIdAndUpdate(req.userId, {
        stripeCustomerId: customerId
      });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      metadata: {
        projectId,
        userId: req.userId.toString()
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment processing error'
    });
  }
});

// @route   POST /api/payments/confirm-payment
// @desc    Confirm payment and update project
// @access  Private
router.post('/confirm-payment', auth, [
  body('paymentIntentId').notEmpty().withMessage('Payment intent ID required'),
  body('projectId').isMongoId().withMessage('Valid project ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { paymentIntentId, projectId } = req.body;

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Verify project belongs to user
    const project = await Project.findOne({
      _id: projectId,
      owner: req.userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Update project budget
    project.budget.actual = paymentIntent.amount / 100;
    project.status = 'prototype';
    await project.save();

    // Add communication
    await project.addCommunication(
      'status-update',
      `Payment of $${paymentIntent.amount / 100} confirmed. Project moved to prototype phase.`,
      req.userId
    );

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment confirmation error'
    });
  }
});

// @route   GET /api/payments/history
// @desc    Get user's payment history
// @access  Private
router.get('/history', auth, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    // Get projects with payments
    const projects = await Project.find({
      owner: req.userId,
      'budget.actual': { $gt: 0 }
    })
      .select('title budget status createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Project.countDocuments({
      owner: req.userId,
      'budget.actual': { $gt: 0 }
    });

    res.json({
      success: true,
      data: {
        payments: projects,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/create-subscription
// @desc    Create subscription for premium features
// @access  Private
router.post('/create-subscription', auth, [
  body('priceId').notEmpty().withMessage('Price ID required'),
  body('paymentMethodId').notEmpty().withMessage('Payment method ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { priceId, paymentMethodId } = req.body;

    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        name: req.user.name,
        metadata: {
          userId: req.userId.toString()
        }
      });
      customerId = customer.id;
      
      await User.findByIdAndUpdate(req.userId, {
        stripeCustomerId: customerId
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
    });

    // Update user subscription
    const plan = priceId.includes('basic') ? 'basic' : 
                 priceId.includes('premium') ? 'premium' : 'enterprise';

    await User.findByIdAndUpdate(req.userId, {
      'subscription.plan': plan,
      'subscription.status': 'active',
      'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
    });

    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: { subscription }
    });
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Subscription creation error'
    });
  }
});

// @route   POST /api/payments/webhook
// @desc    Handle Stripe webhooks
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      break;
    
    case 'invoice.payment_succeeded':
      const invoice = event.data.object;
      console.log('Invoice payment succeeded:', invoice.id);
      break;
    
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      console.log('Subscription updated:', subscription.id);
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;

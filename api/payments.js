import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Project from '../models/Project.js';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

const authenticate = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) throw new Error('No token provided');
  const token = authHeader.replace('Bearer ', '');
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decoded.userId).select('-password');
  if (!user) throw new Error('User not found');
  return user;
};

export default async function handler(req, res) {
  await connectDB();
  const { method, url } = req;

  try {
    // Parse URL to extract path and params
    const urlParts = url.split('/').filter(p => p);
    const path = '/' + urlParts.slice(1).join('/'); // Remove 'api' prefix

    // POST /api/payments/create-payment-intent
    if (method === 'POST' && path === '/create-payment-intent') {
      const user = await authenticate(req);

      const validate = [
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('projectId').isMongoId().withMessage('Valid project ID required'),
        body('currency').optional().isIn(['usd', 'eur', 'gbp']).withMessage('Invalid currency')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { amount, projectId, currency = 'usd' } = req.body;

      // Verify project belongs to user
      const project = await Project.findOne({
        _id: projectId,
        owner: user._id
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user._id.toString()
          }
        });
        customerId = customer.id;

        // Update user with customer ID
        await User.findByIdAndUpdate(user._id, {
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
          userId: user._id.toString()
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id
        }
      });
    }

    // POST /api/payments/confirm-payment
    if (method === 'POST' && path === '/confirm-payment') {
      const user = await authenticate(req);

      const validate = [
        body('paymentIntentId').notEmpty().withMessage('Payment intent ID required'),
        body('projectId').isMongoId().withMessage('Valid project ID required')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { paymentIntentId, projectId } = req.body;

      // Retrieve payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ success: false, message: 'Payment not completed' });
      }

      // Verify project belongs to user
      const project = await Project.findOne({
        _id: projectId,
        owner: user._id
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // Update project budget
      project.budget.actual = paymentIntent.amount / 100;
      project.status = 'prototype';
      await project.save();

      // Add communication
      await project.addCommunication(
        'status-update',
        `Payment of $${paymentIntent.amount / 100} confirmed. Project moved to prototype phase.`,
        user._id
      );

      return res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: { project }
      });
    }

    // GET /api/payments/history
    if (method === 'GET' && path === '/history') {
      const user = await authenticate(req);
      const { page = 1, limit = 10 } = req.query;

      // Get projects with payments
      const projects = await Project.find({
        owner: user._id,
        'budget.actual': { $gt: 0 }
      })
        .select('title budget status createdAt')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Project.countDocuments({
        owner: user._id,
        'budget.actual': { $gt: 0 }
      });

      return res.json({
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
    }

    // POST /api/payments/create-subscription
    if (method === 'POST' && path === '/create-subscription') {
      const user = await authenticate(req);

      const validate = [
        body('priceId').notEmpty().withMessage('Price ID required'),
        body('paymentMethodId').notEmpty().withMessage('Payment method ID required')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { priceId, paymentMethodId } = req.body;

      // Get or create Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            userId: user._id.toString()
          }
        });
        customerId = customer.id;

        await User.findByIdAndUpdate(user._id, {
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

      await User.findByIdAndUpdate(user._id, {
        'subscription.plan': plan,
        'subscription.status': 'active',
        'subscription.currentPeriodEnd': new Date(subscription.current_period_end * 1000)
      });

      return res.json({
        success: true,
        message: 'Subscription created successfully',
        data: { subscription }
      });
    }

    // POST /api/payments/webhook
    if (method === 'POST' && path === '/webhook') {
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

      return res.json({ received: true });
    }

    // Default: Not found
    return res.status(404).json({ success: false, message: 'Route not found' });

  } catch (error) {
    console.error('Payments API error:', error);
    if (error.message.includes('not valid') || error.message.includes('not found')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

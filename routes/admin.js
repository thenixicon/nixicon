const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const User = require('../models/User');
const { auth, adminAuth, developerAuth } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication
router.use(auth);

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard stats
// @access  Private (Admin)
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalUsers,
      totalDevelopers,
      recentProjects,
      projectStatusStats,
      monthlyRevenue
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: { $in: ['prototype', 'in-development', 'testing'] } }),
      Project.countDocuments({ status: 'deployed' }),
      User.countDocuments({ role: 'user' }),
      User.countDocuments({ role: 'developer' }),
      Project.find()
        .populate('owner', 'name email')
        .populate('assignedDeveloper', 'name email')
        .sort({ createdAt: -1 })
        .limit(10),
      Project.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Project.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$budget.actual' }
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalProjects,
          activeProjects,
          completedProjects,
          totalUsers,
          totalDevelopers,
          monthlyRevenue: monthlyRevenue[0]?.total || 0
        },
        recentProjects,
        projectStatusStats
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/projects
// @desc    Get all projects for admin
// @access  Private (Admin)
router.get('/projects', adminAuth, async (req, res) => {
  try {
    const { status, assigned, page = 1, limit = 20 } = req.query;
    const filter = {};
    
    if (status) filter.status = status;
    if (assigned === 'true') filter.assignedDeveloper = { $exists: true, $ne: null };
    if (assigned === 'false') filter.assignedDeveloper = null;

    const projects = await Project.find(filter)
      .populate('owner', 'name email phone')
      .populate('assignedDeveloper', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Project.countDocuments(filter);

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    console.error('Get admin projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/projects/:id/assign
// @desc    Assign developer to project
// @access  Private (Admin)
router.put('/projects/:id/assign', adminAuth, [
  body('developerId').isMongoId().withMessage('Valid developer ID required')
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

    const { developerId } = req.body;
    const projectId = req.params.id;

    // Verify developer exists and has developer role
    const developer = await User.findOne({
      _id: developerId,
      role: 'developer'
    });

    if (!developer) {
      return res.status(400).json({
        success: false,
        message: 'Developer not found'
      });
    }

    const project = await Project.findByIdAndUpdate(
      projectId,
      { 
        assignedDeveloper: developerId,
        status: 'in-development'
      },
      { new: true }
    ).populate('owner assignedDeveloper', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Add communication
    await project.addCommunication(
      'status-update',
      `Project assigned to ${developer.name}`,
      req.userId
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('project-assigned', {
      developer: developer.name,
      assignedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Developer assigned successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Assign developer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/admin/projects/:id/status
// @desc    Update project status
// @access  Private (Admin/Developer)
router.put('/projects/:id/status', developerAuth, [
  body('status').isIn(['draft', 'prototype', 'in-development', 'testing', 'deployed', 'cancelled'])
    .withMessage('Invalid status')
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

    const { status, notes } = req.body;
    const projectId = req.params.id;

    const project = await Project.findOne({
      _id: projectId,
      $or: [
        { assignedDeveloper: req.userId },
        ...(req.user.role === 'admin' ? [{}] : [])
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    project.status = status;
    if (status === 'deployed') {
      project.timeline.actualEnd = new Date();
    }
    await project.save();

    // Add communication
    await project.addCommunication(
      'status-update',
      `Status updated to ${status}${notes ? ': ' + notes : ''}`,
      req.userId
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('status-update', {
      status,
      updatedBy: req.user.name,
      updatedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/developers
// @desc    Get all developers
// @access  Private (Admin)
router.get('/developers', adminAuth, async (req, res) => {
  try {
    const developers = await User.find({ role: 'developer' })
      .select('name email avatar createdAt')
      .sort({ createdAt: -1 });

    // Get workload for each developer
    const developersWithWorkload = await Promise.all(
      developers.map(async (dev) => {
        const activeProjects = await Project.countDocuments({
          assignedDeveloper: dev._id,
          status: { $in: ['in-development', 'testing'] }
        });
        return {
          ...dev.toObject(),
          activeProjects
        };
      })
    );

    res.json({
      success: true,
      data: { developers: developersWithWorkload }
    });
  } catch (error) {
    console.error('Get developers error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/admin/developers
// @desc    Create new developer
// @access  Private (Admin)
router.post('/developers', adminAuth, [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    const developer = new User({
      name,
      email,
      password,
      role: 'developer',
      isVerified: true
    });

    await developer.save();

    res.status(201).json({
      success: true,
      message: 'Developer created successfully',
      data: { developer: developer.toJSON() }
    });
  } catch (error) {
    console.error('Create developer error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get analytics data
// @access  Private (Admin)
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      projectTrends,
      revenueTrends,
      categoryStats,
      developerPerformance
    ] = await Promise.all([
      // Project creation trends
      Project.aggregate([
        {
          $match: { createdAt: { $gte: startDate } }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      // Revenue trends
      Project.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            'budget.actual': { $gt: 0 }
          }
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              day: { $dayOfMonth: '$createdAt' }
            },
            revenue: { $sum: '$budget.actual' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
      ]),
      // Category statistics
      Project.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      // Developer performance
      Project.aggregate([
        {
          $match: {
            assignedDeveloper: { $exists: true, $ne: null },
            status: 'deployed'
          }
        },
        {
          $group: {
            _id: '$assignedDeveloper',
            completedProjects: { $sum: 1 },
            avgCompletionTime: {
              $avg: {
                $subtract: ['$timeline.actualEnd', '$timeline.actualStart']
              }
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'developer'
          }
        },
        { $unwind: '$developer' },
        {
          $project: {
            developerName: '$developer.name',
            completedProjects: 1,
            avgCompletionTime: 1
          }
        }
      ])
    ]);

    res.json({
      success: true,
      data: {
        projectTrends,
        revenueTrends,
        categoryStats,
        developerPerformance
      }
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

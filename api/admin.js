import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Project from '../models/Project.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

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

const adminAuth = (user) => {
  if (user.role !== 'admin') throw new Error('Access denied. Admin role required.');
};

const developerAuth = (user) => {
  if (!['developer', 'admin'].includes(user.role)) throw new Error('Access denied. Developer role required.');
};

export default async function handler(req, res) {
  await connectDB();
  const { method, url } = req;

  try {
    const user = await authenticate(req);

    // Parse URL to extract path and params
    const urlParts = url.split('/').filter(p => p);
    const path = '/' + urlParts.slice(1).join('/'); // Remove 'api' prefix

    // GET /api/admin/dashboard
    if (method === 'GET' && path === '/dashboard') {
      adminAuth(user);
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

      return res.json({
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
    }

    // GET /api/admin/projects
    if (method === 'GET' && path === '/projects') {
      adminAuth(user);
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

      return res.json({
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
    }

    // PUT /api/admin/projects/:id/assign
    if (method === 'PUT' && path.match(/^\/projects\/[^\/]+\/assign$/)) {
      adminAuth(user);
      const projectId = path.split('/')[2];

      const validate = [
        body('developerId').isMongoId().withMessage('Valid developer ID required')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { developerId } = req.body;

      // Verify developer exists and has developer role
      const developer = await User.findOne({
        _id: developerId,
        role: 'developer'
      });

      if (!developer) {
        return res.status(400).json({ success: false, message: 'Developer not found' });
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
        return res.status(404).json({ success: false, message: 'Project not found' });
      }

      // Add communication
      await project.addCommunication(
        'status-update',
        `Project assigned to ${developer.name}`,
        user._id
      );

      return res.json({
        success: true,
        message: 'Developer assigned successfully',
        data: { project }
      });
    }

    // PUT /api/admin/projects/:id/status
    if (method === 'PUT' && path.match(/^\/projects\/[^\/]+\/status$/)) {
      developerAuth(user);
      const projectId = path.split('/')[2];

      const validate = [
        body('status').isIn(['draft', 'prototype', 'in-development', 'testing', 'deployed', 'cancelled'])
          .withMessage('Invalid status')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { status, notes } = req.body;

      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { assignedDeveloper: user._id },
          ...(user.role === 'admin' ? [{}] : [])
        ]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found or access denied' });
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
        user._id
      );

      return res.json({
        success: true,
        message: 'Status updated successfully',
        data: { project }
      });
    }

    // GET /api/admin/developers
    if (method === 'GET' && path === '/developers') {
      adminAuth(user);
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

      return res.json({
        success: true,
        data: { developers: developersWithWorkload }
      });
    }

    // POST /api/admin/developers
    if (method === 'POST' && path === '/developers') {
      adminAuth(user);
      const validate = [
        body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { name, email, password } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists with this email' });
      }

      const developer = new User({
        name,
        email,
        password,
        role: 'developer',
        isVerified: true
      });

      await developer.save();

      return res.status(201).json({
        success: true,
        message: 'Developer created successfully',
        data: { developer: developer.toJSON() }
      });
    }

    // GET /api/admin/analytics
    if (method === 'GET' && path === '/analytics') {
      adminAuth(user);
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

      return res.json({
        success: true,
        data: {
          projectTrends,
          revenueTrends,
          categoryStats,
          developerPerformance
        }
      });
    }

    // Default: Not found
    return res.status(404).json({ success: false, message: 'Route not found' });

  } catch (error) {
    console.error('Admin API error:', error);
    if (error.message.includes('Access denied') || error.message.includes('not valid') || error.message.includes('not found')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/projects
// @desc    Get user's projects
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, category, page = 1, limit = 10 } = req.query;
    const filter = { owner: req.userId };
    
    if (status) filter.status = status;
    if (category) filter.category = category;

    const projects = await Project.find(filter)
      .populate('assignedDeveloper', 'name email avatar')
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
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/projects/:id
// @desc    Get single project
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.userId },
        { assignedDeveloper: req.userId }
      ]
    }).populate('owner assignedDeveloper', 'name email avatar role');

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    res.json({
      success: true,
      data: { project }
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/projects
// @desc    Create new project
// @access  Private
router.post('/', auth, [
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').isIn(['mobile-app', 'web-app', 'website', 'automation', 'ai-tool', 'other']).withMessage('Invalid category')
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

    const projectData = {
      ...req.body,
      owner: req.userId
    };

    const project = new Project(projectData);
    await project.save();

    // Add initial communication
    await project.addCommunication(
      'status-update',
      'Project created successfully',
      req.userId
    );

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/projects/:id
// @desc    Update project
// @access  Private
router.put('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    const allowedUpdates = [
      'title', 'description', 'category', 'platform', 'features',
      'design', 'technical', 'timeline', 'budget'
    ];

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field];
      }
    });

    await project.save();

    res.json({
      success: true,
      message: 'Project updated successfully',
      data: { project }
    });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   DELETE /api/projects/:id
// @desc    Delete project
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    await Project.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Project deleted successfully'
    });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/projects/:id/communication
// @desc    Add communication to project
// @access  Private
router.post('/:id/communication', auth, [
  body('type').isIn(['message', 'file', 'milestone', 'status-update']).withMessage('Invalid communication type'),
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Content must be 1-2000 characters')
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

    const project = await Project.findOne({
      _id: req.params.id,
      $or: [
        { owner: req.userId },
        { assignedDeveloper: req.userId }
      ]
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    await project.addCommunication(
      req.body.type,
      req.body.content,
      req.userId,
      req.body.attachments || []
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.to(`project-${project._id}`).emit('new-message', {
      type: req.body.type,
      content: req.body.content,
      author: req.user.name,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: 'Communication added successfully'
    });
  } catch (error) {
    console.error('Add communication error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/projects/:id/ai-generate
// @desc    Generate project features using AI
// @access  Private
router.post('/:id/ai-generate', auth, [
  body('prompt').trim().isLength({ min: 10, max: 500 }).withMessage('Prompt must be 10-500 characters')
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

    const project = await Project.findOne({
      _id: req.params.id,
      owner: req.userId
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or access denied'
      });
    }

    // Simulate AI generation (replace with actual AI service)
    const mockFeatures = [
      {
        name: 'User Authentication',
        description: 'Secure login and registration system',
        complexity: 'medium',
        estimatedHours: 8
      },
      {
        name: 'Dashboard',
        description: 'Main user interface with data visualization',
        complexity: 'complex',
        estimatedHours: 16
      },
      {
        name: 'Settings',
        description: 'User preferences and configuration',
        complexity: 'simple',
        estimatedHours: 4
      }
    ];

    project.features = mockFeatures;
    project.aiGenerated = {
      isAiGenerated: true,
      prompt: req.body.prompt,
      generatedAt: new Date(),
      confidence: 0.85
    };

    await project.save();

    res.json({
      success: true,
      message: 'AI features generated successfully',
      data: { features: mockFeatures }
    });
  } catch (error) {
    console.error('AI generate error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

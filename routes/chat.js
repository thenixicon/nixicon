const express = require('express');
const { body, validationResult } = require('express-validator');
const Project = require('../models/Project');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/chat/projects/:projectId/messages
// @desc    Get chat messages for a project
// @access  Private
router.get('/projects/:projectId/messages', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify user has access to project
    const project = await Project.findOne({
      _id: projectId,
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

    // Get messages from project communication
    const messages = project.communication
      .filter(msg => msg.type === 'message')
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice((page - 1) * limit, page * limit)
      .reverse();

    // Populate author information
    const populatedMessages = await Project.populate(messages, {
      path: 'author',
      select: 'name email avatar role'
    });

    res.json({
      success: true,
      data: {
        messages: populatedMessages,
        pagination: {
          current: parseInt(page),
          hasMore: project.communication.filter(msg => msg.type === 'message').length > page * limit
        }
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chat/projects/:projectId/messages
// @desc    Send a message in project chat
// @access  Private
router.post('/projects/:projectId/messages', auth, [
  body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')
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

    const { projectId } = req.params;
    const { content, attachments = [] } = req.body;

    // Verify user has access to project
    const project = await Project.findOne({
      _id: projectId,
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

    // Add message to project
    await project.addCommunication('message', content, req.userId, attachments);

    // Emit real-time message
    const io = req.app.get('io');
    io.to(`project-${projectId}`).emit('new-message', {
      content,
      author: {
        _id: req.userId,
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar,
        role: req.user.role
      },
      timestamp: new Date(),
      attachments
    });

    res.json({
      success: true,
      message: 'Message sent successfully'
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/chat/projects/:projectId/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/projects/:projectId/messages/:messageId/read', auth, async (req, res) => {
  try {
    const { projectId, messageId } = req.params;

    // Verify user has access to project
    const project = await Project.findOne({
      _id: projectId,
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

    // Find the message and mark as read
    const message = project.communication.id(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Check if already read by this user
    const alreadyRead = message.readBy.some(read => 
      read.user.toString() === req.userId.toString()
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: req.userId,
        readAt: new Date()
      });
      await project.save();
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message read error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chat/conversations
// @desc    Get user's active conversations
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.userId },
        { assignedDeveloper: req.userId }
      ],
      status: { $in: ['prototype', 'in-development', 'testing'] }
    })
      .populate('owner assignedDeveloper', 'name email avatar')
      .select('title status owner assignedDeveloper communication')
      .sort({ updatedAt: -1 });

    // Get last message and unread count for each project
    const conversations = projects.map(project => {
      const messages = project.communication.filter(msg => msg.type === 'message');
      const lastMessage = messages[messages.length - 1];
      
      const unreadCount = messages.filter(msg => {
        return !msg.readBy.some(read => 
          read.user.toString() === req.userId.toString()
        );
      }).length;

      return {
        projectId: project._id,
        title: project.title,
        status: project.status,
        owner: project.owner,
        assignedDeveloper: project.assignedDeveloper,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          author: lastMessage.author,
          timestamp: lastMessage.timestamp
        } : null,
        unreadCount
      };
    });

    res.json({
      success: true,
      data: { conversations }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chat/projects/:projectId/typing
// @desc    Send typing indicator
// @access  Private
router.post('/projects/:projectId/typing', auth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { isTyping } = req.body;

    // Verify user has access to project
    const project = await Project.findOne({
      _id: projectId,
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

    // Emit typing indicator
    const io = req.app.get('io');
    io.to(`project-${projectId}`).emit('typing', {
      userId: req.userId,
      userName: req.user.name,
      isTyping
    });

    res.json({
      success: true,
      message: 'Typing indicator sent'
    });
  } catch (error) {
    console.error('Typing indicator error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

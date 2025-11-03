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

export default async function handler(req, res) {
  await connectDB();
  const { method, url } = req;

  try {
    const user = await authenticate(req);

    // Parse URL to extract path and params
    const urlParts = url.split('/').filter(p => p);
    const path = '/' + urlParts.slice(1).join('/'); // Remove 'api' prefix

    // GET /api/chat/projects/:projectId/messages
    if (method === 'GET' && path.match(/^\/projects\/[^\/]+\/messages$/)) {
      const projectId = path.split('/')[2];
      const { page = 1, limit = 50 } = req.query;

      // Verify user has access to project
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: user._id },
          { assignedDeveloper: user._id }
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

      return res.json({
        success: true,
        data: {
          messages: populatedMessages,
          pagination: {
            current: parseInt(page),
            hasMore: project.communication.filter(msg => msg.type === 'message').length > page * limit
          }
        }
      });
    }

    // POST /api/chat/projects/:projectId/messages
    if (method === 'POST' && path.match(/^\/projects\/[^\/]+\/messages$/)) {
      const projectId = path.split('/')[2];

      const validate = [
        body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Message must be 1-2000 characters')
      ];
      for (const rule of validate) { await rule.run(req); }
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      }

      const { content, attachments = [] } = req.body;

      // Verify user has access to project
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: user._id },
          { assignedDeveloper: user._id }
        ]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found or access denied' });
      }

      // Add message to project
      await project.addCommunication('message', content, user._id, attachments);

      return res.json({
        success: true,
        message: 'Message sent successfully'
      });
    }

    // PUT /api/chat/projects/:projectId/messages/:messageId/read
    if (method === 'PUT' && path.match(/^\/projects\/[^\/]+\/messages\/[^\/]+\/read$/)) {
      const parts = path.split('/');
      const projectId = parts[2];
      const messageId = parts[4];

      // Verify user has access to project
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: user._id },
          { assignedDeveloper: user._id }
        ]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found or access denied' });
      }

      // Find the message and mark as read
      const message = project.communication.id(messageId);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      // Check if already read by this user
      const alreadyRead = message.readBy.some(read =>
        read.user.toString() === user._id.toString()
      );

      if (!alreadyRead) {
        message.readBy.push({
          user: user._id,
          readAt: new Date()
        });
        await project.save();
      }

      return res.json({
        success: true,
        message: 'Message marked as read'
      });
    }

    // GET /api/chat/conversations
    if (method === 'GET' && path === '/conversations') {
      const projects = await Project.find({
        $or: [
          { owner: user._id },
          { assignedDeveloper: user._id }
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
            read.user.toString() === user._id.toString()
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

      return res.json({
        success: true,
        data: { conversations }
      });
    }

    // POST /api/chat/projects/:projectId/typing
    if (method === 'POST' && path.match(/^\/projects\/[^\/]+\/typing$/)) {
      const projectId = path.split('/')[2];
      const { isTyping } = req.body;

      // Verify user has access to project
      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: user._id },
          { assignedDeveloper: user._id }
        ]
      });

      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found or access denied' });
      }

      return res.json({
        success: true,
        message: 'Typing indicator sent'
      });
    }

    // Default: Not found
    return res.status(404).json({ success: false, message: 'Route not found' });

  } catch (error) {
    console.error('Chat API error:', error);
    if (error.message.includes('not valid') || error.message.includes('not found')) {
      return res.status(401).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

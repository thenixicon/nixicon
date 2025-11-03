import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Project from '../../models/Project';
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
  return decoded.userId;
};

const validate = [
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be 10-1000 characters'),
  body('category').isIn(['mobile-app', 'web-app', 'website', 'automation', 'ai-tool', 'other']).withMessage('Invalid category')
];

export default async function handler(req, res) {
  await connectDB();
  try {
    const userId = await authenticate(req);
    if (req.method === 'GET') {
      const { status, category, page = 1, limit = 10 } = req.query;
      const filter = { owner: userId };
      if (status) filter.status = status;
      if (category) filter.category = category;
      const projects = await Project.find(filter)
        .populate('assignedDeveloper', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));
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
    } else if (req.method === 'POST') {
      for (const rule of validate) {
        await rule.run(req);
      }
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
        owner: userId
      };
      const project = new Project(projectData);
      await project.save();
      // Add initial communication (if method exists)
      if (typeof project.addCommunication === 'function') {
        await project.addCommunication(
          'status-update',
          'Project created successfully',
          userId
        );
      }
      return res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: { project }
      });
    } else {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
}

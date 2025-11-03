import mongoose from 'mongoose';
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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  await connectDB();
  try {
    const userId = await authenticate(req);
    const { id } = req.query;
    const project = await Project.findOne({
      _id: id,
      $or: [
        { owner: userId },
        { assignedDeveloper: userId }
      ]
    }).populate('owner assignedDeveloper', 'name email avatar role');
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    return res.json({ success: true, data: { project } });
  } catch (error) {
    return res.status(401).json({ success: false, message: error.message });
  }
}

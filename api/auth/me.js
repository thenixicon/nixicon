import mongoose from 'mongoose';
import User from '../../models/User';
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
  try {
    await connectDB();
    const userId = await authenticate(req);
    const user = await User.findById(userId).select('-password');
    res.json({ success: true, data: { user } });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
}

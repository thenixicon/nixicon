import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
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

const validate = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('phone').optional().isMobilePhone(),
  body('country').optional().isLength({ min: 2, max: 50 })
];

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    await connectDB();
    const userId = await authenticate(req);
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
    const { name, phone, country, preferences } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (country) updateData.country = country;
    if (preferences) updateData.preferences = preferences;
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');
    res.json({ success: true, message: 'Profile updated successfully', data: { user } });
  } catch (error) {
    res.status(401).json({ success: false, message: error.message });
  }
}

import mongoose from 'mongoose';
import 'dotenv/config';

export const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ MongoDB connected');
};

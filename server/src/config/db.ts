import mongoose from 'mongoose';
import { env } from './env.js';

export async function connectDB(uri = env.MONGO_URI) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  if (env.NODE_ENV !== 'test') console.log(`MongoDB connected → ${mongoose.connection.name}`);
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

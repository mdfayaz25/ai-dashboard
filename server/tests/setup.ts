import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { connectDB } from '../src/config/db.js';

const uri = process.env.MONGO_URI_TEST ?? 'mongodb://127.0.0.1:27017/ai_dashboard_test';

beforeAll(async () => {
  await connectDB(uri);
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase().catch(() => undefined);
  await mongoose.disconnect();
});

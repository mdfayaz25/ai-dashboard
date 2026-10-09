import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/ai_dashboard'),
  JWT_SECRET: z.string().min(16).default('change-me-in-production-please'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  ANTHROPIC_API_KEY: z.string().optional(),
  BEDROCK_ENABLED: z.enum(['true', 'false']).default('false'),
  AWS_REGION: z.string().default('us-east-1'),
  BEDROCK_MODELS: z.string().default('amazon.nova-pro-v1:0,amazon.nova-lite-v1:0,meta.llama3-1-70b-instruct-v1:0'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

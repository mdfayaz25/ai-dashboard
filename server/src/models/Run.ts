import { Schema, model } from 'mongoose';

const runSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    prompt: { type: Schema.Types.ObjectId, ref: 'Prompt' },
    promptTitle: String,
    provider: { type: String, enum: ['anthropic', 'bedrock', 'demo'], required: true },
    model: { type: String, required: true },
    system: { type: String, default: '' },
    input: { type: String, required: true },
    output: { type: String, default: '' },
    temperature: Number,
    maxTokens: Number,
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    latencyMs: { type: Number, default: 0 },
    ttftMs: Number,
    stopReason: String,
    status: { type: String, enum: ['success', 'error', 'cancelled'], required: true },
    error: String,
    rating: { type: Number, enum: [-1, 0, 1], default: 0 },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

runSchema.index({ user: 1, createdAt: -1 });

export const Run = model('Run', runSchema);

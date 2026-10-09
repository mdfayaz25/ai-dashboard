import { Schema, model } from 'mongoose';

export const extractVariables = (template: string) => [...new Set([...template.matchAll(/\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g)].map((m) => m[1]))];

const promptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 280, default: '' },
    system: { type: String, maxlength: 8000, default: '' },
    template: { type: String, required: true, maxlength: 20000 },
    variables: [{ type: String }],
    tags: [{ type: String, trim: true, lowercase: true, maxlength: 24 }],
    favorite: { type: Boolean, default: false },
    provider: { type: String, enum: ['anthropic', 'bedrock', 'demo'], default: 'anthropic' },
    model: { type: String, default: 'claude-sonnet-5-5' },
    temperature: { type: Number, min: 0, max: 1, default: 0.7 },
    maxTokens: { type: Number, min: 16, max: 8192, default: 1024 },
    runCount: { type: Number, default: 0 },
    lastRunAt: Date,
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

promptSchema.pre('validate', function setVariables(next) {
  this.variables = extractVariables(this.template);
  next();
});

export const Prompt = model('Prompt', promptSchema);

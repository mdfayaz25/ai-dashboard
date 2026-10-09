import { Router } from 'express';
import { z } from 'zod';
import { Prompt } from '../models/Prompt.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';

const router = Router();
router.use(requireAuth);

const body = z.object({
  title: z.string().trim().min(2, 'Give the prompt a title').max(80),
  description: z.string().trim().max(280).optional(),
  system: z.string().max(8000).optional(),
  template: z.string().trim().min(1, 'The prompt template is empty').max(20000),
  tags: z.array(z.string().trim().toLowerCase().min(1).max(24)).max(8).optional(),
  provider: z.enum(['anthropic', 'bedrock', 'demo']).optional(),
  model: z.string().max(120).optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().int().min(16).max(8192).optional(),
  favorite: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const prompts = await Prompt.find({ user: req.user!.id }).sort({ favorite: -1, updatedAt: -1 });
    res.json({ prompts });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const prompt = await Prompt.findOne({ _id: req.params.id, user: req.user!.id });
    if (!prompt) throw AppError.notFound('Prompt not found');
    res.json({ prompt });
  }),
);

router.post(
  '/',
  validate({ body }),
  asyncHandler(async (req, res) => {
    const prompt = await Prompt.create({ ...req.body, user: req.user!.id });
    res.status(201).json({ prompt });
  }),
);

router.patch(
  '/:id',
  validate({ body: body.partial() }),
  asyncHandler(async (req, res) => {
    const prompt = await Prompt.findOne({ _id: req.params.id, user: req.user!.id });
    if (!prompt) throw AppError.notFound('Prompt not found');
    Object.assign(prompt, req.body);
    await prompt.save();
    res.json({ prompt });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const prompt = await Prompt.findOneAndDelete({ _id: req.params.id, user: req.user!.id });
    if (!prompt) throw AppError.notFound('Prompt not found');
    res.status(204).end();
  }),
);

export default router;

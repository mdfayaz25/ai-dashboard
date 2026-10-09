import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { signToken } from '../lib/jwt.js';

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
});

router.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const exists = await User.exists({ email: req.body.email });
    if (exists) throw AppError.conflict('An account with this email already exists');
    const user = await User.create(req.body);
    res.status(201).json({ user, token: signToken({ sub: user.id, role: user.role }) });
  }),
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email }).select('+password');
    if (!user || !(await user.comparePassword(req.body.password))) {
      throw AppError.unauthorized('Incorrect email or password');
    }
    res.json({ user, token: signToken({ sub: user.id, role: user.role }) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw AppError.unauthorized();
    res.json({ user });
  }),
);

router.patch(
  '/me',
  requireAuth,
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true, runValidators: true });
    res.json({ user });
  }),
);

export default router;

import { Router } from 'express';
import authRoutes from './auth.routes.js';
import runRoutes from './run.routes.js';
import promptRoutes from './prompt.routes.js';
import analyticsRoutes from './analytics.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/prompts', promptRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/', runRoutes);

import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleGetMonthlyStats } from '../controllers/handle-get-monthly-stats.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/monthly', wrapHandler(handleGetMonthlyStats));

export default router;

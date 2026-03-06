import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListUsers } from '../controllers/handle-list-users.js';
import { handleListDebugMessages } from '../controllers/handle-list-debug-messages.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/users', wrapHandler(handleListUsers));
router.get('/users/:userId/messages', wrapHandler(handleListDebugMessages));

export default router;

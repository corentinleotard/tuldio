import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListMessages } from '../controllers/handle-list-messages.js';
import { handleSendMessage } from '../controllers/handle-send-message.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.get('/', wrapHandler(handleListMessages));
router.post('/', wrapHandler(handleSendMessage));

export default router;

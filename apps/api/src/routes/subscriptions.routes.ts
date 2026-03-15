import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleCreateCheckout } from '../controllers/handle-create-checkout.js';
import { handleCreatePortal } from '../controllers/handle-create-portal.js';

const router: RouterType = Router();

router.use(authMiddleware);

router.post('/checkout', wrapHandler(handleCreateCheckout));
router.post('/portal', wrapHandler(handleCreatePortal));

export default router;

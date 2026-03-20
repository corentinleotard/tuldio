import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { handleStripeWebhookController } from '../controllers/handle-stripe-webhook.js';
import { handlePdpWebhook } from '../controllers/handle-pdp-webhook.js';

const router: RouterType = Router();

router.post('/stripe', wrapHandler(handleStripeWebhookController));
router.post('/pdp', wrapHandler(handlePdpWebhook));

export default router;

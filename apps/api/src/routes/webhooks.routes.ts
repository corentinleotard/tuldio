import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { handleStripeWebhookController } from '../controllers/handle-stripe-webhook.js';

const router: RouterType = Router();

router.post('/stripe', wrapHandler(handleStripeWebhookController));

export default router;

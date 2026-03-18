import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireGod } from '../middleware/require-god.js';
import { handleListProspects } from '../controllers/god-prospection/handle-list-prospects.js';
import { handleSendBatch } from '../controllers/god-prospection/handle-send-batch.js';
import { handleSendTest } from '../controllers/god-prospection/handle-send-test.js';
import { handleBatchStatus } from '../controllers/god-prospection/handle-batch-status.js';
import { handleCancelBatch } from '../controllers/god-prospection/handle-cancel-batch.js';
import { handleListSent } from '../controllers/god-prospection/handle-list-sent.js';
import { handleListReceived } from '../controllers/god-prospection/handle-list-received.js';
import { handleReply } from '../controllers/god-prospection/handle-reply.js';
import { handleReport } from '../controllers/god-prospection/handle-report.js';
import { handleSendQueue } from '../controllers/god-prospection/handle-send-queue.js';

const router: RouterType = Router();

router.use(authMiddleware);
router.use(requireGod);

router.get('/prospects', wrapHandler(handleListProspects));
router.post('/send', wrapHandler(handleSendBatch));
router.post('/send-test', wrapHandler(handleSendTest));
router.get('/batch-status', wrapHandler(handleBatchStatus));
router.post('/cancel', wrapHandler(handleCancelBatch));
router.get('/sent', wrapHandler(handleListSent));
router.get('/received', wrapHandler(handleListReceived));
router.post('/reply', wrapHandler(handleReply));
router.get('/report', wrapHandler(handleReport));
router.get('/send-queue', wrapHandler(handleSendQueue));

export default router;

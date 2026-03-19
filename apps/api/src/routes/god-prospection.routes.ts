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
import { handleListSequences } from '../controllers/god-prospection/handle-list-sequences.js';
import { handleCreateSequence } from '../controllers/god-prospection/handle-create-sequence.js';
import { handleUpdateSequence } from '../controllers/god-prospection/handle-update-sequence.js';
import { handleDeleteSequence } from '../controllers/god-prospection/handle-delete-sequence.js';
import { handleAssignToSequence } from '../controllers/god-prospection/handle-assign-to-sequence.js';
import { handleSequenceReport } from '../controllers/god-prospection/handle-sequence-report.js';
import { handleGetChannelLimits } from '../controllers/god-prospection/handle-get-channel-limits.js';
import { handleUpdateChannelLimit } from '../controllers/god-prospection/handle-update-channel-limit.js';
import { handleSetupWhatsApp } from '../controllers/god-prospection/handle-setup-whatsapp.js';
import { handleGetWhatsAppStatus } from '../controllers/god-prospection/handle-get-whatsapp-status.js';
import { handlePauseProspect } from '../controllers/god-prospection/handle-pause-prospect.js';
import { handleSequenceProspects } from '../controllers/god-prospection/handle-sequence-prospects.js';
import { handleSendTestWhatsApp } from '../controllers/god-prospection/handle-send-test-whatsapp.js';
import { handleListReceivedMessages } from '../controllers/god-prospection/handle-list-received-messages.js';
import { handleGetProspect } from '../controllers/god-prospection/handle-get-prospect.js';
import { handleUpdateProspect } from '../controllers/god-prospection/handle-update-prospect.js';
import { handleRecentSends } from '../controllers/god-prospection/handle-recent-sends.js';
import { handleUpcomingSends } from '../controllers/god-prospection/handle-upcoming-sends.js';

const router: RouterType = Router();

router.use(authMiddleware);
router.use(requireGod);

// Existing routes
router.get('/prospects', wrapHandler(handleListProspects));
router.post('/send', wrapHandler(handleSendBatch));
router.post('/send-test', wrapHandler(handleSendTest));
router.get('/batch-status', wrapHandler(handleBatchStatus));
router.post('/cancel', wrapHandler(handleCancelBatch));
router.get('/sent', wrapHandler(handleListSent));
router.get('/sends', wrapHandler(handleRecentSends));
router.get('/upcoming', wrapHandler(handleUpcomingSends));
router.get('/received', wrapHandler(handleListReceived));
router.get('/received-messages', wrapHandler(handleListReceivedMessages));
router.post('/reply', wrapHandler(handleReply));
router.get('/report', wrapHandler(handleReport));
router.get('/send-queue', wrapHandler(handleSendQueue));

// Sequences
router.get('/sequences', wrapHandler(handleListSequences));
router.post('/sequences', wrapHandler(handleCreateSequence));
router.post('/sequences/assign', wrapHandler(handleAssignToSequence));
router.get('/sequences/:id/report', wrapHandler(handleSequenceReport));
router.get('/sequences/:id/prospects', wrapHandler(handleSequenceProspects));
router.put('/sequences/:id', wrapHandler(handleUpdateSequence));
router.delete('/sequences/:id', wrapHandler(handleDeleteSequence));

// Prospect management
router.get('/prospects/:id', wrapHandler(handleGetProspect));
router.put('/prospects/:id', wrapHandler(handleUpdateProspect));
router.put('/prospects/:id/pause', wrapHandler(handlePauseProspect));

// Channel limits
router.get('/channel-limits', wrapHandler(handleGetChannelLimits));
router.put('/channel-limits/:channel', wrapHandler(handleUpdateChannelLimit));

// WhatsApp
router.post('/whatsapp/setup', wrapHandler(handleSetupWhatsApp));
router.get('/whatsapp/status', wrapHandler(handleGetWhatsAppStatus));
router.post('/whatsapp/send-test', wrapHandler(handleSendTestWhatsApp));

export default router;

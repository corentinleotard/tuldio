import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListQuotes } from '../controllers/handle-list-quotes.js';
import { handleGetQuote } from '../controllers/handle-get-quote.js';
import { handleCreateQuote } from '../controllers/handle-create-quote.js';
import { handleUpdateQuoteStatus } from '../controllers/handle-update-quote-status.js';
import { handleDownloadQuotePdf } from '../controllers/handle-download-quote-pdf.js';
import { handleSendQuoteEmail } from '../controllers/handle-send-quote-email.js';
import { handleGetDocumentLogs } from '../controllers/handle-get-document-logs.js';
import { handleDeleteQuote } from '../controllers/handle-delete-quote.js';

const router: RouterType = Router();

router.get('/', authMiddleware, wrapHandler(handleListQuotes));
router.get('/:id', authMiddleware, wrapHandler(handleGetQuote));
router.get('/:id/pdf', authMiddleware, wrapHandler(handleDownloadQuotePdf));
router.get('/:id/logs', authMiddleware, wrapHandler((req, res) => handleGetDocumentLogs('quote', req, res)));
router.post('/', authMiddleware, wrapHandler(handleCreateQuote));
router.post('/:id/send-email', authMiddleware, wrapHandler(handleSendQuoteEmail));
router.put('/:id/status', authMiddleware, wrapHandler(handleUpdateQuoteStatus));
router.delete('/:id', authMiddleware, wrapHandler(handleDeleteQuote));

export default router;

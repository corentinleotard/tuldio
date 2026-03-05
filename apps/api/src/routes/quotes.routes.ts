import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListQuotes } from '../controllers/handle-list-quotes.js';
import { handleGetQuote } from '../controllers/handle-get-quote.js';
import { handleCreateQuote } from '../controllers/handle-create-quote.js';
import { handleUpdateQuoteStatus } from '../controllers/handle-update-quote-status.js';
import { handleDownloadQuotePdf } from '../controllers/handle-download-quote-pdf.js';

const router: RouterType = Router();

router.get('/', authMiddleware, wrapHandler(handleListQuotes));
router.get('/:id', authMiddleware, wrapHandler(handleGetQuote));
router.get('/:id/pdf', authMiddleware, wrapHandler(handleDownloadQuotePdf));
router.post('/', authMiddleware, wrapHandler(handleCreateQuote));
router.put('/:id/status', authMiddleware, wrapHandler(handleUpdateQuoteStatus));

export default router;

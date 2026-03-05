import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListInvoices } from '../controllers/handle-list-invoices.js';
import { handleGetInvoice } from '../controllers/handle-get-invoice.js';
import { handleCreateInvoice } from '../controllers/handle-create-invoice.js';
import { handleCreateInvoiceFromQuote } from '../controllers/handle-create-invoice-from-quote.js';
import { handleMarkAsPaid } from '../controllers/handle-mark-as-paid.js';
import { handleDownloadInvoicePdf } from '../controllers/handle-download-invoice-pdf.js';

const router: RouterType = Router();

router.get('/', authMiddleware, wrapHandler(handleListInvoices));
router.get('/:id', authMiddleware, wrapHandler(handleGetInvoice));
router.get('/:id/pdf', authMiddleware, wrapHandler(handleDownloadInvoicePdf));
router.post('/', authMiddleware, wrapHandler(handleCreateInvoice));
router.post('/from-quote', authMiddleware, wrapHandler(handleCreateInvoiceFromQuote));
router.put('/:id/paid', authMiddleware, wrapHandler(handleMarkAsPaid));

export default router;

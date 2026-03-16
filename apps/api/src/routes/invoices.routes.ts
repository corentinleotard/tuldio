import { type Router as RouterType, Router } from 'express';
import { wrapHandler } from '../lib/wrap-handler.js';
import { authMiddleware } from '../middleware/auth.js';
import { handleListInvoices } from '../controllers/handle-list-invoices.js';
import { handleGetInvoice } from '../controllers/handle-get-invoice.js';
import { handleCreateInvoice } from '../controllers/handle-create-invoice.js';
import { handleCreateInvoiceFromQuote } from '../controllers/handle-create-invoice-from-quote.js';
import { handleMarkAsPaid } from '../controllers/handle-mark-as-paid.js';
import { handleUpdateInvoice } from '../controllers/handle-update-invoice.js';
import { handleUpdateInvoiceStatus } from '../controllers/handle-update-invoice-status.js';
import { handleDownloadInvoicePdf } from '../controllers/handle-download-invoice-pdf.js';
import { handleSendInvoiceEmail } from '../controllers/handle-send-invoice-email.js';
import { handleGetDocumentLogs } from '../controllers/handle-get-document-logs.js';
import { handleDeleteInvoice } from '../controllers/handle-delete-invoice.js';

const router: RouterType = Router();

router.get('/', authMiddleware, wrapHandler(handleListInvoices));
router.get('/:id', authMiddleware, wrapHandler(handleGetInvoice));
router.get('/:id/pdf', authMiddleware, wrapHandler(handleDownloadInvoicePdf));
router.get('/:id/logs', authMiddleware, wrapHandler((req, res) => handleGetDocumentLogs('invoice', req, res)));
router.post('/', authMiddleware, wrapHandler(handleCreateInvoice));
router.post('/from-quote', authMiddleware, wrapHandler(handleCreateInvoiceFromQuote));
router.post('/:id/send-email', authMiddleware, wrapHandler(handleSendInvoiceEmail));
router.put('/:id', authMiddleware, wrapHandler(handleUpdateInvoice));
router.put('/:id/status', authMiddleware, wrapHandler(handleUpdateInvoiceStatus));
router.put('/:id/paid', authMiddleware, wrapHandler(handleMarkAsPaid));
router.delete('/:id', authMiddleware, wrapHandler(handleDeleteInvoice));

export default router;

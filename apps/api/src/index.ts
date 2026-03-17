import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb, logger } from '@tuldio/core/lib';
import { errorHandler } from './middleware/error-handler.js';
import { defaultLimiter } from './lib/rate-limit.js';
import { requestLogger } from './lib/request-logger.js';
import { authMiddleware } from './middleware/auth.js';
import { checkSubscription } from './middleware/check-subscription.js';
import authRoutes from './routes/auth.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import statsRoutes from './routes/stats.routes.js';
import quotesRoutes from './routes/quotes.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';
import adminRoutes from './routes/admin.routes.js';
import subscriptionsRoutes from './routes/subscriptions.routes.js';
import webhooksRoutes from './routes/webhooks.routes.js';
import { wrapHandler } from './lib/wrap-handler.js';
import { handlePublicDownload } from './controllers/handle-public-download.js';
import godProspectionRoutes from './routes/god-prospection.routes.js';

const PORT = process.env.PORT || 3003;

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5174'],
    credentials: true,
  }),
);

// Webhook route MUST be before express.json() — Stripe needs raw body
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhooksRoutes);

app.use(express.json());
app.use(cookieParser());
app.use(defaultLimiter);
app.use(requestLogger);

// Public routes
app.use('/api/auth', authRoutes);

// Public document download (no auth, token-based)
app.get('/api/d/:token', wrapHandler(handlePublicDownload));

// Protected routes (no subscription check)
app.use('/api/teams', teamsRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/admin', adminRoutes);

// Protected routes (with subscription check on writes)
app.use('/api/clients', authMiddleware, checkSubscription, clientsRoutes);
app.use('/api/messages', authMiddleware, checkSubscription, messagesRoutes);
app.use('/api/stats', authMiddleware, checkSubscription, statsRoutes);
app.use('/api/quotes', authMiddleware, checkSubscription, quotesRoutes);
app.use('/api/invoices', authMiddleware, checkSubscription, invoicesRoutes);

// God mode — dev only
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/god-prospection', godProspectionRoutes);
}

// Static files
const FILES_DIR = process.env.FILES_DIR || '/var/tuldio/files';
app.use('/files', express.static(FILES_DIR));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ data: { ok: true } });
});

app.use(errorHandler);

connectDb().then(() => {
  app.listen(PORT, () => {
    logger.info(`API running on http://localhost:${PORT}`);
  });
});

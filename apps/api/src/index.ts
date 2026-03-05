import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { connectDb, logger } from '@tuldio/core/lib';
import { errorHandler } from './middleware/error-handler.js';
import { defaultLimiter } from './lib/rate-limit.js';
import { requestLogger } from './lib/request-logger.js';
import authRoutes from './routes/auth.routes.js';
import clientsRoutes from './routes/clients.routes.js';
import teamsRoutes from './routes/teams.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import statsRoutes from './routes/stats.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import quotesRoutes from './routes/quotes.routes.js';
import invoicesRoutes from './routes/invoices.routes.js';

const PORT = process.env.PORT || 3002;

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(defaultLimiter);
app.use(requestLogger);

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/clients', clientsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/invoices', invoicesRoutes);

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

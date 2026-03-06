import rateLimit from 'express-rate-limit';

export const defaultLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (_req, res) => (res as { locals: { userId?: string } }).locals.userId ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Trop de messages, réessayez dans une minute' } },
});

export const otpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email ?? req.ip ?? 'unknown',
  message: { error: true, code: 'RATE_LIMITED', message: 'Trop de tentatives, réessayez dans une minute' },
});

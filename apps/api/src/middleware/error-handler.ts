import type { Request, Response, NextFunction } from 'express';
import { HandledError, logger } from '@tuldio/core/lib';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HandledError) {
    logger.warn(err.message, { code: err.code, statusCode: err.statusCode });
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error(err.message, { stack: err.stack });
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Une erreur est survenue' },
  });
}

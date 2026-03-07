import type { Request, Response, NextFunction } from 'express';
import { logger } from '@tuldio/core/lib';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    logger.info(`${req.method} ${route} ${res.statusCode} ${duration}ms`);
  });

  next();
}

import cron from 'node-cron';
import { logger } from '@tuldio/core/lib';

const running = new Set<string>();

export function schedule(input: { name: string; expression: string; fn: () => Promise<void> }) {
  cron.schedule(input.expression, async () => {
    if (running.has(input.name)) {
      logger.debug(`[cron:${input.name}] Skipping — previous tick still running`);
      return;
    }
    running.add(input.name);
    try {
      await input.fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[cron:${input.name}] ${message}`);
    } finally {
      running.delete(input.name);
    }
  });

  logger.info(`Scheduled: ${input.name} (${input.expression})`);
}

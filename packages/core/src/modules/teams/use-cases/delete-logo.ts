import fs from 'node:fs';
import path from 'node:path';
import { updateTeamMeta } from '../repository/update-team.js';
import { logger } from '../../../lib/infra/logger.js';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

export async function deleteLogo(input: {
  teamId: string;
}): Promise<void> {
  const filePath = path.join(FILES_DIR, 'logos', `${input.teamId}.png`);

  try {
    await fs.promises.unlink(filePath);
  } catch {
    // File may not exist
  }

  await updateTeamMeta({ teamId: input.teamId, logoUrl: '' });

  logger.info('Logo deleted', { teamId: input.teamId });
}

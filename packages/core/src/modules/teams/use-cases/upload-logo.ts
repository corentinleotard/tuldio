import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { updateTeamMeta } from '../repository/update-team.js';
import { logger } from '../../../lib/infra/logger.js';

const FILES_DIR = process.env.FILES_DIR ?? '/var/tuldio/files';

export async function uploadLogo(input: {
  teamId: string;
  filePath: string;
}): Promise<string> {
  const logoDir = path.join(FILES_DIR, 'logos');
  await fs.promises.mkdir(logoDir, { recursive: true });

  // Resize/optimize with sharp
  const fileName = `${input.teamId}.png`;
  const destPath = path.join(logoDir, fileName);

  await sharp(input.filePath)
    .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toFile(destPath);

  const logoUrl = `/files/logos/${fileName}`;
  await updateTeamMeta({ teamId: input.teamId, logoUrl });

  logger.info('Logo uploaded', { teamId: input.teamId });

  return logoUrl;
}

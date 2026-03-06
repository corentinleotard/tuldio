import type { Request, Response } from 'express';
import { uploadLogo } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleUploadLogo(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Un fichier est requis' } });
    return;
  }

  const teamId = getTeamId(res);
  const logoUrl = await uploadLogo({ teamId, filePath: file.path });

  res.json({ data: { logoUrl } });
}

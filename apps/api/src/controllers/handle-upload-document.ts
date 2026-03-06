import type { Request, Response } from 'express';
import { processTeamDocument } from '@tuldio/core/teams';
import { getTeamId } from '../middleware/auth.js';

export async function handleUploadDocument(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Un fichier est requis' } });
    return;
  }

  const teamId = getTeamId(res);
  const documentUrl = `/files/documents/${file.filename}`;

  const team = await processTeamDocument({
    teamId,
    filePath: file.path,
    mimeType: file.mimetype,
    documentUrl,
  });

  res.json({ data: team });
}

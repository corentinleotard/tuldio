import fs from 'node:fs';
import type { Request, Response } from 'express';
import { createTemplate } from '@tuldio/core/templates';
import { storeFile } from '@tuldio/core/lib';
import { getTeamId } from '../middleware/auth.js';

export async function handleCreateTemplate(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const type = req.body.type as 'quote' | 'invoice';

  if (!type || !['quote', 'invoice'].includes(type)) {
    res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Type must be quote or invoice' } });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'A PDF or image file is required' } });
    return;
  }

  const fileBuffer = fs.readFileSync(req.file.path);
  const originalUrl = await storeFile({
    subdir: 'templates/originals',
    buffer: fileBuffer,
    extension: '.pdf',
  });

  // TODO: LLM extraction of CompanyProfile + LegalInfo will be added here
  const template = await createTemplate({
    teamId,
    type,
    layoutData: {},
    originalUrl,
  });

  res.status(201).json({ data: template });
}

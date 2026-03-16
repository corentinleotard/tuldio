import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import { transcribeAudio } from '@tuldio/core/voice';
import { getUserId, getTeamId } from '../middleware/auth.js';

export async function handleTranscribeAudio(req: Request, res: Response): Promise<void> {
  const userId = getUserId(res);
  const teamId = getTeamId(res);
  const filePath = req.file?.path;

  if (!filePath) {
    res.status(400).json({ error: { code: 'NO_AUDIO', message: 'Fichier audio requis' } });
    return;
  }

  try {
    const result = await transcribeAudio({ filePath, teamId, userId });

    res.status(200).json({ data: { text: result.text.trim() } });
  } catch {
    res.status(500).json({ error: { code: 'TRANSCRIPTION_FAILED', message: 'Erreur de transcription. Réessayez.' } });
  } finally {
    fs.unlink(filePath).catch(() => {});
  }
}

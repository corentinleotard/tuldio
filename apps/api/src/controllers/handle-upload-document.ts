import type { Request, Response } from 'express';

export async function handleUploadDocument(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: { code: 'FILE_REQUIRED', message: 'Un fichier est requis' } });
    return;
  }

  const originalDocumentUrl = `/files/documents/${file.filename}`;

  // TODO: trigger LLM extraction of company info from uploaded document
  // and update team fields with extracted data

  res.json({ data: { originalDocumentUrl } });
}

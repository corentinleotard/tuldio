import type { Request, Response } from 'express';
import { deleteSequenceUc } from '@tuldio/core/god-prospection';

export async function handleDeleteSequence(req: Request, res: Response): Promise<void> {
  const id = req.params.id as string;
  await deleteSequenceUc({ id });
  res.status(204).send();
}

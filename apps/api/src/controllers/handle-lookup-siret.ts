import type { Request, Response } from 'express';
import { lookupSiretUc } from '@tuldio/core/teams';

export async function handleLookupSiret(req: Request, res: Response): Promise<void> {
  const siret = req.params.siret as string;
  const data = await lookupSiretUc(siret);
  res.json({ data });
}

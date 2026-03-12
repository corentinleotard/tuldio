import type { Request, Response } from 'express';
import { getTeam } from '@tuldio/core/teams';
import { generatePreviewPdf } from '@tuldio/core/pdf';
import { getTeamId } from '../middleware/auth.js';

export async function handlePreviewPdf(req: Request, res: Response): Promise<void> {
  const teamId = getTeamId(res);
  const type = req.query.type === 'invoice' ? 'invoice' : 'quote';

  const team = await getTeam(teamId);
  const buffer = await generatePreviewPdf({
    type,
    team: { name: team.name, logoUrl: team.logoUrl ?? '', fields: team.fields },
  });

  const filename = type === 'quote' ? 'apercu-devis.pdf' : 'apercu-facture.pdf';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.end(buffer);
}

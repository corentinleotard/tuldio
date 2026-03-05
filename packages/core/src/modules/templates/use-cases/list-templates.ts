import { findTemplatesByTeam } from '../repository/find-templates-by-team.js';
import { toTemplateView, type TemplateView } from '../domain/template.view.js';

export async function listTemplates(teamId: string): Promise<TemplateView[]> {
  const rows = await findTemplatesByTeam(teamId);

  return rows.map(toTemplateView);
}

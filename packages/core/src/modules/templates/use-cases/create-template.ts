import { insertTemplate } from '../repository/insert-template.js';
import { toTemplateView, type TemplateView } from '../domain/template.view.js';

export async function createTemplate(input: {
  teamId: string;
  type: 'quote' | 'invoice';
  layoutData: unknown;
  originalUrl?: string;
}): Promise<TemplateView> {
  const template = await insertTemplate(input);

  return toTemplateView(template);
}

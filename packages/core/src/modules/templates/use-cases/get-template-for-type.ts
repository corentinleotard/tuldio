import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { findTemplateByType } from '../repository/find-template-by-type.js';
import { toTemplateView, type TemplateView } from '../domain/template.view.js';

export async function getTemplateForType(input: {
  teamId: string;
  type: 'quote' | 'invoice';
}): Promise<TemplateView> {
  const template = await findTemplateByType(input);

  if (!template) {
    throw new HandledError(errorCodes.templateNotFound);
  }

  return toTemplateView(template);
}

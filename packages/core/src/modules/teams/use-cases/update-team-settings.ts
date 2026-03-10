import { z } from 'zod';
import type { TeamSummary, UpdateTeamSettingsRequest, TeamField } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { updateTeamSettings as updateTeamSettingsRepo } from '../repository/update-team-settings.js';
import { refreshDraftDocuments } from '../repository/refresh-draft-documents.js';
import { findTeamFields } from '../repository/find-team-fields.js';
import { toTeamSummary } from '../domain/team.view.js';
import { toTeamField } from '../domain/team-field.view.js';

const updateTeamSettingsSchema = z.object({
  quoteLastNumber: z.number().int().min(0).optional(),
  quoteValidityDays: z.number().int().min(1).optional(),
  invoiceLastNumber: z.number().int().min(0).optional(),
  invoicePaymentDelayDays: z.number().int().min(1).optional(),
});

export async function updateTeamSettings(input: {
  teamId: string;
} & UpdateTeamSettingsRequest): Promise<TeamSummary> {
  const parsed = updateTeamSettingsSchema.safeParse({
    quoteLastNumber: input.quoteLastNumber,
    quoteValidityDays: input.quoteValidityDays,
    invoiceLastNumber: input.invoiceLastNumber,
    invoicePaymentDelayDays: input.invoicePaymentDelayDays,
  });

  if (!parsed.success) {
    throw new HandledError(errorCodes.invalidInput);
  }

  const row = await updateTeamSettingsRepo({
    teamId: input.teamId,
    ...parsed.data,
  });

  await refreshDraftDocuments({
    teamId: input.teamId,
    quoteValidityDays: parsed.data.quoteValidityDays,
    invoicePaymentDelayDays: parsed.data.invoicePaymentDelayDays,
  });

  const fieldRows = await findTeamFields(input.teamId);
  const fields: TeamField[] = fieldRows.map(toTeamField);

  return toTeamSummary(row, fields);
}

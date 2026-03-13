import type { InvoiceView, InvoiceType } from '@tuldio/types';
import { HandledError } from '../../../lib/errors/handled-error.js';
import { errorCodes } from '../../../lib/errors/error-codes.js';
import { logger } from '../../../lib/infra/logger.js';
import { canInvoiceQuote, shouldAutoAcceptQuote } from '../../quotes/domain/validators.js';
import { findQuoteById } from '../../quotes/repository/find-quote-by-id.js';
import { updateQuoteStatus } from '../../quotes/repository/update-quote-status.js';
import { findClientById } from '../../clients/repository/find-client-by-id.js';
import { getClientDisplayName } from '../../clients/domain/get-client-display-name.js';
import { findTeamById } from '../../teams/repository/find-team-by-id.js';
import { isFieldTrue } from '../../teams/domain/team-field.entity.js';
import { findTeamFieldByKey } from '../../teams/repository/find-team-field-by-key.js';
import { computeDueDate, buildAcompteLines, buildAcompteLinesByAmount, computeInvoiceTotals, buildSoldeLines } from '../domain/validators.js';
import { computeLineTotal, resolveTvaRate, groupByTva } from '../../documents/domain/document-math.js';
import { insertInvoice } from '../repository/insert-invoice.js';
import { findInvoiceById } from '../repository/find-invoice-by-id.js';
import { findInvoicesByQuote } from '../repository/find-invoices-by-quote.js';
import { toInvoiceView } from './create-invoice.js';

export async function createInvoiceFromQuote(input: {
  teamId: string;
  userId: string;
  quoteId: string;
  title?: string;
  prestationDate?: Date;
  invoiceType?: InvoiceType;
  depositPercent?: number;
  depositAmount?: number;
  depositBase?: 'total' | 'remaining';
}): Promise<InvoiceView> {
  const quote = await findQuoteById({
    teamId: input.teamId,
    quoteId: input.quoteId,
  });

  if (!quote) {
    throw new HandledError(errorCodes.quoteNotFound);
  }

  if (!canInvoiceQuote(quote.status)) {
    throw new HandledError(errorCodes.quoteNotInvoiceable);
  }

  if (shouldAutoAcceptQuote(quote.status)) {
    await updateQuoteStatus({
      teamId: input.teamId,
      quoteId: quote.id,
      status: 'accepted',
    });
    logger.info('quote.auto_accepted', { teamId: input.teamId, quoteId: quote.id });
  }

  const team = await findTeamById(input.teamId);

  let insertLines: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    tvaRate: number;
    totalHt: number;
    prestationId?: string | null;
  }>;
  let totalHt: number;
  let totalTtc: number;
  let resolvedInvoiceType: InvoiceType;

  if (input.invoiceType === 'acompte') {
    // Guard: sum of existing sent/paid acomptes + new acompte must be strictly less than quote total
    const existingAcomptes = await findInvoicesByQuote({
      teamId: input.teamId,
      quoteId: input.quoteId,
      invoiceType: 'acompte',
    });
    const existingAcomptesHt = existingAcomptes.reduce((sum, inv) => sum + inv.total_ht, 0);

    const tvaExemptField = await findTeamFieldByKey({ teamId: input.teamId, key: 'tva_exempt' });
    const tvaExempt = isFieldTrue(tvaExemptField);

    // Group quote lines by TVA rate to prorate acompte across all rates
    const quoteLinesForGrouping = quote.lines.map((l) => ({
      quantity: Number(l.quantity),
      unitPrice: l.unit_price,
      tvaRate: resolveTvaRate({ requestedRate: l.tva_rate, tvaExempt }),
    }));
    const tvaGroups = groupByTva(quoteLinesForGrouping);

    let acompteLinesList: Array<{ description: string; quantity: number; unit: string; unitPrice: number; tvaRate: number }>;

    if (input.depositAmount) {
      // Fixed amount: prorate across TVA groups
      acompteLinesList = buildAcompteLinesByAmount({
        quoteTitle: quote.title,
        amountHt: input.depositAmount,
        tvaGroups,
      });
    } else {
      // Percentage-based
      const percent = input.depositPercent ?? 30;
      const baseGroups = input.depositBase === 'remaining'
        ? tvaGroups.map((g) => ({
          ...g,
          baseHt: g.baseHt - Math.round(existingAcomptesHt * g.baseHt / quote.total_ht),
        }))
        : tvaGroups;

      acompteLinesList = buildAcompteLines({
        quoteTitle: quote.title,
        percentage: percent,
        tvaGroups: baseGroups,
      });
    }

    const newAcompteHt = acompteLinesList.reduce((sum, l) => sum + Math.round(l.unitPrice * l.quantity), 0);
    if (existingAcomptesHt + newAcompteHt >= quote.total_ht) {
      throw new HandledError(errorCodes.acompteExceedsQuote);
    }

    insertLines = acompteLinesList.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      tvaRate: l.tvaRate,
      totalHt: computeLineTotal({ quantity: l.quantity, unitPrice: l.unitPrice }),
    }));

    const totals = computeInvoiceTotals(insertLines);
    totalHt = totals.totalHt;
    totalTtc = totals.totalTtc;
    resolvedInvoiceType = 'acompte';
  } else {
    // Auto-decide: if acomptes exist → solde, otherwise → standard
    // Guard: only one non-cancelled non-draft solde/standard per quote
    const existingSoldes = await findInvoicesByQuote({
      teamId: input.teamId,
      quoteId: input.quoteId,
      invoiceType: 'solde',
    });
    const existingStandards = await findInvoicesByQuote({
      teamId: input.teamId,
      quoteId: input.quoteId,
      invoiceType: 'standard',
    });
    if (existingSoldes.length > 0 || existingStandards.length > 0) {
      throw new HandledError(errorCodes.soldeAlreadyExists);
    }

    const acompteInvoices = await findInvoicesByQuote({
      teamId: input.teamId,
      quoteId: input.quoteId,
      invoiceType: 'acompte',
    });

    if (acompteInvoices.length > 0) {
      // Solde: full quote lines minus deduction for each acompte
      const soldeLines = buildSoldeLines({
        quoteLines: quote.lines,
        acompteInvoices: acompteInvoices.map((inv) => ({
          number: inv.number,
          total_ht: inv.total_ht,
          lines: inv.lines,
        })),
      });

      insertLines = soldeLines.map((l) => ({
        ...l,
        totalHt: l.totalHt,
      }));

      const totals = computeInvoiceTotals(insertLines);
      totalHt = totals.totalHt;
      totalTtc = totals.totalTtc;
      resolvedInvoiceType = 'solde';
    } else {
      // Standard: copy quote lines directly (no acomptes exist)
      insertLines = quote.lines.map((l) => ({
        description: l.description,
        quantity: Number(l.quantity),
        unit: l.unit,
        unitPrice: l.unit_price,
        tvaRate: l.tva_rate,
        totalHt: l.total_ht,
        prestationId: l.prestation_id,
      }));
      totalHt = quote.total_ht;
      totalTtc = quote.total_ttc;
      resolvedInvoiceType = 'standard';
    }
  }

  const invoice = await insertInvoice({
    teamId: input.teamId,
    createdBy: input.userId,
    clientId: quote.client_id,
    quoteId: quote.id,
    title: input.title ?? quote.title,
    lastNumber: team?.invoice_last_number ?? 0,
    prestationDate: input.prestationDate ?? new Date(),
    lines: insertLines,
    totalHt,
    totalTtc,
    dueDate: computeDueDate({ createdAt: new Date(), delayDays: team?.invoice_payment_delay_days ?? 30 }),
    invoiceType: resolvedInvoiceType,
  });

  logger.info('invoice.created_from_quote', { teamId: input.teamId, invoiceId: invoice.id, quoteId: input.quoteId, number: invoice.number, invoiceType: resolvedInvoiceType });

  const client = await findClientById({ teamId: input.teamId, clientId: quote.client_id });
  const full = await findInvoiceById({ teamId: input.teamId, invoiceId: invoice.id });

  return toInvoiceView(full!, {
    clientName: client ? getClientDisplayName(client) : undefined,
    clientEmail: client?.email ?? undefined,
  });
}

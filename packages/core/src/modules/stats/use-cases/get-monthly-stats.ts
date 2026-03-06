import { getRevenueStats, type RevenueStats } from '../repository/get-revenue-stats.js';
import { getUnpaidStats, type UnpaidStats } from '../repository/get-unpaid-stats.js';
import {
  getQuoteConversionStats,
  type QuoteConversionStats,
} from '../repository/get-quote-conversion-stats.js';
import { getBestClient, type BestClientStats } from '../repository/get-best-client.js';

export interface MonthlyStatsView {
  revenue: RevenueStats;
  unpaid: UnpaidStats;
  quoteConversion: QuoteConversionStats;
  bestClient: BestClientStats | null;
}

export async function getMonthlyStats(input: {
  teamId: string;
  month: number;
  year: number;
}): Promise<MonthlyStatsView> {
  const startDate = new Date(input.year, input.month - 1, 1);
  const endDate = new Date(input.year, input.month, 0, 23, 59, 59, 999);

  const [revenue, unpaid, quoteConversion, bestClient] = await Promise.all([
    getRevenueStats({ teamId: input.teamId, startDate, endDate }),
    getUnpaidStats(input.teamId),
    getQuoteConversionStats({ teamId: input.teamId, startDate, endDate }),
    getBestClient({ teamId: input.teamId, startDate, endDate }),
  ]);

  return {
    revenue,
    unpaid,
    quoteConversion,
    bestClient,
  };
}

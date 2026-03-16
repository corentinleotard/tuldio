import type { MonthlyStatsView } from '@tuldio/common';
import { apiFetch } from '@/lib/api-fetch';

export async function fetchMonthlyStats(input: {
  month: number;
  year: number;
}): Promise<MonthlyStatsView> {
  return apiFetch<MonthlyStatsView>(`/api/stats/monthly?month=${input.month}&year=${input.year}`);
}

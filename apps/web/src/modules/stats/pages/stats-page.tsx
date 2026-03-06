import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Trophy,
  BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCurrency } from '@/lib/utils';
import { fetchMonthlyStats } from '../api/stats.api.js';
import { StatCard } from '../components/stat-card.js';
import { ConversionBar } from '../components/conversion-bar.js';

const FRENCH_MONTHS = [
  'Janvier',
  'Fevrier',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Aout',
  'Septembre',
  'Octobre',
  'Novembre',
  'Decembre',
];

export function StatsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats', month, year],
    queryFn: () => fetchMonthlyStats({ month, year }),
  });

  function goToPreviousMonth() {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  const hasData =
    stats &&
    (stats.revenue.count > 0 ||
      stats.quoteConversion.total > 0 ||
      stats.unpaid.count > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b px-4 py-4 md:px-5 md:pb-4 md:pt-5">
        <h1 className="text-[22px] font-bold tracking-tight text-primary">Statistiques</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            aria-label="Mois precedent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {FRENCH_MONTHS[month - 1]} {year}
          </span>
          <button
            type="button"
            onClick={goToNextMonth}
            className="rounded-full p-1.5 transition-colors hover:bg-secondary"
            aria-label="Mois suivant"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-4 pb-4 md:px-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}

        {!isLoading && !hasData && (
          <EmptyState
            icon={BarChart3}
            message="Pas encore de statistiques pour ce mois. Elles apparaitront quand vous aurez des documents."
          />
        )}

        {!isLoading && hasData && stats && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <StatCard
                icon={TrendingUp}
                label="CA encaissé"
                value={formatCurrency(stats.revenue.totalTtc)}
                subValue={`${stats.revenue.count} facture${stats.revenue.count > 1 ? 's' : ''} payée${stats.revenue.count > 1 ? 's' : ''}`}
                accentClassName="border-l-success"
              />
              <StatCard
                icon={Wallet}
                label="Impayé"
                value={formatCurrency(stats.unpaid.total)}
                subValue={`${stats.unpaid.count} facture${stats.unpaid.count > 1 ? 's' : ''} en attente`}
                accentClassName="border-l-warning"
              />
            </div>

            {stats.quoteConversion.total > 0 && (
              <ConversionBar
                total={stats.quoteConversion.total}
                accepted={stats.quoteConversion.accepted}
                rate={stats.quoteConversion.rate}
              />
            )}

            {stats.bestClient && (
              <Card className="border-l-[3px] border-l-primary">
                <CardContent className="flex items-start gap-4 p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase text-muted-foreground">
                      Meilleur client
                    </span>
                    <span className="text-2xl font-bold">{stats.bestClient.clientName}</span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(stats.bestClient.total)} ce mois
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

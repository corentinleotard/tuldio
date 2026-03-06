import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Cpu, Zap, Hash, Coins } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchAiCosts } from '../api/settings.api';

function formatCost(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 4,
  });
}

function formatNumber(n: number): string {
  return n.toLocaleString('fr-FR');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AiCostsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['ai-costs'],
    queryFn: fetchAiCosts,
  });

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Reglages
      </button>

      <h1 className="mb-6 text-[22px] font-bold tracking-tight text-primary">
        Consommation IA
      </h1>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SummaryCard
              icon={Coins}
              label="Cout total"
              value={formatCost(data.totalCostCents)}
            />
            <SummaryCard
              icon={Hash}
              label="Appels"
              value={formatNumber(data.totalCalls)}
            />
            <SummaryCard
              icon={Zap}
              label="Tokens entree"
              value={formatNumber(data.totalInputTokens)}
            />
            <SummaryCard
              icon={Cpu}
              label="Tokens sortie"
              value={formatNumber(data.totalOutputTokens)}
            />
          </div>

          {/* Calls table */}
          {data.calls.length === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center">
              <Cpu className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Aucun appel IA pour le moment.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium uppercase text-muted-foreground">
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Usage</th>
                      <th className="px-4 py-3">Modele</th>
                      <th className="px-4 py-3 text-right">Tokens</th>
                      <th className="px-4 py-3 text-right">Cout</th>
                      <th className="px-4 py-3 text-right">Duree</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.calls.map((call) => (
                      <tr
                        key={call.id}
                        className="border-b last:border-0 transition-colors hover:bg-secondary/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(call.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <PurposeBadge purpose={call.purpose} />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {call.model.replace('claude-', '')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          {formatNumber(call.inputTokens + call.outputTokens)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                          {formatCost(call.costCents)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {call.durationMs < 1000
                            ? `${call.durationMs}ms`
                            : `${(call.durationMs / 1000).toFixed(1)}s`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <props.icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{props.value}</p>
    </div>
  );
}

function PurposeBadge(props: { purpose: string }) {
  const labels: Record<string, string> = {
    chat: 'Chat',
    extraction: 'Extraction',
  };
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {labels[props.purpose] ?? props.purpose}
    </span>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AiCallView } from '@tuldio/types';
import { ArrowLeft, Cpu, Zap, Hash, Coins, Database, X, ChevronRight } from 'lucide-react';
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

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)} %`;
}

export function AiCostsPage() {
  const navigate = useNavigate();
  const [selectedCall, setSelectedCall] = useState<AiCallView | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['ai-costs'],
    queryFn: fetchAiCosts,
  });

  const totalAllInputTokens = data
    ? data.totalInputTokens + data.totalCacheReadTokens + data.totalCacheCreationTokens
    : 0;
  const cacheHitRate = totalAllInputTokens > 0
    ? data!.totalCacheReadTokens / totalAllInputTokens
    : 0;

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
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
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
            <SummaryCard
              icon={Database}
              label="Tokens caches (lus)"
              value={formatNumber(data.totalCacheReadTokens)}
            />
            <SummaryCard
              icon={Database}
              label="Taux de cache"
              value={formatPercent(cacheHitRate)}
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
                      <th className="px-4 py-3 text-right">Cache</th>
                      <th className="px-4 py-3 text-right">Cout</th>
                      <th className="px-4 py-3 text-right">Duree</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.calls.map((call) => (
                      <tr
                        key={call.id}
                        onClick={() => call.promptText ? setSelectedCall(call) : undefined}
                        className={`border-b last:border-0 transition-colors hover:bg-secondary/50 ${call.promptText ? 'cursor-pointer' : ''}`}
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
                          <span className="text-muted-foreground">{formatNumber(call.inputTokens)}</span>
                          {' / '}
                          <span>{formatNumber(call.outputTokens)}</span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                          <CacheBadge readTokens={call.cacheReadTokens} creationTokens={call.cacheCreationTokens} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">
                          {formatCost(call.costCents)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-muted-foreground tabular-nums">
                          {call.durationMs < 1000
                            ? `${call.durationMs}ms`
                            : `${(call.durationMs / 1000).toFixed(1)}s`}
                        </td>
                        <td className="px-2 py-3 text-muted-foreground">
                          {call.promptText && <ChevronRight className="h-4 w-4" />}
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

      {selectedCall && (
        <PromptDetailPanel call={selectedCall} onClose={() => setSelectedCall(null)} />
      )}
    </div>
  );
}

function PromptDetailPanel(props: { call: AiCallView; onClose: () => void }) {
  const { call, onClose } = props;
  const [tab, setTab] = useState<'prompt' | 'response'>('prompt');

  const formatJson = (raw: string | null): string | null => {
    if (!raw) return null;
    try {
      return JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      return raw;
    }
  };

  const promptFormatted = formatJson(call.promptText);
  const responseFormatted = formatJson(call.responseText);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-16" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <PurposeBadge purpose={call.purpose} />
            <span className="text-sm text-muted-foreground">{formatDate(call.createdAt)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumber(call.inputTokens)} in / {formatNumber(call.outputTokens)} out
            </span>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b px-4">
          <button
            type="button"
            onClick={() => setTab('prompt')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${tab === 'prompt' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Prompt
          </button>
          <button
            type="button"
            onClick={() => setTab('response')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${tab === 'response' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Response
          </button>
        </div>

        {/* Content */}
        <div className="overflow-auto p-4" style={{ maxHeight: 'calc(80vh - 110px)' }}>
          {tab === 'prompt' && promptFormatted && (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              {promptFormatted}
            </pre>
          )}
          {tab === 'response' && responseFormatted && (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed">
              {responseFormatted}
            </pre>
          )}
          {tab === 'prompt' && !promptFormatted && (
            <p className="text-sm text-muted-foreground">Pas de donnees (disponible en mode dev uniquement).</p>
          )}
          {tab === 'response' && !responseFormatted && (
            <p className="text-sm text-muted-foreground">Pas de donnees (disponible en mode dev uniquement).</p>
          )}
        </div>
      </div>
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
    detect_client: 'Detection',
    extraction: 'Extraction',
  };
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {labels[props.purpose] ?? props.purpose}
    </span>
  );
}

function CacheBadge(props: { readTokens: number; creationTokens: number }) {
  if (props.readTokens === 0 && props.creationTokens === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  if (props.readTokens > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
        {formatNumber(props.readTokens)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
      {formatNumber(props.creationTokens)}
    </span>
  );
}

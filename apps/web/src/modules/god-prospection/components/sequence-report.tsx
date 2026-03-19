import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle, Users, Reply, CheckCircle, AlertTriangle, Pause, Play, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchSequenceReport,
  fetchSequenceProspects,
  pauseProspect,
} from '../api/god-prospection.api';
import { ProspectDetailModal } from './prospect-detail-modal';

export function SequenceReport(props: { sequenceId: string }) {
  const queryClient = useQueryClient();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: report, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sequence-report', props.sequenceId],
    queryFn: () => fetchSequenceReport({ sequenceId: props.sequenceId }),
  });

  const { data: prospects } = useQuery({
    queryKey: ['god-prospection', 'sequence-prospects', props.sequenceId],
    queryFn: () => fetchSequenceProspects({ sequenceId: props.sequenceId }),
  });

  const pauseMutation = useMutation({
    mutationFn: pauseProspect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequence-prospects', props.sequenceId] });
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequence-report', props.sequenceId] });
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequences'] });
    },
    onError: () => toast.error('Erreur'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!report) return null;

  const maxSent = Math.max(1, ...report.funnel.map((f) => f.sent));

  return (
    <div className="space-y-6 p-4">
      <h3 className="text-sm font-semibold">{report.sequenceName}</h3>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Users} label="Assignes" value={report.totalAssigned} />
        <MetricCard
          icon={Reply}
          label="Taux de reponse"
          value={`${(report.replyRate * 100).toFixed(1)}%`}
        />
        <MetricCard icon={CheckCircle} label="Termines" value={report.completed} />
        <MetricCard icon={AlertTriangle} label="Erreurs" value={report.errors} variant="destructive" />
      </div>

      {/* Funnel */}
      {report.funnel.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Funnel</h4>
          <div className="space-y-2">
            {report.funnel.map((step) => (
              <div key={step.stepOrder} className="flex items-center gap-3">
                <div className="flex w-16 items-center gap-1 text-xs text-muted-foreground">
                  {step.channel === 'email' ? (
                    <Mail className="h-3 w-3" />
                  ) : (
                    <MessageCircle className="h-3 w-3" />
                  )}
                  Etape {step.stepOrder + 1}
                </div>
                <div className="flex-1">
                  <div className="h-4 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(step.sent / maxSent) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground">
                  {step.sent} envoyes, {step.pending} en attente
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active/paused prospects */}
      {prospects && prospects.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">
            Prospects actifs ({prospects.length})
          </h4>
          <div className="divide-y divide-border rounded-md border border-border">
            {prospects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="truncate font-medium">{p.fullName}</span>
                    {p.hasMobile && (
                      <MessageCircle className="h-3 w-3 text-success" />
                    )}
                    {p.sequenceStatus === 'paused' && (
                      <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
                        Pause
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Etape {p.currentStep + 1}</span>
                    <span>{p.email}</span>
                    {p.lastSentAt && (
                      <span>Envoye : {new Date(p.lastSentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                    {p.nextStepAt && (
                      <span>Prochain : {new Date(p.nextStepAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDetailId(p.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  title="Details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => pauseMutation.mutate({
                    prospectId: p.id,
                    paused: p.sequenceStatus === 'active',
                  })}
                  disabled={pauseMutation.isPending}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title={p.sequenceStatus === 'active' ? 'Mettre en pause' : 'Reprendre'}
                >
                  {p.sequenceStatus === 'active' ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {report.recentActivity.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">Activite recente</h4>
          <div className="divide-y divide-border rounded-md border border-border">
            {report.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 text-xs">
                {a.channel === 'email' ? (
                  <Mail className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <MessageCircle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="flex-1 truncate">{a.prospectName}</span>
                <span className="text-muted-foreground">Etape {a.stepOrder + 1}</span>
                <span className="text-muted-foreground">
                  {new Date(a.sentAt).toLocaleDateString('fr-FR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {detailId && (
        <ProspectDetailModal
          prospectId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

function MetricCard(props: {
  icon: typeof Users;
  label: string;
  value: number | string;
  variant?: 'destructive';
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className={`h-3 w-3 ${props.variant === 'destructive' ? 'text-destructive' : ''}`} />
        {props.label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${props.variant === 'destructive' ? 'text-destructive' : ''}`}>
        {props.value}
      </div>
    </div>
  );
}

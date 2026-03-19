import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, FlaskConical, OctagonX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  sendBatch,
  sendTestEmail,
  fetchBatchStatus,
  cancelBatch,
  type ProspectListResult,
} from '../api/god-prospection.api';

const DEFAULT_BODY = `Bonjour {{firstName}},

Je contacte quelques {{professionPlural}} pour leur poser une question : vous faites vos devis comment aujourd'hui ? Word, Excel, papier ?

J'ai créé un outil qui permet de faire un devis en 30 sec depuis le téléphone, juste en envoyant un message ou un vocal.

Si ça vous parle, votre espace est déjà prêt :

Corentin`;

interface SendControlsProps {
  data: ProspectListResult;
  profession: string | null;
  onProfessionChange: (v: string | null) => void;
  count: number;
  onCountChange: (v: number) => void;
}

export function SendControls(props: SendControlsProps) {
  const { data, profession, onProfessionChange, count, onCountChange } = props;
  const queryClient = useQueryClient();
  const [body, setBody] = useState(DEFAULT_BODY);
  const [testEmail, setTestEmail] = useState('');

  const [polling, setPolling] = useState(false);

  const { data: batchStatus } = useQuery({
    queryKey: ['god-prospection', 'batch-status'],
    queryFn: async () => {
      const status = await fetchBatchStatus();
      // Detect batch completion inside queryFn to avoid setState-in-effect
      if (status && !status.running && status.total > 0) {
        setPolling(false);
        queryClient.invalidateQueries({ queryKey: ['god-prospection'] });
      }
      return status;
    },
    refetchInterval: polling ? 30000 : false,
    enabled: polling,
  });

  const isRunning = batchStatus?.running === true;

  const sendMutation = useMutation({
    mutationFn: sendBatch,
    onSuccess: (result) => {
      if (!result.accepted) {
        toast.error('Un envoi est déjà en cours');
        return;
      }
      if (result.batchSize > 0) {
        toast.success(`${result.batchSize} email(s) en cours d'envoi`);
        setPolling(true);
      } else {
        toast.info('Aucun email à envoyer');
      }
      queryClient.invalidateQueries({ queryKey: ['god-prospection'] });
    },
    onError: () => toast.error("Erreur lors de l'envoi"),
  });

  const testMutation = useMutation({
    mutationFn: sendTestEmail,
    onSuccess: () => toast.success('Email test envoyé'),
    onError: () => toast.error("Erreur lors de l'envoi du test"),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelBatch,
    onSuccess: (result) => {
      if (result.cancelled) {
        toast.success('Annulation demandée, les emails restants ne seront pas envoyés');
      } else {
        toast.info('Aucun envoi en cours');
      }
    },
    onError: () => toast.error("Erreur lors de l'annulation"),
  });

  const handleSend = () => {
    if (!body.trim()) {
      toast.error('Remplis le corps du message');
      return;
    }
    sendMutation.mutate({ count: Math.min(count, data.dailyRemaining), body, profession });
  };

  const handleTest = () => {
    if (!testEmail.trim() || !body.trim()) {
      toast.error('Remplis l\'email test + corps');
      return;
    }
    testMutation.mutate({ to: testEmail, body, profession });
  };

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Envoi</h2>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{data.totalSent} envoyés</span>
          <span className="text-border">|</span>
          <span>{data.totalUnsent} restants</span>
          <span className="text-border">|</span>
          <span className="font-medium text-foreground">
            {data.dailyUsed}/{data.dailyLimit} aujourd'hui
          </span>
        </div>
      </div>

      {isRunning && batchStatus && (
        <div className="flex items-center justify-between rounded-md bg-primary/5 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>
              Envoi en cours : {batchStatus.sent}/{batchStatus.total}
              {batchStatus.errors > 0 && ` (${batchStatus.errors} erreur(s))`}
            </span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            <OctagonX className="mr-1.5 h-3.5 w-3.5" />
            Stop
          </Button>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Corps du message</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Variables : <code className="rounded bg-secondary px-1">{'{{firstName}}'}</code>{' '}
          <code className="rounded bg-secondary px-1">{'{{fullName}}'}</code>{' '}
          <code className="rounded bg-secondary px-1">{'{{profession}}'}</code>{' '}
          <code className="rounded bg-secondary px-1">{'{{professionPlural}}'}</code>{' '}
          <code className="rounded bg-secondary px-1">{'{{clients}}'}</code>
          <br />
          L'objet est généré automatiquement selon la profession du prospect.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@email.com"
            className="w-48 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={testMutation.isPending}
          >
            {testMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="mr-2 h-4 w-4" />
            )}
            Test
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Cible :</label>
          <select
            value={profession ?? ''}
            onChange={(e) => onProfessionChange(e.target.value || null)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Toutes professions</option>
            {data.professions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Nombre :</label>
          <input
            type="number"
            min={1}
            max={data.dailyRemaining}
            value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            className="w-20 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={sendMutation.isPending || isRunning || data.dailyRemaining === 0}
        >
          {sendMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Envoyer
        </Button>

        {data.dailyRemaining === 0 && (
          <span className="text-sm text-warning">Limite quotidienne atteinte</span>
        )}
      </div>
    </div>
  );
}

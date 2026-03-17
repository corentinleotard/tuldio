import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  sendBatch,
  sendTestEmail,
  fetchBatchStatus,
  type ProspectListResult,
} from '../api/god-prospection.api';

const DEFAULT_BODY = `Bonjour {{firstName}},

Entre les {{clients}} et la paperasse, combien de temps vous perdez chaque semaine sur vos factures et vos devis ?

On a créé Tuldio pour les professionnels comme vous. Vous envoyez un vocal ou tapez un message, et votre facture est prête en 30 secondes. Pas de logiciel compliqué, pas de formulaire, juste une conversation.

C'est gratuit 14 jours, sans carte bancaire : https://tuldio.fr

Corentin`;

export function SendControls(props: { data: ProspectListResult }) {
  const { data } = props;
  const queryClient = useQueryClient();
  const [count, setCount] = useState(Math.min(data.dailyRemaining, 5));
  const [subject, setSubject] = useState('Vos factures en 30 secondes');
  const [body, setBody] = useState(DEFAULT_BODY);
  const [testEmail, setTestEmail] = useState('');

  const [polling, setPolling] = useState(false);

  // Poll batch status only when a batch was launched
  const { data: batchStatus } = useQuery({
    queryKey: ['god-prospection', 'batch-status'],
    queryFn: fetchBatchStatus,
    refetchInterval: polling ? 30000 : false,
    enabled: polling,
  });

  const isRunning = batchStatus?.running === true;

  useEffect(() => {
    if (batchStatus && !batchStatus.running && batchStatus.total > 0) {
      setPolling(false);
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'prospects'] });
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sent'] });
    }
  }, [batchStatus, queryClient]);

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

  const handleSend = () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Remplis tous les champs');
      return;
    }
    sendMutation.mutate({ count: Math.min(count, data.dailyRemaining), subject, body });
  };

  const handleTest = () => {
    if (!testEmail.trim() || !subject.trim() || !body.trim()) {
      toast.error('Remplis l\'email test + objet + corps');
      return;
    }
    testMutation.mutate({ to: testEmail, subject, body });
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
        <div className="flex items-center gap-3 rounded-md bg-primary/5 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>
            Envoi en cours : {batchStatus.sent}/{batchStatus.total}
            {batchStatus.errors > 0 && ` (${batchStatus.errors} erreur(s))`}
          </span>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">Objet</label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Simplifiez votre facturation"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

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
          <code className="rounded bg-secondary px-1">{'{{clients}}'}</code>
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

      <div className="flex items-center gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Nombre :</label>
          <input
            type="number"
            min={1}
            max={data.dailyRemaining}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
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

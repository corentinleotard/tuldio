import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Mail, MessageCircle, Pencil, Trash2, ToggleLeft, ToggleRight, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  fetchSequences,
  updateSequence,
  deleteSequence,
  type SequenceView,
} from '../api/god-prospection.api';
import { SequenceBuilder } from './sequence-builder';
import { SequenceReport } from './sequence-report';

export function SequenceList() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sequences'],
    queryFn: fetchSequences,
  });

  const toggleMutation = useMutation({
    mutationFn: (seq: SequenceView) =>
      updateSequence({ id: seq.id, isActive: !seq.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequences'] });
    },
    onError: () => toast.error('Erreur lors de la mise a jour'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSequence({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequences'] });
      toast.success('Sequence supprimee');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  if (creating || editingId) {
    return (
      <SequenceBuilder
        sequenceId={editingId}
        onClose={() => {
          setEditingId(null);
          setCreating(false);
        }}
      />
    );
  }

  if (reportId) {
    return (
      <div>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            onClick={() => setReportId(null)}
            className="text-sm text-primary hover:underline"
          >
            Retour
          </button>
        </div>
        <SequenceReport sequenceId={reportId} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const list = sequences ?? [];

  return (
    <div>
      <div className="flex items-center justify-between px-4 py-3">
        <h3 className="text-sm font-semibold">Sequences</h3>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Nouvelle
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Aucune sequence. Cree-en une pour automatiser tes relances.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {list.map((seq) => (
            <div key={seq.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{seq.name}</span>
                  {!seq.isActive && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      Pause
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {seq.steps.length} etape(s)
                    {seq.steps.some((s) => s.channel === 'email') && <Mail className="h-3 w-3" />}
                    {seq.steps.some((s) => s.channel === 'whatsapp') && <MessageCircle className="h-3 w-3" />}
                  </span>
                  <span>{seq.stats.active} actifs</span>
                  <span>{seq.stats.replied} reponses</span>
                  {seq.stats.error > 0 && (
                    <span className="text-destructive">{seq.stats.error} erreurs</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setReportId(seq.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  title="Rapport"
                >
                  <BarChart3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleMutation.mutate(seq)}
                  disabled={toggleMutation.isPending}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                  title={seq.isActive ? 'Desactiver' : 'Activer'}
                >
                  {seq.isActive ? (
                    <ToggleRight className="h-4 w-4 text-primary" />
                  ) : (
                    <ToggleLeft className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => setEditingId(seq.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button className="rounded-md p-1.5 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer la sequence</AlertDialogTitle>
                      <AlertDialogDescription>
                        Cette action est irreversible. La sequence &quot;{seq.name}&quot; sera supprimee.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate(seq.id)}>
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

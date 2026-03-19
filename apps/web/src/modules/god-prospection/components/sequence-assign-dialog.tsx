import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchSequences, assignToSequence } from '../api/god-prospection.api';

export function SequenceAssignDialog(props: {
  prospectIds: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedSequenceId, setSelectedSequenceId] = useState('');

  const { data: sequences, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sequences'],
    queryFn: fetchSequences,
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      assignToSequence({
        prospectIds: props.prospectIds,
        sequenceId: selectedSequenceId,
      }),
    onSuccess: (result) => {
      toast.success(`${result.assigned} prospect(s) assignes a la sequence`);
      queryClient.invalidateQueries({ queryKey: ['god-prospection'] });
      props.onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const activeSequences = (sequences ?? []).filter((s) => s.isActive);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={props.onClose}>
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Assigner a une sequence</h3>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          {props.prospectIds.length} prospect(s) selectionne(s)
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : activeSequences.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Aucune sequence active. Cree-en une d'abord.
          </p>
        ) : (
          <div className="space-y-3">
            <select
              value={selectedSequenceId}
              onChange={(e) => setSelectedSequenceId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Choisir une sequence</option>
              {activeSequences.map((seq) => (
                <option key={seq.id} value={seq.id}>
                  {seq.name} ({seq.steps.length} etape(s))
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={props.onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!selectedSequenceId || assignMutation.isPending}
          >
            {assignMutation.isPending && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            Assigner
          </Button>
        </div>
      </div>
    </div>
  );
}

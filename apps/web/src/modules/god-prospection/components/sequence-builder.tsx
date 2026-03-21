import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ArrowLeft, Save, Mail, MessageCircle, ArrowUp, ArrowDown, Link } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  fetchSequences,
  createSequence,
  updateSequence,
} from '../api/god-prospection.api';

let stepKeyCounter = 0;
function nextStepKey(): string {
  return `step-${++stepKeyCounter}`;
}

interface StepDraft {
  key: string;
  channel: string;
  delayDays: number;
  subject: string | null;
  body: string;
  linkText: string | null;
}

function makeStep(partial?: Partial<Omit<StepDraft, 'key'>>): StepDraft {
  return {
    key: nextStepKey(),
    channel: partial?.channel ?? 'email',
    delayDays: partial?.delayDays ?? 0,
    subject: partial?.subject ?? null,
    body: partial?.body ?? '',
    linkText: partial?.linkText ?? null,
  };
}

function SequenceBuilderInner(props: {
  sequenceId: string | null;
  initialName: string;
  initialSteps: StepDraft[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(props.initialName);
  const [steps, setSteps] = useState(props.initialSteps);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stepsWithOrder = steps.map((s, i) => ({
        stepOrder: i,
        channel: s.channel,
        delayDays: s.delayDays,
        subject: s.channel === 'email' ? s.subject : null,
        body: s.body,
        linkText: s.linkText?.trim() || null,
      }));

      if (props.sequenceId) {
        await updateSequence({ id: props.sequenceId, name, steps: stepsWithOrder });
      } else {
        await createSequence({ name, steps: stepsWithOrder });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'sequences'] });
      toast.success(props.sequenceId ? 'Sequence mise a jour' : 'Sequence creee');
      props.onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur'),
  });

  const addStep = () => {
    setSteps([...steps, makeStep({ delayDays: 3 })]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, patch: Partial<StepDraft>) => {
    setSteps(steps.map((s, i) => {
      if (i !== index) return s;
      const updated = { ...s, ...patch };
      // Clear subject when switching to whatsapp
      if (patch.channel === 'whatsapp') {
        updated.subject = null;
      }
      return updated;
    }));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[index], newSteps[newIndex]] = [newSteps[newIndex]!, newSteps[index]!];
    setSteps(newSteps);
  };

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Nom de sequence requis');
      return;
    }
    if (steps.length === 0) {
      toast.error('Au moins une etape requise');
      return;
    }
    for (const [i, step] of steps.entries()) {
      if (!step.body.trim()) {
        toast.error(`Etape ${i + 1} : corps du message requis`);
        return;
      }
      if (step.delayDays < 0) {
        toast.error(`Etape ${i + 1} : le delai ne peut pas etre negatif`);
        return;
      }
    }
    saveMutation.mutate();
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-3">
        <button
          onClick={props.onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold">
          {props.sequenceId ? 'Modifier la sequence' : 'Nouvelle sequence'}
        </h3>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Nom</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Relance osteopathes"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium">Etapes</label>

        {steps.map((step, i) => (
          <div key={step.key} className="space-y-2 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Etape {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                {steps.length > 1 && (
                  <button
                    onClick={() => removeStep(i)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Canal</label>
                <select
                  value={step.channel}
                  onChange={(e) => updateStep(i, { channel: e.target.value })}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Delai</label>
                <input
                  type="number"
                  min={0}
                  value={step.delayDays}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    updateStep(i, { delayDays: Number.isNaN(val) ? 0 : Math.max(0, val) });
                  }}
                  className="w-16 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-muted-foreground">jours</span>
              </div>
            </div>

            {step.channel === 'email' && (
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Objet</label>
                <input
                  value={step.subject ?? ''}
                  onChange={(e) => updateStep(i, { subject: e.target.value || null })}
                  placeholder="Objet de l'email"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            )}

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                {step.channel === 'email' ? <Mail className="h-3 w-3" /> : <MessageCircle className="h-3 w-3" />}
                Message
              </label>
              <textarea
                value={step.body}
                onChange={(e) => updateStep(i, { body: e.target.value })}
                rows={4}
                placeholder="Bonjour {{firstName}}..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Variables :{' '}
                <code className="rounded bg-secondary px-1">{'{{firstName}}'}</code>{' '}
                <code className="rounded bg-secondary px-1">{'{{fullName}}'}</code>{' '}
                <code className="rounded bg-secondary px-1">{'{{profession}}'}</code>{' '}
                <code className="rounded bg-secondary px-1">{'{{professionPlural}}'}</code>{' '}
                <code className="rounded bg-secondary px-1">{'{{clients}}'}</code>
              </p>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link className="h-3 w-3" />
                Texte du lien (vide = pas de lien)
              </label>
              <input
                value={step.linkText ?? ''}
                onChange={(e) => updateStep(i, { linkText: e.target.value || null })}
                placeholder="Ex: Votre espace est deja pret :"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        ))}

        <button
          onClick={addStep}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Ajouter une etape
        </button>
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={props.onClose}>
          Annuler
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending}>
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {props.sequenceId ? 'Mettre a jour' : 'Creer'}
        </Button>
      </div>
    </div>
  );
}

export function SequenceBuilder(props: {
  sequenceId: string | null;
  onClose: () => void;
}) {
  const { data: sequences, isLoading } = useQuery({
    queryKey: ['god-prospection', 'sequences'],
    queryFn: fetchSequences,
    enabled: !!props.sequenceId,
  });

  if (props.sequenceId && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const existing = props.sequenceId
    ? sequences?.find((s) => s.id === props.sequenceId)
    : null;

  const initialName = existing?.name ?? '';
  const initialSteps: StepDraft[] = existing
    ? existing.steps.map((s) => makeStep({
        channel: s.channel,
        delayDays: s.delayDays,
        subject: s.subject,
        body: s.body,
        linkText: s.linkText,
      }))
    : [makeStep()];

  return (
    <SequenceBuilderInner
      key={props.sequenceId ?? 'new'}
      sequenceId={props.sequenceId}
      initialName={initialName}
      initialSteps={initialSteps}
      onClose={props.onClose}
    />
  );
}

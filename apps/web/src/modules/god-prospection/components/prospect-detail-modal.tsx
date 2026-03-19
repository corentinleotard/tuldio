import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, Loader2, Mail, Phone, Globe, MessageCircle, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchProspectDetail, updateProspectApi } from '../api/god-prospection.api';

export function ProspectDetailModal(props: {
  prospectId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: prospect, isLoading } = useQuery({
    queryKey: ['god-prospection', 'prospect', props.prospectId],
    queryFn: () => fetchProspectDetail({ id: props.prospectId }),
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const startEditing = () => {
    if (!prospect) return;
    setForm({
      firstName: prospect.firstName,
      fullName: prospect.fullName,
      email: prospect.email,
      phone: prospect.phone ?? '',
      whatsappPhone: prospect.whatsappPhone ?? '',
      profession: prospect.profession,
      website: prospect.website ?? '',
    });
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => updateProspectApi({
      id: props.prospectId,
      firstName: form.firstName,
      fullName: form.fullName,
      email: form.email,
      phone: form.phone || null,
      whatsappPhone: form.whatsappPhone || null,
      profession: form.profession,
      website: form.website || null,
    }),
    onSuccess: () => {
      toast.success('Prospect mis a jour');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['god-prospection'] });
    },
    onError: () => toast.error('Erreur'),
  });

  if (isLoading) {
    return (
      <Overlay onClose={props.onClose}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Overlay>
    );
  }

  if (!prospect) return null;

  const statusLabel: Record<string, string> = {
    new: 'Nouveau',
    sent: 'Contacte',
    error: 'Erreur',
  };

  const seqStatusLabel: Record<string, string> = {
    active: 'Actif',
    completed: 'Termine',
    replied: 'A repondu',
    paused: 'En pause',
    error: 'Erreur',
  };

  return (
    <Overlay onClose={props.onClose}>
      <div className="flex items-center justify-between border-b border-border pb-4">
        <h3 className="text-lg font-semibold">{prospect.fullName}</h3>
        <button onClick={props.onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <Field label="Prenom" value={form.firstName ?? ''} onChange={(v) => setForm({ ...form, firstName: v })} />
          <Field label="Nom complet" value={form.fullName ?? ''} onChange={(v) => setForm({ ...form, fullName: v })} />
          <Field label="Email" value={form.email ?? ''} onChange={(v) => setForm({ ...form, email: v })} />
          <Field label="Telephone" value={form.phone ?? ''} onChange={(v) => setForm({ ...form, phone: v })} placeholder="06 12 34 56 78" />
          <Field label="WhatsApp" value={form.whatsappPhone ?? ''} onChange={(v) => setForm({ ...form, whatsappPhone: v })} placeholder="06 12 34 56 78 (si different)" />
          <Field label="Profession" value={form.profession ?? ''} onChange={(v) => setForm({ ...form, profession: v })} />
          <Field label="Site web" value={form.website ?? ''} onChange={(v) => setForm({ ...form, website: v })} />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditing(false)}>Annuler</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
              Enregistrer
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
              {statusLabel[prospect.status] ?? prospect.status}
            </span>
            {prospect.sequenceStatus && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                prospect.sequenceStatus === 'active' ? 'bg-primary/10 text-primary'
                : prospect.sequenceStatus === 'replied' ? 'bg-success/10 text-success'
                : prospect.sequenceStatus === 'error' ? 'bg-destructive/10 text-destructive'
                : 'bg-secondary text-muted-foreground'
              }`}>
                {seqStatusLabel[prospect.sequenceStatus] ?? prospect.sequenceStatus}
              </span>
            )}
            {prospect.icpScore !== null && prospect.icpScore !== undefined && (
              <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                prospect.icpScore >= 9 ? 'bg-success/10 text-success'
                : prospect.icpScore >= 7 ? 'bg-primary/10 text-primary'
                : 'bg-secondary text-muted-foreground'
              }`}>
                <Star className="h-2.5 w-2.5" />
                {prospect.icpScore}
              </span>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <InfoRow icon={Mail} label="Email" value={prospect.email} />
            <InfoRow icon={Phone} label="Telephone" value={prospect.phone} empty="Non renseigne" />
            <InfoRow icon={MessageCircle} label="WhatsApp" value={prospect.whatsappPhone} empty="Meme que telephone" />
            <InfoRow icon={Globe} label="Site web" value={prospect.website} empty="Non renseigne" />
          </div>

          {/* Template variables preview */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Variables du template</p>
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-xs">
              <div className="grid grid-cols-2 gap-y-1">
                <span className="text-muted-foreground">{'{{firstName}}'}</span>
                <span className={prospect.firstName ? '' : 'text-warning'}>{prospect.firstName || '(vide)'}</span>
                <span className="text-muted-foreground">{'{{fullName}}'}</span>
                <span>{prospect.fullName}</span>
                <span className="text-muted-foreground">{'{{profession}}'}</span>
                <span>{prospect.profession}</span>
                <span className="text-muted-foreground">{'{{professionPlural}}'}</span>
                <span>{prospect.profession.toLowerCase() + 's'}</span>
              </div>
            </div>
          </div>

          {/* Activity timeline */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Activite</p>
            <div className="space-y-1.5 text-xs">
              {prospect.sentAt && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  <span>Email envoye</span>
                  {prospect.sentSubject && <span className="text-muted-foreground">({prospect.sentSubject})</span>}
                  <span className="ml-auto text-muted-foreground">
                    {new Date(prospect.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
              {prospect.sequenceStatus && (
                <div className="flex items-center gap-2">
                  <span>Sequence : etape {prospect.currentStep + 1}</span>
                  <span className="ml-auto text-muted-foreground">
                    {prospect.nextStepAt
                      ? `Prochain : ${new Date(prospect.nextStepAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : prospect.sequenceStatus === 'completed' ? 'Termine' : prospect.sequenceStatus === 'replied' ? 'A repondu' : ''
                    }
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>Cree le {new Date(prospect.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                <span>-- Maj {new Date(prospect.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          </div>

          {prospect.icpReason && (
            <p className="text-xs text-muted-foreground">{prospect.icpReason}</p>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={startEditing}>Modifier</Button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Overlay(props: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={props.onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{props.label}</label>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}

function InfoRow(props: { icon: typeof Mail; label: string; value: string | null; empty?: string }) {
  const Icon = props.icon;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="w-20 text-xs text-muted-foreground">{props.label}</span>
      <span className={props.value ? '' : 'text-muted-foreground/50'}>{props.value || props.empty || '-'}</span>
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mail, Globe, Phone, Star, ListOrdered, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { fetchSendQueue, type SendQueueProspect } from '../api/god-prospection.api';
import { SequenceAssignDialog } from './sequence-assign-dialog';

export function SendQueue(props: {
  profession: string | null;
  count: number;
}) {
  const { profession, count } = props;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAssign, setShowAssign] = useState(false);
  const [includeContacted, setIncludeContacted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['god-prospection', 'send-queue', profession, includeContacted],
    queryFn: () => fetchSendQueue({ profession, limit: 200, includeContacted }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const prospects = data ?? [];

  // Filter stale selections against current visible list
  const visibleIds = new Set(prospects.map((p) => p.id));
  const effectiveSelected = new Set([...selected].filter((id) => visibleIds.has(id)));

  if (prospects.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Aucun prospect dans la file d'attente
        {profession ? ` pour "${profession}"` : ''}.
      </div>
    );
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (effectiveSelected.size === prospects.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(prospects.map((p) => p.id)));
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={effectiveSelected.size === prospects.length && prospects.length > 0}
            onChange={toggleAll}
            className="rounded"
          />
          {effectiveSelected.size > 0 ? `${effectiveSelected.size} selectionne(s)` : 'Tout selectionner'}
        </label>
        {effectiveSelected.size > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAssign(true)}
          >
            <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
            Assigner a une sequence
          </Button>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeContacted}
            onChange={(e) => {
              setIncludeContacted(e.target.checked);
              setSelected(new Set());
            }}
            className="rounded"
          />
          Inclure deja contactes
        </label>
      </div>

      <div className="divide-y divide-border">
        {prospects.map((p, i) => (
          <QueueRow
            key={p.id}
            prospect={p}
            inBatch={i < count}
            rank={i + 1}
            isSelected={effectiveSelected.has(p.id)}
            onToggle={() => toggleSelect(p.id)}
          />
        ))}
      </div>

      {showAssign && (
        <SequenceAssignDialog
          prospectIds={[...effectiveSelected]}
          onClose={() => {
            setShowAssign(false);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}

function QueueRow(props: {
  prospect: SendQueueProspect;
  inBatch: boolean;
  rank: number;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const { prospect: p, inBatch, rank, isSelected, onToggle } = props;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 transition-colors ${
        inBatch ? 'bg-primary/5' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={onToggle}
        className="mt-1 rounded"
      />

      {/* Rank badge */}
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          inBatch
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-muted-foreground'
        }`}
      >
        {rank}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{p.fullName}</span>
          {p.icpScore !== null && p.icpScore !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${
                p.icpScore >= 9
                  ? 'bg-success/10 text-success'
                  : p.icpScore >= 7
                    ? 'bg-primary/10 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Star className="h-2.5 w-2.5" />
              {p.icpScore}
            </span>
          )}
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {p.profession}
          </span>
          {p.status === 'sent' && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              Contacte
            </span>
          )}
          {p.hasMobile && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
              <MessageCircle className="h-2.5 w-2.5" />
              Mobile
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {p.email}
          </span>
          {p.website && (
            <span className="inline-flex items-center gap-1">
              <Globe className="h-3 w-3" />
              {p.website}
            </span>
          )}
          {p.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {p.phone}
            </span>
          )}
        </div>

        {p.icpReason && (
          <p className="mt-1 text-xs text-muted-foreground/70">{p.icpReason}</p>
        )}
      </div>
    </div>
  );
}

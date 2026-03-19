import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { fetchChannelLimits, updateChannelLimitApi, type ChannelLimitView } from '../api/god-prospection.api';

const CHANNEL_ICONS: Record<string, typeof Mail> = {
  email: Mail,
  whatsapp: MessageCircle,
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
};

export function ChannelLimitsEditor() {
  const queryClient = useQueryClient();
  const [localOverrides, setLocalOverrides] = useState<Record<string, number>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { data: limits, isLoading } = useQuery({
    queryKey: ['god-prospection', 'channel-limits'],
    queryFn: fetchChannelLimits,
  });

  const updateMutation = useMutation({
    mutationFn: updateChannelLimitApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['god-prospection', 'channel-limits'] });
    },
    onError: () => toast.error('Erreur lors de la mise a jour'),
  });

  const handleChange = (channel: string, value: number) => {
    setLocalOverrides((prev) => ({ ...prev, [channel]: value }));

    if (debounceTimers.current[channel]) {
      clearTimeout(debounceTimers.current[channel]);
    }

    debounceTimers.current[channel] = setTimeout(() => {
      updateMutation.mutate({ channel, dailyLimit: value });
    }, 800);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <h3 className="mb-3 text-sm font-semibold">Limites quotidiennes</h3>
      <div className="space-y-2">
        {(limits ?? []).map((limit: ChannelLimitView) => {
          const Icon = CHANNEL_ICONS[limit.channel] ?? Mail;
          const label = CHANNEL_LABELS[limit.channel] ?? limit.channel;
          const displayLimit = localOverrides[limit.channel] ?? limit.dailyLimit;
          return (
            <div key={limit.channel} className="flex items-center gap-3">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="w-20 text-sm">{label}</span>
              <input
                type="number"
                min={0}
                value={displayLimit}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  handleChange(limit.channel, Number.isNaN(val) ? 0 : Math.max(0, val));
                }}
                className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-muted-foreground">
                {limit.dailyUsed}/{displayLimit} aujourd'hui
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, QrCode, Loader2, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { fetchWhatsAppStatus, setupWhatsApp } from '../api/god-prospection.api';

export function WhatsAppSetup() {
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['god-prospection', 'whatsapp-status'],
    queryFn: async () => {
      const s = await fetchWhatsAppStatus();
      // If connected while we were waiting for QR, clear QR state
      if (s.connected && qrCode) {
        setQrCode(null);
        setPolling(false);
        toast.success('WhatsApp connecte');
      }
      return s;
    },
    refetchInterval: (qrCode || polling) ? 3000 : false,
  });

  const setupMutation = useMutation({
    mutationFn: setupWhatsApp,
    onSuccess: (result) => {
      if (result.connected) {
        setQrCode(null);
        setPolling(false);
        toast.success('WhatsApp connecte');
        queryClient.invalidateQueries({ queryKey: ['god-prospection', 'whatsapp-status'] });
      } else if (result.qrCode) {
        setQrCode(result.qrCode);
        setPolling(false);
      } else {
        // QR not ready yet, start polling status - backend is initializing
        setPolling(true);
        toast.info('Connexion en cours...');
        // Retry setup after a few seconds to get the QR
        setTimeout(() => {
          setupMutation.mutate();
        }, 5000);
      }
    },
    onError: () => {
      setPolling(false);
      toast.error('Erreur de connexion WhatsApp');
    },
  });

  const connected = status?.connected === true;

  return (
    <div className="px-4 py-3">
      <h3 className="mb-3 text-sm font-semibold">WhatsApp</h3>

      {connected ? (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
            <MessageCircle className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium">Connecte</p>
            {status?.phone && (
              <p className="text-xs text-muted-foreground">+{status.phone}</p>
            )}
          </div>
        </div>
      ) : qrCode ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Scanne ce QR code avec WhatsApp Business sur ton telephone :
          </p>
          <div className="flex items-center justify-center rounded-md border border-border bg-white p-4">
            <QRCodeSVG value={qrCode} size={200} />
          </div>
          <p className="text-xs text-muted-foreground">
            WhatsApp Business {'>'} Appareils connectes {'>'} Connecter un appareil
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
            {polling || setupMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Unplug className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">
              {polling ? 'Connexion en cours...' : 'Non connecte'}
            </p>
          </div>
          {!polling && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
            >
              {setupMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <QrCode className="mr-1.5 h-3.5 w-3.5" />
              )}
              Connecter
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

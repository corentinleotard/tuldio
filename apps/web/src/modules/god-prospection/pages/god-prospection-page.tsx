import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, BarChart3, ListOrdered } from 'lucide-react';
import { fetchProspects } from '../api/god-prospection.api';
import { SendControls } from '../components/send-controls';
import { SentEmailList } from '../components/sent-email-list';
import { ReceivedEmailList } from '../components/received-email-list';
import { SendQueue } from '../components/send-queue';
import { ProspectReport } from '../components/prospect-report';
import { SequenceList } from '../components/sequence-list';
import { ChannelLimitsEditor } from '../components/channel-limits-editor';
import { WhatsAppSetup } from '../components/whatsapp-setup';

type MainTab = 'prospection' | 'sequences' | 'reports';
type SubTab = 'queue' | 'sent' | 'received';

export function GodProspectionPage() {
  const [mainTab, setMainTab] = useState<MainTab>('prospection');
  const [subTab, setSubTab] = useState<SubTab>('queue');
  const [profession, setProfession] = useState<string | null>(null);
  const [count, setCount] = useState(5);

  const { data, isLoading } = useQuery({
    queryKey: ['god-prospection', 'prospects'],
    queryFn: fetchProspects,
    enabled: mainTab === 'prospection',
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-[22px] font-bold tracking-tight">Prospection</h1>
      </div>

      {/* Top-level tabs */}
      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setMainTab('prospection')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            mainTab === 'prospection'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Megaphone className="h-3.5 w-3.5" />
          Prospection
        </button>
        <button
          onClick={() => setMainTab('sequences')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            mainTab === 'sequences'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          Sequences
        </button>
        <button
          onClick={() => setMainTab('reports')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            mainTab === 'reports'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Rapports
        </button>
      </div>

      {mainTab === 'prospection' ? (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : data ? (
            <div className="mt-4">
              <SendControls
                data={data}
                profession={profession}
                onProfessionChange={setProfession}
                count={count}
                onCountChange={setCount}
              />
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex gap-1 border-b border-border">
              <button
                onClick={() => setSubTab('queue')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  subTab === 'queue'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                File d'attente
              </button>
              <button
                onClick={() => setSubTab('sent')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  subTab === 'sent'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Envoyes
              </button>
              <button
                onClick={() => setSubTab('received')}
                className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                  subTab === 'received'
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Recus
              </button>
            </div>

            <div className="mt-0 rounded-b-lg border-x border-b border-border bg-card">
              {subTab === 'queue' ? (
                <SendQueue profession={profession} count={count} />
              ) : subTab === 'sent' ? (
                <SentEmailList />
              ) : (
                <ReceivedEmailList />
              )}
            </div>
          </div>
        </>
      ) : mainTab === 'sequences' ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <SequenceList />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <ChannelLimitsEditor />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <WhatsAppSetup />
          </div>
        </div>
      ) : (
        <div className="mt-0 rounded-b-lg border-x border-b border-border bg-card">
          <ProspectReport />
        </div>
      )}
    </div>
  );
}

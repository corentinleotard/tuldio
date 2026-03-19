import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Users, Send, Inbox, Settings, Mail, MessageCircle, Clock } from 'lucide-react';
import { fetchProspects, fetchRecentSends, fetchUpcomingSends, fetchChannelLimits } from '../api/god-prospection.api';
import { SendControls } from '../components/send-controls';
import { SentEmailList } from '../components/sent-email-list';
import { ReceivedEmailList } from '../components/received-email-list';
import { SendQueue } from '../components/send-queue';
import { ProspectReport } from '../components/prospect-report';
import { SequenceList } from '../components/sequence-list';
import { ChannelLimitsEditor } from '../components/channel-limits-editor';
import { WhatsAppSetup } from '../components/whatsapp-setup';

type Tab = 'dashboard' | 'prospects' | 'sent' | 'received' | 'settings';

export function GodProspectionPage() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [profession, setProfession] = useState<string | null>(null);
  const [count, setCount] = useState(5);

  const { data: prospects } = useQuery({
    queryKey: ['god-prospection', 'prospects'],
    queryFn: fetchProspects,
  });

  const { data: recentSends } = useQuery({
    queryKey: ['god-prospection', 'sends'],
    queryFn: () => fetchRecentSends({ limit: 5 }),
  });

  const { data: upcoming } = useQuery({
    queryKey: ['god-prospection', 'upcoming'],
    queryFn: () => fetchUpcomingSends({ limit: 10 }),
  });

  const { data: channelLimits } = useQuery({
    queryKey: ['god-prospection', 'channel-limits'],
    queryFn: fetchChannelLimits,
  });

  const emailLimit = channelLimits?.find((l) => l.channel === 'email');
  const waLimit = channelLimits?.find((l) => l.channel === 'whatsapp');

  const tabs: Array<{ id: Tab; label: string; icon: typeof Megaphone }> = [
    { id: 'dashboard', label: 'Dashboard', icon: Megaphone },
    { id: 'prospects', label: 'Prospects', icon: Users },
    { id: 'sent', label: 'Envoyes', icon: Send },
    { id: 'received', label: 'Recus', icon: Inbox },
    { id: 'settings', label: 'Reglages', icon: Settings },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Megaphone className="h-6 w-6 text-primary" />
        <h1 className="text-[22px] font-bold tracking-tight">Prospection</h1>
      </div>

      {/* Single tab bar */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div className="mt-4 space-y-4">
          {/* Today's activity summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="A contacter"
              value={prospects?.totalUnsent ?? 0}
              color="text-primary"
            />
            <StatCard
              label="Contactes"
              value={prospects?.totalSent ?? 0}
            />
            <StatCard
              label="Emails aujourd'hui"
              value={`${emailLimit?.dailyUsed ?? 0}/${emailLimit?.dailyLimit ?? 10}`}
              icon={Mail}
            />
            <StatCard
              label="WhatsApp aujourd'hui"
              value={`${waLimit?.dailyUsed ?? 0}/${waLimit?.dailyLimit ?? 2}`}
              icon={MessageCircle}
            />
          </div>

          {/* Last sends */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <h3 className="text-sm font-semibold">Derniers envois</h3>
              <button
                onClick={() => setTab('sent')}
                className="text-xs text-primary hover:underline"
              >
                Voir tout
              </button>
            </div>
            {recentSends && recentSends.length > 0 ? (
              <div className="divide-y divide-border">
                {recentSends.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    {s.channel === 'email' ? (
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5 text-success" />
                    )}
                    <span className="flex-1 truncate font-medium">{s.prospectName}</span>
                    <span className="text-xs text-muted-foreground">
                      Etape {s.stepOrder + 1}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.sentAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucun envoi de sequence pour le moment
              </div>
            )}
          </div>

          {/* Upcoming sends */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 px-4 py-3">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Prochains envois (24h)</h3>
            </div>
            {upcoming && upcoming.length > 0 ? (
              <div className="max-h-[30vh] divide-y divide-border overflow-y-auto">
                {upcoming.map((s) => {
                  const isOverdue = new Date(s.nextStepAt) <= new Date();
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                      {s.channel === 'email' ? (
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <MessageCircle className="h-3.5 w-3.5 text-success" />
                      )}
                      <span className="flex-1 truncate font-medium">{s.fullName}</span>
                      <span className="text-xs text-muted-foreground">Etape {s.stepOrder + 1}</span>
                      <span className={`text-xs ${isOverdue ? 'font-medium text-primary' : 'text-muted-foreground'}`}>
                        {isOverdue ? 'Maintenant' : new Date(s.nextStepAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Aucun envoi prevu dans les 24h
              </div>
            )}
          </div>

          {/* Sequences overview */}
          <div className="rounded-lg border border-border bg-card">
            <SequenceList />
          </div>
        </div>
      )}

      {tab === 'prospects' && (
        <>
          {prospects && (
            <div className="mt-4">
              <SendControls
                data={prospects}
                profession={profession}
                onProfessionChange={setProfession}
                count={count}
                onCountChange={setCount}
              />
            </div>
          )}
          <div className="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-border bg-card">
            <SendQueue profession={profession} count={count} />
          </div>
        </>
      )}

      {tab === 'sent' && (
        <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card">
          <SentEmailList />
        </div>
      )}

      {tab === 'received' && (
        <div className="mt-4 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card">
          <ReceivedEmailList />
        </div>
      )}

      {tab === 'settings' && (
        <div className="mt-4 space-y-4">
          <div className="rounded-lg border border-border bg-card">
            <ChannelLimitsEditor />
          </div>
          <div className="rounded-lg border border-border bg-card">
            <WhatsAppSetup />
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card">
            <ProspectReport />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard(props: {
  label: string;
  value: number | string;
  color?: string;
  icon?: typeof Mail;
}) {
  const Icon = props.icon;
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {props.label}
      </div>
      <div className={`mt-1 text-lg font-semibold ${props.color ?? ''}`}>
        {props.value}
      </div>
    </div>
  );
}

import { useState } from 'react';
import {
  Home,
  CreditCard,
  Bell,
  Download,
  Cpu,
  MessageSquare,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { SettingsRow } from '../components/settings-row';

export function SettingsPage() {
  const { user, team, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(true);

  const subscriptionLabel =
    team?.subscriptionStatus === 'trial'
      ? 'Essai gratuit'
      : team?.subscriptionStatus === 'active'
        ? 'Abonnement actif'
        : team?.subscriptionStatus === 'cancelled'
          ? 'Abonnement annule'
          : 'Abonnement expire';

  const subscriptionVariant =
    team?.subscriptionStatus === 'active' || team?.subscriptionStatus === 'trial'
      ? 'success'
      : 'warning';

  const filledCount = team?.fields.filter((f) => f.value && f.key !== 'original_document_url').length ?? 0;
  const totalCount = team?.fields.filter((f) => f.key !== 'original_document_url').length ?? 0;

  return (
    <div className="mx-auto max-w-lg p-4 md:p-6">
      <h1 className="mb-6 text-[22px] font-bold tracking-tight text-primary">Reglages</h1>

      {/* Profile header */}
      {user && (
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={user.name} size="lg" />
          <div className="min-w-0">
            <p className="text-lg font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">
              {team?.name ?? user.email}
            </p>
          </div>
        </div>
      )}

      {/* Account section */}
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
        <p className="px-4 pt-3 text-xs font-medium uppercase text-muted-foreground">
          Compte
        </p>
        <SettingsRow
          icon={Home}
          label="Mon entreprise"
          subLabel={`${filledCount}/${totalCount} champs renseignes`}
          iconClassName="bg-primary/10 text-primary"
          onClick={() => navigate('/settings/company')}
        />
      </div>

      {/* Subscription section */}
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
        <p className="px-4 pt-3 text-xs font-medium uppercase text-muted-foreground">
          Abonnement
        </p>
        <SettingsRow
          icon={CreditCard}
          label={subscriptionLabel}
          iconClassName="bg-accent/10 text-accent"
          trailing={
            <Badge variant={subscriptionVariant}>
              {team?.subscriptionStatus === 'trial' ? '47 jours restants' : subscriptionLabel}
            </Badge>
          }
          onClick={() => {}}
        />
      </div>

      {/* Preferences section */}
      <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
        <p className="px-4 pt-3 text-xs font-medium uppercase text-muted-foreground">
          Preferences
        </p>
        <SettingsRow
          icon={Bell}
          label="Notifications"
          trailing={
            <ToggleSwitch checked={notifications} onChange={setNotifications} />
          }
        />
        <SettingsRow icon={Download} label="Exporter mes donnees" onClick={() => {}} />
      </div>

      {/* Admin section — owners only */}
      {user?.god && (
        <div className="mb-6 overflow-hidden rounded-2xl border bg-card">
          <p className="px-4 pt-3 text-xs font-medium uppercase text-muted-foreground">
            Administration
          </p>
          <SettingsRow
            icon={Cpu}
            label="Consommation IA"
            subLabel="Couts et utilisation"
            iconClassName="bg-accent/10 text-accent"
            onClick={() => navigate('/settings/ai-costs')}
          />
          <SettingsRow
            icon={MessageSquare}
            label="Debug Chat"
            subLabel="Messages, tools, tokens"
            iconClassName="bg-accent/10 text-accent"
            onClick={() => navigate('/settings/debug-chat')}
          />
        </div>
      )}

      {/* Logout */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center justify-center py-3.5 text-[15px] font-semibold text-destructive transition-colors hover:bg-secondary"
        >
          Se deconnecter
        </button>
      </div>
    </div>
  );
}

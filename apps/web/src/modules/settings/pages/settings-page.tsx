import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  CreditCard,
  Bell,
  FileText,
  Download,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { SettingsRow } from '../components/settings-row';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, team, signOut } = useAuth();
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
        <SettingsRow icon={User} label="Mon profil" subLabel={user?.email} iconClassName="bg-primary/10 text-primary" onClick={() => {}} />
        <SettingsRow icon={FileText} label="Mes modeles" subLabel="Devis et factures" iconClassName="bg-primary/10 text-primary" onClick={() => navigate('/settings/templates')} />
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

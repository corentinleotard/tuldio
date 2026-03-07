import { useState, useEffect, createContext, useContext, useCallback, useMemo, type ReactNode } from 'react';
import { X, Upload, MoreVertical } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'pwa-install-dismissed';
const IS_MOBILE = /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
const IS_STANDALONE =
  window.matchMedia('(display-mode: standalone)').matches ||
  ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone);

// --- Shared context ---

interface PwaContextValue {
  canInstall: boolean;
  installed: boolean;
  install: () => Promise<void>;
}

const PwaContext = createContext<PwaContextValue>({
  canInstall: false,
  installed: IS_STANDALONE,
  install: async () => {},
});

export function usePwa() {
  return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(IS_STANDALONE);

  useEffect(() => {
    if (installed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [installed]);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const value = useMemo<PwaContextValue>(
    () => ({ canInstall: deferredPrompt !== null, installed, install }),
    [deferredPrompt, installed, install],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}

// --- Banner (mobile only, above bottom nav) ---

export function usePwaBanner() {
  const { installed } = usePwa();
  const [dismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');
  return IS_MOBILE && !installed && !dismissed;
}

export function PwaInstallPrompt() {
  const { canInstall, installed, install } = usePwa();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISSED_KEY) === 'true');

  if (!IS_MOBILE || installed || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, 'true');
  }

  async function handleInstall() {
    await install();
    dismiss();
  }

  if (canInstall) {
    return (
      <div className="flex h-10 items-center justify-between border-t border-border bg-card px-4">
        <span className="text-xs text-muted-foreground">Installe l'app Tuldio</span>
        <div className="flex shrink-0 items-center gap-2 pl-3">
          <button
            onClick={handleInstall}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white"
          >
            Installer
          </button>
          <button onClick={dismiss} className="p-0.5 text-muted-foreground">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-10 items-center justify-between border-t border-border bg-card px-4">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {IS_IOS ? (
          <>Installe l'app : <Upload size={12} className="text-primary" /> puis "Sur l'écran d'accueil"</>
        ) : (
          <>Installe l'app : menu <MoreVertical size={12} className="text-primary" /> puis "Installer"</>
        )}
      </span>
      <button onClick={dismiss} className="shrink-0 p-0.5 text-muted-foreground">
        <X size={14} />
      </button>
    </div>
  );
}

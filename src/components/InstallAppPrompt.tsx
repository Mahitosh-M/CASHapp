import { Download, Share2, Smartphone, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    cashAppInstallPrompt?: BeforeInstallPromptEvent | null;
    cashAppInstallListenersBound?: boolean;
  }
}

const INSTALL_AVAILABLE_EVENT = 'cashapp-install-available';
const DISMISS_STORAGE_KEY = 'cashapp:installPromptDismissedAt';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

if (typeof window !== 'undefined' && !window.cashAppInstallListenersBound) {
  window.cashAppInstallListenersBound = true;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    window.cashAppInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  });
  window.addEventListener('appinstalled', () => {
    window.cashAppInstallPrompt = null;
    window.dispatchEvent(new Event(INSTALL_AVAILABLE_EVENT));
  });
}

const isStandaloneApp = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

const isDismissedRecently = () => {
  try {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY));
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_MS;
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // Installation remains available even when private browsing blocks storage.
  }
};

export const InstallAppPrompt = ({ disabled = false }: { disabled?: boolean }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => window.cashAppInstallPrompt || null
  );
  const [visible, setVisible] = useState(false);

  const isIosSafari = useMemo(() => {
    const userAgent = window.navigator.userAgent;
    const isIos =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (userAgent.includes('Macintosh') && 'ontouchend' in document);
    const isSafari = /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
    return isIos && isSafari;
  }, []);

  useEffect(() => {
    const handleAvailabilityChange = () => {
      const nextPrompt = window.cashAppInstallPrompt || null;
      setDeferredPrompt(nextPrompt);
      if (!nextPrompt) setVisible(false);
    };

    window.addEventListener(INSTALL_AVAILABLE_EVENT, handleAvailabilityChange);
    return () => window.removeEventListener(INSTALL_AVAILABLE_EVENT, handleAvailabilityChange);
  }, []);

  useEffect(() => {
    if (disabled || isStandaloneApp() || isDismissedRecently()) {
      setVisible(false);
      return undefined;
    }

    if (!deferredPrompt && !isIosSafari) return undefined;

    const timerId = window.setTimeout(() => setVisible(true), 4000);
    return () => window.clearTimeout(timerId);
  }, [deferredPrompt, disabled, isIosSafari]);

  const closePrompt = () => {
    rememberDismissal();
    setVisible(false);
  };

  const installApp = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'dismissed') rememberDismissal();
    window.cashAppInstallPrompt = null;
    setDeferredPrompt(null);
    setVisible(false);
  };

  if (!visible) return null;

  const isIosPrompt = isIosSafari && !deferredPrompt;

  return (
    <div className="install-prompt-layer" role="region" aria-label="Install Cash App">
      <section className="install-prompt">
        <div className="install-prompt-header">
          <img src="/icons/icon-192.png" alt="" />
          <div>
            <span>{isIosPrompt ? 'iPhone Home Screen' : 'Quick Access'}</span>
            <strong>{isIosPrompt ? 'Install Cash App on iPhone' : 'Install Cash App'}</strong>
          </div>
          <button type="button" onClick={closePrompt} aria-label="Close install prompt" title="Later">
            <X size={19} />
          </button>
        </div>
        <div className="install-prompt-body">
          <div className="install-prompt-copy">
            {isIosPrompt ? <Share2 size={22} /> : <Smartphone size={22} />}
            <span>
              {isIosPrompt
                ? 'Tap Share, then choose Add to Home Screen.'
                : 'Keep Cash App on your mobile home screen.'}
            </span>
          </div>
          <div className="install-prompt-actions">
            <button type="button" className="secondary-button" onClick={closePrompt}>Later</button>
            <button type="button" className="primary-button" onClick={isIosPrompt ? closePrompt : installApp}>
              {isIosPrompt ? null : <Download size={17} />}
              {isIosPrompt ? 'Got it' : 'Install App'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

'use client';

import { useEffect, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function PwaRegister() {
  const [installPrompt, setInstallPrompt] =
    useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      }).then((registration) => registration.update()).catch(() => {
        // La web continúa funcionando normalmente si el registro no está disponible.
      });
    }

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator &&
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const iosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent);

    setIsIos(iosDevice && !standalone);

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setShowIosHelp(false);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallPrompt(null);
      return;
    }

    if (isIos) setShowIosHelp(true);
  };

  useEffect(() => {
    const handleInstallRequest = () => {
      void installApp();
    };

    window.addEventListener('albatros:install-app', handleInstallRequest);
    return () => {
      window.removeEventListener('albatros:install-app', handleInstallRequest);
    };
  }, [installPrompt, isIos]);

  if ((dismissed && !showIosHelp) || (!installPrompt && !isIos && !showIosHelp)) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] max-w-[calc(100vw-2rem)]">
      {showIosHelp ? (
        <div className="w-72 rounded-2xl border border-white/10 bg-[#0b0c10]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start gap-3">
            <Share2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-black uppercase italic">
                Instalar Albatros
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/65">
                En Safari pulsa Compartir y después “Agregar a pantalla de inicio”.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              className="ml-auto text-white/45 transition-colors hover:text-white"
              aria-label="Cerrar instrucciones"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#0b0c10]/90 p-1.5 shadow-2xl backdrop-blur-xl">
          <button
            type="button"
            onClick={installApp}
            className="flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-black uppercase italic tracking-wide text-white transition-transform hover:scale-[1.02] active:scale-95"
          >
            <Download className="h-4 w-4" />
            Instalar app
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="grid h-9 w-9 place-items-center rounded-full text-white/45 transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Ocultar instalación"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

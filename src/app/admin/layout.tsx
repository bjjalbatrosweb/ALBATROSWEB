'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import {
  FolderHeart,
  ClipboardList,
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  MonitorPlay,
  MessageCircleMore,
  ScrollText,
  Smartphone,
  UserCheck,
  CalendarDays,
  RadioTower,
  Fingerprint,
  QrCode,
  ReceiptText,
  RotateCcw,
  ShoppingCart,
  Cpu,
  Wifi,
  WifiOff,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { AdminAlertCenter } from '@/components/admin/admin-alert-center';
import { PwaNotificationControl } from '@/components/admin/pwa-notification-control';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
} from '@/lib/access-control';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type DeviceStatus = {
  deviceId?: string;
  dispositivo?: string;
  ultimoContacto?: Timestamp;
  puertaCerrada?: boolean;
  puertaBloqueada?: boolean;
  alarmaActiva?: boolean;
  rssi?: number | null;
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [exitIntent, setExitIntent] = useState<'home' | 'logout' | null>(null);
  const [currentSite, setCurrentSite] = useState<Sede | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [deviceStatusReady, setDeviceStatusReady] = useState(false);
  const [statusClock, setStatusClock] = useState(Date.now());
  const [restartIntent, setRestartIntent] = useState(false);
  const [isRestartingDevice, setIsRestartingDevice] = useState(false);

  /*
   * Firebase Authentication confirma la sesión y el documento usuarios/{uid}
   * determina el rol y las sedes permitidas. localStorage solo conserva la
   * sede elegida; nunca concede permisos por sí mismo.
   */
  useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      localStorage.removeItem('userSede');
      localStorage.removeItem('userRole');
      setIsSessionReady(false);
      setCurrentSite(null);
      router.replace('/login-profesor');
      return;
    }

    let cancelled = false;

    const verificarAcceso = async () => {
      const sedeGuardada = localStorage.getItem('userSede') as Sede | null;
      const perfilSnapshot = await getDoc(
        doc(firestore, 'usuarios', user.uid),
      );
      const perfil = perfilSnapshot.exists()
        ? normalizarPerfilAcceso(perfilSnapshot.data())
        : null;

      if (
        !cancelled &&
        sedeGuardada &&
        perfil &&
        puedeAdministrarSede(perfil, sedeGuardada)
      ) {
        localStorage.setItem('userRole', perfil.rol);
        setCurrentSite(sedeGuardada);
        setIsSessionReady(true);
        return;
      }

      if (!cancelled) {
        localStorage.removeItem('userSede');
        localStorage.removeItem('userRole');
        setIsSessionReady(false);
        await signOut(auth);
        router.replace('/login-profesor');
      }
    };

    void verificarAcceso();

    return () => {
      cancelled = true;
    };
  }, [auth, firestore, isUserLoading, router, user]);

  useEffect(() => {
    if (!isSessionReady || !currentSite) return;

    setDeviceStatusReady(false);
    const unsubscribe = onSnapshot(
      doc(firestore, 'DispositivosAcceso', currentSite),
      (snapshot) => {
        setDeviceStatus(snapshot.exists() ? snapshot.data() as DeviceStatus : null);
        setDeviceStatusReady(true);
        setStatusClock(Date.now());
      },
      () => setDeviceStatusReady(true),
    );

    return unsubscribe;
  }, [currentSite, firestore, isSessionReady]);

  useEffect(() => {
    const interval = window.setInterval(() => setStatusClock(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      localStorage.removeItem('userSede');
      localStorage.removeItem('userRole');
      await signOut(auth);
      router.replace('/login-profesor');
    } finally {
      setIsSigningOut(false);
    }
  };

  const confirmExit = async () => {
    if (exitIntent === 'home') {
      setExitIntent(null);
      router.push('/');
      return;
    }

    if (exitIntent === 'logout') {
      setExitIntent(null);
      await handleSignOut();
    }
  };

  const requestDeviceRestart = async () => {
    if (
      !user ||
      !currentSite ||
      !deviceStatus?.deviceId ||
      !deviceOnline ||
      isRestartingDevice
    ) return;

    try {
      setIsRestartingDevice(true);
      const token = await user.getIdToken();
      const response = await fetch('/api/dispositivo/reiniciar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sede: currentSite,
          deviceId: deviceStatus.deviceId,
          confirmar: true,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.mensaje || 'No se pudo enviar la orden.');

      setRestartIntent(false);
      toast({
        title: 'Reinicio solicitado',
        description: 'El ESP32 recibirá la orden en un máximo aproximado de 2 minutos. No se generó ninguna lectura RFID.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'No se reinició el ESP32',
        description: error instanceof Error ? error.message : 'Inténtalo nuevamente.',
      });
    } finally {
      setIsRestartingDevice(false);
    }
  };

  const lastContactMs = deviceStatus?.ultimoContacto?.toMillis?.() || 0;
  const secondsSinceContact = lastContactMs
    ? Math.max(0, Math.floor((statusClock - lastContactMs) / 1000))
    : null;
  // El firmware reporta cada 2 minutos. Cinco minutos toleran una señal
  // perdida o una demora temporal sin declarar el equipo desconectado.
  const deviceOnline = secondsSinceContact !== null && secondsSinceContact <= 300;
  const deviceLabel = !deviceStatusReady
    ? 'Comprobando'
    : deviceOnline
      ? 'ESP32 conectado'
      : 'ESP32 sin conexión';
  const lastContactLabel = secondsSinceContact === null
    ? 'Sin señales registradas'
    : secondsSinceContact < 60
      ? `Última señal hace ${secondsSinceContact} s`
      : `Última señal hace ${Math.floor(secondsSinceContact / 60)} min`;

  if (isUserLoading || !isSessionReady) {
    return (
      <div className="min-h-screen bg-background dark flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-bold uppercase tracking-wider">
            Verificando sesión...
          </span>
        </div>
      </div>
    );
  }

  const enlaces = [
    {
      href: '/admin/clase-activa',
      label: 'Clase activa',
      icon: RadioTower,
    },
    {
      href: '/admin/recepcion',
      label: 'Recepción',
      icon: UserCheck,
    },
    {
      href: '/admin/dashboard',
      label: 'Panel de Control',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/emergencias',
      label: 'Archivero',
      icon: FolderHeart,
    },
  ];

  const herramientas = [
    {
      href: '/admin/gestion-atletas',
      label: 'Gestión',
      icon: ClipboardList,
    },
    {
      href: '/admin/asistencia-nfc',
      label: 'Asistencia NFC',
      icon: Smartphone,
    },
    {
      href: '/admin/pantalla',
      label: 'Pantalla TV',
      icon: MonitorPlay,
    },
    {
      href: '/admin/historial',
      label: 'Historial',
      icon: ScrollText,
    },
    {
      href: '/admin/accesos-atletas',
      label: 'Accesos',
      icon: KeyRound,
    },
    {
      href: '/admin/avisos',
      label: 'Avisos',
      icon: Megaphone,
    },
    {
      href: '/admin/calendarios',
      label: 'Calendarios',
      icon: CalendarDays,
    },
    {
      href: '/admin/biometria',
      label: 'Gestión biométrica',
      icon: Fingerprint,
    },
    {
      href: '/admin/pagar',
      label: 'Pagar',
      icon: QrCode,
    },
    {
      href: '/admin/comprar',
      label: 'Comprar',
      icon: ShoppingCart,
    },
    {
      href: '/admin/compras',
      label: 'Compras',
      icon: ReceiptText,
    },
    {
      href: '/admin/firmware',
      label: 'Firmware ESP32',
      icon: Cpu,
    },
    {
      href: '/admin/prospectos-whatsapp',
      label: 'Prospectos WhatsApp',
      icon: MessageCircleMore,
    },
  ];

  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Barra superior del panel administrativo */}
      <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] w-full max-w-[1920px] items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setExitIntent('home')}
              className="shrink-0 rounded-xl p-1 transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              aria-label="Salir al menú principal"
              title="Ir al menú principal"
            >
              <Logo className="justify-start gap-1.5 [&_h1]:hidden xl:[&_h1]:block xl:[&_h1]:text-lg 2xl:[&_h1]:text-xl" />
            </button>

            <nav className="flex min-w-0 flex-1 items-center justify-evenly gap-0.5 overflow-x-auto [scrollbar-width:none] lg:overflow-visible [&::-webkit-scrollbar]:hidden">
              {enlaces.map((enlace) => {
                const Icono = enlace.icon;
                const activo = pathname === enlace.href;

                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    title={enlace.label}
                    aria-label={enlace.label}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-[11px] font-black uppercase tracking-[0.06em] transition-all lg:h-auto lg:w-auto lg:px-2.5 lg:py-2.5 2xl:px-3 ${
                      activo
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                    }`}
                  >
                    <Icono className="h-4 w-4 shrink-0" />
                    <span className="hidden lg:inline">{enlace.label}</span>
                  </Link>
                );
              })}
              <details className="group relative shrink-0">
                <summary
                  className={`flex h-10 w-10 cursor-pointer list-none items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border text-[11px] font-black uppercase tracking-[0.06em] transition-colors lg:h-auto lg:w-auto lg:px-2.5 lg:py-2.5 2xl:px-3 ${
                    herramientas.some((enlace) => pathname === enlace.href)
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  <span className="hidden whitespace-nowrap lg:inline">Más herramientas</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="fixed inset-x-3 top-[4.75rem] z-[100] grid max-h-[calc(100vh-6rem)] gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-2xl lg:absolute lg:inset-x-auto lg:right-0 lg:top-[calc(100%+10px)] lg:min-w-64 lg:overflow-visible">
                  {herramientas.map((enlace) => {
                    const Icono = enlace.icon;
                    const activo = pathname === enlace.href;
                    return (
                      <Link
                        key={enlace.href}
                        href={enlace.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-xs font-black uppercase tracking-wider transition-colors ${
                          activo
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-primary/5 hover:text-primary'
                        }`}
                      >
                        <Icono className="h-4 w-4" />
                        {enlace.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 border-l border-border/60 pl-2">
            <div
              className={`flex items-center gap-1.5 rounded-full border p-2 text-[11px] font-black uppercase tracking-[0.08em] transition-colors ${
                !deviceStatusReady
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : deviceOnline
                    ? 'border-green-500/30 bg-green-500/10 text-green-400'
                    : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
              title={`${deviceLabel} · ${deviceStatus?.deviceId || 'Sin identificador'} · ${lastContactLabel} · Sede ${currentSite?.replace('_', ' ') || '...'}`}
              aria-label={`${deviceLabel}. ${lastContactLabel}`}
            >
              <span className="relative flex h-2.5 w-2.5">
                {deviceOnline && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-60" />
                )}
                <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                  !deviceStatusReady
                    ? 'bg-amber-400'
                    : deviceOnline
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`} />
              </span>
              {deviceOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            </div>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setRestartIntent(true)}
              disabled={!deviceOnline || !deviceStatus?.deviceId || isRestartingDevice}
              title={deviceOnline ? 'Reiniciar ESP32' : 'El ESP32 debe estar conectado para reiniciarlo'}
              aria-label="Reiniciar ESP32"
              className="px-2"
            >
              <RotateCcw className={`h-4 w-4 ${isRestartingDevice ? 'animate-spin' : ''}`} />
            </Button>
            <AdminAlertCenter />
            <div className="[&_button]:px-2 [&_button_span]:hidden [&_svg]:m-0">
              <PwaNotificationControl />
            </div>

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={() => setExitIntent('logout')}
              disabled={isSigningOut}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <AlertDialog
        open={exitIntent !== null}
        onOpenChange={(open) => {
          if (!open && !isSigningOut) setExitIntent(null);
        }}
      >
        <AlertDialogContent className="max-w-md border-primary/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-black uppercase italic">
              ¿Quieres salir?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {exitIntent === 'logout'
                ? 'Se cerrará tu sesión administrativa y tendrás que iniciar sesión nuevamente.'
                : 'Saldrás del panel administrativo y volverás al menú principal. Tu sesión permanecerá activa.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSigningOut}>
              Quedarme
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmExit();
              }}
              disabled={isSigningOut}
              className="font-black uppercase"
            >
              {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={restartIntent}
        onOpenChange={(open) => {
          if (!open && !isRestartingDevice) setRestartIntent(false);
        }}
      >
        <AlertDialogContent className="max-w-md border-amber-500/25">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-xl font-black uppercase italic">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              ¿Reiniciar el ESP32?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Se enviará una orden única al dispositivo <strong>{deviceStatus?.deviceId}</strong> de la sede {currentSite?.replace('_', ' ')}.
              </span>
              <span className="block">
                No registra asistencias, no abre la puerta y no ejecuta una lectura RFID. El control de acceso estará fuera de servicio durante unos segundos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestartingDevice}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void requestDeviceRestart();
              }}
              disabled={isRestartingDevice || !deviceOnline}
              className="bg-amber-600 font-black uppercase text-white hover:bg-amber-700"
            >
              {isRestartingDevice && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar reinicio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

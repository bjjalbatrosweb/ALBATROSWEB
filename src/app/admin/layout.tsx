'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { AdminAlertCenter } from '@/components/admin/admin-alert-center';
import { PwaNotificationControl } from '@/components/admin/pwa-notification-control';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useUser } from '@/firebase';
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
} from '@/lib/access-control';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';

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
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
      href: '/admin/prospectos-whatsapp',
      label: 'Prospectos WhatsApp',
      icon: MessageCircleMore,
    },
  ];

  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Barra superior del panel administrativo */}
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-2 sm:px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo />

            <nav className="hidden md:flex items-center gap-6">
              {enlaces.map((enlace) => {
                const Icono = enlace.icon;
                const activo = pathname === enlace.href;

                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors ${
                      activo
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-primary'
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                    {enlace.label}
                  </Link>
                );
              })}
              <details className="group relative">
                <summary
                  className={`flex cursor-pointer list-none items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                    herramientas.some((enlace) => pathname === enlace.href)
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border/70 text-muted-foreground hover:border-primary/30 hover:text-primary'
                  }`}
                >
                  Más herramientas
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-[calc(100%+10px)] z-50 grid min-w-64 gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
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

          <div className="flex items-center gap-1 sm:gap-3">
            <AdminAlertCenter />
            <PwaNotificationControl />

            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin md:mr-2" />
              ) : (
                <LogOut className="h-4 w-4 md:mr-2" />
              )}
              <span className="hidden md:inline">Salir</span>
            </Button>
          </div>
        </div>
      </header>

      <nav className="md:hidden border-b bg-card overflow-x-auto">
        <div className="flex min-w-max px-3">
          {enlaces.map((enlace) => {
            const Icono = enlace.icon;
            const activo = pathname === enlace.href;

            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activo
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                <Icono className="h-4 w-4" />
                {enlace.label}
              </Link>
            );
          })}
          <details className="group relative">
            <summary className="flex h-full cursor-pointer list-none items-center gap-2 border-b-2 border-transparent px-4 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Más
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="fixed inset-x-3 top-[7.5rem] z-50 grid gap-1 rounded-2xl border border-border bg-card p-2 shadow-2xl">
              {herramientas.map((enlace) => {
                const Icono = enlace.icon;
                return (
                  <Link
                    key={enlace.href}
                    href={enlace.href}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 text-xs font-black uppercase ${
                      pathname === enlace.href
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                    {enlace.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </nav>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FolderHeart,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
  Smartphone,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const enlaces = [
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
  ];

  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Barra superior del panel administrativo */}
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
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
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              asChild
            >
              <Link href="/">
                <LogOut className="mr-2 h-4 w-4" />
                Salir
              </Link>
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
        </div>
      </nav>

      <main className="flex-1 container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

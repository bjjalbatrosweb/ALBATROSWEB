'use client';

import React from 'react';
import Link from 'next/link';
import {
  FolderHeart,
  LayoutDashboard,
  LogOut,
  MonitorPlay,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background dark flex flex-col">
      {/* Barra superior del panel administrativo */}
      <header className="border-b bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo />

            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/admin/dashboard"
                className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Panel de Control
              </Link>

              <Link
                href="/admin/emergencias"
                className="text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"
              >
                <FolderHeart className="h-4 w-4" />
                Archivero
              </Link>

              <Link
                href="/admin/pantalla"
                className="text-sm font-bold uppercase tracking-wider text-muted-foreground hover:text-primary flex items-center gap-2 transition-colors"
              >
                <MonitorPlay className="h-4 w-4" />
                Pantalla TV
              </Link>
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

      <main className="flex-1 container mx-auto p-4 md:p-8">
        {children}
      </main>
    </div>
  );
}

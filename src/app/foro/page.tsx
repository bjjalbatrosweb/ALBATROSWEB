
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Lock, MessageSquare, ArrowLeft } from "lucide-react";
import Link from 'next/link';

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);

  const CORRECT_PASSWORD = "SoyTeamAlbatrosBjj";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Link href="/" className="absolute top-4 left-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
        </Link>
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase">Acceso al Foro</CardTitle>
            <CardDescription>Solo para guerreros del equipo. Introduce la contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña de equipo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn("bg-background", error && "border-destructive")}
                />
                {error && <p className="text-xs text-destructive font-medium">Contraseña incorrecta. Solo los Albatros pasan aquí.</p>}
              </div>
              <Button type="submit" className="w-full font-bold uppercase tracking-widest">
                <Lock className="mr-2 h-4 w-4" /> Entrar al Nido
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Logo />
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-primary">Foro Albatros</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Salir del Foro
          </Button>
        </Link>
      </header>

      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="text-primary h-6 w-6" />
              Bienvenido al Nido, Guerrero
            </CardTitle>
            <CardDescription>Espacio exclusivo para estrategia, técnica y comunidad.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-primary/20 rounded-lg bg-card/50 p-8 text-center">
               <div className="bg-primary/10 p-4 rounded-full mb-4">
                 <MessageSquare className="h-12 w-12 text-primary" />
               </div>
               <h3 className="text-xl font-bold mb-2 uppercase">Canal de Comunicación</h3>
               <p className="text-muted-foreground max-w-md">
                 Este espacio está siendo preparado para las discusiones tácticas. Por ahora, utiliza los canales de WhatsApp oficiales para comunicación inmediata.
               </p>
               <Button className="mt-6" variant="outline" asChild>
                 <a href="https://wa.me/message/MLU5C2HUNOCEN1" target="_blank" rel="noopener noreferrer">Ir al WhatsApp de Equipo</a>
               </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Utility to ensure CN works (copying from lib/utils if needed or using direct string)
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

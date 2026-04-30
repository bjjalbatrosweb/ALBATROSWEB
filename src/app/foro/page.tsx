
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Lock, MessageSquare, ArrowLeft, BookOpen, GraduationCap, ChevronRight, Layout, PlayCircle, Info } from "lucide-react";
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const NIVEL_1_TECNICAS = [
  { id: '1.1', name: 'Mataleón', category: 'Sumisión', difficulty: 'Básica', description: 'Estrangulación sanguínea desde la espalda. El control definitivo.' },
  { id: '1.2', name: 'Armbar', category: 'Sumisión', difficulty: 'Básica', description: 'Palanca de brazo desde guardia cerrada o montada.' },
  { id: '1.3', name: 'Americana', category: 'Sumisión', difficulty: 'Básica', description: 'Ataque al hombro y codo desde posición lateral (Side Control).' },
  { id: '1.4', name: 'Kimura', category: 'Sumisión', difficulty: 'Básica', description: 'Rotación de hombro utilizando el agarre de figura 4.' },
  { id: '1.5', name: 'Guillotina', category: 'Sumisión', difficulty: 'Básica', description: 'Estrangulación frontal al cuello, efectiva en transiciones y defensa de derribo.' },
  { id: '1.6', name: 'Triángulo de Piernas', category: 'Sumisión', difficulty: 'Intermedia', description: 'Estrangulación utilizando las piernas desde la guardia.' },
  { id: '1.7', name: 'Omoplata', category: 'Sumisión', difficulty: 'Intermedia', description: 'Ataque al hombro utilizando las piernas como palanca.' },
  { id: '1.8', name: 'Raspado de Tijera', category: 'Transición', difficulty: 'Básica', description: 'Movimiento fundamental para invertir la posición desde guardia cerrada.' },
  { id: '1.9', name: 'Escape Upa', category: 'Defensa', difficulty: 'Básica', description: 'Escape esencial desde la montada utilizando el puente de cadera.' },
  { id: '1.10', name: 'Paso de Guardia Torreando', category: 'Pasaje', difficulty: 'Básica', description: 'Pasaje de guardia explosivo controlando los tobillos o rodillas.' },
];

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);

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

  // Vista de Técnicas del Nivel 1
  if (activeModule === 'nivel-1') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Logo />
            <Separator orientation="vertical" className="h-8 hidden md:block" />
            <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Nivel 1: Biblioteca Técnica</h1>
          </div>
          <Button variant="ghost" onClick={() => setActiveModule(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Módulos
          </Button>
        </header>

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {NIVEL_1_TECNICAS.map((tecnica) => (
              <Card key={tecnica.id} className="bg-card/40 border-primary/10 hover:border-primary/40 transition-all group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20">{tecnica.id}</Badge>
                    <Badge className="text-[10px] uppercase">{tecnica.category}</Badge>
                  </div>
                  <CardTitle className="text-xl font-black uppercase italic group-hover:text-primary transition-colors">
                    {tecnica.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tecnica.description}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Dificultad: {tecnica.difficulty}</span>
                    <Button size="sm" className="font-bold uppercase tracking-tighter">
                      <PlayCircle className="mr-1 h-4 w-4" /> Ver Detalles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Dashboard del Foro
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Logo />
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-primary italic">Foro Albatros</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Salir del Foro
          </Button>
        </Link>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            <GraduationCap className="h-3 w-3" /> Area de Entrenamiento
          </div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">¡Bienvenido al Nido, Guerrero!</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Este es tu centro de comando técnico. Aquí tendrás acceso exclusivo a tutoriales detallados, 
            desgloses estratégicos y anotaciones de técnicas avanzadas. Todo nuestro arsenal está 
            dividido por nivel y dificultad para que tu progresión sea constante y letal.
          </p>
        </section>

        <Separator className="bg-primary/20" />

        <section className="grid gap-6">
          <h3 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" /> Módulos Disponibles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="group hover:border-primary transition-all duration-300 bg-card/40 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black tracking-tight text-primary uppercase">Nivel 1</CardTitle>
                <CardDescription className="font-bold text-foreground">Cinta blanca principiante</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground italic">
                  Fundamentos críticos, movilidad básica y escapes esenciales. El cimiento de tu juego de combate.
                </p>
                <Button 
                  onClick={() => setActiveModule('nivel-1')}
                  className="w-full font-black uppercase tracking-tighter group-hover:bg-primary group-hover:text-white transition-colors"
                >
                  Explorar Técnicas <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="opacity-50 grayscale border-dashed bg-muted/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black tracking-tight uppercase">Nivel 2</CardTitle>
                <CardDescription className="font-bold">Intermedio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  Próximamente disponible. Enfocado en transiciones y ataques encadenados.
                </p>
                <Button disabled className="w-full mt-4 font-black uppercase tracking-tighter" variant="secondary">
                   <Lock className="mr-2 h-4 w-4" /> Bloqueado
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="p-6 rounded-lg border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-tight">¿Dudas sobre la técnica?</h4>
              <p className="text-sm text-muted-foreground">Consulta directamente con el equipo de instructores.</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <a href="https://wa.me/message/MLU5C2HUNOCEN1" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
          </Button>
        </section>
      </div>
    </div>
  );
}

// Utility function
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}

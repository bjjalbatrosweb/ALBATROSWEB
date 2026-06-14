'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { 
  Trophy, Award, Star, ShieldCheck, 
  ChevronRight, ArrowLeft, Zap, Heart, 
  Target, Flame, Medal, Crown
} from "lucide-react";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const REWARDS_LEVELS = [
  { level: 'Cinturón Blanco', points: 'Inicio', bonus: 'Acceso al arsenal de nutrición base.', icon: ShieldCheck, color: 'bg-white text-black border' },
  { level: 'Cinturón Azul', points: '500 PTS', bonus: 'Descuento del 5% en equipamiento oficial.', icon: Award, color: 'bg-blue-600 text-white' },
  { level: 'Cinturón Morado', points: '1500 PTS', bonus: 'Consultoría personalizada con el Head Coach.', icon: Zap, color: 'bg-purple-700 text-white' },
  { level: 'Cinturón Café', points: '3000 PTS', bonus: 'Acceso a seminarios exclusivos VIP.', icon: Star, color: 'bg-amber-900 text-white' },
  { level: 'Cinturón Negro', points: '5000 PTS', bonus: 'Inscripción gratuita a un torneo estatal.', icon: Crown, color: 'bg-neutral-950 text-white' },
];

const ACHIEVEMENTS = [
  { title: 'Disciplina de Acero', desc: 'Registra tu bitácora por 30 días seguidos.', pts: '+200 PTS', icon: Flame },
  { title: 'Guerrero Nutricional', desc: 'Cumple tus macros semanales al 95%.', pts: '+150 PTS', icon: Heart },
  { title: 'Cazador de Eventos', desc: 'Participa en un torneo oficial Albatros.', pts: '+500 PTS', icon: Trophy },
  { title: 'Espíritu de Equipo', desc: 'Refiere a un nuevo miembro a la academia.', pts: '+300 PTS', icon: Target },
];

export default function RecompensasPage() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-4">
          <Logo />
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <h1 className="text-2xl font-black tracking-tighter uppercase italic text-primary">Programa de Recompensas</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
          </Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Forja tu <span className="text-primary">Legado</span></h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Cada gota de sudor en el tatami y cada comida registrada cuentan. Sube de nivel, desbloquea rangos y obtén beneficios exclusivos de élite.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Progression Column */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-black uppercase italic flex items-center gap-2">
                  <Medal className="text-primary" /> Sistema de Rangos
                </CardTitle>
                <CardDescription>Escala la jerarquía del equipo Albatros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {REWARDS_LEVELS.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 rounded-xl border bg-background/50 hover:border-primary/40 transition-colors group">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${item.color} shadow-lg`}>
                      <item.icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center">
                        <h4 className="font-bold text-lg">{item.level}</h4>
                        <Badge variant="outline" className="font-black text-primary border-primary/20">{item.points}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 italic group-hover:text-foreground transition-colors">
                        Beneficio: {item.bonus}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Achievements Column */}
          <div className="space-y-8">
            <Card className="border-primary/10">
              <CardHeader>
                <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2">
                  <Star className="text-primary" /> Medallas de Honor
                </CardTitle>
                <CardDescription>Hitos que demuestran tu disciplina.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {ACHIEVEMENTS.map((ach, i) => (
                  <div key={i} className="flex gap-4 items-start border-b border-primary/5 pb-4 last:border-0">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <ach.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-bold text-sm uppercase tracking-tight">{ach.title}</h5>
                      <p className="text-xs text-muted-foreground mt-1">{ach.desc}</p>
                      <span className="text-xs font-black text-primary mt-2 block">{ach.pts}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-primary text-white border-none shadow-2xl">
              <CardHeader>
                <CardTitle className="font-black uppercase italic">¡Empieza Hoy!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm font-medium opacity-90">
                  Regístrate como atleta y comienza a acumular puntos automáticamente con tu actividad diaria.
                </p>
                <Button variant="secondary" className="w-full font-black uppercase" asChild>
                  <Link href="/signup">Unirme al Nido <ChevronRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="mt-20 py-8 border-t border-primary/10 text-center max-w-6xl mx-auto">
        <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
          © {new Date().getFullYear()} Team Albatros BJJ • Ciencia y Combate
        </p>
      </footer>
    </div>
  );
}

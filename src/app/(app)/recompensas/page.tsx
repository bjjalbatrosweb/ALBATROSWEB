"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Trophy, Award, Star, ShieldCheck, 
  ChevronRight, Zap, Heart, 
  Target, Flame, Medal, Crown
} from "lucide-react";
import Link from 'next/link';
import { Badge } from "@/components/ui/badge";

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
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Forja tu legado en el tatami y desbloquea beneficios de élite.</p>
      </header>

      <main className="space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-4 py-8 bg-primary/5 rounded-xl border border-primary/10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">Sube de <span className="text-primary">Grado</span></h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            Cada entrenamiento registrado y cada objetivo nutricional cumplido te acerca al Cinturón Negro.
          </p>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Progression Column */}
          <div className="lg:col-span-2 space-y-8">
            <Card className="border-primary/20 bg-card/50 backdrop-blur-sm shadow-xl">
              <CardHeader>
                <CardTitle className="text-2xl font-black uppercase italic flex items-center gap-2 text-primary">
                  <Medal /> Sistema de Rangos
                </CardTitle>
                <CardDescription>Escala la jerarquía del equipo Albatros BJJ.</CardDescription>
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
            <Card className="border-primary/10 bg-secondary/20">
              <CardHeader>
                <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2 text-primary">
                  <Star /> Medallas de Honor
                </CardTitle>
                <CardDescription>Hitos de disciplina táctica.</CardDescription>
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

            <Card className="bg-primary text-white border-none shadow-2xl overflow-hidden relative group">
              <div className="absolute inset-0 bg-black/20 group-hover:scale-110 transition-transform duration-700"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="font-black uppercase italic">¡Disciplina Diaria!</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 relative z-10">
                <p className="text-sm font-medium opacity-90">
                  Tu actividad en la bitácora suma puntos automáticamente a tu perfil de guerrero.
                </p>
                <Button variant="secondary" className="w-full font-black uppercase" asChild>
                  <Link href="/bitacora">Ir a Bitácora <ChevronRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <footer className="pt-12 text-center">
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest opacity-50">
          Team Albatros BJJ • Sistema de Méritos de Combate
        </p>
      </footer>
    </div>
  );
}

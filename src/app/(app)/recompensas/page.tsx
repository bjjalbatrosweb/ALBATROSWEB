'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Award, Star, Medal, Target, ShieldCheck, Zap, Flame, Crown } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const beltLevels = [
  { level: 'Blanco', color: 'bg-white text-black border-black/20', description: 'El inicio del camino. Hambre de aprender.', xpRequired: 0 },
  { level: 'Azul', color: 'bg-blue-600 text-white', description: 'Dominio de los fundamentos. El primer gran escalón.', xpRequired: 1000 },
  { level: 'Morado', color: 'bg-purple-700 text-white', description: 'Refinamiento técnico y fluidez.', xpRequired: 5000 },
  { level: 'Marrón', color: 'bg-amber-900 text-white', description: 'Precisión letal y control absoluto.', xpRequired: 15000 },
  { level: 'Negro', color: 'bg-black text-white', description: 'Maestría. Un nuevo comienzo.', xpRequired: 50000 },
];

const achievements = [
  { id: 1, title: 'Primer Vuelo', description: 'Registra tu primera semana completa de entrenos.', icon: Zap, points: 100 },
  { id: 2, title: 'Depredador', description: 'Registra 50 comidas tácticas en la bitácora.', icon: Flame, points: 500 },
  { id: 3, title: 'Inmortal', description: '30 días seguidos de actividad sin fallar.', icon: Crown, points: 2000 },
  { id: 4, title: 'Cerebro Táctico', description: 'Genera y guarda 10 recetas del Chef IA.', icon: BrainCircuit, points: 300 },
  { id: 5, title: 'Peso en Regla', description: 'Mantente en tu categoría de peso por 3 meses.', icon: Target, points: 1000 },
];

export default function RecompensasPage() {
  const currentXP = 750; // Simulated XP
  const nextLevel = beltLevels[1];
  const progress = (currentXP / nextLevel.xpRequired) * 100;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter italic uppercase">Programa de Recompensas</h1>
        <p className="text-muted-foreground italic">Forja tu legado. Sube de nivel, gana medallas, domina el tatami.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Nivel de Cinturón Actual */}
        <Card className="lg:col-span-1 border-primary/20 bg-background/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black uppercase tracking-tight italic">
              <Trophy className="text-primary h-6 w-6" /> Tu Grado Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <div className="flex justify-center py-4">
                <div className="relative">
                    <div className="h-32 w-32 rounded-full border-4 border-primary/20 flex items-center justify-center bg-secondary/30">
                        <Award className="h-16 w-16 text-primary" />
                    </div>
                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-white text-black border-black font-black uppercase px-4">
                        Cinturón Blanco
                    </Badge>
                </div>
            </div>
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase italic text-muted-foreground">
                    <span>Progreso al Cinturón Azul</span>
                    <span>{currentXP} / {nextLevel.xpRequired} XP</span>
                </div>
                <Progress value={75} className="h-3 bg-secondary" />
                <p className="text-[10px] text-muted-foreground italic">Faltan 250 XP para el siguiente grado.</p>
            </div>
          </CardContent>
        </Card>

        {/* Niveles de Cinturón */}
        <Card className="lg:col-span-2 border-primary/10">
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-tight italic">Escalafón Albatros</CardTitle>
            <CardDescription className="italic">El camino del guerrero está marcado por su constancia.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {beltLevels.map((belt, idx) => (
                <div key={idx} className="flex items-center gap-4 p-3 rounded-md border bg-card/30 group hover:border-primary/50 transition-all">
                  <div className={cn("h-4 w-16 rounded shadow-sm shrink-0", belt.color)} />
                  <div className="flex-1">
                    <h4 className="text-sm font-black uppercase italic">{belt.level}</h4>
                    <p className="text-xs text-muted-foreground italic">{belt.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{belt.xpRequired} XP</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Logros y Medallas */}
        <Card className="lg:col-span-3 border-primary/10">
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-tight italic flex items-center gap-2">
                <Medal className="text-primary h-6 w-6" /> Medallas de Honor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {achievements.map((ach) => (
                <div key={ach.id} className="p-4 rounded-xl border bg-secondary/20 text-center flex flex-col items-center gap-3 group hover:bg-secondary/40 transition-colors">
                  <div className="p-3 bg-background rounded-full border border-primary/10 group-hover:scale-110 transition-transform">
                    <ach.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h4 className="text-sm font-black uppercase italic leading-tight">{ach.title}</h4>
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">{ach.description}</p>
                  <Badge variant="outline" className="mt-auto border-primary/20 text-primary font-bold">+{ach.points} XP</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Beneficios de Grado */}
        <Card className="lg:col-span-3 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="font-black uppercase tracking-tight italic flex items-center gap-2">
                <Star className="text-primary h-6 w-6" /> Beneficios por Rango
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <h5 className="font-bold text-sm uppercase italic flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Iniciados (Blanco-Azul)
                </h5>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1 italic">
                    <li>Acceso al Laboratorio Biométrico.</li>
                    <li>Uso de la Bitácora de Combate.</li>
                    <li>Soporte básico de comunidad.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-bold text-sm uppercase italic flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Expertos (Morado-Marrón)
                </h5>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1 italic">
                    <li>Desbloqueo del Chef IA Avanzado.</li>
                    <li>Planes nutricionales personalizados.</li>
                    <li>Descuentos en seminarios y torneos.</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h5 className="font-bold text-sm uppercase italic flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" /> Maestros (Negro)
                </h5>
                <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1 italic">
                    <li>Consultoría estratégica 1-a-1.</li>
                    <li>Acceso a seminarios exclusivos VIP.</li>
                    <li>Identidad visual dorada en el nido Albatros.</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

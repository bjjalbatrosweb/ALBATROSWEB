"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, Target, Flame, Award, ShieldCheck, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const REWARDS_LEVELS = [
  { level: 'Cinturón Blanco', points: '0 - 500', description: 'Iniciación al camino del guerrero.', color: 'bg-slate-100 text-black border-slate-300' },
  { level: 'Cinturón Azul', points: '501 - 1500', description: 'Técnica base consolidada y disciplina constante.', color: 'bg-blue-600 text-white border-blue-800' },
  { level: 'Cinturón Morado', points: '1501 - 3000', description: 'Dominio de la estrategia y fluidez en el combate.', color: 'bg-purple-700 text-white border-purple-900' },
  { level: 'Cinturón Marrón', points: '3001 - 5000', description: 'Refinamiento de la técnica y liderazgo en el tatami.', color: 'bg-amber-900 text-white border-black' },
  { level: 'Cinturón Negro', points: '5000+', description: 'Maestría total y compromiso con el legado Albatros.', color: 'bg-neutral-950 text-white border-primary' },
];

const ACHIEVEMENTS = [
  { id: 1, name: 'Primer Sangre', description: 'Registra tu primera comida en la bitácora.', icon: Flame, completed: true },
  { id: 2, name: 'Científico de Datos', description: 'Completa tu primer cálculo en el laboratorio.', icon: Target, completed: true },
  { id: 3, name: 'Asistencia Perfecta', description: '7 días seguidos de registros de entrenamiento.', icon: Star, completed: false },
  { id: 4, name: 'Peso Táctico', description: 'Alcanza tu peso objetivo de categoría UFC.', icon: Award, completed: false },
];

export default function RecompensasPage() {
  // En un sistema real, estos puntos vendrían de Firestore sumando actividades
  const userPoints = 420; 
  const currentBelt = REWARDS_LEVELS[0];
  const nextBelt = REWARDS_LEVELS[1];
  const progressToNext = (userPoints / 500) * 100;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter italic uppercase">Programa de Recompensas Albatros</h1>
        <p className="text-muted-foreground">Tu disciplina se traduce en rango. Cada registro te acerca a la maestría.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Progress Card */}
          <Card className="bg-gradient-to-br from-card to-secondary/30 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <Trophy className="h-40 w-40" />
            </div>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Estado de Rango Actual</CardTitle>
                  <h2 className="text-4xl font-black tracking-tighter mt-2">{currentBelt.level}</h2>
                </div>
                <Badge className={cn("px-4 py-1 text-sm font-bold border-2", currentBelt.color)}>
                  LVL 1
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span>Progreso al {nextBelt.level}</span>
                  <span className="text-primary">{userPoints} / 500 PTS</span>
                </div>
                <Progress value={progressToNext} className="h-3" />
              </div>
              <p className="text-sm text-muted-foreground italic">
                "El cinturón solo sirve para sujetar los pantalones. Lo que importa es lo que llevas dentro del pecho."
              </p>
            </CardContent>
          </Card>

          {/* Achievement Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="col-span-full text-lg font-black uppercase tracking-tighter italic flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" /> Medallas de Desbloqueadas
            </h3>
            {ACHIEVEMENTS.map((ach) => (
              <Card key={ach.id} className={cn("transition-all", !ach.completed && "opacity-50 grayscale")}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("p-3 rounded-full", ach.completed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                    <ach.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm uppercase">{ach.name}</h4>
                    <p className="text-xs text-muted-foreground">{ach.description}</p>
                  </div>
                  {ach.completed && <ShieldCheck className="h-4 w-4 text-primary ml-auto" />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase italic">Jerarquía del Nido</CardTitle>
              <CardDescription>Escala en el ranking y obtén beneficios.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {REWARDS_LEVELS.map((level, i) => (
                  <div key={i} className="p-4 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className={cn("w-3 h-10 rounded-full", level.color.split(' ')[0])} />
                    <div className="flex-1">
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-sm">{level.level}</span>
                            <span className="text-[10px] font-bold text-muted-foreground">{level.points} PTS</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-1">{level.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Próximo Beneficio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                    <ChevronRight className="h-4 w-4 text-primary mt-1 shrink-0" />
                    <p className="text-sm">Al llegar a <b>Cinturón Azul</b>, desbloqueas el acceso a <b>Seminarios Exclusivos No-Gi</b> sin costo adicional.</p>
                </div>
                <div className="p-3 bg-card rounded-md border border-dashed text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Código de descuento en Tienda</p>
                    <p className="text-lg font-black tracking-[0.2em]">BLOQUEADO</p>
                </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
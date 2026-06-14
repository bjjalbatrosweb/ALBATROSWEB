"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, Medal, Award, CheckCircle2, Lock, BrainCircuit } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

const levels = [
  { name: 'Cinturón Blanco', status: 'completed', description: 'Fundamentos básicos dominados.' },
  { name: 'Cinturón Azul', status: 'current', description: 'Control y técnica en progresión.', progress: 45 },
  { name: 'Cinturón Morado', status: 'locked', description: 'Refinamiento táctico avanzado.' },
  { name: 'Cinturón Marrón', status: 'locked', description: 'Maestría técnica y estratégica.' },
  { name: 'Cinturón Negro', status: 'locked', description: 'Dominio absoluto del arte.' },
];

const achievements = [
  { title: 'Asistencia Perfecta', description: '30 días seguidos de entrenamiento.', icon: Medal, unlocked: true },
  { title: 'Guerrero Nutricional', description: 'Cumplir macros por 2 semanas.', icon: Trophy, unlocked: true },
  { title: 'Estratega de Combate', description: 'Completar 10 desgloses técnicos.', icon: BrainCircuit, unlocked: false },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-black tracking-tighter">Programa de Recompensas</h1>
            <p className="text-muted-foreground">Tu disciplina se premia. Sube de rango y desbloquea medallas.</p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-black tracking-tighter">Progreso de Rango</CardTitle>
              <CardDescription>Tu camino hacia la maestría.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {levels.map((level, i) => (
                <div key={i} className={`p-4 rounded-lg border flex items-center gap-4 ${level.status === 'locked' ? 'opacity-50' : ''}`}>
                  <div className={`p-3 rounded-full ${level.status === 'completed' ? 'bg-primary/10 text-primary' : level.status === 'current' ? 'bg-primary text-white animate-pulse' : 'bg-muted text-muted-foreground'}`}>
                    {level.status === 'completed' ? <CheckCircle2 className="h-6 w-6" /> : level.status === 'locked' ? <Lock className="h-6 w-6" /> : <Star className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold">{level.name}</h4>
                      {level.status === 'current' && <span className="text-xs font-bold text-primary uppercase">Actual</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                    {level.status === 'current' && <Progress value={level.progress} className="h-1.5 mt-3" />}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-black tracking-tighter">Logros Desbloqueados</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {achievements.map((ach, i) => (
                <div key={i} className={`flex items-center gap-4 p-3 rounded-md border ${ach.unlocked ? 'bg-secondary/30' : 'bg-muted/10 opacity-60'}`}>
                  <ach.icon className={`h-8 w-8 ${ach.unlocked ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-bold">{ach.title}</p>
                    <p className="text-[10px] text-muted-foreground">{ach.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary text-white border-none">
            <CardHeader>
              <CardTitle className="font-black tracking-tighter italic text-white">BONO DE GUERRERO</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm opacity-90 leading-tight">
                Al llegar al Rango Púrpura, obtendrás un 15% de descuento en Rashguards oficiales Albatros.
              </p>
              <Badge variant="outline" className="mt-4 border-white text-white">¡Entrena Fuerte!</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

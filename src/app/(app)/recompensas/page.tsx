"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Target, ShieldCheck, Flame } from 'lucide-react';

const ranks = [
  { level: 'Cinturón Blanco', progress: 100, color: 'bg-slate-100 text-slate-900', description: 'El inicio del camino. Disciplina y fundamentos.' },
  { level: 'Cinturón Azul', progress: 45, color: 'bg-blue-600 text-white', description: 'Navegando las aguas técnicas. Resistencia probada.' },
  { level: 'Cinturón Morado', progress: 0, color: 'bg-purple-700 text-white', description: 'Refinamiento táctico. El arte se vuelve propio.' },
  { level: 'Cinturón Café', progress: 0, color: 'bg-amber-900 text-white', description: 'Dominio de la presión. Fuerza y precisión.' },
  { level: 'Cinturón Negro', progress: 0, color: 'bg-zinc-950 text-white', description: 'Maestría técnica. Un nuevo comienzo.' },
];

const achievements = [
  { id: 1, title: 'Asistencia Perfecta', description: '30 días seguidos de entrenamiento.', icon: Flame, earned: true },
  { id: 2, title: 'Puntualidad Marcial', description: 'Llegar 10 min antes por una semana.', icon: Target, earned: true },
  { id: 3, title: 'Guerrero del Mes', description: 'Reconocimiento por esfuerzo destacado.', icon: Trophy, earned: false },
  { id: 4, title: 'Técnico Élite', description: 'Dominio de los fundamentos Nivel 1.', icon: Medal, earned: false },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu disciplina tiene valor. Progresa en el nido y desbloquea beneficios.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progresión de Rango */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black uppercase italic">
              <Star className="h-5 w-5 text-primary" /> Progresión de Rango
            </CardTitle>
            <CardDescription>Tu camino hacia la maestría técnica.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {ranks.map((rank, index) => (
              <div key={index} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Badge className={rank.color}>{rank.level}</Badge>
                  <span className="text-xs font-mono font-bold text-muted-foreground">{rank.progress}%</span>
                </div>
                <Progress value={rank.progress} className="h-2" />
                <p className="text-[10px] text-muted-foreground italic">{rank.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Medallas y Logros */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase italic">
                <Medal className="h-5 w-5 text-primary" /> Medallas de Honor
              </CardTitle>
              <CardDescription>Logros desbloqueados por tu disciplina.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {achievements.map((achievement) => (
                <div 
                  key={achievement.id} 
                  className={`flex flex-col items-center text-center p-3 rounded-md border border-dashed transition-all ${achievement.earned ? 'bg-primary/5 border-primary/30 opacity-100' : 'bg-muted/30 border-muted-foreground/20 opacity-40 grayscale'}`}
                >
                  <achievement.icon className={`h-8 w-8 mb-2 ${achievement.earned ? 'text-primary' : 'text-muted-foreground'}`} />
                  <p className="text-[10px] font-black uppercase tracking-tighter">{achievement.title}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary text-primary-foreground border-none shadow-[0_0_20px_rgba(255,0,0,0.2)]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase italic">
                <ShieldCheck className="h-5 w-5" /> Beneficios de Elite
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs font-bold uppercase tracking-wide">
                <li className="flex items-center gap-2">✓ 10% Descuento en Rashguards</li>
                <li className="flex items-center gap-2">✓ Acceso a Seminarios VIP</li>
                <li className="flex items-center gap-2">✓ Consultoría Nutricional IA</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

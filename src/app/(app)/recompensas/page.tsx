"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Award, Star, Flame, Zap, ShieldCheck, ChevronRight } from "lucide-react";

const rewards = [
  {
    title: "Nivel de Cinturón",
    description: "Tu progreso técnico en el Jiu-Jitsu.",
    current: "Blanco (3 Grados)",
    next: "Azul",
    progress: 75,
    icon: ShieldCheck,
    color: "text-blue-500",
  },
  {
    title: "Racha de Combate",
    description: "Días consecutivos de entrenamiento registrado.",
    current: "12 Días",
    next: "15 Días (Medalla Bronce)",
    progress: 80,
    icon: Flame,
    color: "text-orange-500",
  },
  {
    title: "Volumen de Carga",
    description: "Calorías quemadas en el último mes.",
    current: "12,450 kcal",
    next: "15,000 kcal",
    progress: 60,
    icon: Zap,
    color: "text-yellow-500",
  }
];

const achievements = [
  { id: 1, name: "Primera Sangre", description: "Completa tu primer registro en la bitácora.", earned: true },
  { id: 2, name: "Guerrero Disciplinado", description: "Entrena 5 días seguidos.", earned: true },
  { id: 3, name: "Científico del Tatami", description: "Calcula tus macros en el laboratorio.", earned: true },
  { id: 4, name: "Sombra del Albatros", description: "Domina 10 técnicas en el foro.", earned: false },
  { id: 5, name: "Peso de Competición", description: "Mantén tu peso ideal por 1 mes.", earned: false },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu disciplina se forja en el tatami, tu gloria se registra aquí.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {rewards.map((reward, i) => (
          <Card key={i} className="relative overflow-hidden group">
            <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform`}>
              <reward.icon size={120} />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <reward.icon className={`h-5 w-5 ${reward.color}`} />
                {reward.title}
              </CardTitle>
              <CardDescription>{reward.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <p className="text-xs uppercase font-bold text-muted-foreground">Actual</p>
                  <p className="text-xl font-black italic uppercase">{reward.current}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase font-bold text-muted-foreground">Siguiente Meta</p>
                  <p className="text-sm font-bold">{reward.next}</p>
                </div>
              </div>
              <Progress value={reward.progress} className="h-2" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Medallas de Honor
            </CardTitle>
            <CardDescription>Logros desbloqueados en tu carrera de guerrero.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {achievements.map((achievement) => (
                <div key={achievement.id} className={`flex items-center gap-4 p-3 rounded-md border ${achievement.earned ? 'bg-primary/5 border-primary/20' : 'opacity-50 grayscale'}`}>
                  <div className={`p-2 rounded-full ${achievement.earned ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                    <Award className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold uppercase">{achievement.name}</p>
                    <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  </div>
                  {achievement.earned && <Badge className="bg-green-500 hover:bg-green-600">Completado</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Beneficios del Equipo
            </CardTitle>
            <CardDescription>Ventajas exclusivas por tu rango actual.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-secondary/50 border space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">1</div>
                <div>
                  <p className="text-sm font-bold uppercase">Descuento en Gear</p>
                  <p className="text-xs text-muted-foreground">10% de descuento en Rashguards y Jerseys Albatros.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">2</div>
                <div>
                  <p className="text-sm font-bold uppercase">Acceso Anticipado</p>
                  <p className="text-xs text-muted-foreground">Registro prioritario en Seminarios y Eventos Estatales.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">3</div>
                <div>
                  <p className="text-sm font-bold uppercase">Chef IA Premium</p>
                  <p className="text-xs text-muted-foreground">Generación ilimitada de planes nutricionales tácticos.</p>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground italic text-center uppercase tracking-widest">
              Eleva tu nivel, desbloquea más poder.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
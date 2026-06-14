"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, ShieldCheck, Flame, Medal, Award, Zap, Target } from "lucide-react";

const REWARDS_LEVELS = [
  { level: "Cinturón Blanco", progress: 100, color: "bg-white text-black border-black", description: "Iniciación y fundamentos básicos." },
  { level: "Cinturón Azul", progress: 65, color: "bg-blue-600 text-white", description: "Dominio técnico y control posicional." },
  { level: "Cinturón Morado", progress: 30, color: "bg-purple-700 text-white", description: "Refinamiento táctico y fluidez." },
  { level: "Cinturón Café", progress: 10, color: "bg-amber-900 text-white", description: "Estrategia avanzada y potencia." },
  { level: "Cinturón Negro", progress: 5, color: "bg-black text-red-600 border-red-600", description: "Maestría técnica e identidad marcial." },
];

const ACHIEVEMENT_BADGES = [
  { id: 1, name: "Asistencia Perfecta", icon: Star, description: "30 días seguidos de entrenamiento.", unlocked: true },
  { id: 2, name: "Guerrero de Sparring", icon: Flame, description: "Participación en 50 rondas de combate.", unlocked: true },
  { id: 3, name: "Técnica Letal", icon: Zap, description: "Aprender 10 sumisiones avanzadas.", unlocked: false },
  { id: 4, name: "Disciplina de Hierro", icon: ShieldCheck, description: "Mantener el peso ideal por 3 meses.", unlocked: false },
  { id: 5, name: "Campeón del Nido", icon: Trophy, description: "Ganar un torneo interno de Albatros.", unlocked: false },
  { id: 6, name: "Mente Táctica", icon: Target, description: "Completar todos los módulos del Foro.", unlocked: true },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu progreso en el tatami tiene valor real. Sube de nivel, gana medallas.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Medal className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle className="text-xl font-black tracking-tighter">ESTADO ACTUAL: ATLETA EN ASCENSO</CardTitle>
                  <CardDescription className="font-bold">Próximo objetivo: Especialista en Sumisiones</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Progreso de Rango</span>
                <span className="text-2xl font-black tracking-tighter">74%</span>
              </div>
              <Progress value={74} className="h-3" />
              <p className="text-xs text-muted-foreground italic">
                Sigue registrando tus entrenamientos y comidas en la bitácora para acelerar tu ascenso.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REWARDS_LEVELS.map((r, i) => (
              <Card key={i} className="overflow-hidden">
                <div className={`h-2 ${r.color.split(' ')[0]}`} />
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg font-black italic uppercase tracking-tighter">{r.level}</CardTitle>
                    <Badge className={r.color}>{r.progress}%</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{r.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black tracking-tighter uppercase italic">
                <Award className="h-5 w-5 text-primary" /> Medallero Táctico
              </CardTitle>
              <CardDescription>Insignias desbloqueadas por tu desempeño.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              {ACHIEVEMENT_BADGES.map((badge) => (
                <div 
                  key={badge.id} 
                  className={`flex flex-col items-center text-center p-3 rounded-lg border transition-all ${
                    badge.unlocked 
                      ? "bg-secondary/50 border-primary/30" 
                      : "bg-muted/20 border-muted grayscale opacity-50"
                  }`}
                >
                  <badge.icon className={`h-8 w-8 mb-2 ${badge.unlocked ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-black uppercase tracking-tighter leading-tight">{badge.name}</span>
                  {badge.unlocked && <Badge variant="secondary" className="mt-2 text-[8px] h-4">DESBLOQUEADO</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-black text-white border-primary/50 shadow-[0_0_20px_rgba(255,0,0,0.1)]">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase italic tracking-widest text-primary">Beneficios de Élite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-xs space-y-3 font-bold uppercase tracking-tighter">
                <li className="flex items-start gap-2">
                   <Zap className="h-4 w-4 text-primary shrink-0" />
                   <span>10% Descuento en seminarios internacionales</span>
                </li>
                <li className="flex items-start gap-2">
                   <Zap className="h-4 w-4 text-primary shrink-0" />
                   <span>Acceso anticipado a preventa de Gear Albatros</span>
                </li>
                <li className="flex items-start gap-2">
                   <Zap className="h-4 w-4 text-primary shrink-0" />
                   <span>Consultoría nutricional IA ilimitada</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

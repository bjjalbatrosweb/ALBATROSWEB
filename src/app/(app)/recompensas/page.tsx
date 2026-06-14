"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  Target, 
  Flame, 
  Medal, 
  Star, 
  ShieldCheck, 
  Zap,
  TrendingUp,
  Award
} from "lucide-react";
import { Separator } from '@/components/ui/separator';

const rankData = [
  { rank: 'Cinturón Blanco', progress: 100, status: 'Completado', color: 'bg-white text-black border-2 border-zinc-300' },
  { rank: 'Cinturón Azul', progress: 45, status: 'En Progreso', color: 'bg-blue-600 text-white' },
  { rank: 'Cinturón Morado', progress: 0, status: 'Bloqueado', color: 'bg-purple-800 text-white opacity-50' },
  { rank: 'Cinturón Marrón', progress: 0, status: 'Bloqueado', color: 'bg-amber-900 text-white opacity-50' },
  { rank: 'Cinturón Negro', progress: 0, status: 'Bloqueado', color: 'bg-black text-white opacity-50' },
];

const achievements = [
  { title: 'Asistencia Perfecta', description: '30 días seguidos de entrenamiento.', icon: ShieldCheck, color: 'text-green-500' },
  { title: 'Guerrero de Sparring', description: 'Completa 50 rondas de combate.', icon: Flame, color: 'text-orange-500' },
  { title: 'Mente Analítica', description: 'Registra 20 técnicas en el Foro.', icon: Target, color: 'text-blue-500' },
  { title: 'Atleta de Élite', description: 'Mantén tu peso objetivo por 3 meses.', icon: Award, color: 'text-yellow-500' },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu disciplina se traduce en rango. Sube de nivel en el nido Albatros.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Progreso de Rango</CardTitle>
                  <CardDescription>Camino hacia el Cinturón Negro</CardDescription>
                </div>
                <Trophy className="h-10 w-10 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {rankData.map((rank, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center text-sm font-bold uppercase tracking-tight">
                    <div className="flex items-center gap-3">
                      <div className={`h-4 w-12 rounded-full ${rank.color}`} />
                      <span>{rank.rank}</span>
                    </div>
                    <span className={rank.status === 'Completado' ? 'text-green-500' : 'text-muted-foreground'}>
                      {rank.status}
                    </span>
                  </div>
                  <Progress value={rank.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {achievements.map((achievement, index) => (
              <Card key={index} className="bg-card/50 hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <div className={`p-3 rounded-lg bg-secondary/80 ${achievement.color}`}>
                    <achievement.icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-sm font-bold uppercase">{achievement.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <Card className="bg-primary text-white border-none shadow-[0_0_30px_rgba(255,0,0,0.3)]">
            <CardHeader>
              <CardTitle className="font-black tracking-tighter uppercase italic flex items-center gap-2">
                <Zap className="h-6 w-6" /> Puntos Albatros
              </CardTitle>
              <CardDescription className="text-white/80">Acumula puntos por cada entrenamiento.</CardDescription>
            </CardHeader>
            <CardContent className="text-center py-6">
              <span className="text-7xl font-black tracking-tighter">1,250</span>
              <p className="text-sm uppercase font-bold mt-2 tracking-widest">PTS TOTALES</p>
            </CardContent>
            <CardContent>
              <Button variant="secondary" className="w-full font-black uppercase tracking-widest">
                Canjear Beneficios
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2">
                <Star className="h-5 w-5 text-primary" /> Próxima Meta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-md border bg-secondary/30 flex items-center gap-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-sm font-bold uppercase">Grado II (Azul)</p>
                  <p className="text-xs text-muted-foreground">Faltan 12 entrenamientos para tu siguiente barra.</p>
                </div>
              </div>
              <Separator />
              <div className="text-xs space-y-2">
                <p className="font-bold uppercase text-muted-foreground">Beneficios de Nivel:</p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>10% Descuento en Rashguards Albatros.</li>
                  <li>Acceso a Seminarios Exclusivos.</li>
                  <li>Invitación al Torneo Interno Anual.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

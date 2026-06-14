"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Award, Star, Medal, Target } from "lucide-react";

const rewards = [
  { level: "Blanco", points: "Iniciado", color: "bg-white text-black", icon: Star, desc: "Comienzo del camino." },
  { level: "Azul", points: "1000 XP", color: "bg-blue-600 text-white", icon: Award, desc: "Dominio técnico básico." },
  { level: "Morado", points: "2500 XP", color: "bg-purple-600 text-white", icon: Trophy, desc: "Refinamiento táctico." },
  { level: "Marrón", points: "5000 XP", color: "bg-orange-800 text-white", icon: Medal, desc: "Maestría en ejecución." },
  { level: "Negro", points: "10000 XP", color: "bg-zinc-950 text-white border border-primary", icon: Target, desc: "Mando supremo." },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Programa de Recompensas Albatros</h1>
        <p className="text-muted-foreground">Forja tu rango a través de la disciplina y el entrenamiento.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-black uppercase italic">Tu Progreso de Atleta</CardTitle>
            <CardDescription>Suma puntos registrando tus entrenamientos y comidas en la bitácora.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-6 rounded-lg bg-primary/5 border border-primary/20 text-center">
              <p className="text-sm font-bold uppercase tracking-widest text-primary">Rango Actual</p>
              <h2 className="text-5xl font-black tracking-tighter mt-2">CINTURÓN BLANCO</h2>
              <div className="mt-4 flex justify-center">
                  <Badge className="bg-white text-black font-bold uppercase px-4 py-1">2/4 Rayas</Badge>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-bold uppercase">
                <span>Progreso hacia Cinturón Azul</span>
                <span>450 / 1000 XP</span>
              </div>
              <Progress value={45} className="h-3" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                            <Star className="h-4 w-4 text-primary" /> Logros Recientes
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-2">
                        <p>• Asistencia perfecta esta semana (+50 XP)</p>
                        <p>• Meta calórica cumplida 3 días (+30 XP)</p>
                        <p>• Primer registro en bitácora (+10 XP)</p>
                    </CardContent>
                </Card>
                <Card className="bg-card/50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-bold uppercase flex items-center gap-2">
                            <Medal className="h-4 w-4 text-primary" /> Próxima Medalla
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
                        <p className="font-bold text-foreground italic">"Guerrero Constante"</p>
                        <p>Registra 7 entrenamientos seguidos para desbloquear.</p>
                    </CardContent>
                </Card>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg font-black uppercase tracking-tighter italic">Escalafón de Rango</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {rewards.map((reward, i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-md border bg-secondary/20">
                            <div className={`p-2 rounded-full ${reward.color}`}>
                                <reward.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black uppercase">{reward.level}</p>
                                <p className="text-[10px] text-muted-foreground leading-tight">{reward.desc}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono">{reward.points}</Badge>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

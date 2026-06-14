'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Star, Gift, Zap, ShieldCheck, Award, Target, Flame } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useDailyData } from "@/context/DailyDataProvider";

export default function RecompensasPage() {
  const { biometrics } = useDailyData();

  const rewards = [
    { title: "Primer Combate", description: "Completa tu primer registro en la bitácora.", icon: Flame, completed: true },
    { title: "Guerrero Disciplinado", description: "Registra 7 días seguidos de entrenamiento.", icon: Target, completed: false },
    { title: "Peso de Combate", description: "Alcanza tu peso objetivo en el Laboratorio.", icon: ShieldCheck, completed: false },
    { title: "Maestro Culinario", description: "Genera 10 recetas con el Chef IA.", icon: Zap, completed: true },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic text-primary">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu disciplina se premia. Sube de rango y desbloquea beneficios exclusivos.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rango Actual */}
        <Card className="lg:col-span-1 bg-primary/5 border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/20 p-4 rounded-full w-fit mb-4">
              <Award className="h-12 w-12 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black uppercase tracking-tighter">Cinturón Blanco</CardTitle>
            <CardDescription className="font-bold">Nivel 1 • Iniciado Albatros</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-black uppercase">
                <span>Progreso a Cinturón Azul</span>
                <span>40%</span>
              </div>
              <Progress value={40} className="h-2" />
            </div>
            <div className="p-4 rounded-md border border-dashed border-primary/30 bg-background/50 text-center">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Próximo Beneficio</p>
              <p className="text-xs font-black uppercase">Descuento 10% en Rashguards</p>
            </div>
          </CardContent>
        </Card>

        {/* Misiones y Logros */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-black uppercase italic flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Medallas de Honor
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rewards.map((reward, i) => (
              <Card key={i} className={reward.completed ? "border-primary/40 bg-primary/5" : "opacity-60 grayscale"}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${reward.completed ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                    <reward.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-black uppercase text-sm tracking-tight">{reward.title}</h3>
                    <p className="text-xs text-muted-foreground leading-tight">{reward.description}</p>
                    {reward.completed && <Badge className="mt-2 h-4 text-[8px] uppercase bg-green-500/20 text-green-500 border-none">Completado</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-muted/30 border-none">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase italic">¿Cómo ganar puntos?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4 font-medium">
                <li>Registrar comidas diarias en la bitácora: <span className="text-primary">+10 pts</span></li>
                <li>Completar sesiones de entrenamiento: <span className="text-primary">+25 pts</span></li>
                <li>Mantener el peso objetivo semanal: <span className="text-primary">+50 pts</span></li>
                <li>Asistir a seminarios o eventos: <span className="text-primary">+100 pts</span></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Gift, Star, Zap, Award, Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const currentPoints = 450;
const nextMilestone = 1000;
const progressPercentage = (currentPoints / nextMilestone) * 100;

const rewards = [
  { id: 1, name: "Mes de BJJ Gratis", cost: 1500, icon: Trophy, category: "Membresía", available: false },
  { id: 2, name: "Rashguard Oficial", cost: 800, icon: Zap, category: "Equipo", available: false },
  { id: 3, name: "Seminario con Maestro", cost: 1200, icon: Award, category: "Evento", available: false },
  { id: 4, name: "Kit de Hidratación", cost: 300, icon: Star, category: "Accesorios", available: true },
];

const missions = [
  { title: "Disciplina de Hierro", description: "Registra tus comidas por 7 días seguidos.", points: "+100 pts", status: "Incompleto" },
  { title: "Guerrero Social", description: "Invita a un amigo a una clase de prueba.", points: "+200 pts", status: "Incompleto" },
  { title: "Asalto al Tatami", description: "Completa 5 sesiones de entrenamiento esta semana.", points: "+150 pts", status: "En Progreso" },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-4xl font-black tracking-tighter uppercase italic">Programa de <span className="text-primary">Recompensas</span></h1>
        <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">Tu disciplina tiene valor. Canjea tus puntos por equipo y beneficios.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Card de Puntos Actuales */}
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
              <Star className="h-4 w-4 text-primary" /> Puntos Albatros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-7xl font-black tracking-tighter text-primary">{currentPoints}</div>
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 text-muted-foreground">PUNTOS DISPONIBLES</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold uppercase">
                <span>Nivel Principiante</span>
                <span className="text-muted-foreground">{currentPoints} / {nextMilestone}</span>
              </div>
              <Progress value={progressPercentage} className="h-2 bg-primary/10" />
              <p className="text-[10px] text-center text-muted-foreground mt-2 uppercase">TE FALTAN {nextMilestone - currentPoints} PUNTOS PARA EL SIGUIENTE NIVEL</p>
            </div>
          </CardContent>
        </Card>

        {/* Misiones Diarias */}
        <Card className="lg:col-span-2 bg-card/50">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2 text-primary">
              <Zap className="h-5 w-5" /> Misiones de Combate
            </CardTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground">Acumula puntos cumpliendo objetivos tácticos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {missions.map((mission, i) => (
              <div key={i} className="flex items-center justify-between p-4 border border-white/5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group cursor-default">
                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase tracking-tighter group-hover:text-primary transition-colors">{mission.title}</h4>
                  <p className="text-xs text-muted-foreground">{mission.description}</p>
                </div>
                <div className="text-right">
                  <Badge variant="secondary" className="font-black text-primary border-primary/20">{mission.points}</Badge>
                  <p className="text-[9px] uppercase font-bold text-muted-foreground mt-1">{mission.status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Tienda de Recompensas */}
        <div className="lg:col-span-3">
          <h2 className="text-2xl font-black tracking-tighter uppercase italic mb-6">Arsenal de <span className="text-primary">Canje</span></h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {rewards.map((reward) => (
              <Card key={reward.id} className={cn("overflow-hidden group transition-all", !reward.available && "opacity-60")}>
                <CardHeader className="bg-muted/50 p-4">
                  <div className="flex justify-between items-start">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <reward.icon className="h-6 w-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-[9px] uppercase font-black">{reward.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1">
                    <h3 className="font-black uppercase tracking-tighter text-sm">{reward.name}</h3>
                    <p className="text-xs text-primary font-black">{reward.cost} PTS</p>
                  </div>
                  <Button 
                    className="w-full h-8 text-[10px] font-black uppercase tracking-widest" 
                    variant={reward.available ? "default" : "secondary"}
                    disabled={!reward.available}
                  >
                    {reward.available ? "Canjear Ahora" : "Puntos Insuficientes"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Card className="border-dashed border-primary/20 bg-transparent">
        <CardContent className="flex flex-col md:flex-row items-center justify-between p-6 gap-6">
          <div className="flex items-center gap-4 text-center md:text-left">
            <div className="bg-primary/20 p-4 rounded-full">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black uppercase italic">Recluta a un Guerrero</h3>
              <p className="text-sm text-muted-foreground">Comparte tu código de referido y ambos ganarán 500 puntos cuando tu recluta se inscriba.</p>
            </div>
          </div>
          <Button variant="outline" className="font-black uppercase tracking-widest border-primary text-primary hover:bg-primary hover:text-white transition-all w-full md:w-auto">
            Compartir Código <Share2 className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

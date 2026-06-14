'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
    Trophy, Star, Award, 
    Flame, Zap, Heart, 
    ShieldCheck, Crown, Target
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const REWARDS_TIERS = [
    { name: 'Cinturón Blanco', minPoints: 0, color: 'bg-white text-black border-neutral-300', description: 'El inicio del camino. Disciplina básica.' },
    { name: 'Cinturón Azul', minPoints: 500, color: 'bg-blue-600 text-white', description: 'Dominio técnico fundamental alcanzado.' },
    { name: 'Cinturón Morado', minPoints: 1500, color: 'bg-purple-700 text-white', description: 'Fluidez y estrategia avanzada.' },
    { name: 'Cinturón Marrón', minPoints: 3000, color: 'bg-amber-900 text-white', description: 'Refinamiento táctico y potencia.' },
    { name: 'Cinturón Negro', minPoints: 5000, color: 'bg-black text-white', description: 'Maestría total. Espíritu Albatros.' },
];

const ACHIEVEMENTS = [
    { title: 'Primer Vuelo', icon: Flame, desc: 'Completa tu primer registro en la bitácora.', points: 50 },
    { title: 'Asalto Nutricional', icon: Target, desc: 'Llega a tus metas calóricas 7 días seguidos.', points: 200 },
    { title: 'Guerrero de Hierro', icon: ShieldCheck, desc: 'Registra 20 sesiones de entrenamiento intensas.', points: 500 },
    { title: 'Espíritu Albatros', icon: Heart, desc: 'Participa en un evento oficial del equipo.', points: 1000 },
];

export default function RewardsPage() {
  // Mock data - In a real app, this would come from the user profile in Firestore
  const userPoints = 750;
  const currentTier = REWARDS_TIERS.find((t, i) => userPoints >= t.minPoints && (i === REWARDS_TIERS.length - 1 || userPoints < REWARDS_TIERS[i+1].minPoints)) || REWARDS_TIERS[0];
  const nextTier = REWARDS_TIERS[REWARDS_TIERS.indexOf(currentTier) + 1] || null;
  const progressToNext = nextTier ? ((userPoints - currentTier.minPoints) / (nextTier.minPoints - currentTier.minPoints)) * 100 : 100;

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic text-primary">Programa de Recompensas Albatros</h1>
        <p className="text-muted-foreground">Tu disciplina se traduce en honor y beneficios. Sube de rango.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Rango Actual */}
        <Card className="lg:col-span-1 bg-card/50 border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Rango Actual</CardTitle>
            <div className="py-6 flex flex-col items-center gap-4">
                <div className={`px-6 py-2 rounded-full font-black uppercase tracking-widest text-lg shadow-lg border ${currentTier.color}`}>
                    {currentTier.name}
                </div>
                <p className="text-xs text-muted-foreground italic px-4">"{currentTier.description}"</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold uppercase">
                    <span>Progreso al Siguiente Rango</span>
                    <span className="text-primary">{userPoints} / {nextTier?.minPoints || 'MAX'} pts</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
            </div>
            <Separator className="bg-primary/10" />
            <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 rounded-md bg-muted/30">
                    <Zap className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-[10px] font-black uppercase">Beneficio Activo</p>
                    <p className="text-xs font-bold">10% Off Tienda</p>
                </div>
                <div className="p-3 rounded-md bg-muted/30">
                    <Star className="h-5 w-5 text-primary mx-auto mb-1" />
                    <p className="text-[10px] font-black uppercase">Racha Actual</p>
                    <p className="text-xs font-bold">12 Días</p>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Medallas y Logros */}
        <Card className="lg:col-span-2 bg-card/30">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> Medallas de Honor
            </CardTitle>
            <CardDescription className="text-xs uppercase font-bold">Completa misiones tácticas para ganar puntos de rango.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ACHIEVEMENTS.map((ach, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-primary/5 bg-background/50 hover:border-primary/20 transition-colors">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <ach.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h4 className="text-sm font-black uppercase">{ach.title}</h4>
                            <p className="text-[10px] text-muted-foreground">{ach.desc}</p>
                            <Badge variant="outline" className="mt-2 text-[9px] font-black text-primary border-primary/30">+{ach.points} PTS</Badge>
                        </div>
                    </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Tabla de Beneficios */}
        <Card className="lg:col-span-3 bg-primary/5 border-primary/10">
            <CardHeader>
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Crown className="h-4 w-4 text-primary" /> Privilegios de Elite
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="space-y-1">
                        <h5 className="text-xs font-black uppercase text-blue-500">Rango Azul</h5>
                        <ul className="text-[10px] text-muted-foreground space-y-1">
                            <li>• Parche oficial de equipo gratuito</li>
                            <li>• 15% descuento en seminarios</li>
                        </ul>
                    </div>
                    <div className="space-y-1">
                        <h5 className="text-xs font-black uppercase text-purple-500">Rango Morado</h5>
                        <ul className="text-[10px] text-muted-foreground space-y-1">
                            <li>• Acceso a biblioteca técnica Nivel 2</li>
                            <li>• Clase privada mensual 1-a-1</li>
                        </ul>
                    </div>
                    <div className="space-y-1">
                        <h5 className="text-xs font-black uppercase text-amber-700">Rango Marrón</h5>
                        <ul className="text-[10px] text-muted-foreground space-y-1">
                            <li>• Kit de suplementación bimensual</li>
                            <li>• Patrocinio parcial en torneos</li>
                        </ul>
                    </div>
                    <div className="space-y-1">
                        <h5 className="text-xs font-black uppercase text-foreground">Rango Negro</h5>
                        <ul className="text-[10px] text-muted-foreground space-y-1">
                            <li>• Embajador oficial Albatros</li>
                            <li>• Acceso vitalicio al nido</li>
                        </ul>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Star, Award, Zap, Shield, Target } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const CINTURONES = [
  { nivel: 'Blanco', color: 'bg-white text-black border', info: 'Iniciación en el camino del guerrero.' },
  { nivel: 'Azul', color: 'bg-blue-600 text-white', info: 'Dominio de fundamentos básicos y técnica.' },
  { nivel: 'Morado', color: 'bg-purple-700 text-white', info: 'Refinamiento táctico y fluidez en combate.' },
  { nivel: 'Marrón', color: 'bg-amber-900 text-white', info: 'Precisión letal y comprensión profunda.' },
  { nivel: 'Negro', color: 'bg-black text-white', info: 'Maestría técnica y mentalidad inquebrantable.' },
];

const LOGROS = [
  { title: 'Disciplina de Hierro', icon: Shield, description: 'Registra 30 días consecutivos en tu bitácora.', progress: 45 },
  { title: 'Peso de Combate', icon: Target, description: 'Mantente en tu categoría de peso por 3 meses.', progress: 70 },
  { title: 'Asalto Nutricional', icon: Zap, description: 'Cumple tus macros semanales al 100%.', progress: 20 },
  { title: 'Héroe del Tatami', icon: Trophy, description: 'Participa en 3 eventos oficiales del equipo.', progress: 100 },
];

export default function RecompensasPage() {
  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic text-primary">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu disciplina se forja en el tatami, tu gloria se registra aquí.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-card/40 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <Trophy className="h-32 w-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-xl font-black tracking-tight uppercase">Progreso de Cinturón</CardTitle>
              <CardDescription>Tu evolución técnica dentro de Albatros Team.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-bold uppercase text-muted-foreground">Grado Actual:</span>
                    <Badge className="px-4 py-1 text-lg font-black bg-white text-black border">Cinturón Blanco</Badge>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase">
                        <span>Progreso a Azul</span>
                        <span>15%</span>
                    </div>
                    <Progress value={15} className="h-3 bg-secondary" />
                </div>
                <Separator className="bg-primary/10" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {CINTURONES.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-background/40 border border-primary/5">
                            <div className={`h-4 w-12 rounded-full ${c.color}`} />
                            <div className="flex-1">
                                <p className="text-xs font-black uppercase">{c.nivel}</p>
                                <p className="text-[10px] text-muted-foreground italic">{c.info}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {LOGROS.map((logro, i) => (
                  <Card key={i} className="bg-card/30 border-primary/10">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <logro.icon className="h-5 w-5 text-primary" />
                            <CardTitle className="text-sm font-bold uppercase">{logro.title}</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">{logro.description}</p>
                        <div className="space-y-1">
                             <div className="flex justify-between text-[10px] font-bold">
                                <span>Progreso</span>
                                <span>{logro.progress}%</span>
                            </div>
                            <Progress value={logro.progress} className="h-1.5" />
                        </div>
                    </CardContent>
                  </Card>
              ))}
          </div>
        </div>

        <aside className="space-y-8">
            <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2">
                        <Star className="h-5 w-5 text-primary" /> Beneficios Elite
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-4">
                        <li className="flex items-start gap-3">
                            <div className="bg-primary/20 p-2 rounded-full mt-1"><Award className="h-3 w-3 text-primary" /></div>
                            <div>
                                <p className="text-xs font-bold uppercase">Descuento en Tienda</p>
                                <p className="text-[10px] text-muted-foreground">10% OFF en Rashguards y equipo oficial.</p>
                            </div>
                        </li>
                         <li className="flex items-start gap-3">
                            <div className="bg-primary/20 p-2 rounded-full mt-1"><Award className="h-3 w-3 text-primary" /></div>
                            <div>
                                <p className="text-xs font-bold uppercase">Seminarios Exclusivos</p>
                                <p className="text-[10px] text-muted-foreground">Acceso prioritario a clases con maestros invitados.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="bg-primary/20 p-2 rounded-full mt-1"><Award className="h-3 w-3 text-primary" /></div>
                            <div>
                                <p className="text-xs font-bold uppercase">Consultoría Nutricional</p>
                                <p className="text-[10px] text-muted-foreground">Sesión 1-a-1 con el Head Coach cada trimestre.</p>
                            </div>
                        </li>
                    </ul>
                </CardContent>
            </Card>

            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground">Próximo Hito</CardTitle>
                </CardHeader>
                <CardContent className="text-center py-6">
                    <Zap className="h-12 w-12 text-primary/30 mx-auto mb-4 animate-pulse" />
                    <h3 className="text-sm font-black uppercase">Fuerza de Voluntad</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 italic">Continúa entrenando para desbloquear nuevas recompensas tácticas.</p>
                </CardContent>
            </Card>
        </aside>
      </div>
    </div>
  );
}

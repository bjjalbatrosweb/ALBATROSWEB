'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ArrowLeft, Star, Award, Trophy, Info, ChevronDown } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { cn } from "@/lib/utils";

const months = [
  { name: 'JUNIO', points: '+1' },
  { name: 'JULIO', points: '+2' },
  { name: 'AGOSTO', points: '+3', hasChest: true },
  { name: 'SEPTIEMBRE', points: '+4' },
  { name: 'OCTUBRE', points: '+5' },
  { name: 'NOVIEMBRE', points: '+6' },
  { name: 'DICIEMBRE', points: '+7', hasChest: true },
];

export default function RecompensasPage() {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    // Cálculo del mes actual relativo a Junio (index 0)
    // Suponemos contexto de año 2026 para la demo o año actual
    const now = new Date();
    const month = now.getMonth(); // 0-11
    
    // Mapeo: Junio(5) -> 0, Julio(6) -> 1 ... Diciembre(11) -> 6
    let index = month - 5;
    
    // Ajustes de límites
    if (month < 5) index = -1; // Antes de junio
    if (month > 11) index = 7;  // Después de diciembre
    
    setCurrentMonthIndex(index);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12">
        <div className="flex items-center gap-4">
          <Logo />
          <div className="h-8 w-px bg-primary/20 hidden md:block" />
          <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Programa de Recompensas</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
          </Button>
        </Link>
      </header>

      <main className="max-w-6xl mx-auto space-y-12">
        <section className="text-center space-y-4">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Tu Camino a la Gloria</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto italic">
            Mantén tu disciplina mes con mes. La flecha avanza, las estrellas se convierten en puntos y los cofres revelan tu grandeza.
          </p>
        </section>

        <Card className="bg-card/40 border-primary/20 backdrop-blur-sm overflow-hidden">
          <CardHeader className="text-center pb-0">
             <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="uppercase font-black tracking-widest italic">Línea del Tiempo Táctica</CardTitle>
             </div>
             <CardDescription>Progreso automático cada día 1 de mes.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-16">
            <div className="relative pt-24 pb-12 overflow-x-auto scrollbar-hide">
              {/* Línea horizontal de fondo */}
              <div className="absolute top-[164px] left-0 right-0 h-1 bg-muted-foreground/20 rounded-full" />
              
              <div className="flex justify-between items-start min-w-[800px] relative px-4">
                {months.map((month, index) => {
                  const isPastOrCurrent = index <= currentMonthIndex;
                  const isCurrent = index === currentMonthIndex;
                  const chestImage = isPastOrCurrent ? '/cofreabierto.png' : '/cofrecerrado.png';

                  return (
                    <div key={month.name} className="flex flex-col items-center relative z-10 w-24">
                      
                      {/* Sección de Cofre */}
                      <div className="h-24 flex items-end justify-center mb-4">
                        {month.hasChest && (
                          <div className={cn(
                            "relative transition-all duration-700",
                            isPastOrCurrent ? "scale-110" : "grayscale opacity-50",
                            isCurrent && "animate-pulse"
                          )}>
                            <Image 
                              src={chestImage} 
                              alt="Cofre de recompensa" 
                              width={85} 
                              height={85}
                              className="drop-shadow-[0_0_15px_rgba(255,0,0,0.2)]"
                            />
                            {isPastOrCurrent && (
                              <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded italic animate-bounce shadow-lg">
                                ¡ABIERTO!
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Nombre del Mes */}
                      <span className={cn(
                        "text-xs font-black mb-4 tracking-tighter transition-colors",
                        isPastOrCurrent ? "text-primary" : "text-muted-foreground"
                      )}>
                        {month.name}
                      </span>

                      {/* Flecha Indicadora de Progreso */}
                      <div className="relative h-10 w-10 flex items-center justify-center">
                        {isCurrent ? (
                          <div className="absolute -top-12 animate-bounce flex flex-col items-center">
                             <ChevronDown className="h-10 w-10 text-primary drop-shadow-[0_0_10px_rgba(255,0,0,0.6)]" strokeWidth={5} />
                             <div className="h-2 w-2 rounded-full bg-primary animate-ping" />
                          </div>
                        ) : null}
                        
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 transition-all duration-500",
                          isPastOrCurrent ? "bg-primary border-primary scale-125 shadow-[0_0_10px_rgba(255,0,0,0.4)]" : "bg-background border-muted-foreground"
                        )} />
                      </div>

                      {/* Puntos o Estrella */}
                      <div className="mt-6 flex flex-col items-center">
                        {isPastOrCurrent ? (
                          <div className="bg-primary/10 border border-primary/30 rounded-lg p-2 text-center animate-in zoom-in-50 duration-700">
                             <span className="text-2xl font-black text-primary italic leading-none">{month.points}</span>
                             <p className="text-[8px] font-bold uppercase text-primary tracking-tighter">Puntos</p>
                          </div>
                        ) : (
                          <div className="bg-muted/50 p-2 rounded-lg opacity-40">
                            <Star className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-primary/5 border-primary/20 group hover:border-primary/40 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" /> Sistema de Acumulación
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                        La constancia es tu mayor ventaja competitiva. Cada mes que la flecha avanza, tus puntos crecen. Canjéalos por equipamiento oficial Albatros y seminarios tácticos.
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20 group hover:border-primary/40 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-primary" /> Cofres de Élite
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                        Agosto y Diciembre son meses de bonificación. Si mantienes el ritmo hasta el final del año, el cofre final revelará el rango máximo y recompensas exclusivas del equipo.
                    </p>
                </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20 group hover:border-primary/40 transition-colors">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" /> Protocolo de Rango
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                        El progreso es automático basándose en tu suscripción activa. Si la misión se detiene, la flecha regresa al inicio. Solo los más disciplinados alcanzan el cofre de Diciembre.
                    </p>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

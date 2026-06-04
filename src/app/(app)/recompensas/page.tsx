
"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Trophy, Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

const monthsData = [
  { id: 0, name: 'JUNIO', monthVal: 5, points: '+1' },
  { id: 1, name: 'JULIO', monthVal: 6, points: '+2' },
  { id: 2, name: 'AGOSTO', monthVal: 7, points: '+3' },
  { id: 3, name: 'SEPTIEMBRE', monthVal: 8, points: '+4' },
  { id: 4, name: 'OCTUBRE', monthVal: 9, points: '+5' },
  { id: 5, name: 'NOVIEMBRE', monthVal: 10, points: '+6' },
  { id: 6, name: 'DICIEMBRE', monthVal: 11, points: '+7' },
];

const FistIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={cn("transition-all duration-1000", className)}
  >
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-1.3-6.1-2.9l-1.1-1.1" />
  </svg>
);

export default function RecompensasPage() {
  const activeIndex = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    
    // Referencia basada en los logs del sistema (2026)
    if (y < 2026) return -1;
    if (y > 2026) return 6;
    if (m < 5) return -1;
    if (m > 11) return 6;
    
    return m - 5; 
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Mantén la constancia mes con mes y forja tu legado de puntos.</p>
      </header>

      <Card className="bg-card/50 border-primary/10 overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="text-primary h-6 w-6" />
            Progreso de Temporada 2026
          </CardTitle>
          <CardDescription>
            Cada primer día de mes, tu rango avanza y tus estrellas se convierten en puntos de victoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-10 pb-20">
          <div className="relative w-full max-w-5xl mx-auto px-4">
            {/* Main Timeline Line */}
            <div className="absolute top-1/2 left-0 w-full h-1 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-1000"
                style={{ width: `${(Math.max(0, activeIndex) / 6) * 100}%` }}
              />
            </div>

            {/* Fist Position */}
            <div 
              className="absolute top-1/2 -translate-y-full mb-6 transition-all duration-1000 flex flex-col items-center"
              style={{ left: `${(Math.max(0, activeIndex) / 6) * 100}%`, transform: `translate(-50%, -100%)` }}
            >
              <div className="bg-primary p-3 rounded-full shadow-[0_0_20px_rgba(255,0,0,0.5)] animate-bounce mb-2">
                <FistIcon className="h-8 w-8 text-white" />
              </div>
              <div className="bg-primary text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter text-white">
                POSICIÓN ACTUAL
              </div>
            </div>

            {/* Points and Labels */}
            <div className="flex justify-between relative mt-2">
              {monthsData.map((m, i) => {
                const isPastOrCurrent = i <= activeIndex;
                const isCurrent = i === activeIndex;

                return (
                  <div key={m.id} className="flex flex-col items-center group">
                    {/* Tick Mark */}
                    <div className={cn(
                      "h-4 w-1 rounded-full mb-4",
                      isPastOrCurrent ? "bg-primary" : "bg-muted"
                    )} />
                    
                    {/* Month Label */}
                    <span className={cn(
                      "text-[10px] md:text-xs font-black mb-6 tracking-tighter transition-colors",
                      isCurrent ? "text-primary scale-110" : isPastOrCurrent ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {m.name}
                    </span>

                    {/* Reward Item */}
                    <div className={cn(
                      "h-12 w-12 rounded-lg flex items-center justify-center transition-all duration-500",
                      isCurrent ? "bg-primary text-white scale-125 shadow-lg" : 
                      isPastOrCurrent ? "bg-primary/20 text-primary border border-primary/30" : 
                      "bg-muted text-muted-foreground border border-transparent"
                    )}>
                      {isPastOrCurrent ? (
                        <span className="font-bold text-sm">{m.points}</span>
                      ) : (
                        <Star className="h-5 w-5 fill-current opacity-40" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2">
                    <Award className="h-5 w-5 text-primary" /> Reglas de Combate
                </CardTitle>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3 text-sm text-muted-foreground italic">
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span> Los puntos se abonan automáticamente el día 1 de cada mes.</li>
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span> Debes mantener tu membresía activa para que el puño siga avanzando.</li>
                    <li className="flex gap-2"><span className="text-primary font-bold">•</span> Los puntos acumulados son canjeables por productos y descuentos en el nido.</li>
                </ul>
            </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
            <CardHeader>
                <CardTitle className="text-lg font-black uppercase italic flex items-center gap-2">
                    <Lock className="h-5 w-5 text-primary" /> Próxima Misión
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="p-4 bg-muted/50 rounded-md border border-dashed text-center">
                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                        RECOMPENSA DE {activeIndex < 6 ? monthsData[activeIndex + 1]?.name : 'DICIEMBRE'}
                    </p>
                    <p className="text-2xl font-black text-primary tracking-tighter mt-1">
                        {activeIndex < 6 ? monthsData[activeIndex + 1]?.points : '+7'} PUNTOS
                    </p>
                </div>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trophy, ChevronDown, Award } from "lucide-react";
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
    const now = new Date();
    const month = now.getMonth(); 
    let index = month - 5; 
    if (month < 5) index = -1;
    if (month > 11) index = 7;
    setCurrentMonthIndex(index);
  }, []);

  return (
    <div className="p-4 md:p-8 space-y-12">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase text-primary italic">Programa de Recompensas</h1>
        <p className="text-muted-foreground">Tu lealtad al tatami tiene premio.</p>
      </header>
      <main className="max-w-6xl mx-auto space-y-12">
        <Card className="bg-card/40 border-primary/20 backdrop-blur-sm overflow-hidden">
          <CardHeader className="text-center pb-0">
             <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="uppercase font-black tracking-widest italic">Progreso de Temporada</CardTitle>
             </div>
             <CardDescription>Avance automático basado en tu permanencia.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-16">
            <div className="relative pt-32 pb-12 overflow-x-auto scrollbar-hide">
              <div className="absolute top-[204px] left-0 right-0 h-1 bg-muted-foreground/20 rounded-full" />
              <div className="flex justify-between items-start min-w-[800px] relative px-4">
                {months.map((month, index) => {
                  const isPastOrCurrent = index <= currentMonthIndex;
                  const isCurrent = index === currentMonthIndex;
                  const chestImage = isPastOrCurrent ? '/cofreabierto.png' : '/cofrecerrado.png';
                  return (
                    <div key={month.name} className="flex flex-col items-center relative z-10 w-24">
                      <div className="h-32 flex flex-col items-center justify-end mb-4 group">
                        {month.hasChest && (
                          <div className={cn("relative transition-all duration-700", isPastOrCurrent ? "scale-110" : "grayscale opacity-50", isCurrent && "animate-pulse")}>
                            <Image src={chestImage} alt="Cofre" width={85} height={85} className="drop-shadow-[0_0_15px_rgba(255,0,0,0.2)]" />
                            {isPastOrCurrent && <div className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded italic animate-bounce shadow-lg">¡REVELADO!</div>}
                          </div>
                        )}
                      </div>
                      <span className={cn("text-xs font-black mb-4 tracking-tighter", isPastOrCurrent ? "text-primary" : "text-muted-foreground")}>{month.name}</span>
                      <div className="relative h-10 w-10 flex items-center justify-center">
                        {isCurrent && <div className="absolute -top-12 animate-bounce flex flex-col items-center"><ChevronDown className="h-10 w-10 text-primary" strokeWidth={5} /><div className="h-2 w-2 rounded-full bg-primary animate-ping" /></div>}
                        <div className={cn("h-4 w-4 rounded-full border-2", isPastOrCurrent ? "bg-primary border-primary scale-125" : "bg-background border-muted-foreground")} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

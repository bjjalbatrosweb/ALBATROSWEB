"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, Trophy, Award, Lock, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { Separator } from '@/components/ui/separator';

const monthsData = [
  { id: 0, name: 'JUNIO', points: '+1' },
  { id: 1, name: 'JULIO', points: '+2' },
  { id: 2, name: 'AGOSTO', points: '+3' },
  { id: 3, name: 'SEPTIEMBRE', points: '+4' },
  { id: 4, name: 'OCTUBRE', points: '+5' },
  { id: 5, name: 'NOVIEMBRE', points: '+6' },
  { id: 6, name: 'DICIEMBRE', points: '+7' },
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
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    
    // Lógica para 2026 (ajustar según el año deseado)
    let index = -1;
    if (y < 2026) index = -1;
    else if (y > 2026) index = 6;
    else if (m < 5) index = -1; // Antes de Junio
    else if (m > 11) index = 6; // Después de Diciembre
    else index = m - 5; // Junio es 5, así que index 0
    
    setActiveIndex(index);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12">
        <div className="flex items-center gap-4">
          <Logo />
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Programa de Recompensas</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Inicio
          </Button>
        </Link>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        <section className="text-center space-y-4 mb-12">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-primary">Forja tu Legado</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                Mantén la constancia mes con mes y observa cómo tu rango avanza automáticamente. Cada estrella se convierte en poder de victoria.
            </p>
        </section>

        <Card className="bg-card/30 border-primary/10 overflow-hidden backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl font-black uppercase italic">
              <Trophy className="text-primary h-6 w-6" />
              Temporada 2026
            </CardTitle>
            <CardDescription className="font-bold">
              El puño avanza automáticamente el día 1 de cada mes.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-20 pb-28">
            <div className="relative w-full max-w-5xl mx-auto px-4">
              {/* Main Timeline Line */}
              <div className="absolute top-1/2 left-0 w-full h-1.5 bg-muted -translate-y-1/2 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-1000 shadow-[0_0_15px_rgba(255,0,0,0.5)]"
                  style={{ width: `${activeIndex === -1 ? 0 : (activeIndex / 6) * 100}%` }}
                />
              </div>

              {/* Fist Position */}
              <div 
                className="absolute top-1/2 -translate-y-full mb-8 transition-all duration-1000 flex flex-col items-center"
                style={{ left: `${activeIndex === -1 ? 0 : (activeIndex / 6) * 100}%`, transform: `translate(-50%, -100%)` }}
              >
                <div className="bg-primary p-4 rounded-full shadow-[0_0_30px_rgba(255,0,0,0.6)] animate-bounce mb-3 border-2 border-white/20">
                  <FistIcon className="h-10 w-10 text-white" />
                </div>
                <div className="bg-primary text-[10px] font-black px-3 py-1 rounded uppercase tracking-widest text-white shadow-lg">
                  TU POSICIÓN
                </div>
              </div>

              {/* Points and Labels */}
              <div className="flex justify-between relative mt-4">
                {monthsData.map((m, i) => {
                  const isPastOrCurrent = i <= activeIndex;
                  const isCurrent = i === activeIndex;

                  return (
                    <div key={m.id} className="flex flex-col items-center group">
                      <div className={cn(
                        "h-6 w-1.5 rounded-full mb-6 transition-all",
                        isPastOrCurrent ? "bg-primary scale-110" : "bg-muted"
                      )} />
                      
                      <span className={cn(
                        "text-xs md:text-sm font-black mb-8 tracking-tighter transition-all uppercase italic",
                        isCurrent ? "text-primary scale-125" : isPastOrCurrent ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {m.name}
                      </span>

                      <div className={cn(
                        "h-14 w-14 rounded-xl flex items-center justify-center transition-all duration-500 border-2",
                        isCurrent ? "bg-primary text-white scale-150 shadow-[0_0_20px_rgba(255,0,0,0.4)] border-white/20" : 
                        isPastOrCurrent ? "bg-primary/10 text-primary border-primary/30" : 
                        "bg-muted/50 text-muted-foreground border-transparent"
                      )}>
                        {isPastOrCurrent ? (
                          <span className="font-black text-lg">{m.points}</span>
                        ) : (
                          <Star className="h-6 w-6 fill-current opacity-20" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="bg-primary/5 border-primary/20 backdrop-blur-sm">
              <CardHeader>
                  <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2 text-primary">
                      <Award className="h-6 w-6" /> Reglas de Combate
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <ul className="space-y-4 text-sm md:text-base text-muted-foreground italic">
                      <li className="flex gap-3"><span className="text-primary font-bold">01.</span> Los puntos se abonan automáticamente el día 1 de cada mes basándose en el calendario del sistema.</li>
                      <li className="flex gap-3"><span className="text-primary font-bold">02.</span> Debes mantener tu membresía activa para que el puño siga avanzando por la línea.</li>
                      <li className="flex gap-3"><span className="text-primary font-bold">03.</span> Los puntos acumulados son canjeables por productos oficiales y descuentos exclusivos en el nido.</li>
                  </ul>
              </CardContent>
          </Card>

          <Card className="bg-card/40 border-primary/10 backdrop-blur-sm">
              <CardHeader>
                  <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2">
                      <Lock className="h-6 w-6 text-primary" /> Próxima Misión
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="p-6 bg-muted/30 rounded-xl border-2 border-dashed border-primary/20 text-center group hover:border-primary/50 transition-colors">
                      <p className="text-xs text-muted-foreground uppercase font-bold tracking-[0.2em] mb-2">
                          RECOMPENSA DE {activeIndex < 6 ? monthsData[activeIndex + 1]?.name : 'DICIEMBRE'}
                      </p>
                      <p className="text-4xl font-black text-primary tracking-tighter">
                          {activeIndex < 6 ? monthsData[activeIndex + 1]?.points : '+7'} PUNTOS
                      </p>
                  </div>
              </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

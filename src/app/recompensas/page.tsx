'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ArrowLeft, Star, Award, Trophy, Info, ChevronDown, Eye, Gift, Zap } from "lucide-react";
import Link from 'next/link';
import Image from 'next/image';
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

const months = [
  { name: 'JUNIO', points: '+1' },
  { name: 'JULIO', points: '+2' },
  { name: 'AGOSTO', points: '+3', hasChest: true },
  { name: 'SEPTIEMBRE', points: '+4' },
  { name: 'OCTUBRE', points: '+5' },
  { name: 'NOVIEMBRE', points: '+6' },
  { name: 'DICIEMBRE', points: '+7', hasChest: true },
];

const rewardItems = [
  { name: "Membresía 1 Mes Gratis", desc: "Acceso total al nido.", icon: Zap, color: "text-yellow-500" },
  { name: "Par de Guantes Élite", desc: "Protección de grado profesional.", icon: Trophy, color: "text-primary" },
  { name: "Seminario Táctico", desc: "Aprende con los mejores.", icon: Award, color: "text-blue-500" },
  { name: "Gorra Oficial Albatros", desc: "Identidad de equipo.", icon: Star, color: "text-primary" },
  { name: "Rashguard Personalizado", desc: "Segunda piel para el combate.", icon: Gift, color: "text-purple-500" },
  { name: "Protector Bucal Pro", desc: "Seguridad máxima.", icon: Info, color: "text-green-500" },
];

export default function RecompensasPage() {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  useEffect(() => {
    // Determinar el mes actual para la flecha de progreso
    const now = new Date();
    const month = now.getMonth(); 
    // Mapeo: Junio es mes 5 (0-indexed)
    let index = month - 5; 
    if (month < 5) index = -1; // Antes de Junio
    if (month > 11) index = 7; // Después de Diciembre
    setCurrentMonthIndex(index);
  }, []);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      {/* Botón Flotante "Ojito" con Ruleta */}
      <div className="fixed bottom-8 right-8 z-50">
        <Dialog>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-14 w-14 rounded-full bg-primary/10 backdrop-blur-md border border-primary/20 hover:bg-primary/20 transition-all group"
            >
              <Eye className="h-7 w-7 text-primary/40 group-hover:text-primary transition-colors" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-xl border-primary/20">
            <DialogHeader className="text-center">
              <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center justify-center gap-2">
                <Eye className="text-primary" /> Echarle un vistazo
              </DialogTitle>
              <CardDescription className="font-bold text-muted-foreground">Premios de Élite Albatros disponibles</CardDescription>
            </DialogHeader>
            <div className="py-8">
              <Carousel
                opts={{
                  align: "start",
                  loop: true,
                }}
                className="w-full max-w-lg mx-auto"
              >
                <CarouselContent>
                  {rewardItems.map((reward, index) => (
                    <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/2">
                      <div className="p-1">
                        <Card className="bg-background/50 border-primary/10 overflow-hidden hover:border-primary/40 transition-colors">
                          <CardContent className="flex flex-col items-center justify-center p-6 text-center gap-4">
                            <div className={cn("p-4 rounded-full bg-primary/5", reward.color)}>
                              <reward.icon className="h-10 w-10" />
                            </div>
                            <div>
                              <h3 className="font-black uppercase text-sm tracking-tight">{reward.name}</h3>
                              <p className="text-[10px] text-muted-foreground italic mt-1">{reward.desc}</p>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="hidden md:flex border-primary/20 hover:bg-primary/10" />
                <CarouselNext className="hidden md:flex border-primary/20 hover:bg-primary/10" />
              </Carousel>
              <p className="text-center text-[10px] text-muted-foreground mt-6 uppercase tracking-widest font-bold">
                Desliza para ver más recompensas del campamento
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic">Línea del Tiempo Táctica</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto italic">
            Mantén tu disciplina mes con mes. Los cofres revelan tu grandeza al llegar a la meta.
          </p>
        </section>

        <Card className="bg-card/40 border-primary/20 backdrop-blur-sm overflow-hidden">
          <CardHeader className="text-center pb-0">
             <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="h-6 w-6 text-primary" />
                <CardTitle className="uppercase font-black tracking-widest italic">Progreso de Temporada</CardTitle>
             </div>
             <CardDescription>Avance automático basado en tu permanencia.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 md:p-16">
            <div className="relative pt-24 pb-12 overflow-x-auto scrollbar-hide">
              {/* Barra base de la línea de tiempo */}
              <div className="absolute top-[164px] left-0 right-0 h-1 bg-muted-foreground/20 rounded-full" />
              
              <div className="flex justify-between items-start min-w-[800px] relative px-4">
                {months.map((month, index) => {
                  const isPastOrCurrent = index <= currentMonthIndex;
                  const isCurrent = index === currentMonthIndex;
                  
                  // Lógica de los cofres
                  const chestImage = isPastOrCurrent ? '/cofreabierto.png' : '/cofrecerrado.png';

                  return (
                    <div key={month.name} className="flex flex-col items-center relative z-10 w-24">
                      
                      {/* Espacio para el cofre */}
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
                                ¡REVELADO!
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <span className={cn(
                        "text-xs font-black mb-4 tracking-tighter transition-colors",
                        isPastOrCurrent ? "text-primary" : "text-muted-foreground"
                      )}>
                        {month.name}
                      </span>

                      {/* Nodo de la línea de tiempo y Flecha */}
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

                      {/* Puntos acumulados */}
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
                        <Award className="h-4 w-4 text-primary" /> Sistema de Puntos
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                        La constancia en el tatami se traduce en puntos acumulables. Canjéalos por equipamiento oficial y seminarios exclusivos.
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
                        Agosto y Diciembre son hitos críticos. Mantén tu suscripción activa para abrir los cofres y revelar recompensas de alto valor.
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
                        El progreso es automático. Si la disciplina se detiene, el contador regresa al inicio. Solo los más constantes alcanzan el cofre final.
                    </p>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

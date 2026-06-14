'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
    Trophy, Gift, Lock, Unlock, Eye, 
    Zap, Star, Dumbbell, Target, Sparkles, TrendingUp
} from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const PREMIOS_ELITE = [
    { name: 'Parche Albatros Bordado', icon: Star },
    { name: 'Seminario de Verano Gratis', icon: Trophy },
    { name: '1 Mes de BJJ Gratis', icon: Unlock },
    { name: 'Rashguard Exclusiva', icon: Gift },
    { name: 'Jersey Kickboxing', icon: Zap },
    { name: 'Descuento 50% Tienda', icon: Target },
    { name: 'Sesión Privada con Head Coach', icon: Dumbbell },
    { name: 'Kit de Hidratación Pro', icon: Sparkles },
];

export default function RecompensasPage() {
    const [progress, setProgress] = useState(0);
    const [isRuletaOpen, setIsRuletaOpen] = useState(false);
    const currentMonth = new Date().getMonth(); // 0-11

    useEffect(() => {
        const targetProgress = (currentMonth / 11) * 100;
        const timer = setTimeout(() => setProgress(targetProgress), 500);
        return () => clearTimeout(timer);
    }, [currentMonth]);

    const isAgostoUnlocked = currentMonth >= 7; 
    const isDiciembreUnlocked = currentMonth >= 11;

    return (
        <div className="p-4 md:p-8 space-y-8">
            <header>
                <h1 className="text-3xl font-black tracking-tighter uppercase text-primary italic">Programa de Recompensas</h1>
                <p className="text-muted-foreground">Tu disciplina tiene un arsenal de premios esperándote.</p>
            </header>

            <div className="max-w-5xl mx-auto space-y-12">
                <section className="text-center space-y-4">
                    <Badge className="bg-primary text-white font-black uppercase italic tracking-widest px-4 py-1">Estatus: Guerrero en Formación</Badge>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter uppercase italic">La constancia es el <span className="text-primary">Camino</span></h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto italic">
                        Mantén tu racha de pagos al día y desbloquea el arsenal de élite en Agosto y Diciembre.
                    </p>
                </section>

                <Card className="bg-card/40 border-primary/20 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                    <CardHeader>
                        <div className="flex justify-between items-end">
                            <div>
                                <CardTitle className="text-xl font-black uppercase italic flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-primary" /> Progreso de Temporada
                                </CardTitle>
                                <CardDescription className="font-bold">Ciclo Anual de Lealtad Albatros</CardDescription>
                            </div>
                            <span className="text-4xl font-black text-primary italic">{Math.round(progress)}%</span>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-8 pb-12">
                        <div className="relative pt-8">
                            <Progress value={progress} className="h-4 bg-muted/50 border border-primary/10" />
                            
                            <div className="absolute top-0 left-0 w-full flex justify-between px-2">
                                <div className="flex flex-col items-center gap-2" style={{ marginLeft: '66%' }}>
                                    <div className="relative group">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-50 hover:opacity-100 text-primary transition-all scale-125"
                                            onClick={() => setIsRuletaOpen(true)}
                                        >
                                            <Eye className="h-6 w-6" />
                                        </Button>
                                        <div className={cn(
                                            "p-4 rounded-xl border-2 transition-all duration-500",
                                            isAgostoUnlocked ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(255,0,0,0.3)] animate-pulse" : "bg-muted text-muted-foreground border-dashed border-muted-foreground/30"
                                        )}>
                                            {isAgostoUnlocked ? <Unlock className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">Agosto</span>
                                </div>

                                <div className="flex flex-col items-center gap-2">
                                    <div className="relative group">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-50 hover:opacity-100 text-primary transition-all scale-125"
                                            onClick={() => setIsRuletaOpen(true)}
                                        >
                                            <Eye className="h-6 w-6" />
                                        </Button>
                                        <div className={cn(
                                            "p-4 rounded-xl border-2 transition-all duration-500",
                                            isDiciembreUnlocked ? "bg-primary text-white border-primary shadow-[0_0_20px_rgba(255,0,0,0.3)] animate-pulse" : "bg-muted text-muted-foreground border-dashed border-muted-foreground/30"
                                        )}>
                                            {isDiciembreUnlocked ? <Unlock className="h-8 w-8" /> : <Lock className="h-8 w-8" />}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest mt-2">Diciembre</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader className="pb-2">
                            <Zap className="h-8 w-8 text-primary mb-2" />
                            <CardTitle className="text-sm font-black uppercase italic">Puntualidad</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">Paga antes del día 5 para mantener tu racha activa.</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader className="pb-2">
                            <Star className="h-8 w-8 text-primary mb-2" />
                            <CardTitle className="text-sm font-black uppercase italic">Racha de Honor</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">8 meses desbloquean el primer cofre. 12 meses el botín legendario.</p>
                        </CardContent>
                    </Card>
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader className="pb-2">
                            <Trophy className="h-8 w-8 text-primary mb-2" />
                            <CardTitle className="text-sm font-black uppercase italic">Premios Élite</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">Equipo oficial, parches bordados y meses de entreno gratis.</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Dialog open={isRuletaOpen} onOpenChange={setIsRuletaOpen}>
                <DialogContent className="sm:max-w-4xl bg-card border-primary/20">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black uppercase italic text-primary flex items-center gap-2">
                            <Sparkles className="h-6 w-6" /> Arsenal de Premios
                        </DialogTitle>
                        <DialogDescription className="font-bold">Equipo exclusivo para los guerreros más constantes.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="relative py-12 overflow-hidden bg-black/20 rounded-xl border border-primary/10">
                        <div className="flex gap-8 animate-marquee whitespace-nowrap">
                            {[...PREMIOS_ELITE, ...PREMIOS_ELITE].map((premio, i) => (
                                <div key={i} className="inline-flex flex-col items-center justify-center p-6 bg-card border border-primary/10 rounded-xl min-w-[200px] shadow-lg group hover:border-primary/40 transition-all">
                                    <premio.icon className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-black uppercase italic tracking-tighter text-center">{premio.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <style jsx global>{`
                @keyframes marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-marquee {
                    animation: marquee 20s linear infinite;
                }
            `}</style>
        </div>
    );
}

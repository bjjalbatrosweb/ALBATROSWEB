
"use client";

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dices, ShieldAlert, Swords, Trophy, Activity, RotateCcw, Zap, Home } from "lucide-react";
import Link from 'next/link';

const DERRIBOS = [
  "Double Leg", "Single Leg", "Ouchi Gari", "Kouchi Gari", 
  "Tani Otoshi", "Tomoe Nage", "Ankle Pick", "Arm Drag to Back"
];

const SUMISIONES = [
  "Mata León", "Armbar", "Triángulo", "Kimura", 
  "Americana", "Guillotina", "Ezekiel Choke", "Bow and Arrow"
];

const ROLES = [
  { name: "Pasador (Atacar)", icon: Swords, desc: "Tu misión es romper la guardia y dominar." },
  { name: "Guardero (Defender)", icon: ShieldAlert, desc: "Tu misión es mantener distancia y buscar el raspado." }
];

const RESTRICCIONES = [
  "Sin usar las manos (solo frames)", "Solo una pierna activa", 
  "Ojos cerrados (con supervisión)", "No usar solapas (No-Gi style)", 
  "Solo ataques de pierna", "Iniciar sentado", 
  "Iniciar de pie", "Tiempo límite: 2 minutos"
];

export default function DadosPage() {
  const [isRolling, setIsRolling] = useState(false);
  const [results, setResults] = useState<{
    derribo: string;
    sumision: string;
    rol: typeof ROLES[0];
    restriccion: string;
  } | null>(null);

  const rollDice = () => {
    setIsRolling(true);
    setResults(null);

    // Simulamos una demora para la animación
    setTimeout(() => {
      setResults({
        derribo: DERRIBOS[Math.floor(Math.random() * DERRIBOS.length)],
        sumision: SUMISIONES[Math.floor(Math.random() * SUMISIONES.length)],
        rol: ROLES[Math.floor(Math.random() * ROLES.length)],
        restriccion: RESTRICCIONES[Math.floor(Math.random() * RESTRICCIONES.length)],
      });
      setIsRolling(false);
    }, 1000);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto dark bg-background min-h-screen">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
            <h1 className="text-3xl font-black tracking-tighter uppercase italic text-primary">Dados de Combate</h1>
            <p className="text-muted-foreground text-sm">Escenarios tácticos aleatorios para entrenamiento.</p>
        </div>
        <Link href="/">
            <Button variant="ghost" size="sm"><Home className="mr-2 h-4 w-4" /> Inicio</Button>
        </Link>
      </header>

      <div className="flex justify-center pt-8">
        <Button 
          size="lg" 
          onClick={rollDice} 
          disabled={isRolling}
          className="font-black uppercase tracking-widest px-12 h-16 text-lg shadow-[0_0_20px_rgba(255,0,0,0.3)] hover:shadow-primary/50 transition-all"
        >
          {isRolling ? (
            <>
              <RotateCcw className="mr-2 h-6 w-6 animate-spin" />
              Girando...
            </>
          ) : (
            <>
              <Dices className="mr-2 h-6 w-6" />
              Lanzar Dados
            </>
          )}
        </Button>
      </div>

      {results ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in zoom-in-95 duration-500">
          <Card className="border-primary/20 bg-card/50 overflow-hidden group">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Técnica de Entrada</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-2xl font-black text-foreground uppercase italic">{results.derribo}</p>
              <p className="text-sm text-muted-foreground mt-1">Derribo o transición inicial requerida.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Objetivo Final</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-2xl font-black text-foreground uppercase italic">{results.sumision}</p>
              <p className="text-sm text-muted-foreground mt-1">Busca finalizar el asalto con esta técnica.</p>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-card/50 overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex items-center gap-2">
                <results.rol.icon className="h-5 w-5 text-primary" />
                <CardTitle className="text-sm font-black uppercase tracking-widest">Rol Táctico</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-2xl font-black text-foreground uppercase italic">{results.rol.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{results.rol.desc}</p>
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5 overflow-hidden">
            <CardHeader className="bg-destructive/10 pb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <CardTitle className="text-sm font-black uppercase tracking-widest text-destructive">Restricción de Misión</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="text-2xl font-black text-destructive uppercase italic">{results.restriccion}</p>
              <p className="text-sm text-muted-foreground mt-1">Añade este hándicap para forzar tu adaptación.</p>
            </CardContent>
          </Card>
        </div>
      ) : !isRolling && (
        <div className="border-2 border-dashed border-primary/10 rounded-2xl h-64 flex flex-col items-center justify-center bg-card/20 text-muted-foreground">
          <Dices className="h-12 w-12 opacity-20 mb-4" />
          <p className="italic font-medium uppercase tracking-widest text-xs">Esperando órdenes de combate...</p>
        </div>
      )}

      <Card className="bg-primary/5 border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg font-black uppercase italic">¿Cómo usar esta herramienta?</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <span>Lanza los dados antes de cada asalto de sparring para forzar tu zona de confort.</span>
            </li>
            <li className="flex gap-2">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <span>Si sale una técnica que no dominas, úsala como oportunidad de estudio y práctica bajo presión.</span>
            </li>
            <li className="flex gap-2">
              <Zap className="h-4 w-4 text-primary shrink-0" />
              <span>Las restricciones están diseñadas para mejorar tu técnica pura, eliminando el uso de fuerza bruta o agarres habituales.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

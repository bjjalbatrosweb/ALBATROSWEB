"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Dices,
  Home,
  RotateCcw,
  ShieldAlert,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DERRIBOS = [
  "Double Leg",
  "Single Leg",
  "Uchi Mata",
  "Harai Goshi",
  "Ashi Guruma",
  "Tani Otoshi",
  "O Soto Gari",
  "Bomber",
  "Ankle Pick",
  "Arm Drag",
  "Kouchi Gari",
  "De Ashi Barai",
];

const SUMISIONES = [
  "Mata León",
  "Armbar",
  "Triángulo",
  "Kimura",
  "Americana",
  "Guillotina",
  "Ezekiel Choke",
  "Bow and Arrow",
  "Omoplata",
  "Darce Choke",
  "Anaconda Choke",
  "Katagatame",
];

const ROLES = [
  {
    name: "Pasador (Atacar)",
    icon: Swords,
    desc: "Rompe la guardia, consolida el control y busca avanzar.",
  },
  {
    name: "Guardero (Defender)",
    icon: ShieldAlert,
    desc: "Controla la distancia y trabaja para raspar o finalizar.",
  },
];

const RESTRICCIONES = [
  "Sin usar agarres de manga",
  "Solo una pierna activa",
  "No usar solapas (estilo No-Gi)",
  "Solo ataques desde la guardia",
  "Iniciar sentado",
  "Iniciar de pie",
  "Tiempo límite: 2 minutos",
  "Priorizar técnica sobre fuerza",
];

type Mode = "menu" | "dice" | "slots";
type SlotCategory = "derribos" | "sumisiones";

type DiceResults = {
  derribo: string;
  sumision: string;
  rol: (typeof ROLES)[number];
  restriccion: string;
};

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function getThreeDifferent(items: readonly string[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, 3);
}

export default function DadosPage() {
  const [mode, setMode] = useState<Mode>("menu");
  const [isRolling, setIsRolling] = useState(false);
  const [diceResults, setDiceResults] = useState<DiceResults | null>(null);
  const [slotCategory, setSlotCategory] = useState<SlotCategory>("derribos");
  const [slotResults, setSlotResults] = useState<string[]>([]);

  const openMode = (nextMode: Exclude<Mode, "menu">) => {
    setMode(nextMode);
    setIsRolling(false);
  };

  const returnToMenu = () => {
    setMode("menu");
    setIsRolling(false);
  };

  const rollDice = () => {
    if (isRolling) return;

    setIsRolling(true);
    setDiceResults(null);

    window.setTimeout(() => {
      setDiceResults({
        derribo: randomItem(DERRIBOS),
        sumision: randomItem(SUMISIONES),
        rol: randomItem(ROLES),
        restriccion: randomItem(RESTRICCIONES),
      });
      setIsRolling(false);
    }, 900);
  };

  const spinSlots = () => {
    if (isRolling) return;

    setIsRolling(true);
    setSlotResults([]);

    window.setTimeout(() => {
      const selectedList = slotCategory === "derribos" ? DERRIBOS : SUMISIONES;
      setSlotResults(getThreeDifferent(selectedList));
      setIsRolling(false);
    }, 1200);
  };

  const changeSlotCategory = (category: SlotCategory) => {
    if (isRolling) return;
    setSlotCategory(category);
    setSlotResults([]);
  };

  const renderHeader = (title: string, description: string, showBack = false) => (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {showBack && (
          <Button variant="outline" size="sm" onClick={returnToMenu}>
            ← Volver
          </Button>
        )}
        <div>
          <h1 className="text-2xl font-black uppercase italic tracking-tighter text-primary sm:text-3xl">
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Link href="/">
        <Button variant="ghost" size="sm">
          <Home className="mr-2 h-4 w-4" />
          Inicio
        </Button>
      </Link>
    </header>
  );

  const renderMenu = () => (
    <>
      {renderHeader(
        "Generador de Combate",
        "Elige una dinámica aleatoria para tu entrenamiento.",
      )}

      <section className="py-5 text-center sm:py-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-primary">
          Selecciona un modo
        </p>
        <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
          ¿Cómo quieres probar tu suerte?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
          Crea un escenario completo con los dados o consigue tres técnicas
          aleatorias con la tragaperras.
        </p>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <button type="button" onClick={() => openMode("dice")} className="text-left">
          <Card className="group h-full overflow-hidden border-primary/20 transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl hover:shadow-primary/10">
            <CardHeader className="border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg transition-transform group-hover:rotate-6 group-hover:scale-105">
                <Dices className="h-9 w-9" />
              </div>
              <CardTitle className="text-2xl font-black uppercase italic">Dados</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Genera un derribo, una sumisión, un rol táctico y una restricción
                para construir un asalto completo.
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-primary">
                  4 resultados
                </span>
                <span className="font-bold text-primary transition-transform group-hover:translate-x-1">
                  Entrar →
                </span>
              </div>
            </CardContent>
          </Card>
        </button>

        <button type="button" onClick={() => openMode("slots")} className="text-left">
          <Card className="group h-full overflow-hidden border-amber-500/20 transition-all hover:-translate-y-1 hover:border-amber-500/60 hover:shadow-xl hover:shadow-amber-500/10">
            <CardHeader className="border-b bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg transition-transform group-hover:-rotate-6 group-hover:scale-105">
                <Trophy className="h-9 w-9" />
              </div>
              <CardTitle className="text-2xl font-black uppercase italic">Tragaperras</CardTitle>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Elige entre derribos o sumisiones y gira para obtener tres
                técnicas diferentes al azar.
              </p>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-amber-500">
                  3 resultados
                </span>
                <span className="font-bold text-amber-500 transition-transform group-hover:translate-x-1">
                  Entrar →
                </span>
              </div>
            </CardContent>
          </Card>
        </button>
      </div>

      <Card className="border-primary/10 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p>
            Utiliza los resultados como objetivo técnico del round. Si aparece
            una técnica que todavía no dominas, practícala primero de forma
            controlada antes de llevarla al sparring.
          </p>
        </CardContent>
      </Card>
    </>
  );

  const resultCards = diceResults
    ? [
        {
          title: "Técnica de entrada",
          value: diceResults.derribo,
          description: "Derribo o transición inicial requerida.",
          icon: Activity,
          destructive: false,
        },
        {
          title: "Objetivo final",
          value: diceResults.sumision,
          description: "Busca terminar el asalto con esta sumisión.",
          icon: Trophy,
          destructive: false,
        },
        {
          title: "Rol táctico",
          value: diceResults.rol.name,
          description: diceResults.rol.desc,
          icon: diceResults.rol.icon,
          destructive: false,
        },
        {
          title: "Restricción de misión",
          value: diceResults.restriccion,
          description: "Adapta tu estrategia sin abandonar el control técnico.",
          icon: ShieldAlert,
          destructive: true,
        },
      ]
    : [];

  const renderDice = () => (
    <>
      {renderHeader(
        "Dados de Combate",
        "Genera un escenario táctico completo para tu siguiente asalto.",
        true,
      )}

      <Card className="overflow-hidden border-primary/20">
        <CardContent className="flex flex-col items-center bg-gradient-to-br from-primary/10 via-background to-background p-7 text-center sm:p-10">
          <div className={cn(
            "mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl",
            isRolling && "animate-bounce",
          )}>
            <Dices className={cn("h-11 w-11", isRolling && "animate-spin")} />
          </div>
          <h2 className="text-2xl font-black uppercase italic">Escenario aleatorio</h2>
          <p className="mb-6 mt-2 max-w-lg text-sm text-muted-foreground">
            Cada lanzamiento combina cuatro condiciones para crear un round
            diferente y obligarte a adaptar tu estrategia.
          </p>
          <Button
            size="lg"
            onClick={rollDice}
            disabled={isRolling}
            className="h-14 min-w-64 px-8 text-base font-black uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            {isRolling ? (
              <>
                <RotateCcw className="mr-2 h-5 w-5 animate-spin" />
                Lanzando...
              </>
            ) : (
              <>
                <Dices className="mr-2 h-5 w-5" />
                {diceResults ? "Lanzar de nuevo" : "Lanzar dados"}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {diceResults ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {resultCards.map(result => (
            <Card
              key={result.title}
              className={cn(
                "overflow-hidden animate-in zoom-in-95 duration-500",
                result.destructive
                  ? "border-destructive/30"
                  : "border-primary/20",
              )}
            >
              <CardHeader className={cn(
                "border-b pb-4",
                result.destructive ? "bg-destructive/10" : "bg-primary/5",
              )}>
                <div className="flex items-center gap-2">
                  <result.icon className={cn(
                    "h-5 w-5",
                    result.destructive ? "text-destructive" : "text-primary",
                  )} />
                  <CardTitle className={cn(
                    "text-xs font-black uppercase tracking-widest",
                    result.destructive && "text-destructive",
                  )}>
                    {result.title}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className={cn(
                  "text-2xl font-black uppercase italic",
                  result.destructive && "text-destructive",
                )}>
                  {result.value}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {result.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isRolling ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/15 bg-card/20 text-muted-foreground">
          <Dices className="mb-3 h-10 w-10 opacity-20" />
          <p className="text-xs font-bold uppercase tracking-widest">
            Esperando lanzamiento
          </p>
        </div>
      ) : null}
    </>
  );

  const renderSlots = () => (
    <>
      {renderHeader(
        "Tragaperras",
        "Elige una categoría y consigue tres técnicas diferentes.",
        true,
      )}

      <Card className="overflow-hidden border-amber-500/25 shadow-xl shadow-amber-500/5">
        <div className="border-b bg-gradient-to-br from-amber-500/15 via-background to-background p-6 text-center sm:p-8">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-amber-500">
            Selecciona la categoría
          </p>
          <div className="mx-auto grid max-w-lg grid-cols-2 gap-3">
            <Button
              type="button"
              variant={slotCategory === "derribos" ? "default" : "outline"}
              onClick={() => changeSlotCategory("derribos")}
              disabled={isRolling}
              className="h-12 font-black uppercase"
            >
              <Activity className="mr-2 h-5 w-5" />
              Derribos
            </Button>
            <Button
              type="button"
              variant={slotCategory === "sumisiones" ? "default" : "outline"}
              onClick={() => changeSlotCategory("sumisiones")}
              disabled={isRolling}
              className="h-12 font-black uppercase"
            >
              <Swords className="mr-2 h-5 w-5" />
              Sumisiones
            </Button>
          </div>
        </div>

        <CardContent className="space-y-7 p-5 sm:p-8">
          <div className="grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((position) => {
              const result = slotResults[position];
              return (
                <div
                  key={position}
                  className={cn(
                    "relative flex min-h-40 items-center justify-center overflow-hidden rounded-2xl border-2 p-5 text-center",
                    result
                      ? "border-amber-500/60 bg-gradient-to-b from-amber-500/15 to-background shadow-lg"
                      : "border-dashed border-muted-foreground/20 bg-muted/20",
                  )}
                >
                  <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-background text-xs font-black shadow">
                    {position + 1}
                  </span>
                  {isRolling ? (
                    <div className="space-y-3">
                      <RotateCcw className="mx-auto h-9 w-9 animate-spin text-amber-500" />
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Girando
                      </p>
                    </div>
                  ) : result ? (
                    <div className="animate-in zoom-in-75 duration-500">
                      <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-amber-500">
                        {slotCategory === "derribos" ? "Derribo" : "Sumisión"}
                      </p>
                      <p className="text-xl font-black uppercase italic sm:text-2xl">
                        {result}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <Trophy className="mx-auto mb-3 h-9 w-9 text-muted-foreground/20" />
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
                        Sin resultado
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              onClick={spinSlots}
              disabled={isRolling}
              className="h-14 min-w-64 bg-amber-500 px-8 text-base font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
            >
              {isRolling ? (
                <>
                  <RotateCcw className="mr-2 h-5 w-5 animate-spin" />
                  Girando...
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-5 w-5" />
                  {slotResults.length ? "Volver a girar" : "Girar"}
                </>
              )}
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              Los tres resultados siempre serán diferentes entre sí.
            </p>
          </div>
        </CardContent>
      </Card>

      {slotResults.length > 0 && !isRolling && (
        <Card className="border-amber-500/15 bg-amber-500/5">
          <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
            <Zap className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <p>
              Practica cada resultado por separado o intenta conectar las tres
              técnicas durante el mismo bloque de entrenamiento.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <main className="min-h-screen bg-background p-4 dark md:p-8">
      <div className="mx-auto max-w-5xl space-y-7">
        {mode === "menu" && renderMenu()}
        {mode === "dice" && renderDice()}
        {mode === "slots" && renderSlots()}
      </div>
    </main>
  );
}

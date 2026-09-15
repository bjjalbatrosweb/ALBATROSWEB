"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DailyAdherenceCard } from "@/components/dashboard/daily-adherence-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerformanceDashboard } from "@/hooks/use-performance-dashboard";

const WeeklyEnergyChart = dynamic(
  () => import("@/components/dashboard/weekly-energy-chart"),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[300px] w-full" />,
  },
);

const PERFORMANCE_GUIDELINES = [
  "Mantén un balance energético acorde a tus objetivos durante toda la semana. Evita variaciones grandes entre días.",
  "Asegura una ingesta adecuada de proteína diaria para favorecer la recuperación y el rendimiento.",
  "Procura respetar los horarios de comida, especialmente después del entrenamiento.",
  "Hidrátate correctamente a lo largo del día.",
  "Da prioridad a alimentos de buena calidad nutricional y evita omitir comidas.",
  "Mantén constancia y registra tus alimentos para un mejor seguimiento.",
  "El progreso depende de la disciplina diaria. Enfócate en mejorar pequeños detalles semana a semana.",
];

export function PerformanceDashboard() {
  const { dailyTargets, dailyConsumed, energyBalanceData, isLoading, hasNutritionTargets } =
    usePerformanceDashboard();

  return (
    <div className="space-y-8 p-4 md:p-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">
          Dashboard de Rendimiento
        </h1>
        <p className="text-muted-foreground">
          Análisis de la semana: prepárate para el combate.
        </p>
      </header>

      {!isLoading && !hasNutritionTargets && (
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100">
          <p className="flex items-start gap-2 font-bold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Aún no tienes metas nutricionales calculadas; por eso no mostramos objetivos genéricos.</p>
          <Link href="/laboratorio" className="mt-2 inline-flex font-black text-amber-200 underline underline-offset-4">Configurar una estimación</Link>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 lg:grid-cols-3 ${!hasNutritionTargets ? "opacity-60" : ""}`}>
        <div className="grid gap-6 lg:col-span-1">
          <DailyAdherenceCard
            dailyConsumed={dailyConsumed}
            dailyTargets={dailyTargets}
            isLoading={isLoading}
          />
        </div>

        <div className="grid gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="font-black tracking-tighter">
                Balance Energético Semanal
              </CardTitle>
              <CardDescription>
                Ingesta vs. Gasto Calórico de los últimos 7 días.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WeeklyEnergyChart
                data={energyBalanceData}
                targetCalories={dailyTargets.calories}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="font-black tracking-tighter">
              Instrucciones Generales
            </CardTitle>
            <CardDescription>
              Guía para optimizar tu rendimiento y disciplina.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {PERFORMANCE_GUIDELINES.map((guideline) => (
                <li key={guideline}>{guideline}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

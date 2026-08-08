"use client";

import type { DailyTargets } from "@/context/DailyDataProvider";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { DailyConsumed } from "@/components/dashboard/performance-dashboard-types";

type DailyAdherenceCardProps = {
  dailyConsumed: DailyConsumed;
  dailyTargets: DailyTargets;
  isLoading: boolean;
};

type MacroKey = "protein" | "carbs" | "fats";

function MacroProgress({
  consumed,
  target,
  title,
  isLoading,
}: {
  consumed: number;
  target: number;
  title: string;
  isLoading: boolean;
}) {
  const percentage = target > 0 ? (consumed / target) * 100 : 0;

  if (isLoading) {
    return (
      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
          <Skeleton className="h-5 w-1/3" />
        </div>
        <Skeleton className="h-2 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <p className="font-mono text-sm tracking-tighter">
          <span className="font-bold text-foreground">
            {consumed.toLocaleString()}
          </span>{" "}
          / {target.toLocaleString()} g
        </p>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

function DailyCalorieSummary({
  dailyConsumed,
  dailyTargets,
  isLoading,
}: DailyAdherenceCardProps) {
  const netBalance = dailyConsumed.calories - dailyConsumed.expenditure;

  if (isLoading) {
    return (
      <div>
        <h3 className="mb-4 text-lg font-bold tracking-tight">
          Balance Calórico del Día
        </h3>
        <div className="space-y-4 rounded-md border bg-secondary/50 p-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-bold tracking-tight">
        Balance Calórico del Día
      </h3>
      <div className="space-y-4 rounded-md border bg-secondary/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Ingesta</span>
          <span className="font-mono font-bold tracking-tighter text-foreground">
            {dailyConsumed.calories.toLocaleString()} kcal
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Gasto</span>
          <span className="font-mono font-bold tracking-tighter text-foreground">
            {dailyConsumed.expenditure.toLocaleString()} kcal
          </span>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <span className="font-medium">Balance Neto</span>
          <span
            className={`font-mono font-bold tracking-tighter ${
              netBalance >= 0 ? "text-primary" : "text-destructive"
            }`}
          >
            {netBalance >= 0 ? "+" : ""}
            {netBalance.toLocaleString()} kcal
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Objetivo Calórico</span>
          <span className="font-mono tracking-tighter text-primary/80">
            {dailyTargets.calories.toLocaleString()} kcal
          </span>
        </div>
      </div>
    </div>
  );
}

export function DailyAdherenceCard(props: DailyAdherenceCardProps) {
  const macros: Array<{ key: MacroKey; title: string }> = [
    { key: "protein", title: "Proteína (g)" },
    { key: "carbs", title: "Carbohidratos (g)" },
    { key: "fats", title: "Grasas (g)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-black tracking-tighter">
          Adherencia Diaria
        </CardTitle>
        <CardDescription>Cumplimiento de objetivos para hoy.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <DailyCalorieSummary {...props} />
          <Separator />
          <div>
            <h3 className="mb-4 text-lg font-bold tracking-tight">
              Macros de Combate
            </h3>
            <div className="space-y-4">
              {macros.map(({ key, title }) => (
                <MacroProgress
                  key={key}
                  consumed={props.dailyConsumed[key]}
                  target={props.dailyTargets[key]}
                  title={title}
                  isLoading={props.isLoading}
                />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

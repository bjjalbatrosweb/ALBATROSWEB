"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { EnergyBalancePoint } from "@/components/dashboard/performance-dashboard-types";

const chartConfig = {
  intake: {
    label: "Ingesta",
    color: "hsl(var(--primary))",
  },
  expenditure: {
    label: "Gasto",
    color: "hsl(var(--muted-foreground))",
  },
};

type WeeklyEnergyChartProps = {
  data: EnergyBalancePoint[];
  targetCalories: number;
  isLoading: boolean;
};

function EnergyTooltip({
  active,
  payload,
  label,
}: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload as EnergyBalancePoint;
  const netBalance = data.intake - data.expenditure;

  return (
    <div className="rounded-md border bg-card p-3 text-sm shadow-lg">
      <p className="mb-2 font-bold">{label}</p>
      <div className="space-y-1">
        <p>
          Ingesta:{" "}
          <span className="font-mono font-medium">
            {data.intake.toLocaleString()} kcal
          </span>
        </p>
        <p>
          Gasto:{" "}
          <span className="font-mono font-medium">
            {data.expenditure.toLocaleString()} kcal
          </span>
        </p>
        <p
          className={`font-bold ${
            netBalance >= 0 ? "text-primary" : "text-destructive"
          }`}
        >
          Balance Neto:{" "}
          <span className="font-mono font-medium">
            {netBalance >= 0 ? "+" : ""}
            {netBalance.toLocaleString()} kcal
          </span>
        </p>
      </div>
    </div>
  );
}

export default function WeeklyEnergyChart({
  data,
  targetCalories,
  isLoading,
}: WeeklyEnergyChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[300px] w-full" />;
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart
        data={data}
        margin={{ top: 20, right: 20, left: -20, bottom: 5 }}
        barGap={4}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          unit="kcal"
        />
        <Tooltip cursor={false} content={<EnergyTooltip />} />
        <ChartLegend content={<ChartLegendContent />} />
        <ReferenceLine
          y={targetCalories}
          label={{
            value: "Meta Ingesta",
            position: "insideTopRight",
            fill: "hsl(var(--muted-foreground))",
            fontSize: 12,
          }}
          stroke="hsl(var(--ring))"
          strokeDasharray="2 6"
        />
        <Bar
          dataKey="intake"
          fill="var(--color-intake)"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="expenditure"
          fill="var(--color-expenditure)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}

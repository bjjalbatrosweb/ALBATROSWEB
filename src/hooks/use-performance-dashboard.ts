"use client";

import { useMemo } from "react";
import { format, startOfDay, subDays } from "date-fns";
import { es } from "date-fns/locale";
import { collection, query, where } from "firebase/firestore";

import { useDailyData } from "@/context/DailyDataProvider";
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  useUser,
} from "@/firebase";
import type {
  DailyConsumed,
  EnergyBalancePoint,
  MealLog,
  TrainingSession,
} from "@/components/dashboard/performance-dashboard-types";

const EMPTY_DAILY_CONSUMED: DailyConsumed = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
  expenditure: 0,
};

export function usePerformanceDashboard() {
  const { dailyTargets, isDataLoading: isTargetsLoading } = useDailyData();
  const { user } = useUser();
  const firestore = useFirestore();
  const sevenDaysAgo = useMemo(() => startOfDay(subDays(new Date(), 6)), []);

  const mealLogsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;

    return query(
      collection(firestore, `perfiles/${user.uid}/mealLogs`),
      where("logDate", ">=", sevenDaysAgo.toISOString()),
    );
  }, [user, firestore, sevenDaysAgo]);
  const { data: mealLogs, isLoading: isLoadingMeals } =
    useCollection<MealLog>(mealLogsQuery);

  const trainingSessionsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;

    return query(
      collection(firestore, `perfiles/${user.uid}/trainingSessions`),
      where("logDate", ">=", sevenDaysAgo.toISOString()),
    );
  }, [user, firestore, sevenDaysAgo]);
  const { data: trainingSessions, isLoading: isLoadingTrainings } =
    useCollection<TrainingSession>(trainingSessionsQuery);

  const isLoading =
    isLoadingMeals || isLoadingTrainings || isTargetsLoading;

  const { dailyConsumed, energyBalanceData } = useMemo(() => {
    const today = startOfDay(new Date());
    const todayKey = today.toISOString().split("T")[0];
    const todayLogs =
      mealLogs?.filter((log) => log.logDate.startsWith(todayKey)) ?? [];
    const todaySessions =
      trainingSessions?.filter((session) =>
        session.logDate.startsWith(todayKey),
      ) ?? [];

    const consumed: DailyConsumed = {
      ...EMPTY_DAILY_CONSUMED,
      calories: todayLogs.reduce((sum, log) => sum + log.totalCalories, 0),
      protein: todayLogs.reduce((sum, log) => sum + log.totalProtein, 0),
      carbs: todayLogs.reduce(
        (sum, log) => sum + log.totalCarbohydrates,
        0,
      ),
      fats: todayLogs.reduce((sum, log) => sum + log.totalFat, 0),
      expenditure: todaySessions.reduce(
        (sum, session) => sum + session.estimatedCaloriesBurned,
        0,
      ),
    };

    const balanceData: EnergyBalancePoint[] = Array.from(
      { length: 7 },
      (_, index) => {
        const day = startOfDay(subDays(new Date(), index));
        const dayKey = day.toISOString().split("T")[0];
        const dayLogs =
          mealLogs?.filter((log) => log.logDate.startsWith(dayKey)) ?? [];
        const daySessions =
          trainingSessions?.filter((session) =>
            session.logDate.startsWith(dayKey),
          ) ?? [];

        return {
          day: format(day, "E", { locale: es }),
          intake: dayLogs.reduce((sum, log) => sum + log.totalCalories, 0),
          expenditure: daySessions.reduce(
            (sum, session) => sum + session.estimatedCaloriesBurned,
            0,
          ),
        };
      },
    ).reverse();

    return { dailyConsumed: consumed, energyBalanceData: balanceData };
  }, [mealLogs, trainingSessions]);

  return { dailyTargets, dailyConsumed, energyBalanceData, isLoading };
}


'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';

// Define types within the provider for centralization
export type Biometrics = {
  gender: 'male' | 'female';
  weight: number;
  height: number;
  age: number;
  activityLevel: number;
};

export type Goal = 'maintain' | 'lose' | 'gain';

export type DailyTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

// Based on docs/backend.json UserProfile entity
type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: 'male' | 'female';
  heightCm: number;
  weightKg: number;
  activityLevel: number;
  goal: Goal;
  dailyTargetCalories: number;
  dailyTargetProtein: number;
  dailyTargetCarbs: number;
  dailyTargetFats: number;
};


interface DailyDataContextType {
  intakeCalories: number;
  setIntakeCalories: React.Dispatch<React.SetStateAction<number>>;
  expenditureCalories: number;
  setExpenditureCalories: React.Dispatch<React.SetStateAction<number>>;
  biometrics: Biometrics;
  setBiometrics: React.Dispatch<React.SetStateAction<Biometrics>>;
  goal: Goal;
  setGoal: React.Dispatch<React.SetStateAction<Goal>>;
  dailyTargets: DailyTargets;
  setDailyTargets: React.Dispatch<React.SetStateAction<DailyTargets>>;
  saveData: (data: { biometrics: Biometrics, goal: Goal, dailyTargets: DailyTargets }) => Promise<void>;
  isDataLoading: boolean;
  hasProfileData: boolean;
  hasNutritionTargets: boolean;
}

const DailyDataContext = createContext<DailyDataContextType | undefined>(undefined);

const DEFAULT_BIOMETRICS: Biometrics = {
  gender: 'male',
  weight: 0,
  height: 0,
  age: 0,
  activityLevel: 1.55,
};
const DEFAULT_GOAL: Goal = 'maintain';
const DEFAULT_DAILY_TARGETS: DailyTargets = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fats: 0,
};

export const DailyDataProvider = ({ children }: { children: ReactNode }) => {
  const [intakeCalories, setIntakeCalories] = useState(0);
  const [expenditureCalories, setExpenditureCalories] = useState(0);

  const { user } = useUser();
  const firestore = useFirestore();

  const [biometrics, setBiometrics] = useState<Biometrics>(DEFAULT_BIOMETRICS);
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [dailyTargets, setDailyTargets] = useState<DailyTargets>(DEFAULT_DAILY_TARGETS);

  const userProfileRef = useMemoFirebase(() =>
    user && firestore ? doc(firestore, 'perfiles', user.uid) : null,
    [user, firestore]
  );
  
  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (userProfile) {
      setBiometrics({
        gender: userProfile.gender || DEFAULT_BIOMETRICS.gender,
        weight: userProfile.weightKg || DEFAULT_BIOMETRICS.weight,
        height: userProfile.heightCm || DEFAULT_BIOMETRICS.height,
        age: userProfile.age || DEFAULT_BIOMETRICS.age,
        activityLevel: userProfile.activityLevel || DEFAULT_BIOMETRICS.activityLevel,
      });
      setGoal(userProfile.goal || DEFAULT_GOAL);
      setDailyTargets({
        calories: userProfile.dailyTargetCalories || DEFAULT_DAILY_TARGETS.calories,
        protein: userProfile.dailyTargetProtein || DEFAULT_DAILY_TARGETS.protein,
        carbs: userProfile.dailyTargetCarbs || DEFAULT_DAILY_TARGETS.carbs,
        fats: userProfile.dailyTargetFats || DEFAULT_DAILY_TARGETS.fats,
      });
    }
  }, [userProfile]);

  const saveData = useCallback(async (data: { biometrics: Biometrics, goal: Goal, dailyTargets: DailyTargets }) => {
    if (!user) throw new Error("Sesión requerida.");
    const dataToSave = {
      gender: data.biometrics.gender,
      weightKg: data.biometrics.weight,
      heightCm: data.biometrics.height,
      age: data.biometrics.age,
      activityLevel: data.biometrics.activityLevel,
      goal: data.goal,
      dailyTargets: data.dailyTargets,
    };
    const token = await user.getIdToken();
    const { response, data: result } = await apiRequest<{ ok?: boolean; mensaje?: string }>("/api/perfil", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(dataToSave),
    });
    if (!response.ok || !result.ok) {
      throw new Error(apiErrorMessage(response.status, result.mensaje, "No se pudieron guardar las metas."));
    }
    setBiometrics(data.biometrics);
    setGoal(data.goal);
    setDailyTargets(data.dailyTargets);
  }, [user]);

  const hasProfileData = biometrics.weight > 0 && biometrics.height > 0 && biometrics.age > 0;
  const hasNutritionTargets = dailyTargets.calories > 0;

  return (
    <DailyDataContext.Provider value={{
      intakeCalories,
      setIntakeCalories,
      expenditureCalories,
      setExpenditureCalories,
      biometrics,
      setBiometrics,
      goal,
      setGoal,
      dailyTargets,
      setDailyTargets,
      saveData,
      isDataLoading: isProfileLoading,
      hasProfileData,
      hasNutritionTargets,
    }}>
      {children}
    </DailyDataContext.Provider>
  );
};

export const useDailyData = () => {
  const context = useContext(DailyDataContext);
  if (context === undefined) {
    throw new Error('useDailyData must be used within a DailyDataProvider');
  }
  return context;
};

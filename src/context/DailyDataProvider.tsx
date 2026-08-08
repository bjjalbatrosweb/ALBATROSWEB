
'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';

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
  saveData: (data: { biometrics: Biometrics, goal: Goal, dailyTargets: DailyTargets }) => void;
  isDataLoading: boolean;
}

const DailyDataContext = createContext<DailyDataContextType | undefined>(undefined);

const DEFAULT_BIOMETRICS: Biometrics = {
  gender: 'male',
  weight: 84,
  height: 180,
  age: 28,
  activityLevel: 1.55,
};
const DEFAULT_GOAL: Goal = 'maintain';
const DEFAULT_DAILY_TARGETS: DailyTargets = {
  calories: 3200,
  protein: 185,
  carbs: 380,
  fats: 90,
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

  const saveData = useCallback((data: { biometrics: Biometrics, goal: Goal, dailyTargets: DailyTargets }) => {
    if (!userProfileRef) return;
    
    // Update context state immediately for snappy UI
    setBiometrics(data.biometrics);
    setGoal(data.goal);
    setDailyTargets(data.dailyTargets);

    const dataToSave = {
      gender: data.biometrics.gender,
      weightKg: data.biometrics.weight,
      heightCm: data.biometrics.height,
      age: data.biometrics.age,
      activityLevel: data.biometrics.activityLevel,
      goal: data.goal,
      dailyTargetCalories: data.dailyTargets.calories,
      dailyTargetProtein: data.dailyTargets.protein,
      dailyTargetCarbs: data.dailyTargets.carbs,
      dailyTargetFats: data.dailyTargets.fats,
      updatedAt: serverTimestamp(),
    };
    
    setDocumentNonBlocking(userProfileRef, dataToSave, { merge: true });
  }, [userProfileRef]);

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

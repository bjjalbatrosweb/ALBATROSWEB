export type MealLog = {
  id: string;
  logDate: string;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbohydrates: number;
};

export type TrainingSession = {
  id: string;
  logDate: string;
  estimatedCaloriesBurned: number;
};

export type DailyConsumed = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  expenditure: number;
};

export type EnergyBalancePoint = {
  day: string;
  intake: number;
  expenditure: number;
};

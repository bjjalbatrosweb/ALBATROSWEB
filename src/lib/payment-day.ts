export type TrainingSchedule = "monday" | "tuesday";

export const MONTHLY_PRICES = { 1: 600, 2: 900 } as const;
export const SCHEDULE_DAYS: Record<TrainingSchedule, readonly number[]> = {
  monday: [1, 3, 5],
  tuesday: [2, 4, 6],
};

export type PaymentDayResult = {
  monthlyPrice: number;
  totalClasses: number;
  remainingClasses: number;
  attendedClasses: number;
  amountDue: number;
  nextPaymentDate: Date;
  classDates: Date[];
};

export function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculatePaymentDay(startDate: Date, disciplines: 1 | 2, schedule: TrainingSchedule): PaymentDayResult {
  const year = startDate.getFullYear();
  const month = startDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const allowedDays = SCHEDULE_DAYS[schedule];
  const classDates = Array.from({ length: lastDay }, (_, index) => new Date(year, month, index + 1, 12))
    .filter((date) => allowedDays.includes(date.getDay()));
  const remainingClasses = classDates.filter((date) => date >= startDate).length;
  const monthlyPrice = MONTHLY_PRICES[disciplines];
  const amountDue = classDates.length ? Math.round((monthlyPrice * remainingClasses / classDates.length) * 100) / 100 : 0;

  return {
    monthlyPrice,
    totalClasses: classDates.length,
    remainingClasses,
    attendedClasses: classDates.length - remainingClasses,
    amountDue,
    nextPaymentDate: new Date(year, month + 1, 1, 12),
    classDates,
  };
}

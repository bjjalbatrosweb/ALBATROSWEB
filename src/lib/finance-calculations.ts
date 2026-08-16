export type FinanceMovement = {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  date: Date;
  source?: "payment" | "manual";
};

export function safeAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
}

export function financeSummary(movements: FinanceMovement[]) {
  const income = movements.filter((item) => item.type === "income").reduce((sum, item) => sum + safeAmount(item.amount), 0);
  const expenses = movements.filter((item) => item.type === "expense").reduce((sum, item) => sum + safeAmount(item.amount), 0);
  const balance = income - expenses;
  const margin = income > 0 ? (balance / income) * 100 : 0;
  return { income, expenses, balance, margin };
}

export function totalsByCategory(movements: FinanceMovement[], type: FinanceMovement["type"]) {
  const totals = new Map<string, number>();
  movements.filter((item) => item.type === type).forEach((item) => {
    const category = item.category.trim() || "Sin categoría";
    totals.set(category, (totals.get(category) || 0) + safeAmount(item.amount));
  });
  return [...totals.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function dailyCashFlow(movements: FinanceMovement[], year: number, monthIndex: number) {
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    const current = movements.filter((item) => item.date.getFullYear() === year && item.date.getMonth() === monthIndex && item.date.getDate() === day);
    return { day: String(day), ingresos: current.filter((item) => item.type === "income").reduce((sum, item) => sum + safeAmount(item.amount), 0), egresos: current.filter((item) => item.type === "expense").reduce((sum, item) => sum + safeAmount(item.amount), 0) };
  });
}

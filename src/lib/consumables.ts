export type ConsumableMovement = {
  id: string;
  type: "entry" | "consumption" | "adjustment";
  quantity: number;
  before: number;
  after: number;
  responsible: string;
  notes: string;
  at: string;
};

export type ConsumableItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minimum: number;
  target: number;
  unitCost: number;
  supplier: string;
  notes: string;
  history: ConsumableMovement[];
  updatedAt: string | null;
};

export type StockState = "out" | "low" | "ok";

export function consumableState(item: ConsumableItem): StockState {
  if (item.stock <= 0) return "out";
  if (item.stock <= item.minimum) return "low";
  return "ok";
}

export function suggestedPurchase(item: ConsumableItem) {
  return Math.max(0, item.target - item.stock);
}

export function consumableStats(items: ConsumableItem[]) {
  const out = items.filter((item) => consumableState(item) === "out").length;
  const low = items.filter((item) => consumableState(item) === "low").length;
  const value = items.reduce(
    (total, item) => total + item.stock * item.unitCost,
    0,
  );
  return { total: items.length, out, low, ok: items.length - out - low, value };
}

export function buildPurchaseList(items: ConsumableItem[], site: string) {
  const required = items
    .filter((item) => consumableState(item) !== "ok")
    .map((item) => ({ item, quantity: suggestedPurchase(item) }))
    .filter(({ quantity }) => quantity > 0);
  const lines = [`Lista de reposición · ${site}`];
  if (required.length === 0) lines.push("No hay compras pendientes.");
  else {
    lines.push(
      ...required.map(
        ({ item, quantity }) =>
          `- ${item.name}: comprar ${quantity} ${item.unit}${quantity === 1 ? "" : "s"}${
            item.supplier ? ` · ${item.supplier}` : ""
          }`,
      ),
    );
  }
  return lines.join("\n");
}

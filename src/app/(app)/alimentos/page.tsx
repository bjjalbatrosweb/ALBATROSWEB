"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Loader2,
  MinusCircle,
  PlusCircle,
  Save,
  Search,
  ShoppingBasket,
  XCircle,
} from "lucide-react";
import { collection, query } from "firebase/firestore";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDailyData } from "@/context/DailyDataProvider";
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { useToast } from "@/hooks/use-toast";
import { apiErrorMessage, apiRequest } from "@/lib/api-client";
import {
  addFoodSelection,
  foodSearchKey,
  foodSelectionNote,
  foodSelectionTotals,
  normalizeFoodCatalogItem,
  normalizeFoodGrams,
  type SelectedFood,
} from "@/lib/food-selection";

type FoodDocument = { id: string; [key: string]: unknown };
type MealType = "Desayuno" | "Almuerzo" | "Cena" | "Snack";

export default function AlimentosPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFoods, setSelectedFoods] = useState<SelectedFood[]>([]);
  const [mealType, setMealType] = useState<MealType>("Almuerzo");
  const [saving, setSaving] = useState(false);
  const { setIntakeCalories } = useDailyData();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const foodsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, "alimentos")) : null),
    [firestore],
  );
  const { data: foodDocuments, isLoading } = useCollection<FoodDocument>(foodsQuery);

  const foods = useMemo(
    () =>
      (foodDocuments || [])
        .map((item) => normalizeFoodCatalogItem(item.id, item))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((left, right) => left.name.localeCompare(right.name, "es")),
    [foodDocuments],
  );
  const searchKey = foodSearchKey(searchTerm);
  const filteredFoods = foods.filter((food) =>
    foodSearchKey(food.name).includes(searchKey),
  );
  const totals = useMemo(() => foodSelectionTotals(selectedFoods), [selectedFoods]);
  const hasMacros = totals.protein > 0 || totals.fat > 0 || totals.carbs > 0;

  useEffect(() => {
    setIntakeCalories(totals.calories);
  }, [setIntakeCalories, totals.calories]);

  function addFood(food: (typeof foods)[number]) {
    if (selectedFoods.length >= 30 && !selectedFoods.some((item) => item.id === food.id)) {
      toast({ variant: "destructive", title: "Selección completa", description: "Puedes incluir hasta 30 alimentos en una comida." });
      return;
    }
    setSelectedFoods((current) => addFoodSelection(current, food));
  }

  function changeGrams(id: string, value: string) {
    setSelectedFoods((current) =>
      current.map((food) =>
        food.id === id ? { ...food, grams: normalizeFoodGrams(value) } : food,
      ),
    );
  }

  function removeFood(id: string) {
    setSelectedFoods((current) => current.filter((food) => food.id !== id));
  }

  async function saveMeal() {
    if (!user || saving || selectedFoods.length === 0) return;
    try {
      setSaving(true);
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<{ ok?: boolean; mensaje?: string }>(
        "/api/bitacora",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            type: "meal",
            mealType,
            totalCalories: totals.calories,
            totalProtein: totals.protein,
            totalFat: totals.fat,
            totalCarbohydrates: totals.carbs,
            notes: foodSelectionNote(selectedFoods),
          }),
        },
      );
      if (!response.ok || !data.ok) {
        throw new Error(
          apiErrorMessage(response.status, data.mensaje, "No se pudo guardar la comida."),
        );
      }
      setSelectedFoods([]);
      toast({ title: "Comida guardada", description: "Ya aparece en tu bitácora y en el resumen de rendimiento." });
    } catch (error) {
      toast({ variant: "destructive", title: "No se guardó la comida", description: error instanceof Error ? error.message : "Inténtalo nuevamente." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen space-y-6 bg-slate-950 p-4 pb-28 text-white md:p-8 md:pb-10">
      <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(16,185,129,.14),transparent_38%),linear-gradient(135deg,#17191f,#0b101a)] p-6 md:p-8">
        <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Nutrición personal</p>
        <h1 className="mt-2 text-3xl font-black tracking-tighter md:text-4xl">Registro de alimentos</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Elige alimentos, ajusta los gramos y guarda el total como una comida real en tu bitácora.</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[.85fr_1.15fr]">
        <Card className="border-white/10 bg-[#12141a] text-white lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5 text-emerald-300" />Mi comida</CardTitle>
            <CardDescription>Cada alimento está expresado por cada 100 gramos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedFoods.length === 0 ? (
              <div className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-5 text-center text-sm text-slate-400">Añade alimentos desde el catálogo para preparar una comida.</div>
            ) : selectedFoods.map((food) => {
              const portionCalories = Math.round(food.caloriesPer100g * food.grams) / 100;
              return (
                <div key={food.id} className="rounded-2xl border border-white/[.07] bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><b className="block truncate text-sm">{food.name}</b><span className="text-xs text-emerald-300">{portionCalories.toLocaleString("es-MX")} kcal</span></div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeFood(food.id)} aria-label={`Quitar ${food.name}`}><MinusCircle className="h-4 w-4 text-red-300" /></Button>
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-xs text-slate-400"><Input type="number" inputMode="numeric" min={10} max={5000} step={10} value={food.grams} onChange={(event) => changeGrams(food.id, event.target.value)} className="h-9 border-white/10 bg-[#11151d] text-white" /><span className="shrink-0">gramos</span></label>
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="block space-y-4 border-t border-white/10 pt-5">
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Cantidad" value={`${totals.grams} g`} />
              <Metric label="Energía" value={`${totals.calories.toLocaleString("es-MX")} kcal`} />
            </div>
            {hasMacros ? <div className="grid grid-cols-3 gap-2"><Metric label="Proteína" value={`${totals.protein} g`} /><Metric label="Grasa" value={`${totals.fat} g`} /><Metric label="Carbs" value={`${totals.carbs} g`} /></div> : selectedFoods.length > 0 && <p className="text-xs leading-5 text-slate-500">El catálogo actual no incluye macronutrientes para estos alimentos; se guardarán en cero sin inventarlos.</p>}
            {selectedFoods.length > 0 && (
              <>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Tipo de comida<select value={mealType} onChange={(event) => setMealType(event.target.value as MealType)} className="mt-2 h-10 w-full rounded-md border border-white/10 bg-[#11151d] px-3 text-sm normal-case text-white"><option>Desayuno</option><option>Almuerzo</option><option>Cena</option><option>Snack</option></select></label>
                <Button className="w-full font-black" disabled={saving} onClick={() => void saveMeal()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "Guardando…" : "Guardar en mi bitácora"}</Button>
                <Button variant="ghost" className="w-full text-slate-400 hover:bg-white/5 hover:text-white" disabled={saving} onClick={() => setSelectedFoods([])}><XCircle className="mr-2 h-4 w-4" />Limpiar selección</Button>
              </>
            )}
          </CardFooter>
        </Card>

        <Card className="border-white/10 bg-[#12141a] text-white">
          <CardHeader><CardTitle>Catálogo</CardTitle><CardDescription>Las calorías mostradas corresponden a 100 gramos.</CardDescription></CardHeader>
          <CardContent>
            <div className="relative"><Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><Input placeholder="Buscar alimento…" className="border-white/10 bg-black/25 pl-10 text-white" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
              <Table>
                <TableHeader><TableRow><TableHead>Alimento</TableHead><TableHead className="text-right">kcal / 100 g</TableHead><TableHead className="w-20 text-center">Añadir</TableHead></TableRow></TableHeader>
                <TableBody>
                  {isLoading ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}><TableCell><Skeleton className="h-5 w-3/4" /></TableCell><TableCell><Skeleton className="ml-auto h-5 w-16" /></TableCell><TableCell><Skeleton className="mx-auto h-8 w-8 rounded-full" /></TableCell></TableRow>) : foods.length === 0 ? <TableRow><TableCell colSpan={3} className="h-28 text-center text-slate-400">El catálogo todavía no está disponible. Comunícate con la academia.</TableCell></TableRow> : filteredFoods.length === 0 ? <TableRow><TableCell colSpan={3} className="h-28 text-center text-slate-400">No encontramos alimentos con ese nombre.</TableCell></TableRow> : filteredFoods.map((food) => {
                    const selected = selectedFoods.find((item) => item.id === food.id);
                    return <TableRow key={food.id}><TableCell className="font-bold">{food.name}</TableCell><TableCell className="text-right tabular-nums">{food.caloriesPer100g}</TableCell><TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => addFood(food)} aria-label={`Añadir ${food.name}`}>{selected ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <PlusCircle className="h-5 w-5 text-amber-300" />}</Button></TableCell></TableRow>;
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-black/20 p-3"><span className="block text-[9px] font-black uppercase tracking-wider text-slate-500">{label}</span><b className="mt-1 block text-sm text-white">{value}</b></div>;
}

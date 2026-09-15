"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Flame, Loader2, PencilLine, PlusCircle, RefreshCw, Utensils, Dumbbell, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { apiErrorMessage, apiRequest } from '@/lib/api-client';

const mealLogSchema = z.object({
  mealType: z.enum(['Desayuno', 'Almuerzo', 'Cena', 'Snack'], { required_error: "Debes seleccionar un tipo de comida." }),
  totalCalories: z.coerce.number().min(0).max(10000),
  totalProtein: z.coerce.number().min(0).max(1000),
  totalFat: z.coerce.number().min(0).max(1000),
  totalCarbohydrates: z.coerce.number().min(0).max(1000),
  notes: z.string().max(500).optional(),
});
type MealLog = z.infer<typeof mealLogSchema> & { id: string; logDate: string, notes?: string };

const trainingSessionSchema = z.object({
  activityType: z.string().trim().min(2, "Debes especificar un tipo de actividad.").max(80),
  durationMinutes: z.coerce.number().int().min(1).max(1440),
  intensityLevel: z.enum(['Baja', 'Moderada', 'Alta'], { required_error: "Debes seleccionar una intensidad." }),
  estimatedCaloriesBurned: z.coerce.number().min(0).max(10000),
  notes: z.string().max(500).optional(),
});
type TrainingSession = z.infer<typeof trainingSessionSchema> & { id: string; logDate: string, notes?: string };

type HistoryItem = (MealLog & { type: 'meal' }) | (TrainingSession & { type: 'training' });
type LogResponse = { ok?: boolean; mensaje?: string; items?: HistoryItem[]; item?: HistoryItem };


export default function BitacoraPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<"comida" | "entrenamiento">("comida");
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const { user } = useUser();
  const { toast } = useToast();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [loadError, setLoadError] = useState("");

  const mealForm = useForm<z.infer<typeof mealLogSchema>>({
    resolver: zodResolver(mealLogSchema),
    defaultValues: {
      mealType: "Almuerzo",
      totalCalories: 0,
      totalProtein: 0,
      totalFat: 0,
      totalCarbohydrates: 0,
      notes: "",
    },
  });

  const trainingForm = useForm<z.infer<typeof trainingSessionSchema>>({
    resolver: zodResolver(trainingSessionSchema),
    defaultValues: {
      activityType: "",
      durationMinutes: 30,
      intensityLevel: "Moderada",
      estimatedCaloriesBurned: 0,
      notes: "",
    },
  });

  const load = useCallback(async (refresh = false) => {
    if (!user) return;
    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setLoadError("");
      const token = await user.getIdToken();
      const { response, data } = await apiRequest<LogResponse>("/api/bitacora", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo cargar tu bitácora."));
      }
      setItems(data.items);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "No se pudo cargar tu bitácora.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const combinedHistory = items;
  const summary = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;
    const today = new Date().toISOString().slice(0, 10);
    const week = items.filter((item) => new Date(item.logDate).getTime() >= weekAgo);
    const mealsToday = items.filter(
      (item): item is MealLog & { type: "meal" } =>
        item.type === "meal" && item.logDate.startsWith(today),
    );
    const trainingsWeek = week.filter((item): item is TrainingSession & { type: "training" } => item.type === "training");
    return {
      caloriesToday: mealsToday.reduce((total, item) => total + item.totalCalories, 0),
      trainingMinutes: trainingsWeek.reduce((total, item) => total + item.durationMinutes, 0),
      recordsWeek: week.length,
    };
  }, [items]);

  async function saveLog(payload: Record<string, unknown>) {
    if (!user || isSaving) return null;
    const target = editingItem;
    setIsSaving(true);
    try {
      const token = await user.getIdToken();
      const parameters = target
        ? `?${new URLSearchParams({ id: target.id, type: target.type })}`
        : "";
      const { response, data } = await apiRequest<LogResponse>(`/api/bitacora${parameters}`, {
        method: target ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok || !data.ok || !data.item) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo guardar el registro."));
      }
      setItems((current) =>
        target
          ? current.map((item) =>
              item.id === target.id && item.type === target.type
                ? (data.item as HistoryItem)
                : item,
            )
          : [data.item as HistoryItem, ...current],
      );
      setLoadError("");
      return data.item;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el registro.";
      toast({ variant: "destructive", title: "No se guardó", description: message });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  const onMealSubmit = async (values: z.infer<typeof mealLogSchema>) => {
    const wasEditing = editingItem !== null;
    const saved = await saveLog({ type: "meal", ...values, notes: values.notes || "" });
    if (!saved) return;
    toast({ title: wasEditing ? "Comida actualizada" : "Comida guardada", description: wasEditing ? "La corrección ya aparece en tu historial y rendimiento." : `Se añadió ${values.mealType.toLowerCase()} a tu bitácora.` });
    mealForm.reset();
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const onTrainingSubmit = async (values: z.infer<typeof trainingSessionSchema>) => {
    const wasEditing = editingItem !== null;
    const saved = await saveLog({ type: "training", ...values, notes: values.notes || "" });
    if (!saved) return;
    toast({ title: wasEditing ? "Entrenamiento actualizado" : "Entrenamiento guardado", description: wasEditing ? "La corrección ya aparece en tu historial y rendimiento." : `Se añadió tu sesión de ${values.activityType}.` });
    trainingForm.reset();
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  function openCreateDialog() {
    setEditingItem(null);
    setDialogTab("comida");
    mealForm.reset();
    trainingForm.reset();
    setIsDialogOpen(true);
  }

  function openEditDialog(item: HistoryItem) {
    setEditingItem(item);
    if (item.type === "meal") {
      setDialogTab("comida");
      mealForm.reset({
        mealType: item.mealType,
        totalCalories: item.totalCalories,
        totalProtein: item.totalProtein,
        totalFat: item.totalFat,
        totalCarbohydrates: item.totalCarbohydrates,
        notes: item.notes || "",
      });
    } else {
      setDialogTab("entrenamiento");
      trainingForm.reset({
        activityType: item.activityType,
        durationMinutes: item.durationMinutes,
        intensityLevel: item.intensityLevel,
        estimatedCaloriesBurned: item.estimatedCaloriesBurned,
        notes: item.notes || "",
      });
    }
    setIsDialogOpen(true);
  }

  function changeDialogOpen(open: boolean) {
    if (!open && isSaving) return;
    setIsDialogOpen(open);
    if (!open) setEditingItem(null);
  }

  const handleDelete = async (item: HistoryItem) => {
    if (!user || deletingId) return;
    if (!window.confirm("¿Eliminar este registro de tu bitácora?")) return;
    try {
      setDeletingId(item.id);
      const token = await user.getIdToken();
      const parameters = new URLSearchParams({ id: item.id, type: item.type });
      const { response, data } = await apiRequest<LogResponse>(`/api/bitacora?${parameters}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok || !data.ok) {
        throw new Error(apiErrorMessage(response.status, data.mensaje, "No se pudo eliminar el registro."));
      }
      setItems((current) => current.filter((entry) => !(entry.id === item.id && entry.type === item.type)));
      toast({ title: "Registro eliminado", description: "La bitácora ya está actualizada." });
    } catch (error) {
      toast({ variant: "destructive", title: "No se eliminó", description: error instanceof Error ? error.message : "Inténtalo nuevamente." });
    } finally {
      setDeletingId("");
    }
  };

  return (
    <>
      <div className="min-h-screen space-y-6 bg-slate-950 p-4 pb-28 text-white md:p-8 md:pb-10">
        <header className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_85%_0%,rgba(16,185,129,.14),transparent_38%),linear-gradient(135deg,#17191f,#0b101a)] p-6 md:p-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Seguimiento personal</p><h1 className="mt-2 text-3xl font-black tracking-tighter md:text-4xl">Bitácora de entrenamiento</h1><p className="mt-2 text-sm text-slate-400">Registra comidas y sesiones con confirmación real del servidor.</p></div>
            <Button variant="outline" disabled={isRefreshing} onClick={() => void load(true)} className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />Actualizar</Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Summary icon={Utensils} label="Calorías registradas hoy" value={`${summary.caloriesToday.toLocaleString("es-MX")} kcal`} tone="text-amber-300" />
          <Summary icon={Activity} label="Entrenamiento · 7 días" value={`${summary.trainingMinutes} min`} tone="text-cyan-300" />
          <Summary icon={Flame} label="Registros · 7 días" value={String(summary.recordsWeek)} tone="text-emerald-300" />
        </section>

        {loadError && <p role="alert" className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">{loadError}</p>}

        <Card className="border-white/10 bg-[#12141a] text-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Historial de Operaciones</CardTitle>
              <CardDescription>Tu registro diario de rendimiento.</CardDescription>
            </div>
            <Button onClick={openCreateDialog} disabled={isSaving}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Añadir Registro
            </Button>
          </CardHeader>
           <CardContent>
            {isLoading ? (
                <div className="space-y-4 p-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                </div>
            ) : combinedHistory.length === 0 ? (
                <div className="flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
                    <p className="text-muted-foreground">No hay registros en tu bitácora.<br/>Añade una comida o un entrenamiento para empezar.</p>
                </div>
            ) : (
                <div className="overflow-hidden rounded-2xl border border-white/10">
                    <div className="divide-y divide-white/10">
                        {combinedHistory.map((item) => (
                            <div key={item.id} className="p-4 flex items-start gap-4">
                                <div className="bg-secondary p-3 rounded-full mt-1">
                                    {item.type === 'meal' ? <Utensils className="h-5 w-5 text-primary" /> : <Dumbbell className="h-5 w-5 text-primary" />}
                                </div>
                                <div className="flex-1">
                                    {item.type === 'meal' && (
                                        <>
                                            <p className="font-bold">{item.mealType}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {item.totalCalories} kcal | Proteína: {item.totalProtein}g | Grasa: {item.totalFat}g | Carbs: {item.totalCarbohydrates}g
                                            </p>
                                            {item.notes && <p className="text-xs mt-1 italic text-muted-foreground">“{item.notes}”</p>}
                                        </>
                                    )}
                                    {item.type === 'training' && (
                                        <>
                                            <p className="font-bold">{item.activityType}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {item.durationMinutes} min | Intensidad: {item.intensityLevel} | {item.estimatedCaloriesBurned} kcal quemadas
                                            </p>
                                            {item.notes && <p className="text-xs mt-1 italic text-muted-foreground">“{item.notes}”</p>}
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="text-right text-xs text-muted-foreground">
                                        <span>{new Date(item.logDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        <br/>
                                        <span>{new Date(item.logDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" disabled={Boolean(deletingId)} onClick={() => openEditDialog(item as HistoryItem)} aria-label="Editar registro">
                                        <PencilLine className="h-4 w-4 text-cyan-300" />
                                    </Button>
                                    <Button variant="ghost" size="icon" disabled={Boolean(deletingId)} onClick={() => void handleDelete(item as HistoryItem)} aria-label="Eliminar registro">
                                        {deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin text-red-300" /> : <Trash2 className="h-4 w-4 text-red-300" />}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={changeDialogOpen}>
        <DialogContent className="sm:max-w-[425px] md:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Corregir registro" : "Añadir a la Bitácora"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Actualiza los datos sin cambiar el tipo ni la fecha original del registro." : "Registra una comida o un entrenamiento para mantener tu historial al día."}
            </DialogDescription>
          </DialogHeader>
          <Tabs value={dialogTab} onValueChange={(value) => setDialogTab(value as "comida" | "entrenamiento")} className="w-full">
            {!editingItem && <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="comida"><Utensils className="mr-2 h-4 w-4"/>Comida</TabsTrigger>
              <TabsTrigger value="entrenamiento"><Dumbbell className="mr-2 h-4 w-4"/>Entrenamiento</TabsTrigger>
            </TabsList>}
            <TabsContent value="comida">
              <Form {...mealForm}>
                <form onSubmit={mealForm.handleSubmit(onMealSubmit)} className="space-y-4 pt-4">
                  <FormField control={mealForm.control} name="mealType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Comida</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Selecciona un tipo" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Desayuno">Desayuno</SelectItem>
                          <SelectItem value="Almuerzo">Almuerzo</SelectItem>
                          <SelectItem value="Cena">Cena</SelectItem>
                          <SelectItem value="Snack">Snack</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={mealForm.control} name="totalCalories" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calorías Totales (kcal)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                     <FormField control={mealForm.control} name="totalProtein" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proteína (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={mealForm.control} name="totalFat" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grasas (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                      <FormField control={mealForm.control} name="totalCarbohydrates" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                   </div>
                  <FormField control={mealForm.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (Opcional)</FormLabel>
                      <FormControl><Textarea placeholder="Ej: Me sentí con mucha energía..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSaving ? "Guardando…" : editingItem ? "Guardar corrección" : "Guardar comida"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
            <TabsContent value="entrenamiento">
               <Form {...trainingForm}>
                <form onSubmit={trainingForm.handleSubmit(onTrainingSubmit)} className="space-y-4 pt-4">
                  <FormField control={trainingForm.control} name="activityType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Actividad</FormLabel>
                      <FormControl><Input placeholder="Ej: Jiu-Jitsu, Sparring, Pesas" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={trainingForm.control} name="durationMinutes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duración (min)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={trainingForm.control} name="intensityLevel" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Intensidad</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger><SelectValue placeholder="Selecciona intensidad" /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Baja">Baja</SelectItem>
                            <SelectItem value="Moderada">Moderada</SelectItem>
                            <SelectItem value="Alta">Alta</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={trainingForm.control} name="estimatedCaloriesBurned" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calorías Quemadas (kcal)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={trainingForm.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas (Opcional)</FormLabel>
                      <FormControl><Textarea placeholder="Ej: Foco en drills de guardia..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{isSaving ? "Guardando…" : editingItem ? "Guardar corrección" : "Guardar entrenamiento"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: string }) {
  return <article className="rounded-3xl border border-white/10 bg-[#12141a] p-5"><Icon className={`h-6 w-6 ${tone}`} /><span className="mt-4 block text-[10px] font-black uppercase tracking-wider text-slate-500">{label}</span><b className="mt-1 block text-2xl text-white">{value}</b></article>;
}

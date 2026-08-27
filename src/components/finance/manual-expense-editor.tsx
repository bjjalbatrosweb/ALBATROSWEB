"use client";

import { useRef, useState } from "react";
import { doc, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { format } from "date-fns";
import { Loader2, Pencil, Save } from "lucide-react";
import { useFirestore, useUser } from "@/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EXPENSE_CATEGORIES, canManageManualMovement, sameManualExpenseVersion, validateMovementDraft, type ManualFinanceRecord, type MovementDraft } from "@/lib/finance-manual-movements";

export function ManualExpenseEditor({ record, isAdmin, onClose, onSaved }: {
  record: ManualFinanceRecord;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (date: string) => void;
}) {
  const firestore = useFirestore();
  const { user } = useUser();
  const [draft, setDraft] = useState<MovementDraft>(() => ({
    amount: String(record.monto), category: record.categoria, concept: record.concepto,
    date: record.fecha?.toDate ? format(record.fecha.toDate(), "yyyy-MM-dd") : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const categories = EXPENSE_CATEGORIES.includes(record.categoria) ? EXPENSE_CATEGORIES : [record.categoria, ...EXPENSE_CATEGORIES];
  const change = (key: keyof MovementDraft, value: string) => { setDraft(previous => ({ ...previous, [key]: value })); setError(""); };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !user) return;
    pending.current = true; setSaving(true); setError("");
    try {
      if (record.tipo !== "egreso" || !canManageManualMovement(record, user.uid, isAdmin)) throw new Error("No tienes permiso para editar este egreso.");
      const values = validateMovementDraft(draft, "egreso", record.categoria);
      const reference = doc(firestore, "MovimientosFinancieros", record.id);
      await runTransaction(firestore, async transaction => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("Este egreso fue eliminado. Cierra el editor para actualizar la lista.");
        const current = { ...snapshot.data(), id: snapshot.id } as ManualFinanceRecord;
        if (!sameManualExpenseVersion(record, current)) throw new Error("Este egreso cambió mientras lo editabas. Cierra y vuelve a abrir Editar para no sobrescribir los cambios.");
        transaction.update(reference, {
          monto: values.monto, categoria: values.categoria, concepto: values.concepto,
          fecha: Timestamp.fromDate(values.date), actualizadoPor: user.uid,
          actualizadoEn: serverTimestamp(), revision: (current.revision || 0) + 1,
        });
      });
      onSaved(draft.date);
    } catch (cause) {
      const code = (cause as { code?: string })?.code;
      setError(code === "permission-denied"
        ? "No se autorizó la edición. Comprueba tus permisos y que las reglas nuevas de Firestore estén publicadas."
        : code === "unavailable" ? "No hay conexión. Reconéctate y vuelve a guardar; tus cambios siguen en el formulario."
        : cause instanceof Error ? cause.message : "No se pudo actualizar el egreso. Inténtalo de nuevo.");
    } finally { pending.current = false; setSaving(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !pending.current) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-2xl border-white/15 bg-[#15171d] text-white sm:max-w-lg" onEscapeKeyDown={event => { if (pending.current) event.preventDefault(); }} onPointerDownOutside={event => event.preventDefault()}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl font-black"><Pencil className="h-5 w-5 text-sky-300" />Editar egreso manual</DialogTitle>
        <DialogDescription className="text-slate-300">Corrige el movimiento existente. No se generará un duplicado ni se modificarán los pagos de alumnos.</DialogDescription>
      </DialogHeader>
      <form onSubmit={save} className="grid gap-4">
        <fieldset disabled={saving} className="grid min-w-0 gap-4 disabled:opacity-70">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2"><Label htmlFor="edit-expense-amount">Monto (MXN)</Label><Input id="edit-expense-amount" type="number" inputMode="decimal" min="0.01" max="10000000" step="0.01" value={draft.amount} onChange={event => change("amount", event.target.value)} required className="h-11 border-white/15 bg-black/30 text-white" /></div>
            <div className="grid gap-2"><Label htmlFor="edit-expense-date">Fecha</Label><Input id="edit-expense-date" type="date" value={draft.date} onChange={event => change("date", event.target.value)} required className="h-11 min-w-0 border-white/15 bg-black/30 text-white [color-scheme:dark]" /></div>
          </div>
          <div className="grid gap-2"><Label htmlFor="edit-expense-category">Categoría</Label><select id="edit-expense-category" value={draft.category} onChange={event => change("category", event.target.value)} className="h-11 w-full rounded-md border border-white/15 bg-[#090a0d] px-3 text-white">{categories.map(category => <option key={category}>{category}</option>)}</select></div>
          <div className="grid gap-2"><Label htmlFor="edit-expense-concept">Concepto</Label><Input id="edit-expense-concept" value={draft.concept} onChange={event => change("concept", event.target.value)} required minLength={2} maxLength={140} className="h-11 border-white/15 bg-black/30 text-white" /></div>
        </fieldset>
        {error && <p role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <p className="text-xs leading-relaxed text-slate-400">Los totales y las gráficas se recalcularán al guardar. Si cambias el mes de la fecha, se mostrará ese periodo.</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={onClose} className="min-h-11 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">Cancelar</Button>
          <Button type="submit" disabled={saving || !user} className="min-h-11 bg-sky-300 font-bold text-slate-950 hover:bg-sky-200">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{saving ? "Guardando…" : "Guardar cambios"}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

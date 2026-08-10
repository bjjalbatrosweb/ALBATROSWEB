"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Boxes,
  ClipboardCopy,
  PackagePlus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";

import { useAuth } from "@/firebase";
import {
  buildPurchaseList,
  consumableState,
  consumableStats,
  suggestedPurchase,
  type ConsumableItem,
} from "@/lib/consumables";

export default function ConsumablesPage() {
  const auth = useAuth();
  const [site, setSite] = useState("MMA");
  const [items, setItems] = useState<ConsumableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [category, setCategory] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<ConsumableItem | null>(null);
  const [movementType, setMovementType] = useState<"entry" | "consumption" | "adjustment">("entry");
  const [quantity, setQuantity] = useState(1);
  const [responsible, setResponsible] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [newItem, setNewItem] = useState({ name: "", category: "Limpieza", unit: "unidad", stock: 0, minimum: 5, target: 20, unitCost: 0, supplier: "", notes: "" });

  useEffect(() => {
    setSite(window.localStorage.getItem("userSede") || "MMA");
  }, []);

  const bearer = useCallback(async () => ({
    Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
  }), [auth]);

  const load = useCallback(async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/consumibles?sede=${encodeURIComponent(site)}`, { headers: await bearer(), cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.mensaje);
      setItems(data.items || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar.");
    } finally {
      setLoading(false);
    }
  }, [auth.currentUser, bearer, site]);

  useEffect(() => { void load(); }, [load]);

  const stats = useMemo(() => consumableStats(items), [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items]);
  const visible = useMemo(() => items.filter((item) => (filter === "all" || consumableState(item) !== "ok") && (category === "all" || item.category === category)), [category, filter, items]);

  async function send(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/consumibles", { method: "POST", headers: { "Content-Type": "application/json", ...(await bearer()) }, body: JSON.stringify({ ...body, sede: site }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.mensaje || "No se pudo guardar.");
    setItems((current) => {
      const exists = current.some((item) => item.id === data.item.id);
      return (exists ? current.map((item) => item.id === data.item.id ? data.item : item) : [...current, data.item]).sort((a, b) => a.name.localeCompare(b.name, "es"));
    });
    return data.item as ConsumableItem;
  }

  async function createItem() {
    try {
      const item = await send({ action: "create", ...newItem });
      setShowNew(false);
      setNewItem({ name: "", category: "Limpieza", unit: "unidad", stock: 0, minimum: 5, target: 20, unitCost: 0, supplier: "", notes: "" });
      setMessage(`${item.name} agregado al inventario.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
  }

  async function saveMovement() {
    if (!selected) return;
    try {
      const item = await send({ action: "movement", id: selected.id, type: movementType, quantity, responsible, notes: movementNotes });
      setSelected(null);
      setMovementNotes("");
      setQuantity(1);
      setMessage(`Movimiento registrado. Existencia de ${item.name}: ${item.stock} ${item.unit}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo guardar."); }
  }

  async function copyPurchaseList() {
    try { await navigator.clipboard.writeText(buildPurchaseList(items, site)); setMessage("Lista de reposición copiada."); }
    catch { setMessage("No se pudo copiar la lista."); }
  }

  return (
    <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6">
        <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#191b21] to-[#101915] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-300"><Boxes className="h-4 w-4" /> Operaciones · {site}</p><h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Inventario de consumibles</h1><p className="mt-2 text-sm font-medium text-white/60">Entradas, consumos, ajustes y alertas de reposición compartidas por sede.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} className="flex h-11 items-center gap-2 rounded-xl border border-white/20 px-4 font-black text-white hover:bg-white/10"><RefreshCw className="h-4 w-4" /> Actualizar</button><button type="button" onClick={copyPurchaseList} className="flex h-11 items-center gap-2 rounded-xl bg-emerald-400 px-4 font-black text-[#06110c]"><ClipboardCopy className="h-4 w-4" /> Lista de compra</button></div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Artículos", stats.total, "text-white"], ["Disponibles", stats.ok, "text-emerald-300"], ["Existencia baja", stats.low, "text-amber-200"], ["Agotados", stats.out, "text-red-300"], ["Valor estimado", `$${stats.value.toLocaleString("es-MX", { maximumFractionDigits: 2 })}`, "text-sky-300"],
          ].map(([label, value, style]) => <article key={String(label)} className="rounded-2xl border border-white/10 bg-[#17181d] p-4"><p className={`text-3xl font-black ${style}`}>{value}</p><p className="mt-1 text-xs font-black uppercase tracking-wide text-white/45">{label}</p></article>)}
        </section>

        <section className="flex flex-wrap gap-3 rounded-2xl border border-white/10 bg-[#15161b] p-4">
          <label className="grid min-w-44 flex-1 gap-1 text-xs font-black uppercase text-white/55">Vista<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-sm normal-case text-white"><option value="all">Todos</option><option value="attention">Requieren reposición</option></select></label>
          <label className="grid min-w-44 flex-1 gap-1 text-xs font-black uppercase text-white/55">Categoría<select value={category} onChange={(event) => setCategory(event.target.value)} className="h-11 rounded-xl border border-white/15 bg-[#08090c] px-3 text-sm normal-case text-white"><option value="all">Todas</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <button type="button" onClick={() => setShowNew((value) => !value)} className="mt-auto flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 font-black text-[#08090c] sm:flex-none"><Plus className="h-4 w-4" /> Nuevo artículo</button>
        </section>

        {showNew && <section className="grid gap-4 rounded-3xl border border-emerald-400/20 bg-[#131916] p-5 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Nombre"><input value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} placeholder="Ej. Desinfectante" className="field" /></Field>
          <Field label="Categoría"><input value={newItem.category} onChange={(event) => setNewItem({ ...newItem, category: event.target.value })} className="field" /></Field>
          <Field label="Unidad"><input value={newItem.unit} onChange={(event) => setNewItem({ ...newItem, unit: event.target.value })} placeholder="pieza, litro, rollo" className="field" /></Field>
          <Field label="Proveedor"><input value={newItem.supplier} onChange={(event) => setNewItem({ ...newItem, supplier: event.target.value })} className="field" /></Field>
          <NumberField label="Existencia inicial" value={newItem.stock} onChange={(value) => setNewItem({ ...newItem, stock: value })} />
          <NumberField label="Mínimo" value={newItem.minimum} onChange={(value) => setNewItem({ ...newItem, minimum: value })} />
          <NumberField label="Objetivo" value={newItem.target} onChange={(value) => setNewItem({ ...newItem, target: value })} />
          <NumberField label="Costo unitario" value={newItem.unitCost} onChange={(value) => setNewItem({ ...newItem, unitCost: value })} step="0.01" />
          <Field label="Notas" wide><textarea value={newItem.notes} onChange={(event) => setNewItem({ ...newItem, notes: event.target.value })} className="field min-h-20 py-3" /></Field>
          <button type="button" onClick={createItem} className="h-11 rounded-xl bg-emerald-400 font-black text-[#06110c] md:col-span-2 lg:col-span-4"><PackagePlus className="mr-2 inline h-4 w-4" /> Guardar artículo</button>
        </section>}

        {message && <p className="rounded-xl border border-sky-300/20 bg-sky-300/10 px-4 py-3 text-sm font-bold text-sky-100">{message}</p>}
        {loading ? <p className="rounded-2xl bg-[#15161b] p-8 text-center font-bold text-white/55">Cargando inventario…</p> : visible.length === 0 ? <p className="rounded-2xl bg-[#15161b] p-8 text-center font-bold text-white/55">No hay artículos en esta vista.</p> : (
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((item) => {
            const state = consumableState(item); const purchase = suggestedPurchase(item);
            return <article key={item.id} className={`rounded-2xl border p-5 ${state === "out" ? "border-red-400/35 bg-red-500/10" : state === "low" ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-[#17181d]"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-white/45">{item.category}</p><h2 className="text-xl font-black text-white">{item.name}</h2></div>{state !== "ok" && <AlertTriangle className={`h-6 w-6 ${state === "out" ? "text-red-300" : "text-amber-200"}`} />}</div>
              <p className="mt-4 text-5xl font-black text-white">{item.stock}<span className="ml-2 text-sm text-white/50">{item.unit}</span></p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><p className="rounded-lg bg-black/20 p-2 text-white/65">Mínimo <strong className="block text-white">{item.minimum}</strong></p><p className="rounded-lg bg-black/20 p-2 text-white/65">Objetivo <strong className="block text-white">{item.target}</strong></p></div>
              {purchase > 0 && <p className="mt-3 rounded-lg bg-white/[.06] px-3 py-2 text-sm font-bold text-white">Comprar {purchase} {item.unit}{purchase === 1 ? "" : "s"}</p>}
              {item.supplier && <p className="mt-2 text-sm text-white/55">Proveedor: {item.supplier}</p>}
              <div className="mt-4 grid grid-cols-3 gap-2">{([ ["entry", ArrowUp, "Entrada"], ["consumption", ArrowDown, "Consumo"], ["adjustment", SlidersHorizontal, "Ajuste"] ] as const).map(([type, Icon, label]) => <button key={type} type="button" onClick={() => { setSelected(item); setMovementType(type); setResponsible(""); setQuantity(type === "adjustment" ? item.stock : 1); }} className="flex min-h-11 flex-col items-center justify-center rounded-xl border border-white/15 bg-black/20 px-2 text-xs font-black text-white hover:bg-white/10"><Icon className="h-4 w-4" />{label}</button>)}</div>
              {item.history[0] && <p className="mt-3 text-xs text-white/40">Último: {item.history[0].responsible} · {new Date(item.history[0].at).toLocaleString("es-MX")}</p>}
            </article>;
          })}</section>
        )}

        {selected && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"><section className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#17181d] p-6 shadow-2xl"><h2 className="text-2xl font-black text-white">{movementType === "entry" ? "Registrar entrada" : movementType === "consumption" ? "Registrar consumo" : "Ajustar existencia"}</h2><p className="mt-1 text-white/55">{selected.name} · existencia actual: {selected.stock} {selected.unit}</p><div className="mt-5 grid gap-4"><NumberField label={movementType === "adjustment" ? "Nueva existencia" : "Cantidad"} value={quantity} onChange={setQuantity} /><Field label="Responsable"><input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Nombre de quien registra" className="field" /></Field><Field label="Motivo o notas"><textarea value={movementNotes} onChange={(event) => setMovementNotes(event.target.value)} className="field min-h-24 py-3" /></Field><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setSelected(null)} className="h-11 rounded-xl border border-white/20 font-black text-white">Cancelar</button><button type="button" onClick={saveMovement} className="h-11 rounded-xl bg-emerald-400 font-black text-[#06110c]">Guardar movimiento</button></div></div></section></div>}
      </div>
      <style jsx global>{`.field{height:2.75rem;width:100%;border-radius:.75rem;border:1px solid rgba(255,255,255,.15);background:#08090c;padding:0 .75rem;color:#fff;outline:none}.field::placeholder{color:rgba(255,255,255,.35)}.field:focus{border-color:#34d399}`}</style>
    </main>
  );
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <label className={`grid gap-2 text-sm font-bold text-white ${wide ? "md:col-span-2 lg:col-span-4" : ""}`}>{label}{children}</label>; }
function NumberField({ label, value, onChange, step = "1" }: { label: string; value: number; onChange: (value: number) => void; step?: string }) { return <Field label={label}><input type="number" min="0" step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="field" /></Field>; }

"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, Download, Filter, Loader2, Pencil, ReceiptText, Trash2, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { canManageManualMovement, type ManualFinanceRecord } from "@/lib/finance-manual-movements";
import { activeMovementFilters, combineFinanceMovements, type FinancePayment, EMPTY_MOVEMENT_FILTERS, filterManualMovements, manualMovementsCsv, movementExportFilename, movementFilterError, type MovementFilters } from "@/lib/finance-movement-list";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const control = "min-h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#090a0d] px-3 text-sm text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300";
const action = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-bold transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300 disabled:opacity-40";

export function ManualMovementsList({ records, payments, paymentsLoading, paymentsError, month, site, loading, error, userId, isAdmin, deletingId, onEdit, onDelete }: {
  records: ManualFinanceRecord[]; payments: FinancePayment[]; paymentsLoading: boolean; paymentsError?: string; month: string; site: string; loading: boolean; error?: string;
  userId?: string; isAdmin: boolean; deletingId: string | null;
  onEdit: (record: ManualFinanceRecord) => void; onDelete: (record: ManualFinanceRecord) => void;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [includePayments, setIncludePayments] = useState(false);
  const [filters, setFilters] = useState<MovementFilters>({ ...EMPTY_MOVEMENT_FILTERS });
  const [notice, setNotice] = useState("");
  const combined = useMemo(() => combineFinanceMovements(records, payments, site, includePayments), [records, payments, site, includePayments]);
  const categories = useMemo(() => [...new Set([...combined.map(record => record.categoria), filters.category].filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")), [combined, filters.category]);
  const rows = useMemo(() => filterManualMovements(combined, filters, month), [combined, filters, month]);
  const active = activeMovementFilters(filters);
  const invalid = movementFilterError(filters);
  const listError = error || (includePayments ? paymentsError : undefined);
  const busy = loading || (includePayments && paymentsLoading) || Boolean(listError);
  const totals = rows.reduce((sum, row) => ({ income: sum.income + (row.tipo === "ingreso" ? row.monto : 0), expenses: sum.expenses + (row.tipo === "egreso" ? row.monto : 0) }), { income: 0, expenses: 0 });
  function change<K extends keyof MovementFilters>(key: K, value: MovementFilters[K]) { setFilters(current => ({ ...current, [key]: value })); setNotice(""); }
  function clear() { setFilters({ ...EMPTY_MOVEMENT_FILTERS }); setNotice(""); }
  function download() {
    if (busy || invalid || !rows.length) return;
    let url: string | undefined;
    const link = document.createElement("a");
    try {
      url = URL.createObjectURL(new Blob([manualMovementsCsv(rows, site)], { type: "text/csv;charset=utf-8;" }));
      link.href = url; link.download = movementExportFilename(site, month, active > 0, includePayments); link.hidden = true;
      document.body.appendChild(link); link.click();
      setNotice(`Descarga preparada: ${rows.length} ${rows.length === 1 ? "movimiento" : "movimientos"} del periodo ${month}.`);
    } catch { setNotice("No se pudo preparar la descarga. Vuelve a intentarlo."); }
    finally { link.remove(); if (url) { const objectUrl = url; window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); } }
  }

  return <div className="min-w-0 rounded-3xl border border-white/10 bg-[#15171d] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-60"><h2 className="flex items-center gap-2 text-xl font-black"><ReceiptText className="h-5 w-5 shrink-0 text-sky-300" />{includePayments ? "Ingresos y egresos" : "Movimientos manuales"}</h2><p className="mt-2 text-xs leading-relaxed text-slate-300">Lista del periodo {month} · {site}. {includePayments ? "Incluye ingresos manuales, pagos de alumnos y egresos. Los pagos de alumnos son de solo lectura." : "Incluye ingresos y egresos manuales. Activa la opción de abajo para añadir los pagos de alumnos."}</p></div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <button type="button" className={`${action} flex-1 sm:flex-none ${expanded || active ? "border-sky-400/40 bg-sky-400/10 text-sky-200" : "text-white"}`} aria-expanded={expanded} aria-controls={`${id}-filters`} onClick={() => setExpanded(value => !value)}><Filter className="h-4 w-4" />Filtros{active > 0 && <span className="rounded-full bg-sky-300 px-1.5 text-xs text-slate-950">{active}</span>}<ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
        <button type="button" className={`${action} flex-1 border-emerald-400/30 bg-emerald-400/10 text-emerald-200 sm:flex-none`} disabled={busy || Boolean(invalid) || !rows.length} onClick={download} title="Descargar los movimientos filtrados en CSV, compatible con Excel"><Download className="h-4 w-4" />Descargar CSV</button>
      </div>
    </div>
    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-4">
      <Switch id={`${id}-payments`} checked={includePayments} onCheckedChange={value => { setIncludePayments(value); setNotice(""); }} className="mt-1 data-[state=checked]:bg-emerald-400 data-[state=unchecked]:bg-slate-600 [&>span]:bg-white" aria-describedby={`${id}-payments-help`} />
      <div><label htmlFor={`${id}-payments`} className="cursor-pointer text-sm font-bold text-emerald-200">Incluir ingresos de alumnos en la descarga</label><p id={`${id}-payments-help`} className="mt-1 text-xs leading-relaxed text-slate-300">Añade los pagos de alumnos a la lista y al CSV. El archivo contiene exactamente lo mostrado, respetando el mes y los filtros.</p></div>
    </div>
    {includePayments && filters.type === "egreso" && <p className="mt-3 text-xs text-amber-200">El filtro «Solo egresos» oculta los ingresos. <button type="button" onClick={() => change("type", "all")} className="min-h-11 font-bold underline underline-offset-4">Mostrar ingresos y egresos</button></p>}
    <div id={`${id}-filters`} hidden={!expanded} className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField label="Tipo" id={`${id}-type`}><select id={`${id}-type`} className={control} value={filters.type} onChange={event => change("type", event.target.value as MovementFilters["type"])}><option value="all">Ingresos y egresos</option><option value="ingreso">Solo ingresos</option><option value="egreso">Solo egresos</option></select></FilterField>
        <FilterField label="Categoría" id={`${id}-category`}><select id={`${id}-category`} className={control} value={filters.category} onChange={event => change("category", event.target.value)}><option value="">Todas las categorías</option>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></FilterField>
        <FilterField label="Buscar en concepto" id={`${id}-concept`}><input id={`${id}-concept`} className={control} type="search" value={filters.concept} onChange={event => change("concept", event.target.value)} placeholder="Ej. comida, recibo…" /></FilterField>
        <FilterField label="Ordenar por" id={`${id}-sort`}><select id={`${id}-sort`} className={control} value={filters.sort} onChange={event => change("sort", event.target.value as MovementFilters["sort"])}><option value="date-desc">Más recientes</option><option value="date-asc">Más antiguos</option><option value="amount-desc">Mayor monto</option><option value="amount-asc">Menor monto</option></select></FilterField>
        <FilterField label="Desde" id={`${id}-from`}><input id={`${id}-from`} className={control} type="date" value={filters.from} onChange={event => change("from", event.target.value)} /></FilterField>
        <FilterField label="Hasta" id={`${id}-to`}><input id={`${id}-to`} className={control} type="date" value={filters.to} onChange={event => change("to", event.target.value)} /></FilterField>
        <FilterField label="Monto mínimo (MXN)" id={`${id}-min`}><input id={`${id}-min`} className={control} type="number" inputMode="decimal" min="0" step="0.01" value={filters.minAmount} onChange={event => change("minAmount", event.target.value)} placeholder="Sin mínimo" /></FilterField>
        <FilterField label="Monto máximo (MXN)" id={`${id}-max`}><input id={`${id}-max`} className={control} type="number" inputMode="decimal" min="0" step="0.01" value={filters.maxAmount} onChange={event => change("maxAmount", event.target.value)} placeholder="Sin máximo" /></FilterField>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Los filtros se combinan dentro del mes seleccionado. Los indicadores generales de arriba no cambian.</p><button type="button" className={`${action} text-slate-200`} onClick={clear}><X className="h-4 w-4" />Limpiar filtros</button></div>
    </div>
    {invalid && <p role="alert" className="mt-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-200">{invalid}</p>}
    {!busy && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs"><p role="status" className="font-semibold text-slate-200">{rows.length} de {combined.length} movimientos{active > 0 ? " · filtros activos" : ""}</p><span className="text-emerald-300">Ingresos filtrados: {money.format(totals.income)}</span><span className="text-red-300">Egresos filtrados: {money.format(totals.expenses)}</span>{active > 0 && !expanded && <button type="button" onClick={clear} className="min-h-11 text-sky-200 underline underline-offset-4">Quitar filtros</button>}</div>}
    {notice && <p role="status" className="mt-3 text-sm text-emerald-200">{notice}</p>}
    <div className="mt-5 overflow-x-auto" role="region" aria-label="Lista de movimientos financieros" tabIndex={0}>
      <table className="w-full min-w-[700px] text-left text-sm"><thead className="text-[10px] font-black uppercase tracking-wider text-slate-300"><tr><th scope="col" className="pb-3">Fecha</th><th scope="col" className="pb-3">Tipo</th><th scope="col" className="pb-3">Concepto</th><th scope="col" className="pb-3">Categoría</th><th scope="col" className="pb-3 text-right">Monto</th><th scope="col" className="pb-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-white/10">
        {busy ? <tr><td colSpan={6} className="py-10 text-center text-slate-300">{listError || <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Cargando movimientos…</span>}</td></tr> : rows.map(item => <tr key={`${item.origen}-${item.id}`}>
          <td className="py-3 pr-3 text-slate-300">{item.fecha?.toDate?.().toLocaleDateString("es-MX")}</td><td className={`py-3 pr-3 text-xs font-bold ${item.tipo === "ingreso" ? "text-emerald-300" : "text-red-300"}`}>{item.tipo === "ingreso" ? "Ingreso" : "Egreso"}</td>
          <td className="max-w-72 break-words py-3 pr-3 font-bold">{item.concepto}{item.origen === "pago" && <span className="mt-1 block text-xs font-normal text-emerald-200">Pago de alumno</span>}{item.actualizadoEn && <span className="mt-1 block text-xs font-normal text-sky-200" title={item.actualizadoEn.toDate?.().toLocaleString("es-MX")}>Editado</span>}</td><td className="py-3 pr-3 text-slate-300">{item.categoria}</td><td className={`whitespace-nowrap py-3 text-right font-black ${item.tipo === "ingreso" ? "text-emerald-300" : "text-red-300"}`}>{item.tipo === "ingreso" ? "+" : "−"}{money.format(item.monto)}</td>
          <td className="py-3 pl-3">{item.origen === "pago" ? <span className="block text-right text-xs text-slate-400">Solo lectura</span> : <div className="flex items-center justify-end gap-2">{item.tipo === "egreso" && <button type="button" onClick={() => onEdit(item)} disabled={Boolean(deletingId) || !canManageManualMovement(item, userId, isAdmin)} aria-label={`Editar egreso ${item.concepto}`} className={`${action} border-sky-400/25 text-sky-200`}><Pencil className="h-4 w-4" />Editar</button>}<button type="button" onClick={() => onDelete(item)} disabled={Boolean(deletingId) || !canManageManualMovement(item, userId, isAdmin)} aria-label={`Eliminar ${item.concepto}`} className={`${action} w-11 shrink-0 border-red-400/25 text-red-200`}>{deletingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</button></div>}</td>
        </tr>)}
        {!busy && !rows.length && <tr><td colSpan={6} className="py-10 text-center text-slate-400">{combined.length ? "No hay movimientos que coincidan con los filtros." : "Sin movimientos en este periodo."}</td></tr>}
      </tbody></table>
    </div>
  </div>;
}

function FilterField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="grid min-w-0 gap-2"><label htmlFor={id} className="text-xs font-bold text-slate-300">{label}</label>{children}</div>;
}

import { Loader2 } from "lucide-react";

export default function AthleteAppLoading() {
  return <main className="grid min-h-[70vh] place-items-center bg-[#08090c] text-white" aria-busy="true" aria-live="polite"><div role="status" className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-300" aria-hidden="true"/><p className="mt-3 text-sm font-bold text-slate-400">Cargando tu información…</p></div></main>;
}

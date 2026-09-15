"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function AthleteAppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-[75vh] place-items-center bg-[#08090c] p-5 text-white"><section role="alert" className="w-full max-w-lg rounded-[2rem] border border-red-300/20 bg-red-500/10 p-6 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-red-300"/><h1 className="mt-4 text-2xl font-black">No pudimos abrir esta sección</h1><p className="mt-2 text-sm leading-6 text-red-100/75">Tus datos no se modificaron. Puedes intentar nuevamente o volver a tu centro.</p><div className="mt-6 grid gap-2 sm:grid-cols-2"><button type="button" onClick={reset} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-200 px-4 font-black text-red-950"><RefreshCw className="h-4 w-4"/>Reintentar</button><Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-black/20 px-4 font-black text-white"><Home className="h-4 w-4"/>Mi centro</Link></div></section></main>;
}


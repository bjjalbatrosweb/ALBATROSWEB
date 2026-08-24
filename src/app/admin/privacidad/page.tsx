"use client";

import { useEffect, useState } from "react";
import { Download, EyeOff, FileCheck2, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

type Preferences = {
  maskSensitiveOnSharedScreens: boolean;
  requireMeasurementConsent: boolean;
  remindReviewEverySixMonths: boolean;
};

const KEY = "albatrosPrivacyPreferences:v1";
const DEFAULTS: Preferences = {
  maskSensitiveOnSharedScreens: true,
  requireMeasurementConsent: true,
  remindReviewEverySixMonths: true,
};

export default function PrivacyPage() {
  const [preferences, setPreferences] = useState(DEFAULTS);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null") as Partial<Preferences> | null;
      if (saved) setPreferences({ ...DEFAULTS, ...saved });
    } catch { /* Se conservan valores protectores. */ }
  }, []);

  const update = (key: keyof Preferences) => {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    localStorage.setItem(KEY, JSON.stringify(next));
    setMessage("Preferencias guardadas en este dispositivo.");
  };

  const exportPreferences = () => {
    const payload = { sistema: "ALBATROS", tipo: "preferencias_privacidad", generadoEn: new Date().toISOString(), preferences };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url; link.download = "preferencias-privacidad-albatros.json"; link.click();
    URL.revokeObjectURL(url);
  };

  const clearVisualPreferences = () => {
    const prefixes = ["adminMenuOrder:", "adminHubView:", "albatros-neon-athlete-organizer"];
    Object.keys(localStorage).forEach((key) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) localStorage.removeItem(key);
    });
    setMessage("Se borraron preferencias visuales y tableros locales; la sesión y los datos de Firebase no se tocaron.");
  };

  return <main className="min-h-screen bg-[#07090d] p-4 text-white sm:p-7">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-[2rem] border border-emerald-300/15 bg-[radial-gradient(circle_at_top_right,rgba(52,211,153,.16),transparent_35%),#0d1217] p-6 sm:p-9">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-300"><ShieldCheck className="h-4 w-4"/>Gobierno de información</p>
        <h1 className="mt-3 text-3xl font-black sm:text-5xl">Privacidad y datos</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Controles para reducir exposición accidental de salud, emergencias, pagos y rendimiento. No elimina registros de Firebase sin un proceso administrativo confirmado.</p>
      </header>

      {message&&<div role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">{message}</div>}
      <section className="grid gap-4 lg:grid-cols-3">
        <PrivacySwitch icon={EyeOff} title="Pantallas compartidas" text="Ocultar información sensible cuando la vista se proyecte." checked={preferences.maskSensitiveOnSharedScreens} onClick={()=>update("maskSensitiveOnSharedScreens")}/>
        <PrivacySwitch icon={FileCheck2} title="Consentimiento de salud" text="Recordar verificar consentimiento antes de registrar nuevas mediciones." checked={preferences.requireMeasurementConsent} onClick={()=>update("requireMeasurementConsent")}/>
        <PrivacySwitch icon={RotateCcw} title="Revisión periódica" text="Recordar revisar permisos y retención cada seis meses." checked={preferences.remindReviewEverySixMonths} onClick={()=>update("remindReviewEverySixMonths")}/>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-black">Datos especialmente sensibles</h2><ul className="mt-3 space-y-2 text-sm text-slate-400"><li>• Emergencias y contactos.</li><li>• Composición corporal, ciclo menstrual y pruebas físicas.</li><li>• Pagos, RFID, biometría y accesos.</li><li>• Fotografías, evaluaciones y notas internas.</li></ul></article>
        <article className="rounded-3xl border border-white/10 bg-white/[.035] p-5"><h2 className="font-black">Proceso recomendado</h2><ol className="mt-3 space-y-2 text-sm text-slate-400"><li>1. Confirmar identidad y alcance de la solicitud.</li><li>2. Exportar respaldo verificable antes de corregir.</li><li>3. Registrar quién autorizó y realizó el cambio.</li><li>4. Eliminar solo con autorización administrativa.</li></ol></article>
      </section>

      <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-black/25 p-5 sm:flex-row sm:items-center sm:justify-between"><div><b>Herramientas locales</b><p className="mt-1 text-xs text-slate-500">Estas acciones no eliminan atletas, pagos ni asistencias.</p></div><div className="flex flex-wrap gap-2"><button onClick={exportPreferences} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-black"><Download className="h-4 w-4"/>Exportar preferencias</button><button onClick={clearVisualPreferences} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 text-sm font-black text-rose-100"><Trash2 className="h-4 w-4"/>Limpiar datos locales</button></div></section>
    </div>
  </main>;
}

function PrivacySwitch({icon:Icon,title,text,checked,onClick}:{icon:typeof ShieldCheck;title:string;text:string;checked:boolean;onClick:()=>void}) {
  return <button type="button" role="switch" aria-checked={checked} onClick={onClick} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 text-left transition hover:border-emerald-300/25 hover:bg-emerald-500/[.06]"><span className="flex items-center justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300"><Icon className="h-5 w-5"/></span><span className={`relative h-7 w-12 rounded-full transition ${checked?"bg-emerald-400":"bg-slate-700"}`}><i className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${checked?"left-6":"left-1"}`}/></span></span><b className="mt-4 block">{title}</b><span className="mt-1 block text-sm leading-5 text-slate-400">{text}</span></button>;
}

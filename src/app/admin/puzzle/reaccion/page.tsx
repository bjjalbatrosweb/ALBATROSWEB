"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, BrainCircuit, Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

const stimuli = [
  { n: 1, c: "ROJO", bg: "bg-red-500", action: "JAB" },
  { n: 2, c: "AZUL", bg: "bg-blue-500", action: "CROSS" },
  { n: 3, c: "VERDE", bg: "bg-emerald-500", action: "ESQUIVA" },
  { n: 4, c: "AMARILLO", bg: "bg-amber-300", action: "SPRAWL" },
] as const;
type Stimulus = (typeof stimuli)[number];

export default function ReactionPage() {
  const [duration, setDuration] = useState(60), [delay, setDelay] = useState(2), [sound, setSound] = useState(true), [running, setRunning] = useState(false), [paused, setPaused] = useState(false), [left, setLeft] = useState(60), [item, setItem] = useState<Stimulus | null>(null), [hits, setHits] = useState(0), [errors, setErrors] = useState(0), [times, setTimes] = useState<number[]>([]), [full, setFull] = useState(false);
  const shown = useRef(0), clock = useRef<ReturnType<typeof setInterval> | null>(null), next = useRef<ReturnType<typeof setTimeout> | null>(null), deadline = useRef(0), answerRef = useRef<(value: number) => void>(() => undefined);

  const clear = useCallback(() => {
    if (clock.current) clearInterval(clock.current);
    if (next.current) clearTimeout(next.current);
    clock.current = null;
    next.current = null;
  }, []);
  const tone = useCallback((ok = true) => {
    if (!sound) return;
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new AudioContextClass(), oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.frequency.value = ok ? 900 : 190;
      gain.gain.setValueAtTime(.1, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .09);
      oscillator.connect(gain); gain.connect(context.destination);
      oscillator.onended = () => void context.close();
      oscillator.start(); oscillator.stop(context.currentTime + .1);
    } catch { /* La prueba visual continúa si el navegador bloquea el audio. */ }
  }, [sound]);
  const show = useCallback(() => {
    const stimulus = stimuli[Math.floor(Math.random() * stimuli.length)];
    shown.current = performance.now();
    setItem(stimulus);
  }, []);
  const finish = useCallback(() => {
    clear(); setRunning(false); setPaused(false); setLeft(0); setItem(null);
  }, [clear]);
  const startClock = useCallback((seconds: number) => {
    if (clock.current) clearInterval(clock.current);
    deadline.current = Date.now() + seconds * 1000;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0) finish();
    };
    update();
    clock.current = setInterval(update, 250);
  }, [finish]);
  const start = useCallback(() => {
    clear(); setHits(0); setErrors(0); setTimes([]); setLeft(duration); setRunning(true); setPaused(false);
    show(); startClock(duration);
  }, [clear, duration, show, startClock]);
  const answer = useCallback((value: number) => {
    if (!running || paused || !item) return;
    if (value === item.n) {
      setHits((current) => current + 1);
      setTimes((current) => [...current, Math.round(performance.now() - shown.current)]);
      tone(true); setItem(null); next.current = setTimeout(show, delay * 1000);
    } else {
      setErrors((current) => current + 1); tone(false);
    }
  }, [delay, item, paused, running, show, tone]);
  useEffect(() => { answerRef.current = answer; }, [answer]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const value = Number(event.key);
      if (value >= 1 && value <= 4) answerRef.current(value);
    };
    window.addEventListener("keydown", key);
    return () => { clear(); window.removeEventListener("keydown", key); };
  }, [clear]);

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0, best = times.length ? Math.min(...times) : 0;
  function togglePause() {
    if (!running) return;
    if (paused) { setPaused(false); if (!item) show(); startClock(left); }
    else { clear(); setPaused(true); }
  }
  function reset() { clear(); setRunning(false); setPaused(false); setItem(null); setLeft(duration); }

  return <main className="min-h-screen bg-[#070a08] p-4 text-white sm:p-7"><div className="mx-auto max-w-7xl space-y-5"><Header back="Puzzle 05" title="Reacción por colores y números"/><section className="grid gap-4 lg:grid-cols-[320px_1fr]"><aside className="space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-5"><Field label="Duración"><Select disabled={running} value={duration} set={setDuration} values={[30,60,120]}/></Field><Field label="Espera entre estímulos"><Select disabled={running} value={delay} set={setDelay} values={[1,2,3]}/></Field><button disabled={running} onClick={()=>setSound(!sound)} className="ctl disabled:opacity-40">{sound?<Volume2/>:<VolumeX/>} Sonido {sound?"activo":"silenciado"}</button><button disabled={running} onClick={start} className="primary disabled:opacity-40"><Play/>Iniciar prueba</button><button onClick={reset} className="ctl"><RotateCcw/>Reiniciar</button></aside><section className={`relative flex min-h-[600px] flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-[#101410] p-5 text-center ${full?'fixed inset-0 z-50 rounded-none':''}`}>{full&&<button onClick={()=>setFull(false)} className="absolute right-5 top-5 z-10 ctl">Salir</button>}<button onClick={()=>setFull(true)} className="absolute left-5 top-5 ctl"><Maximize2/>Pantalla</button><b className="absolute right-6 top-6 font-mono text-3xl">{left}s</b>{item?<><div><div className={`mx-auto grid h-56 w-56 place-items-center rounded-[3rem] ${item.bg} text-[9rem] font-black text-white shadow-2xl sm:h-80 sm:w-80`}>{item.n}</div><h2 className="mt-7 text-5xl font-black sm:text-8xl">{item.c}</h2><p className="mt-3 text-2xl font-black text-white/60">{item.action}</p></div><div className="mt-7 grid w-full max-w-xl grid-cols-4 gap-3" aria-label="Respuestas">{stimuli.map((option)=><button key={option.n} disabled={paused} onClick={()=>answer(option.n)} className="min-h-16 rounded-2xl border border-white/15 bg-white/[.07] text-2xl font-black transition hover:bg-white/15 active:scale-95 disabled:opacity-40" aria-label={`Responder ${option.n}`}>{option.n}</button>)}</div></>:running?<p className="text-4xl font-black text-white/30">{paused?"PAUSA":"PREPÁRATE…"}</p>:<div><BrainCircuit className="mx-auto h-28 w-28 text-lime-300/30"/><h2 className="mt-4 text-5xl font-black">LISTO PARA REACCIONAR</h2><p className="mt-3 text-white/50">Pulsa una respuesta del 1 al 4 o usa el teclado.</p></div>}</section></section><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat l="Aciertos" v={hits}/><Stat l="Errores" v={errors}/><Stat l="Promedio" v={avg?`${avg} ms`:"—"}/><Stat l="Récord" v={best?`${best} ms`:"—"}/></div>{running&&<button onClick={togglePause} className="primary mx-auto">{paused?<Play/>:<Pause/>}{paused?"Continuar":"Pausar"}</button>}</div></main>;
}
function Header({back,title}:{back:string;title:string}){return <header className="rounded-[2rem] border border-lime-300/15 bg-gradient-to-br from-lime-500/15 to-transparent p-6"><Link href="/admin/puzzle" className="flex items-center gap-2 text-xs font-black text-lime-300"><ArrowLeft className="h-4 w-4"/>PUZZLE HUB</Link><p className="mt-5 text-xs font-black uppercase tracking-widest text-lime-300">{back}</p><h1 className="mt-2 text-4xl font-black sm:text-6xl">{title}</h1></header>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <div><p className="mb-2 text-xs font-black uppercase text-white/50">{label}</p>{children}</div>}
function Select({value,set,values,disabled}:{value:number;set:(n:number)=>void;values:number[];disabled?:boolean}){return <div className="grid grid-cols-3 gap-2">{values.map(v=><button key={v} disabled={disabled} onClick={()=>set(v)} className={`${value===v?"primary":"ctl"} disabled:opacity-40`}>{v}s</button>)}</div>}
function Stat({l,v}:{l:string;v:string|number}){return <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4 text-center"><p className="text-xs font-black uppercase text-white/40">{l}</p><b className="mt-1 block text-3xl">{v}</b></div>}

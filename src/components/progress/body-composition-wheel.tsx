"use client";

import { useEffect, useRef, useState } from "react";
import { Ruler, Scale } from "lucide-react";

type Sex = "masculino" | "femenino";

type Props = {
  sex: Sex;
  weight: number;
  height: number;
  onSexChange: (sex: Sex) => void;
  onWeightChange: (weight: number) => void;
  onHeightChange: (height: number) => void;
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export function BodyCompositionWheel({
  sex,
  weight,
  height,
  onSexChange,
  onWeightChange,
  onHeightChange,
}: Props) {
  const safeWeight = clamp(weight || 70, 35, 180);
  const safeHeight = clamp(height || 170, 130, 220);
  const bmi = safeWeight / Math.pow(safeHeight / 100, 2);
  const widthScale = clamp(0.82 + (bmi - 16) * 0.022, 0.82, 1.24);
  const heightScale = 0.82 + ((safeHeight - 130) / 90) * 0.25;
  const female = sex === "femenino";

  return (
    <section className="mb-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[radial-gradient(circle_at_50%_18%,rgba(251,191,36,.13),transparent_42%),linear-gradient(145deg,rgba(255,255,255,.065),rgba(255,255,255,.018))] p-4 shadow-[inset_0_1px_rgba(255,255,255,.08)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Perfil corporal</p>
          <h3 className="mt-1 text-xl font-black text-white">Configura la silueta</h3>
          <p className="mt-1 text-sm text-slate-400">Desliza peso y estatura para actualizarla.</p>
        </div>
        <div className="grid grid-cols-2 rounded-full border border-white/10 bg-black/30 p-1" role="group" aria-label="Sexo para la composición corporal">
          {(["masculino", "femenino"] as const).map(option => (
            <button
              key={option}
              type="button"
              onClick={() => onSexChange(option)}
              aria-pressed={sex === option}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${sex === option ? "bg-white text-slate-950 shadow-lg" : "text-slate-400 hover:text-white"}`}
            >
              {option === "masculino" ? "Hombre" : "Mujer"}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)_68px] items-end gap-3 sm:grid-cols-[minmax(0,1fr)_84px] sm:gap-4 md:grid-cols-[minmax(0,1fr)_96px] md:gap-5">
        <div className="relative min-h-[390px] overflow-hidden rounded-3xl border border-white/[.08] bg-black/25">
          <div className="pointer-events-none absolute inset-x-12 bottom-7 h-8 rounded-[50%] bg-amber-300/10 blur-xl" />
          <div className="absolute inset-0 flex items-end justify-center pb-8">
            <div
              className="h-[310px] w-[150px] origin-bottom transition-transform duration-500 ease-out"
              style={{ transform: `scale(${widthScale}, ${heightScale})` }}
            >
              <div
                className="h-full w-full bg-gradient-to-b from-white via-slate-300 to-slate-500 drop-shadow-[0_18px_25px_rgba(0,0,0,.55)]"
                style={{
                  WebkitMaskImage: "url('/cuerpo.png')",
                  maskImage: "url('/cuerpo.png')",
                  WebkitMaskRepeat: "no-repeat",
                  maskRepeat: "no-repeat",
                  WebkitMaskSize: "400% 100%",
                  maskSize: "400% 100%",
                  WebkitMaskPosition: `${female ? "66.66%" : "37.5%"} center`,
                  maskPosition: `${female ? "66.66%" : "37.5%"} center`,
                }}
                role="img"
                aria-label={`Silueta ${female ? "femenina" : "masculina"} adaptada a ${safeWeight} kilogramos y ${safeHeight} centímetros`}
              />
            </div>
          </div>
          <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 backdrop-blur-md">
            <span className="block text-[10px] font-black uppercase tracking-wider text-slate-500">IMC visual</span>
            <b className="text-lg text-white">{bmi.toFixed(1)}</b>
          </div>
          <div className="absolute inset-x-3 bottom-3">
            <HorizontalDial value={safeWeight} onChange={onWeightChange}/>
          </div>
        </div>

        <VerticalDial value={safeHeight} onChange={onHeightChange}/>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">La silueta es una representación visual orientativa basada en el IMC; no reproduce la composición corporal real ni sustituye una valoración profesional.</p>
    </section>
  );
}

function HorizontalDial({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  const {expanded,activate,deactivate}=useDialExpansion();
  const ticks=Array.from({length:21},(_,index)=>clamp(value+(index-10)*0.5,35,180));
  return <div className={`relative overflow-hidden rounded-2xl border bg-[#0b0c10]/90 px-3 pt-2 shadow-[0_12px_30px_rgba(0,0,0,.45)] backdrop-blur-xl transition-[padding,border-color,box-shadow] duration-300 ${expanded?'border-amber-300/30 pb-2 shadow-[0_14px_35px_rgba(0,0,0,.55),0_0_22px_rgba(251,191,36,.08)]':'border-white/10 pb-1'}`} onPointerDown={activate} onPointerEnter={activate} onPointerLeave={deactivate} onFocusCapture={activate} onBlurCapture={deactivate} onWheel={event=>{activate();onChange(clamp(value+(event.deltaY>0?0.5:-0.5),35,180))}}>
    <div className="flex items-center justify-between"><span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.15em] text-slate-500"><Scale className="h-3.5 w-3.5 text-amber-300"/>Peso</span><b className="font-mono text-lg tabular-nums text-white">{value.toFixed(1)} <small className="text-[10px] text-slate-500">kg</small></b></div>
    <div className={`relative overflow-hidden transition-[height,opacity,margin] duration-300 ease-out [mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent)] ${expanded?'mt-1 h-10 opacity-100':'mt-0 h-0 opacity-0'}`}>
      <div className="absolute inset-0 grid grid-cols-[repeat(21,minmax(0,1fr))] items-end">{ticks.map((tick,index)=>{const major=Math.round(tick*2)%10===0,center=index===10;return <span key={`${tick}-${index}`} className="flex h-full flex-col items-center justify-end"><small className={`mb-1 font-mono text-[8px] tabular-nums ${center?'text-amber-200':major?'text-slate-400':'text-transparent'}`}>{tick.toFixed(major?0:1)}</small><i className={`block w-px rounded-full ${center?'h-5 bg-amber-300':major?'h-4 bg-slate-400':'h-2.5 bg-slate-600'}`}/></span>})}</div>
      <i className="pointer-events-none absolute bottom-0 left-1/2 h-full w-px -translate-x-1/2 bg-amber-300/30 shadow-[0_0_12px_#fcd34d]"/>
      <input aria-label="Dial de peso en kilogramos" type="range" min="35" max="180" step="0.5" value={value} onInput={activate} onChange={event=>{activate();onChange(Number(event.target.value))}} className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"/>
    </div>
    {!expanded&&<span className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/70 to-transparent"/>}
  </div>
}

function VerticalDial({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  const {expanded,activate,deactivate}=useDialExpansion();
  const ticks=Array.from({length:15},(_,index)=>clamp(Math.round(value)+(7-index),130,220));
  return <div className={`relative flex w-full flex-col items-center overflow-hidden rounded-3xl border bg-[#0b0c10]/90 px-2 shadow-[inset_0_1px_rgba(255,255,255,.06)] backdrop-blur-xl transition-[height,padding,border-color,box-shadow] duration-300 ease-out ${expanded?'h-[390px] border-amber-300/30 py-4 shadow-[inset_0_1px_rgba(255,255,255,.06),0_0_22px_rgba(251,191,36,.08)]':'h-[108px] border-white/[.08] py-3'}`} onPointerDown={activate} onPointerEnter={activate} onPointerLeave={deactivate} onFocusCapture={activate} onBlurCapture={deactivate} onWheel={event=>{activate();onChange(clamp(value+(event.deltaY>0?-1:1),130,220))}}>
    <Ruler className="h-5 w-5 text-amber-300"/><span className="mt-1 text-[9px] font-black uppercase tracking-[.14em] text-slate-500">Altura</span>
    <b className="mt-2 font-mono text-base tabular-nums text-white">{value.toFixed(0)}<small className="ml-1 text-[9px] text-slate-500">cm</small></b>
    <div className={`relative min-h-0 w-full overflow-hidden transition-[flex-grow,opacity,margin] duration-300 [mask-image:linear-gradient(to_bottom,transparent,black_16%,black_84%,transparent)] ${expanded?'mt-3 flex-1 opacity-100':'mt-0 flex-none opacity-0'}`}>
      <div className="absolute inset-0 grid grid-rows-[repeat(15,minmax(0,1fr))]">{ticks.map((tick,index)=>{const major=tick%5===0,center=index===7;return <span key={`${tick}-${index}`} className="flex items-center justify-end gap-1"><small className={`font-mono text-[8px] tabular-nums ${center?'text-amber-200':major?'text-slate-400':'text-transparent'}`}>{tick}</small><i className={`block h-px rounded-full ${center?'w-7 bg-amber-300':major?'w-5 bg-slate-400':'w-3 bg-slate-600'}`}/></span>})}</div>
      <i className="pointer-events-none absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-amber-300/30 shadow-[0_0_12px_#fcd34d]"/>
      <input aria-label="Dial de estatura en centímetros" type="range" min="130" max="220" step="1" value={value} onInput={activate} onChange={event=>{activate();onChange(Number(event.target.value))}} className="absolute inset-0 h-full w-full cursor-ns-resize opacity-0" style={{writingMode:"vertical-lr",direction:"rtl"}}/>
    </div>
    {expanded?<span className="mt-2 text-[8px] font-bold text-slate-600">130 — 220</span>:<span className="mt-auto h-px w-8 bg-amber-300/70 shadow-[0_0_8px_#fcd34d]"/>}
  </div>
}

function useDialExpansion(){
  const [expanded,setExpanded]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const clear=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null}};
  const activate=()=>{clear();setExpanded(true);timer.current=setTimeout(()=>setExpanded(false),1800)};
  const deactivate=()=>{clear();timer.current=setTimeout(()=>setExpanded(false),650)};
  useEffect(()=>()=>clear(),[]);
  return {expanded,activate,deactivate};
}

"use client";

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

      <div className="mt-5 grid items-center gap-5 md:grid-cols-[1fr_72px]">
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
                  WebkitMaskPosition: `${female ? "66.66%" : "0%"} center`,
                  maskPosition: `${female ? "66.66%" : "0%"} center`,
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
          <div className="absolute inset-x-4 bottom-4">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-400"><span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5"/>Peso</span><strong className="text-base text-white">{safeWeight.toFixed(1)} kg</strong></div>
            <input aria-label="Peso en kilogramos" type="range" min="35" max="180" step="0.5" value={safeWeight} onChange={event => onWeightChange(Number(event.target.value))} className="h-2 w-full cursor-ew-resize accent-amber-300" />
            <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-600"><span>35 kg</span><span>180 kg</span></div>
          </div>
        </div>

        <div className="flex min-h-[390px] flex-col items-center rounded-3xl border border-white/[.08] bg-black/25 px-3 py-4">
          <Ruler className="h-5 w-5 text-amber-300"/>
          <strong className="mt-2 whitespace-nowrap text-sm text-white">{safeHeight.toFixed(0)} cm</strong>
          <span className="mt-2 text-[9px] font-black text-slate-600">220</span>
          <input
            aria-label="Estatura en centímetros"
            type="range"
            min="130"
            max="220"
            step="1"
            value={safeHeight}
            onChange={event => onHeightChange(Number(event.target.value))}
            className="my-3 min-h-0 flex-1 cursor-ns-resize accent-amber-300"
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
          />
          <span className="text-[9px] font-black text-slate-600">130</span>
          <span className="mt-2 text-[9px] font-black uppercase tracking-wider text-slate-500">Altura</span>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">La silueta es una representación visual orientativa basada en el IMC; no reproduce la composición corporal real ni sustituye una valoración profesional.</p>
    </section>
  );
}

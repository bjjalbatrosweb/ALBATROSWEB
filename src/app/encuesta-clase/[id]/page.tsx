"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MessageSquareHeart, Star } from "lucide-react";

import { SURVEY_QUESTIONS, type SurveyQuestionKey } from "@/lib/class-survey";

type PublicSurvey = { id: string; className: string; discipline: string; instructorName: string; site: string; expiresAt: string | null };

function deviceId() {
  const key = "albatros-class-survey-device"; let value = window.localStorage.getItem(key);
  if (!value) { value = window.crypto.randomUUID(); window.localStorage.setItem(key, value); }
  return value;
}

export default function PublicClassSurveyPage() {
  const { id } = useParams<{ id: string }>(); const search = useSearchParams();
  const [token] = useState(() => search.get("token") || "");
  const [survey, setSurvey] = useState<PublicSurvey | null>(null); const [message, setMessage] = useState("Cargando encuesta…"); const [sending, setSending] = useState(false); const [sent, setSent] = useState(false);
  const [ratings, setRatings] = useState<Record<SurveyQuestionKey, number>>({ classQuality: 0, instructor: 0, intensity: 0, facilities: 0 }); const [recommendation, setRecommendation] = useState<number | null>(null); const [comment, setComment] = useState("");

  useEffect(() => {
    if (!id || !token) { setMessage("El enlace de la encuesta está incompleto."); return; }
    void fetch(`/api/encuestas-clase/${id}?token=${encodeURIComponent(token)}`, { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.mensaje); setSurvey(data.survey); setMessage(""); window.history.replaceState({}, "", window.location.pathname); }).catch((error) => setMessage(error instanceof Error ? error.message : "No se pudo abrir la encuesta."));
  }, [id, token]);

  async function submit() {
    if (SURVEY_QUESTIONS.some(({ key }) => ratings[key] === 0) || recommendation === null) { setMessage("Califica todas las preguntas antes de enviar."); return; }
    setSending(true); setMessage("");
    try {
      const response = await fetch(`/api/encuestas-clase/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, deviceId: deviceId(), ...ratings, recommendation, comment }) }); const data = await response.json(); if (!response.ok) throw new Error(data.mensaje); setSent(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudo enviar."); }
    finally { setSending(false); }
  }

  if (sent) return <main className="grid min-h-screen place-items-center bg-[#08090c] p-6 text-white"><div className="max-w-lg rounded-3xl border border-emerald-400/25 bg-[#121a17] p-8 text-center"><CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" /><h1 className="mt-4 text-3xl font-black text-white">¡Gracias por responder!</h1><p className="mt-2 text-white/60">Tu opinión quedó registrada de forma anónima.</p></div></main>;
  if (!survey) return <main className="grid min-h-screen place-items-center bg-[#08090c] p-6 text-white"><div className="max-w-md rounded-3xl border border-white/10 bg-[#15161b] p-8 text-center">{message === "Cargando encuesta…" && <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-emerald-400" />}<p className="font-black text-white">{message}</p></div></main>;

  return <main className="min-h-screen bg-[#08090c] px-4 py-6 text-white"><div className="mx-auto grid max-w-2xl gap-5">
    <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1c22] to-[#0d1814] p-6"><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-emerald-300"><MessageSquareHeart className="h-4 w-4" /> Opinión de clase</p><h1 className="mt-2 text-3xl font-black text-white">{survey.className}</h1><p className="mt-2 text-white/60">{survey.discipline}{survey.instructorName ? ` · ${survey.instructorName}` : ""} · {survey.site}</p><p className="mt-3 text-sm font-medium text-white/70">No solicitamos tu nombre. Responde con confianza.</p></header>
    {SURVEY_QUESTIONS.map(({ key, label }) => <section key={key} className="rounded-2xl border border-white/10 bg-[#17181d] p-5"><h2 className="font-black text-white">{label}</h2><div className="mt-3 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setRatings((current) => ({ ...current, [key]: value }))} aria-label={`${label}: ${value}`} className={`grid min-h-14 place-items-center rounded-xl border font-black ${ratings[key] === value ? "border-emerald-300 bg-emerald-400 text-[#06110c]" : "border-white/15 bg-[#08090c] text-white hover:border-emerald-300/50"}`}><Star className={`h-5 w-5 ${ratings[key] === value ? "fill-current" : ""}`} /><span className="text-xs">{value}</span></button>)}</div><div className="mt-2 flex justify-between text-xs font-bold text-white/70"><span>Muy bajo</span><span>Excelente</span></div></section>)}
    <section className="rounded-2xl border border-white/10 bg-[#17181d] p-5"><h2 className="font-black text-white">¿Qué tanto recomendarías esta clase?</h2><div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-11">{Array.from({ length: 11 }, (_, value) => <button key={value} type="button" onClick={() => setRecommendation(value)} className={`h-11 rounded-lg border font-black ${recommendation === value ? "border-sky-300 bg-sky-300 text-[#061017]" : "border-white/15 bg-[#08090c] text-white"}`}>{value}</button>)}</div><div className="mt-2 flex justify-between text-xs font-bold text-white/70"><span>Nada probable</span><span>Definitivamente</span></div></section>
    <label className="grid gap-2 rounded-2xl border border-white/10 bg-[#17181d] p-5 font-black text-white">Comentario opcional<textarea value={comment} onChange={(event) => setComment(event.target.value.slice(0, 500))} placeholder="¿Qué te gustó o qué podríamos mejorar?" className="min-h-32 rounded-xl border border-white/15 bg-[#08090c] p-3 font-medium text-white placeholder:text-white/70 outline-none focus:border-emerald-400" /><span className="text-right text-xs text-white/70">{comment.length}/500</span></label>
    {message && <p className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-100">{message}</p>}
    <button type="button" disabled={sending} onClick={submit} className="h-14 rounded-xl bg-emerald-400 text-lg font-black text-[#06110c] disabled:opacity-60">{sending ? "Enviando…" : "Enviar opinión"}</button>
  </div></main>;
}

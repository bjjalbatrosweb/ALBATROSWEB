"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  BookmarkPlus,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  FlipHorizontal,
  Gauge,
  Library,
  Loader2,
  Maximize2,
  Pencil,
  Play,
  Radio,
  Save,
  ShieldCheck,
  Square,
  Trash2,
  UserRound,
  Video,
  X,
  ZoomIn,
} from "lucide-react";
import { collection, getDocs, query, where } from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  deleteReplayClip,
  formatReplayTime,
  listReplayClips,
  recorderMimeType,
  replayFileExtension,
  saveReplayClip,
  type ReplayClip,
  type ReplayPoint,
  type ReplayStroke,
} from "@/lib/technical-replay";

type View = "captura" | "analisis" | "videoteca";
type RecordingMode = "manual" | "auto";
type AthleteOption = { id: string; nombre: string };

const drawingColors: ReplayStroke["color"][] = ["#facc15", "#ef4444", "#22d3ee", "#ffffff"];

export default function TechnicalReplayPage() {
  const firestore = useFirestore();
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const autoVideoRef = useRef<HTMLVideoElement | null>(null);
  const analysisVideoRef = useRef<HTMLVideoElement | null>(null);
  const compareVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedRef = useRef(0);
  const segmentTimerRef = useRef<number | null>(null);
  const autoActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const clipUrlsRef = useRef<Record<string, string>>({});
  const lastAutoUrlRef = useRef("");

  const [site, setSite] = useState("MMA");
  const [view, setView] = useState<View>("captura");
  const [athletes, setAthletes] = useState<AthleteOption[]>([]);
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [clipTitle, setClipTitle] = useState("");
  const [clips, setClips] = useState<ReplayClip[]>([]);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const [activeClipId, setActiveClipId] = useState("");
  const [compareClipId, setCompareClipId] = useState("");
  const [loading, setLoading] = useState(true);
  const [cameraOn, setCameraOn] = useState(false);
  const [recordingMode, setRecordingMode] = useState<RecordingMode | null>(null);
  const [segmentSeconds, setSegmentSeconds] = useState(8);
  const [lastAutoBlob, setLastAutoBlob] = useState<Blob | null>(null);
  const [lastAutoUrl, setLastAutoUrl] = useState("");
  const [lastAutoDuration, setLastAutoDuration] = useState(0);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [mirrored, setMirrored] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [drawingColor, setDrawingColor] = useState<ReplayStroke["color"]>("#facc15");
  const [draftStroke, setDraftStroke] = useState<ReplayStroke | null>(null);
  const [markerNote, setMarkerNote] = useState("");
  const [fullscreenAnalysis, setFullscreenAnalysis] = useState(false);

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const stored = await listReplayClips();
        if (cancelled) return;
        const urls: Record<string, string> = {};
        stored.forEach((clip) => {
          urls[clip.id] = URL.createObjectURL(clip.blob);
        });
        clipUrlsRef.current = urls;
        setClipUrls(urls);
        setClips(stored);
        setActiveClipId(stored[0]?.id || "");
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No se abrió la videoteca local.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!firestore || !site) return;
    let cancelled = false;
    const loadAthletes = async () => {
      try {
        const snapshot = await getDocs(
          query(collection(firestore, "Alumnos"), where("sede", "==", site)),
        );
        if (cancelled) return;
        setAthletes(
          snapshot.docs
            .filter((record) => record.data().activo !== false)
            .map((record) => ({ id: record.id, nombre: String(record.data().nombre || "Atleta") }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
        );
      } catch {
        // Replay sigue disponible sin asociarlo a una ficha.
      }
    };
    void loadAthletes();
    return () => {
      cancelled = true;
    };
  }, [firestore, site]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      autoActiveRef.current = false;
      if (segmentTimerRef.current !== null) window.clearTimeout(segmentTimerRef.current);
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(clipUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      if (lastAutoUrlRef.current) URL.revokeObjectURL(lastAutoUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (view === "captura") {
      if (streamRef.current && liveVideoRef.current) {
        liveVideoRef.current.srcObject = streamRef.current;
        void liveVideoRef.current.play().catch(() => undefined);
      }
      return;
    }

    autoActiveRef.current = false;
    if (segmentTimerRef.current !== null) window.clearTimeout(segmentTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    const timer = window.setTimeout(() => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setCameraOn(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [view]);

  const activeClip = clips.find((clip) => clip.id === activeClipId) || null;
  const compareClip = clips.find((clip) => clip.id === compareClipId) || null;
  const selectedAthlete = athletes.find((athlete) => athlete.id === selectedAthleteId) || null;
  const storageBytes = clips.reduce((total, clip) => total + clip.size, 0);

  const ensureCamera = async () => {
    if (streamRef.current?.active) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Este navegador no permite usar la cámara.");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
      audio: false,
    });
    streamRef.current = stream;
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = stream;
      await liveVideoRef.current.play();
    }
    setCameraOn(true);
    return stream;
  };

  const stopCamera = () => {
    if (recordingMode) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (liveVideoRef.current) liveVideoRef.current.srcObject = null;
    setCameraOn(false);
  };

  const registerClipUrl = (clip: ReplayClip) => {
    const url = URL.createObjectURL(clip.blob);
    clipUrlsRef.current = { ...clipUrlsRef.current, [clip.id]: url };
    setClipUrls(clipUrlsRef.current);
  };

  const persistBlob = async (blob: Blob, durationSeconds: number, openAnalysis: boolean) => {
    const createdAt = new Date().toISOString();
    const clip: ReplayClip = {
      id: `replay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: clipTitle.trim() || `${selectedAthlete?.nombre || "Replay técnico"} · ${new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}`,
      athleteId: selectedAthlete?.id || "",
      athleteName: selectedAthlete?.nombre || "Sin atleta asignado",
      createdAt,
      durationSeconds: Math.max(0.1, durationSeconds),
      mimeType: blob.type || "video/webm",
      size: blob.size,
      blob,
      markers: [],
      strokes: [],
    };
    await saveReplayClip(clip);
    if (!mountedRef.current) return;
    registerClipUrl(clip);
    setClips((current) => [clip, ...current]);
    setActiveClipId(clip.id);
    setFeedback("Clip guardado en este dispositivo");
    window.setTimeout(() => setFeedback(""), 1800);
    if (openAnalysis) setView("analisis");
  };

  const beginRecorder = async (mode: RecordingMode) => {
    try {
      setError("");
      const stream = await ensureCamera();
      if (recorderRef.current?.state === "recording") return;
      if (typeof MediaRecorder === "undefined") {
        throw new Error("Este navegador permite la cámara, pero no puede grabar clips de video.");
      }
      const mimeType = recorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recordingStartedRef.current = Date.now();
      recorderRef.current = recorder;
      setRecordingMode(mode);
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = Math.max(0.1, (Date.now() - recordingStartedRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "video/webm" });
        recorderRef.current = null;
        if (segmentTimerRef.current !== null) {
          window.clearTimeout(segmentTimerRef.current);
          segmentTimerRef.current = null;
        }
        if (!mountedRef.current || !blob.size) return;
        if (mode === "auto") {
          if (lastAutoUrlRef.current) URL.revokeObjectURL(lastAutoUrlRef.current);
          const url = URL.createObjectURL(blob);
          lastAutoUrlRef.current = url;
          setLastAutoBlob(blob);
          setLastAutoUrl(url);
          setLastAutoDuration(duration);
          window.setTimeout(() => void autoVideoRef.current?.play().catch(() => undefined), 80);
          if (autoActiveRef.current) {
            window.setTimeout(() => void beginRecorder("auto"), 180);
          } else {
            setRecordingMode(null);
          }
        } else {
          setRecordingMode(null);
          void persistBlob(blob, duration, true).catch((saveError) => {
            setError(saveError instanceof Error ? saveError.message : "No se guardó el clip.");
          });
        }
      };
      recorder.start(250);
      if (mode === "auto") {
        segmentTimerRef.current = window.setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, segmentSeconds * 1000);
      }
    } catch (cameraError) {
      autoActiveRef.current = false;
      setRecordingMode(null);
      setError(
        cameraError instanceof Error
          ? cameraError.message
          : "No se pudo iniciar la cámara. Revisa el permiso del navegador.",
      );
    }
  };

  const startAutoReplay = () => {
    autoActiveRef.current = true;
    void beginRecorder("auto");
  };

  const stopAutoReplay = () => {
    autoActiveRef.current = false;
    if (segmentTimerRef.current !== null) window.clearTimeout(segmentTimerRef.current);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const toggleManualRecording = () => {
    if (recordingMode === "manual") {
      recorderRef.current?.stop();
    } else if (!recordingMode) {
      void beginRecorder("manual");
    }
  };

  const saveLastAutoReplay = async () => {
    if (!lastAutoBlob) return;
    try {
      await persistBlob(lastAutoBlob, lastAutoDuration, false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se guardó el replay.");
    }
  };

  const updateClip = async (updated: ReplayClip) => {
    try {
      await saveReplayClip(updated);
      setClips((current) => current.map((clip) => (clip.id === updated.id ? updated : clip)));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se guardó el análisis.");
    }
  };

  const stepFrame = (direction: -1 | 1) => {
    const video = analysisVideoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + direction / 30));
  };

  const setRate = (rate: number) => {
    setPlaybackRate(rate);
    if (analysisVideoRef.current) analysisVideoRef.current.playbackRate = rate;
    if (compareVideoRef.current) compareVideoRef.current.playbackRate = rate;
  };

  const addMarker = () => {
    if (!activeClip || !analysisVideoRef.current) return;
    const marker = {
      id: `marker-${Date.now()}`,
      at: analysisVideoRef.current.currentTime,
      note: markerNote.trim() || "Punto técnico",
    };
    setMarkerNote("");
    void updateClip({
      ...activeClip,
      markers: [...activeClip.markers, marker].sort((a, b) => a.at - b.at),
    });
  };

  const pointerPoint = (event: ReactPointerEvent<SVGSVGElement>): ReplayPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * 1000,
      y: ((event.clientY - bounds.top) / bounds.height) * 562.5,
    };
  };

  const startStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drawing || !activeClip) return;
    analysisVideoRef.current?.pause();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraftStroke({
      id: `stroke-${Date.now()}`,
      color: drawingColor,
      points: [pointerPoint(event)],
    });
  };

  const extendStroke = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!draftStroke || !drawing) return;
    const point = pointerPoint(event);
    setDraftStroke((current) =>
      current ? { ...current, points: [...current.points, point] } : current,
    );
  };

  const finishStroke = () => {
    if (!activeClip || !draftStroke) return;
    const stroke = draftStroke;
    setDraftStroke(null);
    if (stroke.points.length < 2) return;
    void updateClip({ ...activeClip, strokes: [...activeClip.strokes, stroke] });
  };

  const clearDrawings = () => {
    if (!activeClip?.strokes.length || !window.confirm("¿Borrar todas las anotaciones dibujadas?")) return;
    setDraftStroke(null);
    void updateClip({ ...activeClip, strokes: [] });
  };

  const syncComparison = async () => {
    const first = analysisVideoRef.current;
    const second = compareVideoRef.current;
    if (!first || !second) return;
    first.currentTime = 0;
    second.currentTime = 0;
    first.playbackRate = playbackRate;
    second.playbackRate = playbackRate;
    await Promise.allSettled([first.play(), second.play()]);
  };

  const removeClip = async (clip: ReplayClip) => {
    if (!window.confirm(`¿Eliminar “${clip.title}” de este dispositivo?`)) return;
    try {
      await deleteReplayClip(clip.id);
      const url = clipUrlsRef.current[clip.id];
      if (url) URL.revokeObjectURL(url);
      const nextUrls = { ...clipUrlsRef.current };
      delete nextUrls[clip.id];
      clipUrlsRef.current = nextUrls;
      setClipUrls(nextUrls);
      setClips((current) => current.filter((item) => item.id !== clip.id));
      if (activeClipId === clip.id) setActiveClipId(clips.find((item) => item.id !== clip.id)?.id || "");
      if (compareClipId === clip.id) setCompareClipId("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se eliminó el clip.");
    }
  };

  const downloadClip = (clip: ReplayClip) => {
    const link = document.createElement("a");
    link.href = clipUrls[clip.id];
    link.download = `${clip.title.replace(/[^a-z0-9áéíóúüñ _-]/gi, "").trim() || "replay"}.${replayFileExtension(clip.mimeType)}`;
    link.click();
  };

  const openAnalysis = (clipId: string) => {
    setActiveClipId(clipId);
    setCompareClipId("");
    setView("analisis");
    setDrawing(false);
    setZoom(1);
  };

  const tabs: Array<{ id: View; label: string; icon: typeof Video }> = [
    { id: "captura", label: "Captura", icon: Camera },
    { id: "analisis", label: "Análisis", icon: Gauge },
    { id: "videoteca", label: `Videoteca (${clips.length})`, icon: Library },
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 text-white md:p-8">
      <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#161008] via-[#0d0f10] to-[#050607] p-5 shadow-2xl md:p-7">
        <div className="flex items-center gap-2 text-orange-300"><Video className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[.24em]">Análisis privado y local</span></div>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Replay técnico</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">Graba, revisa a cámara lenta, compara ejecuciones y dibuja correcciones sin subir videos a la nube.</p>
      </header>

      <div className="flex items-start gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-500/[.07] p-4 text-cyan-50"><ShieldCheck className="h-5 w-5 shrink-0 text-cyan-300" /><div><p className="text-xs font-black uppercase">Privacidad del entrenamiento</p><p className="mt-1 text-xs text-cyan-100/60">La grabación no incluye audio. Los clips permanecen en este navegador hasta que los descargues o elimines.</p></div></div>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/40 p-4 text-red-100"><X className="h-5 w-5 shrink-0 text-red-300" /><p className="flex-1 text-sm font-bold">{error}</p><button type="button" onClick={() => setError("")}><X /></button></div>}

      <nav className="grid grid-cols-3 gap-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setView(id)} className={`min-h-14 rounded-2xl border px-2 text-xs font-black text-white transition sm:text-sm ${view === id ? "border-orange-300/45 bg-orange-500/15" : "border-white/10 bg-[#090b0d] hover:bg-white/[.06]"}`}><Icon className="mx-auto mb-1 h-4 w-4" />{label}</button>)}</nav>

      {view === "captura" && (
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="rounded-[28px] border border-white/10 bg-[#050607] p-3 shadow-2xl md:p-5">
            <div className="relative aspect-video overflow-hidden rounded-[22px] border border-white/10 bg-black">
              <video ref={liveVideoRef} muted playsInline autoPlay className={`h-full w-full object-contain ${mirrored ? "-scale-x-100" : ""}`} />
              {!cameraOn && <div className="absolute inset-0 grid place-items-center text-center"><div><Camera className="mx-auto mb-3 h-12 w-12 text-white/20" /><p className="font-black uppercase text-white/55">Cámara apagada</p><p className="mt-1 text-xs text-white/30">Actívala cuando el área esté lista.</p></div></div>}
              {recordingMode && <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-xs font-black uppercase text-white shadow-xl"><span className="h-2 w-2 animate-pulse rounded-full bg-white" />{recordingMode === "auto" ? `Replay ${segmentSeconds}s` : "Grabando"}</span>}
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <button type="button" disabled={Boolean(recordingMode)} onClick={() => cameraOn ? stopCamera() : void ensureCamera().catch((cameraError) => setError(cameraError instanceof Error ? cameraError.message : "No se abrió la cámara."))} className="capture-button">{cameraOn ? <Square /> : <Camera />}{cameraOn ? "Apagar cámara" : "Activar cámara"}</button>
              <button type="button" disabled={recordingMode === "auto"} onClick={toggleManualRecording} className={`capture-button ${recordingMode === "manual" ? "border-red-300/40 bg-red-500/20" : "border-orange-300/25 bg-orange-500/10"}`}>{recordingMode === "manual" ? <Square /> : <Radio />}{recordingMode === "manual" ? "Detener y guardar" : "Grabar clip manual"}</button>
            </div>
          </div>

          <aside className="space-y-4 rounded-[26px] border border-white/10 bg-[#090b0d] p-5">
            <div><p className="text-[10px] font-black uppercase tracking-wider text-orange-300">Datos del clip</p><h2 className="font-black uppercase">Captura técnica</h2></div>
            <Field label="Atleta opcional"><select value={selectedAthleteId} onChange={(event) => setSelectedAthleteId(event.target.value)} className="replay-input"><option value="">Sin atleta asignado</option>{athletes.map((athlete) => <option key={athlete.id} value={athlete.id}>{athlete.nombre}</option>)}</select></Field>
            <Field label="Título opcional"><input value={clipTitle} onChange={(event) => setClipTitle(event.target.value)} placeholder="Ej. Pase de guardia · intento 2" className="replay-input" /></Field>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-black uppercase">Replay automático</p><p className="text-[10px] text-white/40">Repite el último segmento</p></div><select value={segmentSeconds} disabled={recordingMode === "auto"} onChange={(event) => setSegmentSeconds(Number(event.target.value))} className="replay-input w-24">{[4, 6, 8, 10, 15].map((value) => <option key={value} value={value}>{value} s</option>)}</select></div><button type="button" disabled={recordingMode === "manual"} onClick={recordingMode === "auto" ? stopAutoReplay : startAutoReplay} className={`capture-button w-full ${recordingMode === "auto" ? "border-red-300/35 bg-red-500/15" : "border-cyan-300/25 bg-cyan-500/10"}`}>{recordingMode === "auto" ? <Square /> : <Play />}{recordingMode === "auto" ? "Detener replay" : "Iniciar replay continuo"}</button></div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black"><div className="aspect-video"><video ref={autoVideoRef} src={lastAutoUrl || undefined} muted controls playsInline className="h-full w-full object-contain" />{!lastAutoUrl && <div className="-mt-[56.25%] grid aspect-video place-items-center text-center text-[10px] text-white/30">Aquí aparecerá el último replay</div>}</div><button type="button" disabled={!lastAutoBlob} onClick={() => void saveLastAutoReplay()} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-white/10 bg-white/[.04] text-xs font-black text-white disabled:opacity-30"><Save />Guardar último replay</button></div>
            <button type="button" onClick={() => setMirrored((value) => !value)} className={`capture-button w-full ${mirrored ? "border-violet-300/30 bg-violet-500/15" : ""}`}><FlipHorizontal />{mirrored ? "Vista espejo activa" : "Activar vista espejo"}</button>
            <p className="text-center text-xs font-bold text-emerald-300">{feedback}</p>
          </aside>
        </section>
      )}

      {view === "analisis" && (
        activeClip ? (
          <section className={`${fullscreenAnalysis ? "fixed inset-0 z-[100] overflow-auto bg-black p-3 md:p-6" : "space-y-5"}`}>
            {fullscreenAnalysis && <button type="button" onClick={() => setFullscreenAnalysis(false)} className="fixed right-5 top-5 z-[110] grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-black/70 text-white"><X /></button>}
            <div className={`grid gap-4 ${compareClip ? "xl:grid-cols-2" : ""}`}>
              <AnalysisVideo clip={activeClip} url={clipUrls[activeClip.id]} videoRef={analysisVideoRef} mirrored={mirrored} zoom={zoom} drawing={drawing} draftStroke={draftStroke} onPointerDown={startStroke} onPointerMove={extendStroke} onPointerUp={finishStroke} />
              {compareClip && <div className="rounded-[24px] border border-violet-300/20 bg-[#070809] p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-xs font-black uppercase text-violet-200">Comparación · {compareClip.title}</span><button type="button" onClick={() => setCompareClipId("")}><X /></button></div><div className="aspect-video overflow-hidden rounded-2xl bg-black"><video ref={compareVideoRef} src={clipUrls[compareClip.id]} controls playsInline className={`h-full w-full object-contain ${mirrored ? "-scale-x-100" : ""}`} /></div></div>}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
              <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#090b0d] p-4">
                <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => stepFrame(-1)} className="analysis-button"><ChevronLeft />1 cuadro</button><button type="button" onClick={() => stepFrame(1)} className="analysis-button">1 cuadro<ChevronRight /></button>{[0.25, 0.5, 0.75, 1].map((rate) => <button key={rate} type="button" onClick={() => setRate(rate)} className={`analysis-button ${playbackRate === rate ? "border-orange-300/35 bg-orange-500/15" : ""}`}>{rate}×</button>)}<button type="button" onClick={() => setMirrored((value) => !value)} className={`analysis-button ${mirrored ? "border-violet-300/35 bg-violet-500/15" : ""}`}><FlipHorizontal />Espejo</button><button type="button" onClick={() => setZoom((value) => value >= 1.5 ? 1 : Number((value + 0.25).toFixed(2)))} className="analysis-button"><ZoomIn />{zoom}×</button><button type="button" onClick={() => setFullscreenAnalysis((value) => !value)} className="analysis-button"><Maximize2 />Pantalla</button></div>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4"><button type="button" onClick={() => setDrawing((value) => !value)} className={`analysis-button ${drawing ? "border-yellow-300/40 bg-yellow-500/15" : ""}`}><Pencil />{drawing ? "Dibujando" : "Dibujar"}</button>{drawingColors.map((color) => <button key={color} type="button" onClick={() => setDrawingColor(color)} aria-label={`Color ${color}`} className={`h-9 w-9 rounded-full border-4 ${drawingColor === color ? "border-white" : "border-transparent"}`} style={{ backgroundColor: color }} />)}<button type="button" disabled={!activeClip.strokes.length} onClick={clearDrawings} className="analysis-button"><Eraser />Limpiar</button></div>
                <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto]"><input value={markerNote} onChange={(event) => setMarkerNote(event.target.value)} placeholder="Nota en el tiempo actual…" className="replay-input" /><button type="button" onClick={addMarker} className="analysis-button min-h-11 border-cyan-300/25 bg-cyan-500/10"><BookmarkPlus />Marcar momento</button></div>
                {compareClip && <button type="button" onClick={() => void syncComparison()} className="capture-button w-full border-violet-300/25 bg-violet-500/10"><Play />Reproducir ambos desde el inicio</button>}
              </div>

              <aside className="rounded-[24px] border border-white/10 bg-[#090b0d] p-4"><p className="text-[9px] font-black uppercase tracking-wider text-orange-300">Análisis actual</p><h2 className="truncate text-lg font-black uppercase">{activeClip.title}</h2><p className="text-xs text-white/45">{activeClip.athleteName} · {formatReplayTime(activeClip.durationSeconds)}</p><div className="mt-4 space-y-2"><Field label="Comparar con"><select value={compareClipId} onChange={(event) => setCompareClipId(event.target.value)} className="replay-input"><option value="">Sin comparación</option>{clips.filter((clip) => clip.id !== activeClip.id).map((clip) => <option key={clip.id} value={clip.id}>{clip.title}</option>)}</select></Field></div><div className="mt-5 border-t border-white/10 pt-4"><p className="mb-3 text-xs font-black uppercase">Momentos marcados</p>{activeClip.markers.length ? <div className="space-y-2">{activeClip.markers.map((marker) => <button key={marker.id} type="button" onClick={() => { if (analysisVideoRef.current) analysisVideoRef.current.currentTime = marker.at; }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-left text-white"><span className="font-mono text-xs font-black text-cyan-300">{formatReplayTime(marker.at)}</span><span className="truncate text-xs text-white/65">{marker.note}</span></button>)}</div> : <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-white/30">Todavía no hay marcas.</p>}</div></aside>
            </div>
          </section>
        ) : <EmptyReplay title="No hay un clip seleccionado" detail="Graba o abre un video desde la videoteca." onGo={() => setView("captura")} />
      )}

      {view === "videoteca" && (
        <section className="rounded-[28px] border border-white/10 bg-[#090b0d] p-4 md:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wider text-orange-300">Almacenamiento local</p><h2 className="text-2xl font-black uppercase">Videoteca técnica</h2><p className="text-xs text-white/45">{clips.length} clips · {(storageBytes / 1024 / 1024).toFixed(1)} MB en este navegador</p></div><button type="button" onClick={() => setView("captura")} className="capture-button"><Camera />Nueva captura</button></div>{loading ? <div className="grid min-h-80 place-items-center"><Loader2 className="animate-spin text-orange-300" /></div> : clips.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{clips.map((clip) => <article key={clip.id} className="overflow-hidden rounded-[22px] border border-white/10 bg-black/25"><div className="aspect-video bg-black"><video src={clipUrls[clip.id]} muted playsInline preload="metadata" className="h-full w-full object-contain" /></div><div className="p-4"><p className="truncate font-black">{clip.title}</p><p className="mt-1 text-[10px] text-white/45">{clip.athleteName} · {formatReplayTime(clip.durationSeconds)} · {(clip.size / 1024 / 1024).toFixed(1)} MB</p><div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => openAnalysis(clip.id)} className="library-button"><Gauge />Analizar</button><button type="button" onClick={() => downloadClip(clip)} className="library-button"><Download />Descargar</button><button type="button" onClick={() => void removeClip(clip)} className="library-button text-red-300"><Trash2 />Eliminar</button></div></div></article>)}</div> : <EmptyReplay title="Videoteca vacía" detail="Los clips que guardes aparecerán aquí." onGo={() => setView("captura")} />}</section>
      )}

      <style jsx global>{`
        .replay-input { height: 2.7rem; width: 100%; border-radius: .85rem; border: 1px solid rgba(255,255,255,.12); background: #07090b; padding: 0 .75rem; color: white; outline: none; }
        .replay-input:focus { border-color: rgba(251,146,60,.55); box-shadow: 0 0 0 3px rgba(249,115,22,.1); }
        .replay-input option { background: #07090b; color: white; }
        .capture-button, .analysis-button { display: inline-flex; min-height: 2.75rem; align-items: center; justify-content: center; gap: .5rem; border-radius: .85rem; border: 1px solid rgba(255,255,255,.14); background: #080a0c; padding: 0 .9rem; color: white; font-size: .72rem; font-weight: 900; }
        .capture-button:disabled, .analysis-button:disabled { opacity: .3; }
        .capture-button svg, .analysis-button svg { width: 1rem; height: 1rem; }
        .library-button { display: flex; min-height: 2.5rem; flex-direction: column; align-items: center; justify-content: center; gap: .2rem; border-radius: .75rem; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); color: white; font-size: .6rem; font-weight: 800; }
        .library-button svg { width: .95rem; height: .95rem; }
      `}</style>
    </main>
  );
}

function AnalysisVideo({ clip, url, videoRef, mirrored, zoom, drawing, draftStroke, onPointerDown, onPointerMove, onPointerUp }: { clip: ReplayClip; url: string; videoRef: React.RefObject<HTMLVideoElement | null>; mirrored: boolean; zoom: number; drawing: boolean; draftStroke: ReplayStroke | null; onPointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void; onPointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void; onPointerUp: () => void }) {
  const transform = `${mirrored ? "scaleX(-1) " : ""}scale(${zoom})`;
  const strokes = draftStroke ? [...clip.strokes, draftStroke] : clip.strokes;
  return <div className="rounded-[24px] border border-orange-300/20 bg-[#070809] p-3"><div className="mb-2 flex items-center justify-between gap-2"><span className="truncate text-xs font-black uppercase text-orange-200">{clip.title}</span><span className={`rounded-full px-2 py-1 text-[9px] font-black ${drawing ? "bg-yellow-400 text-yellow-950" : "bg-white/10 text-white/45"}`}>{drawing ? "Anotando" : "Reproducción"}</span></div><div className="relative aspect-video touch-none overflow-hidden rounded-2xl bg-black"><video ref={videoRef} src={url} controls={!drawing} playsInline className="h-full w-full object-contain transition-transform" style={{ transform }} /><svg viewBox="0 0 1000 562.5" preserveAspectRatio="none" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} className={`absolute inset-0 h-full w-full transition-transform ${drawing ? "cursor-crosshair" : "pointer-events-none"}`} style={{ transform }}>{strokes.map((stroke) => <polyline key={stroke.id} points={stroke.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke.color} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}</svg></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-wider text-white/40">{label}</span>{children}</label>;
}

function EmptyReplay({ title, detail, onGo }: { title: string; detail: string; onGo: () => void }) {
  return <div className="grid min-h-[440px] place-items-center rounded-[26px] border border-dashed border-white/10 bg-[#090b0d] p-8 text-center"><div><UserRound className="mx-auto mb-4 h-12 w-12 text-white/20" /><h2 className="text-xl font-black uppercase">{title}</h2><p className="mt-2 text-sm text-white/45">{detail}</p><button type="button" onClick={onGo} className="mt-5 rounded-2xl bg-orange-400 px-5 py-3 font-black text-orange-950">Ir a captura</button></div></div>;
}

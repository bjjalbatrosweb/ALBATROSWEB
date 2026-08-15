"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Activity,
  AlertTriangle,
  Clock3,
  DoorOpen,
  Dumbbell,
  Flame,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  Map as MapIcon,
  Presentation,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";

import { useFirestore } from "@/firebase";
import {
  ZONE_STATUS_LABELS,
  ZONE_TYPE_LABELS,
  cleanAcademyMap,
  createDefaultAcademyMap,
  moveAthleteToZone,
  occupancyPercent,
  unassignedAthleteIds,
  type AcademyMapState,
  type AcademyZone,
  type AcademyZoneStatus,
  type AcademyZoneType,
} from "@/lib/live-academy-map";

type AthleteProfile = {
  id: string;
  nombre: string;
  fotoUrl: string;
  disciplina: string;
};

type Attendance = {
  id: string;
  alumnoId: string;
  nombre: string;
  dispositivo: string;
  fecha?: Timestamp;
};

type ActiveClass = {
  claseId: string;
  disciplina: string;
  tema: string;
  tipo: string;
  profesorNombre: string;
  inicio?: Timestamp;
};

type DeviceState = {
  dispositivo?: string;
  ultimoContacto?: Timestamp;
  puertaCerrada?: boolean;
  puertaBloqueada?: boolean;
  alarmaActiva?: boolean;
  rssi?: number | null;
};

type AccessState = {
  tatamiBloqueado?: boolean;
};

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<{ release: () => Promise<void> }>;
  };
};

const STORAGE_PREFIX = "albatros-live-map-v1";

const zoneStyles: Record<AcademyZoneType, string> = {
  recepcion: "border-cyan-300/25 bg-cyan-500/[.08]",
  tatami: "border-emerald-300/25 bg-emerald-500/[.08]",
  striking: "border-red-300/25 bg-red-500/[.08]",
  fuerza: "border-violet-300/25 bg-violet-500/[.08]",
  espera: "border-amber-300/25 bg-amber-500/[.08]",
  salida: "border-slate-300/20 bg-slate-500/[.08]",
};

const zoneIcons = {
  recepcion: UserCheck,
  tatami: LayoutGrid,
  striking: Flame,
  fuerza: Dumbbell,
  espera: Users,
  salida: DoorOpen,
} satisfies Record<AcademyZoneType, typeof Users>;

export default function LiveAcademyMapPage() {
  const firestore = useFirestore();
  const [site, setSite] = useState("MMA");
  const [mapState, setMapState] = useState<AcademyMapState>(createDefaultAcademyMap);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, AthleteProfile>>({});
  const [activeClass, setActiveClass] = useState<ActiveClass | null>(null);
  const [activeClassReady, setActiveClassReady] = useState(false);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [attendanceReady, setAttendanceReady] = useState(false);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState("");
  const [editing, setEditing] = useState(false);
  const [presentation, setPresentation] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [wallClock, setWallClock] = useState("--:--:--");

  useEffect(() => {
    setSite(localStorage.getItem("userSede") || "MMA");
  }, []);

  useEffect(() => {
    setMapLoaded(false);
    setActiveClassReady(false);
    setAttendanceReady(false);
    setAttendances([]);
    const stored = localStorage.getItem(`${STORAGE_PREFIX}:${site}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AcademyMapState;
        setMapState(parsed.version === 1 && Array.isArray(parsed.zones) ? parsed : createDefaultAcademyMap());
      } catch {
        setMapState(createDefaultAcademyMap());
      }
    } else {
      setMapState(createDefaultAcademyMap());
    }
    setMapLoaded(true);
  }, [site]);

  useEffect(() => {
    if (!mapLoaded) return;
    localStorage.setItem(`${STORAGE_PREFIX}:${site}`, JSON.stringify(mapState));
  }, [mapLoaded, mapState, site]);

  useEffect(() => {
    const update = () => {
      setNow(Date.now());
      setWallClock(
        new Intl.DateTimeFormat("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date()),
      );
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!firestore || !site) return;
    setLoading(true);
    const unsubscribers = [
      onSnapshot(
        doc(firestore, "ClasesActivas", site),
        (snapshot) => {
          setActiveClass(snapshot.exists() ? (snapshot.data() as ActiveClass) : null);
          setActiveClassReady(true);
          setLoading(false);
        },
        () => {
          setActiveClass(null);
          setActiveClassReady(true);
          setError("No se pudo leer la clase activa.");
          setLoading(false);
        },
      ),
      onSnapshot(
        doc(firestore, "DispositivosAcceso", site),
        (snapshot) => setDevice(snapshot.exists() ? (snapshot.data() as DeviceState) : null),
        () => setDevice(null),
      ),
      onSnapshot(
        doc(firestore, "ControlesAcceso", site),
        (snapshot) => setAccess(snapshot.exists() ? (snapshot.data() as AccessState) : null),
        () => setAccess(null),
      ),
      onSnapshot(
        query(collection(firestore, "Alumnos"), where("sede", "==", site)),
        (snapshot) => {
          const next: Record<string, AthleteProfile> = {};
          snapshot.docs.forEach((record) => {
            const data = record.data();
            if (data.activo === false) return;
            next[record.id] = {
              id: record.id,
              nombre: String(data.nombre || "Atleta"),
              fotoUrl: String(data.fotoUrl || data.imagenUrl || ""),
              disciplina: String(data.disciplina || ""),
            };
          });
          setProfiles(next);
        },
      ),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [firestore, site]);

  useEffect(() => {
    if (!firestore || !activeClassReady) return;
    if (!activeClass?.claseId) {
      setAttendances([]);
      setAttendanceReady(true);
      return;
    }
    setAttendanceReady(false);
    const attendanceQuery = query(
      collection(firestore, "AsistenciasClase"),
      where("claseId", "==", activeClass.claseId),
    );
    return onSnapshot(
      attendanceQuery,
      (snapshot) => {
        const unique = new Map<string, Attendance>();
        snapshot.docs.forEach((record) => {
          const data = record.data();
          const athleteId = String(data.alumnoId || "");
          if (!athleteId) return;
          unique.set(athleteId, {
            id: record.id,
            alumnoId: athleteId,
            nombre: String(data.nombre || "Atleta"),
            dispositivo: String(data.dispositivo || "Asistencia"),
            fecha: data.fecha instanceof Timestamp ? data.fecha : undefined,
          });
        });
        setAttendances([...unique.values()]);
        setAttendanceReady(true);
      },
      () => {
        setAttendanceReady(true);
        setError("No se pudieron actualizar las asistencias de la clase.");
      },
    );
  }, [activeClass?.claseId, activeClassReady, firestore]);

  const presentAthletes = useMemo(
    () =>
      attendances
        .map((attendance) => ({
          id: attendance.alumnoId,
          nombre: profiles[attendance.alumnoId]?.nombre || attendance.nombre,
          fotoUrl: profiles[attendance.alumnoId]?.fotoUrl || "",
          disciplina: profiles[attendance.alumnoId]?.disciplina || activeClass?.disciplina || "",
          checkIn: attendance.fecha,
          dispositivo: attendance.dispositivo,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [activeClass?.disciplina, attendances, profiles],
  );

  const presentIds = useMemo(() => presentAthletes.map((athlete) => athlete.id), [presentAthletes]);
  const presentKey = presentIds.join("|");

  useEffect(() => {
    if (!mapLoaded || !activeClassReady || !attendanceReady) return;
    setMapState((current) => cleanAcademyMap(current, presentKey ? presentKey.split("|") : []));
    setSelectedAthleteId((current) => (current && presentIds.includes(current) ? current : ""));
    // presentKey representa la lista estable de IDs y evita limpiar por cada cambio de perfil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClassReady, attendanceReady, mapLoaded, presentKey]);

  useEffect(() => {
    if (!presentation) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = async () => {
      try {
        lock = await (navigator as WakeLockNavigator).wakeLock?.request("screen") || null;
      } catch {
        lock = null;
      }
    };
    void request();
    return () => void lock?.release();
  }, [presentation]);

  const athleteById = (id: string) => presentAthletes.find((athlete) => athlete.id === id) || null;
  const unassignedIds = unassignedAthleteIds(mapState, presentIds);
  const assignedCount = presentIds.length - unassignedIds.length;
  const totalCapacity = mapState.zones.reduce((total, zone) => total + zone.capacity, 0);
  const lastContact = device?.ultimoContacto?.toMillis?.() || 0;
  const deviceOnline = lastContact > 0 && now - lastContact < 5 * 60_000;

  const moveAthlete = (athleteId: string, zoneId: string | null) => {
    if (zoneId) {
      const zone = mapState.zones.find((item) => item.id === zoneId);
      if (zone?.status === "cerrada") {
        setError(`${zone.name} está cerrada. Cambia su estado antes de mover atletas.`);
        return;
      }
    }
    setMapState((current) => moveAthleteToZone(current, athleteId, zoneId));
    setSelectedAthleteId("");
    setError("");
  };

  const updateZone = (zoneId: string, patch: Partial<AcademyZone>) => {
    setMapState((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      zones: current.zones.map((zone) => (zone.id === zoneId ? { ...zone, ...patch } : zone)),
    }));
  };

  const assignUnassignedToTatami = () => {
    const target = mapState.zones.find((zone) => zone.type === "tatami" && zone.status !== "cerrada");
    if (!target) {
      setError("No hay un tatami abierto disponible.");
      return;
    }
    setMapState((current) =>
      unassignedIds.reduce(
        (state, athleteId) => moveAthleteToZone(state, athleteId, target.id),
        current,
      ),
    );
  };

  const resetMap = () => {
    if (!window.confirm("¿Restaurar nombres, capacidades y zonas predeterminadas?")) return;
    setMapState(cleanAcademyMap(createDefaultAcademyMap(), presentIds));
  };

  const openPresentation = async () => {
    setPresentation(true);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // La vista de TV permanece visible si fullscreen no está disponible.
    }
  };

  const closePresentation = async () => {
    setPresentation(false);
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-4 text-white md:p-8">
      <header className="rounded-[28px] border border-white/10 bg-gradient-to-br from-[#08171a] via-[#0c1011] to-[#050607] p-5 shadow-2xl md:p-7">
        <div className="flex items-center gap-2 text-cyan-300"><MapIcon className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[.24em]">Vista operativa · sede {site}</span></div>
        <h1 className="mt-2 text-3xl font-black uppercase md:text-5xl">Mapa vivo de la academia</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">Ocupación por zonas, clase activa y estado del acceso en una sola pantalla.</p>
      </header>

      {device?.alarmaActiva && <div className="flex items-center gap-3 rounded-2xl border border-red-400/40 bg-red-600/20 p-4 text-red-50"><AlertTriangle className="animate-pulse text-red-300" /><div><p className="font-black uppercase">Alarma del dispositivo activa</p><p className="text-xs text-red-100/70">Verifica físicamente la entrada y el panel de puerta.</p></div></div>}
      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-950/40 p-4 text-red-100"><AlertTriangle className="h-5 w-5 shrink-0 text-red-300" /><p className="flex-1 text-sm font-bold">{error}</p><button type="button" onClick={() => setError("")}><X /></button></div>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard icon={activeClass ? Activity : Clock3} label="Clase activa" value={activeClass ? activeClass.disciplina : "Sin clase"} detail={activeClass ? activeClass.tema || activeClass.tipo : "Inicia una clase para cargar asistentes"} active={Boolean(activeClass)} />
        <StatusCard icon={Users} label="Ocupación registrada" value={`${presentIds.length} atletas`} detail={`${assignedCount} ubicados · ${unassignedIds.length} pendientes`} active={presentIds.length > 0} />
        <StatusCard icon={deviceOnline ? Wifi : WifiOff} label="Dispositivo de acceso" value={deviceOnline ? "En línea" : "Sin conexión reciente"} detail={device?.dispositivo || `Capacidad configurada: ${totalCapacity}`} active={deviceOnline} />
        <StatusCard icon={device?.puertaBloqueada ? LockKeyhole : DoorOpen} label="Entrada y tatami" value={device?.puertaBloqueada ? "Puerta bloqueada" : device?.puertaCerrada === false ? "Puerta abierta" : "Puerta cerrada"} detail={access?.tatamiBloqueado ? "Tatami bloqueado" : "Tatami disponible"} active={!device?.alarmaActiva && !access?.tatamiBloqueado} />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-[#090b0d] p-3">
        <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${activeClass ? "bg-emerald-400" : "bg-white/20"}`} /><div><p className="text-xs font-black uppercase">{activeClass ? `${activeClass.profesorNombre || "Coach"} · ${activeClass.tipo || "Clase"}` : "Esperando clase activa"}</p><p className="text-[10px] text-white/70">La ubicación dentro del gimnasio se asigna manualmente.</p></div></div>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!unassignedIds.length} onClick={assignUnassignedToTatami} className="map-tool-button"><LayoutGrid />Enviar pendientes al tatami</button><button type="button" onClick={() => setEditing((value) => !value)} className={`map-tool-button ${editing ? "border-violet-300/30 bg-violet-500/15" : ""}`}><Activity />{editing ? "Terminar edición" : "Editar zonas"}</button><button type="button" onClick={resetMap} className="map-tool-button"><RotateCcw />Restaurar</button><button type="button" onClick={() => void openPresentation()} className="map-tool-button border-cyan-300/25 bg-cyan-500/10"><Presentation />Vista TV</button></div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[290px_1fr]">
        <aside className="rounded-[24px] border border-white/10 bg-[#090b0d] p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-2"><div><p className="text-[9px] font-black uppercase tracking-wider text-cyan-300">Sin ubicación</p><h2 className="font-black uppercase">Atletas presentes</h2></div><span className="rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-black text-cyan-200">{unassignedIds.length}</span></div>
          {loading ? <div className="grid min-h-56 place-items-center text-center text-sm font-bold text-white/70"><Loader2 className="animate-spin text-cyan-300" /></div> : !activeClass ? <div className="grid min-h-56 place-items-center text-center text-xs text-white/70"><div><Clock3 className="mx-auto mb-3 h-9 w-9" />No hay una clase activa.</div></div> : unassignedIds.length ? <div className="max-h-[640px] space-y-2 overflow-auto pr-1">{unassignedIds.map((id) => { const athlete = athleteById(id); if (!athlete) return null; return <AthleteChip key={id} athlete={athlete} selected={selectedAthleteId === id} onSelect={() => setSelectedAthleteId((current) => current === id ? "" : id)} draggable />; })}</div> : <div className="grid min-h-56 place-items-center text-center text-xs text-emerald-200/70"><div><ShieldCheck className="mx-auto mb-3 h-9 w-9" />Todos los presentes tienen zona.</div></div>}
          {selectedAthleteId && <p className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/[.08] p-3 text-[10px] font-bold text-cyan-100">Atleta seleccionado. Pulsa “Mover aquí” en una zona.</p>}
        </aside>

        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {mapState.zones.map((zone) => <ZoneCard key={zone.id} zone={zone} athletes={zone.athleteIds.map(athleteById).filter(Boolean) as ReturnType<typeof athleteById>[]} editing={editing} selectedAthleteId={selectedAthleteId} onMoveSelected={() => selectedAthleteId && moveAthlete(selectedAthleteId, zone.id)} onMoveAthlete={(athleteId) => moveAthlete(athleteId, zone.id)} onRemoveAthlete={(athleteId) => moveAthlete(athleteId, null)} onSelectAthlete={(athleteId) => setSelectedAthleteId((current) => current === athleteId ? "" : athleteId)} onUpdate={(patch) => updateZone(zone.id, patch)} />)}
        </div>
      </section>

      {presentation && <MapPresentation mapState={mapState} athletes={presentAthletes} activeClass={activeClass} device={device} access={access} deviceOnline={deviceOnline} wallClock={wallClock} onClose={() => void closePresentation()} />}

      <style jsx global>{`
        .map-input { height: 2.45rem; width: 100%; border-radius: .75rem; border: 1px solid rgba(255,255,255,.12); background: #07090b; padding: 0 .65rem; color: white; outline: none; }
        .map-input:focus { border-color: rgba(103,232,249,.5); }
        .map-input option { background: #07090b; color: white; }
        .map-tool-button { display: inline-flex; min-height: 2.45rem; align-items: center; gap: .4rem; border-radius: .75rem; border: 1px solid rgba(255,255,255,.13); background: #080a0c; padding: 0 .7rem; color: white; font-size: .65rem; font-weight: 900; }
        .map-tool-button:disabled { opacity: .3; }
        .map-tool-button svg { width: .95rem; height: .95rem; }
      `}</style>
    </main>
  );
}

function ZoneCard({ zone, athletes, editing, selectedAthleteId, onMoveSelected, onMoveAthlete, onRemoveAthlete, onSelectAthlete, onUpdate }: { zone: AcademyZone; athletes: Array<{ id: string; nombre: string; fotoUrl: string; disciplina: string; checkIn?: Timestamp; dispositivo: string } | null>; editing: boolean; selectedAthleteId: string; onMoveSelected: () => void; onMoveAthlete: (id: string) => void; onRemoveAthlete: (id: string) => void; onSelectAthlete: (id: string) => void; onUpdate: (patch: Partial<AcademyZone>) => void }) {
  const Icon = zoneIcons[zone.type];
  const occupancy = occupancyPercent(zone);
  return <article onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const athleteId = event.dataTransfer.getData("text/albatros-athlete"); if (athleteId) onMoveAthlete(athleteId); }} className={`flex min-h-[290px] flex-col rounded-[24px] border p-4 transition ${zoneStyles[zone.type]} ${zone.status === "cerrada" ? "opacity-55 grayscale" : ""}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/20"><Icon /></span><div className="min-w-0">{editing ? <input value={zone.name} onChange={(event) => onUpdate({ name: event.target.value })} className="map-input font-black" /> : <h3 className="truncate text-lg font-black uppercase">{zone.name}</h3>}<p className="mt-1 truncate text-[10px] text-white/70">{ZONE_TYPE_LABELS[zone.type]} · {zone.activity}</p></div></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase ${zone.status === "abierta" ? "border-emerald-300/25 text-emerald-200" : zone.status === "restringida" ? "border-amber-300/25 text-amber-200" : "border-red-300/25 text-red-200"}`}>{ZONE_STATUS_LABELS[zone.status]}</span></div>{editing ? <div className="mt-3 grid grid-cols-[1fr_90px] gap-2"><input value={zone.activity} onChange={(event) => onUpdate({ activity: event.target.value })} placeholder="Actividad" className="map-input" /><input type="number" min="1" max="100" value={zone.capacity} onChange={(event) => onUpdate({ capacity: Math.max(1, Number(event.target.value)) })} className="map-input" /><select value={zone.status} onChange={(event) => onUpdate({ status: event.target.value as AcademyZoneStatus })} className="map-input col-span-2">{(Object.keys(ZONE_STATUS_LABELS) as AcademyZoneStatus[]).map((status) => <option key={status} value={status}>{ZONE_STATUS_LABELS[status]}</option>)}</select></div> : <div className="mt-3"><div className="mb-1 flex justify-between text-[9px] font-black uppercase text-white/70"><span>Ocupación</span><span>{zone.athleteIds.length}/{zone.capacity} · {occupancy}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/25"><div className={`h-full rounded-full ${occupancy > 100 ? "bg-red-400" : occupancy >= 80 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.min(100, occupancy)}%` }} /></div></div>}<div className="mt-4 flex-1 space-y-2">{athletes.length ? athletes.map((athlete) => athlete && <AthleteChip key={athlete.id} athlete={athlete} selected={selectedAthleteId === athlete.id} onSelect={() => onSelectAthlete(athlete.id)} onRemove={() => onRemoveAthlete(athlete.id)} draggable />) : <div className="grid min-h-24 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-[10px] text-white/70">Arrastra atletas aquí</div>}</div>{selectedAthleteId && !editing && <button type="button" disabled={zone.status === "cerrada"} onClick={onMoveSelected} className="mt-3 min-h-10 w-full rounded-xl border border-cyan-300/25 bg-cyan-500/10 text-xs font-black text-cyan-100 disabled:opacity-30">Mover aquí</button>}</article>;
}

function AthleteChip({ athlete, selected, onSelect, onRemove, draggable = false }: { athlete: { id: string; nombre: string; fotoUrl: string; disciplina: string }; selected: boolean; onSelect: () => void; onRemove?: () => void; draggable?: boolean }) {
  return <div draggable={draggable} onDragStart={(event) => event.dataTransfer.setData("text/albatros-athlete", athlete.id)} className={`flex items-center gap-2 rounded-xl border p-2 text-white transition ${selected ? "border-cyan-300/50 bg-cyan-500/15" : "border-white/10 bg-black/20"}`}><button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left"><AthletePhoto athlete={athlete} className="h-9 w-9 rounded-lg" /><span className="min-w-0"><strong className="block truncate text-xs">{athlete.nombre}</strong><span className="block truncate text-[9px] text-white/70">{athlete.disciplina || "Atleta"}</span></span></button>{onRemove && <button type="button" onClick={onRemove} className="text-white/70 hover:text-red-300" aria-label="Quitar de zona"><X className="h-4 w-4" /></button>}</div>;
}

function AthletePhoto({ athlete, className }: { athlete: { nombre: string; fotoUrl: string }; className: string }) {
  return <span className={`relative shrink-0 overflow-hidden border border-white/10 bg-white/[.06] ${className}`}>{athlete.fotoUrl ? <Image src={athlete.fotoUrl} alt={`Foto de ${athlete.nombre}`} fill sizes="80px" unoptimized className="object-cover" /> : <span className="grid h-full place-items-center text-white/70"><UserRound className="h-1/2 w-1/2" /></span>}</span>;
}

function StatusCard({ icon: Icon, label, value, detail, active }: { icon: typeof Users; label: string; value: string; detail: string; active: boolean }) {
  return <article className="rounded-[22px] border border-white/10 bg-[#090b0d] p-4"><div className="flex items-start gap-3"><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${active ? "bg-cyan-500/15 text-cyan-300" : "bg-white/[.05] text-white/70"}`}><Icon /></span><div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-wider text-white/70">{label}</p><strong className="mt-1 block truncate">{value}</strong><span className="mt-1 block truncate text-[10px] text-white/70">{detail}</span></div></div></article>;
}

function MapPresentation({ mapState, athletes, activeClass, device, access, deviceOnline, wallClock, onClose }: { mapState: AcademyMapState; athletes: Array<{ id: string; nombre: string; fotoUrl: string; disciplina: string }>; activeClass: ActiveClass | null; device: DeviceState | null; access: AccessState | null; deviceOnline: boolean; wallClock: string; onClose: () => void }) {
  const athleteById = (id: string) => athletes.find((athlete) => athlete.id === id);
  return <div className="fixed inset-0 z-[100] overflow-auto bg-black p-4 text-white md:p-8"><header className="mb-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-cyan-300">Mapa operativo</p><h2 className="truncate text-2xl font-black uppercase md:text-5xl">{activeClass ? `${activeClass.disciplina} · ${activeClass.tema}` : "Academia sin clase activa"}</h2></div><div className="rounded-2xl border border-white/15 bg-white/[.06] px-5 py-2 text-center"><span className="block text-[9px] font-black uppercase text-white/70">Hora local</span><strong className="font-mono text-2xl tabular-nums md:text-4xl">{wallClock}</strong></div><button type="button" onClick={onClose} className="ml-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/20 bg-white/10"><X /></button></header><div className="mb-5 flex flex-wrap gap-2"><span className={`rounded-full border px-3 py-2 text-xs font-black ${deviceOnline ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-200" : "border-red-300/25 bg-red-500/10 text-red-200"}`}>{deviceOnline ? <Wifi className="mr-2 inline h-4 w-4" /> : <WifiOff className="mr-2 inline h-4 w-4" />}{deviceOnline ? "Acceso conectado" : "Acceso sin conexión"}</span><span className="rounded-full border border-white/15 bg-white/[.05] px-3 py-2 text-xs font-black">{device?.puertaCerrada === false ? "Puerta abierta" : "Puerta cerrada"}</span><span className={`rounded-full border px-3 py-2 text-xs font-black ${access?.tatamiBloqueado ? "border-red-300/25 bg-red-500/10 text-red-200" : "border-emerald-300/25 bg-emerald-500/10 text-emerald-200"}`}>{access?.tatamiBloqueado ? "Tatami bloqueado" : "Tatami disponible"}</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{mapState.zones.map((zone) => { const Icon = zoneIcons[zone.type]; const members = zone.athleteIds.map(athleteById).filter(Boolean); return <article key={zone.id} className={`min-h-56 rounded-[28px] border p-5 ${zoneStyles[zone.type]} ${zone.status === "cerrada" ? "opacity-55" : ""}`}><div className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black/20"><Icon /></span><span className="min-w-0"><strong className="block truncate text-xl uppercase">{zone.name}</strong><span className="text-xs text-white/70">{zone.activity}</span></span></span><span className="text-xl font-black tabular-nums">{members.length}/{zone.capacity}</span></div><div className="mt-5 flex flex-wrap gap-2">{members.map((athlete) => athlete && <span key={athlete.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 py-1 pl-1 pr-3 text-xs font-bold"><AthletePhoto athlete={athlete} className="h-8 w-8 rounded-full" />{athlete.nombre}</span>)}{!members.length && <span className="text-xs text-white/70">Zona sin atletas asignados</span>}</div></article>; })}</div></div>;
}

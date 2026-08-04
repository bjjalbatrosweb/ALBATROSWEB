'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  DoorClosed,
  DoorOpen,
  Loader2,
  Play,
  RadioTower,
  ShieldAlert,
  Square,
  Users,
} from 'lucide-react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type ActiveClass = {
  claseId: string;
  sede: Sede;
  disciplina: string;
  tema: string;
  tipo: string;
  profesorUid: string;
  profesorNombre: string;
  inicio?: Timestamp;
};
type ClassAttendance = {
  id: string;
  alumnoId: string;
  nombre: string;
  dispositivo?: string;
  fecha?: Timestamp;
};

const disciplines = ['Jiu-Jitsu', 'Kick Boxing', 'MMA', 'Taekwondo'];
const sessionTypes = ['Físico', 'Técnico', 'Práctico', 'Evaluación', 'Clase libre'];

export default function ActiveClassPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [site, setSite] = useState<Sede>('MMA');
  const [activeClass, setActiveClass] = useState<ActiveClass | null>(null);
  const [attendees, setAttendees] = useState<ClassAttendance[]>([]);
  const [discipline, setDiscipline] = useState('Jiu-Jitsu');
  const [sessionType, setSessionType] = useState('Técnico');
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [controlLoading, setControlLoading] = useState(true);
  const [tatamiBlocked, setTatamiBlocked] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('userSede');
    if (['MMA', 'CAUCEL', 'JUAN_PABLO'].includes(saved || '')) setSite(saved as Sede);
  }, []);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(doc(firestore, 'ClasesActivas', site), (snapshot) => {
      setActiveClass(snapshot.exists() ? (snapshot.data() as ActiveClass) : null);
      setLoading(false);
    }, () => setLoading(false));
    return unsubscribe;
  }, [firestore, site]);

  useEffect(() => {
    setControlLoading(true);
    const unsubscribe = onSnapshot(doc(firestore, 'ControlesAcceso', site), (snapshot) => {
      setTatamiBlocked(snapshot.exists() && snapshot.data().tatamiBloqueado === true);
      setControlLoading(false);
    }, () => setControlLoading(false));
    return unsubscribe;
  }, [firestore, site]);

  useEffect(() => {
    if (!activeClass?.claseId) {
      setAttendees([]);
      return;
    }
    const attendanceQuery = query(collection(firestore, 'AsistenciasClase'), where('claseId', '==', activeClass.claseId));
    const unsubscribe = onSnapshot(attendanceQuery, (snapshot) => {
      const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ClassAttendance, 'id'>) }));
      rows.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
      setAttendees(rows);
    });
    return unsubscribe;
  }, [activeClass?.claseId, firestore]);

  const elapsed = useMemo(() => {
    const started = activeClass?.inicio?.toDate?.();
    if (!started) return 'En curso';
    return `Inició ${started.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  }, [activeClass]);

  const startClass = async () => {
    if (!user || !topic.trim() || working) return;
    setWorking(true);
    try {
      const pointerRef = doc(firestore, 'ClasesActivas', site);
      const classRef = doc(collection(firestore, 'Clases'));
      await runTransaction(firestore, async (transaction) => {
        const current = await transaction.get(pointerRef);
        if (current.exists()) throw new Error('Ya existe una clase activa en esta sede.');
        const payload = {
          claseId: classRef.id,
          sede: site,
          disciplina: discipline,
          tema: topic.trim(),
          tipo: sessionType,
          notas: notes.trim(),
          profesorUid: user.uid,
          profesorNombre: user.displayName || user.email || 'Profesor',
          estado: 'activa',
          tatamiBloqueado: tatamiBlocked,
          inicio: serverTimestamp(),
          creadoEn: serverTimestamp(),
        };
        transaction.set(classRef, payload);
        transaction.set(pointerRef, payload);
      });
      toast({ title: 'Clase iniciada', description: 'Las nuevas asistencias aparecerán en tiempo real.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo iniciar', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  const toggleTatami = async () => {
    if (!user || working || controlLoading) return;
    setWorking(true);
    const next = !tatamiBlocked;
    try {
      const batch = writeBatch(firestore);
      batch.set(doc(firestore, 'ControlesAcceso', site), {
        sede: site,
        tatamiBloqueado: next,
        actualizadoPor: user.uid,
        actualizadoPorEmail: user.email || '',
        actualizadoEn: serverTimestamp(),
      }, { merge: true });
      if (activeClass) {
        batch.update(doc(firestore, 'ClasesActivas', site), {
          tatamiBloqueado: next,
          bloqueoActualizadoPor: user.uid,
          bloqueoActualizadoEn: serverTimestamp(),
        });
        batch.update(doc(firestore, 'Clases', activeClass.claseId), {
          tatamiBloqueado: next,
          bloqueoActualizadoPor: user.uid,
          bloqueoActualizadoEn: serverTimestamp(),
        });
      }
      await batch.commit();
      toast({ title: next ? 'Acceso al tatami bloqueado' : 'Acceso al tatami habilitado', description: next ? 'Las tarjetas normales registrarán asistencia, pero no abrirán la puerta.' : 'Las tarjetas autorizadas volverán a abrir la puerta.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo cambiar el acceso', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  const finishClass = async () => {
    if (!activeClass || !user || working) return;
    if (!window.confirm('¿Finalizar esta clase? El bloqueo independiente del tatami conservará su estado actual.')) return;
    setWorking(true);
    try {
      await runTransaction(firestore, async (transaction) => {
        const pointerRef = doc(firestore, 'ClasesActivas', site);
        const pointer = await transaction.get(pointerRef);
        if (!pointer.exists() || pointer.data().claseId !== activeClass.claseId) {
          throw new Error('La clase activa cambió. Actualiza la página.');
        }
        transaction.update(doc(firestore, 'Clases', activeClass.claseId), {
          estado: 'finalizada',
          tatamiBloqueado: tatamiBlocked,
          fin: serverTimestamp(),
          finalizadaPor: user.uid,
          totalAsistentes: attendees.length,
        });
        transaction.delete(pointerRef);
      });
      toast({ title: 'Clase finalizada', description: `${attendees.length} asistentes registrados. El control del tatami no fue modificado.` });
      setTopic('');
      setNotes('');
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo finalizar', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorking(false);
    }
  };

  if (loading) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-primary"><RadioTower className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">Operación en vivo</span></div><h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Clase activa</h1><p className="mt-2 text-sm text-muted-foreground">Controla la sesión, la asistencia y el acceso al tatami.</p></div>
        <Badge variant="outline" className="w-fit">Sede {site.replace('_', ' ')}</Badge>
      </header>

      <Card className={`overflow-hidden transition-all duration-500 ${tatamiBlocked ? 'border-red-500/50 bg-red-500/[0.05] shadow-[0_0_35px_rgba(239,68,68,0.10)]' : 'border-green-500/30 bg-green-500/[0.03]'}`}>
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-colors duration-500 ${tatamiBlocked ? 'bg-red-500/15 text-red-500' : 'bg-green-500/15 text-green-500'}`}>
              {tatamiBlocked ? <DoorClosed className="h-6 w-6" /> : <DoorOpen className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">Control independiente</p>
              <h2 className="mt-1 text-xl font-black uppercase">Acceso al tatami</h2>
              <p className={`mt-1 text-sm font-bold ${tatamiBlocked ? 'text-red-400' : 'text-green-400'}`}>{controlLoading ? 'Consultando estado…' : tatamiBlocked ? 'Bloqueado: sólo abre la tarjeta maestra' : 'Habilitado para tarjetas autorizadas'}</p>
              <p className="mt-2 max-w-2xl text-xs text-muted-foreground">Funciona aunque no haya una clase iniciada. Al bloquear, las tarjetas normales pueden registrar asistencia, pero no activan la puerta; la salida interior permanece libre.</p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={tatamiBlocked}
            aria-label={tatamiBlocked ? 'Habilitar acceso al tatami' : 'Bloquear acceso al tatami'}
            onClick={toggleTatami}
            disabled={working || controlLoading}
            className={`relative h-14 w-28 shrink-0 rounded-full border-2 p-1.5 outline-none transition-all duration-500 focus-visible:ring-4 focus-visible:ring-primary/30 disabled:cursor-wait disabled:opacity-60 ${tatamiBlocked ? 'border-red-400/70 bg-red-600 shadow-[0_0_22px_rgba(239,68,68,0.35)]' : 'border-green-400/60 bg-green-600 shadow-[0_0_18px_rgba(34,197,94,0.22)]'}`}
          >
            <span className={`grid h-10 w-10 place-items-center rounded-full bg-white text-black shadow-lg transition-transform duration-500 ease-out ${tatamiBlocked ? 'translate-x-12 rotate-0' : 'translate-x-0 -rotate-6'}`}>
              {working ? <Loader2 className="h-5 w-5 animate-spin" /> : tatamiBlocked ? <DoorClosed className="h-5 w-5 text-red-600" /> : <DoorOpen className="h-5 w-5 text-green-600" />}
            </span>
            <span className="sr-only">{tatamiBlocked ? 'Acceso bloqueado' : 'Acceso habilitado'}</span>
          </button>
        </CardContent>
        {tatamiBlocked && <div className="flex items-center gap-2 border-t border-red-500/20 bg-red-500/[0.06] px-6 py-3 text-xs font-bold text-red-400"><ShieldAlert className="h-4 w-4" /> Bloqueo activo en esta sede, haya o no una clase en curso.</div>}
      </Card>

      {!activeClass ? (
        <Card className="max-w-2xl border-primary/15"><CardHeader><CardTitle className="flex items-center gap-2"><Play className="h-5 w-5 text-primary" /> Iniciar una clase</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="active-class-discipline">Disciplina</Label><Input id="active-class-discipline" list="active-class-disciplines" value={discipline} onChange={(e) => setDiscipline(e.target.value)} placeholder="Selecciona o escribe una disciplina" /><datalist id="active-class-disciplines">{disciplines.map((item) => <option key={item} value={item} />)}</datalist></div><div className="space-y-2"><Label>Tipo de sesión</Label><select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="h-11 w-full rounded-xl border bg-background px-3">{sessionTypes.map((item) => <option key={item}>{item}</option>)}</select></div><div className="space-y-2 sm:col-span-2"><Label>Tema principal</Label><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Ej. Escapes de montada y recuperación de guardia" maxLength={120} /></div><div className="space-y-2 sm:col-span-2"><Label>Observaciones opcionales</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Objetivo, material o indicaciones..." maxLength={500} /></div><Button onClick={startClass} disabled={!topic.trim() || working} className="font-black uppercase sm:col-span-2">{working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />} Iniciar clase</Button></CardContent></Card>
      ) : (
        <>
          <Card className="border-green-500/25"><CardContent className="p-6"><div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><Badge className="mb-3 bg-green-600">En curso</Badge><h2 className="text-2xl font-black uppercase italic">{activeClass.disciplina}</h2><p className="mt-1 text-lg font-bold">{activeClass.tema}</p><div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Activity className="h-4 w-4" /> {activeClass.tipo}</span><span className="flex items-center gap-1"><Clock3 className="h-4 w-4" /> {elapsed}</span><span className="flex items-center gap-1"><Users className="h-4 w-4" /> {attendees.length} asistentes</span></div></div><Button variant="outline" onClick={finishClass} disabled={working}><Square className="mr-2 h-4 w-4" /> Finalizar</Button></div></CardContent></Card>

          <Card><CardHeader><CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Alumnos registrados</span><Badge>{attendees.length}</Badge></CardTitle></CardHeader><CardContent>{attendees.length === 0 ? <div className="grid min-h-48 place-items-center text-center text-sm text-muted-foreground">Los alumnos aparecerán aquí al pasar RFID, NFC o recepción durante la clase.</div> : <div className="divide-y rounded-xl border">{attendees.map((attendance) => <div key={attendance.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-black">{attendance.nombre}</p><p className="text-xs text-muted-foreground">{attendance.dispositivo || 'Asistencia'}</p></div><span className="text-xs font-bold text-muted-foreground">{attendance.fecha?.toDate?.().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) || 'Ahora'}</span></div>)}</div>}</CardContent></Card>
        </>
      )}
    </div>
  );
}

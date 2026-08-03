'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileImage,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'firebase/storage';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebaseApp, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { normalizarPerfilAcceso } from '@/lib/access-control';

type Sede = 'TODAS' | 'MMA' | 'CAUCEL' | 'JUAN_PABLO';
type Status = 'borrador' | 'publicado' | 'archivado';
type CalendarRecord = {
  id: string;
  titulo: string;
  mes: number;
  anio: number;
  sede: Sede;
  estado: Status;
  imagenUrl: string;
  storagePath: string;
  creadoPorEmail?: string;
  creadoEn?: { toMillis?: () => number };
};

const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const allSites: Array<{ value: Sede; label: string }> = [
  { value: 'TODAS', label: 'Todas / General' },
  { value: 'MMA', label: 'MMA' },
  { value: 'CAUCEL', label: 'Caucel' },
  { value: 'JUAN_PABLO', label: 'Juan Pablo' },
];

export default function AdminCalendarsPage() {
  const firestore = useFirestore();
  const firebaseApp = useFirebaseApp();
  const { user } = useUser();
  const { toast } = useToast();
  const now = new Date();
  const [site, setSite] = useState<Sede>('MMA');
  const [allowedSites, setAllowedSites] = useState<Sede[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [title, setTitle] = useState(`Calendario Albatros · ${months[now.getMonth()]} ${now.getFullYear()}`);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [records, setRecords] = useState<CalendarRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [workingId, setWorkingId] = useState('');

  const loadRecords = async (selectedSite: Sede) => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(firestore, 'Calendarios'), where('sede', '==', selectedSite)));
      const list = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<CalendarRecord, 'id'>) }));
      list.sort((a, b) => (b.creadoEn?.toMillis?.() || 0) - (a.creadoEn?.toMillis?.() || 0));
      setRecords(list);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudieron cargar los calendarios', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const loadProfile = async () => {
      const snapshot = await getDoc(doc(firestore, 'usuarios', user.uid));
      const profile = snapshot.exists() ? normalizarPerfilAcceso(snapshot.data()) : null;
      if (!profile) return;
      const admin = profile.rol === 'admin';
      const sites: Sede[] = admin
        ? ['TODAS', 'MMA', 'CAUCEL', 'JUAN_PABLO']
        : profile.sede && profile.sede !== 'TODAS'
          ? [profile.sede as Sede]
          : [];
      const initial = (localStorage.getItem('userSede') as Sede | null);
      const selected = initial && sites.includes(initial) ? initial : sites[0];
      setIsAdmin(admin);
      setAllowedSites(sites);
      if (selected) setSite(selected);
    };
    void loadProfile();
  }, [firestore, user]);

  useEffect(() => {
    if (allowedSites.includes(site)) void loadRecords(site);
  }, [site, allowedSites]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const current = useMemo(() => records.find((item) => item.estado === 'publicado'), [records]);

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    if (!selected) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) {
      toast({ variant: 'destructive', title: 'Formato no permitido', description: 'Usa una imagen PNG, JPG o WebP.' });
      return;
    }
    if (selected.size > 8 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Imagen demasiado pesada', description: 'El tamaño máximo es de 8 MB.' });
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  const saveDraft = async () => {
    if (!user || !file || !title.trim() || saving) return;
    setSaving(true);
    setProgress(0);
    try {
      const cleanName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
      const path = `calendarios/${site}/${Date.now()}-${cleanName}`;
      const upload = uploadBytesResumable(ref(getStorage(firebaseApp), path), file, { contentType: file.type });
      const imageUrl = await new Promise<string>((resolve, reject) => {
        upload.on('state_changed', (snapshot) => setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)), reject, async () => resolve(await getDownloadURL(upload.snapshot.ref)));
      });
      await addDoc(collection(firestore, 'Calendarios'), {
        titulo: title.trim(), mes: month, anio: year, sede: site,
        estado: 'borrador', imagenUrl: imageUrl, storagePath: path,
        creadoPor: user.uid, creadoPorEmail: user.email || '',
        creadoEn: serverTimestamp(), actualizadoEn: serverTimestamp(),
      });
      setFile(null);
      setPreview('');
      toast({ title: 'Borrador guardado', description: 'Revísalo y publícalo cuando esté listo.' });
      await loadRecords(site);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo subir el calendario', description: error instanceof Error ? error.message : 'Revisa los permisos de Storage.' });
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const publish = async (record: CalendarRecord) => {
    if (!user || workingId) return;
    setWorkingId(record.id);
    try {
      const batch = writeBatch(firestore);
      records.filter((item) => item.estado === 'publicado' && item.id !== record.id).forEach((item) => {
        batch.update(doc(firestore, 'Calendarios', item.id), { estado: 'archivado', actualizadoEn: serverTimestamp() });
      });
      batch.update(doc(firestore, 'Calendarios', record.id), { estado: 'publicado', publicadoPor: user.uid, publicadoEn: serverTimestamp(), actualizadoEn: serverTimestamp() });
      batch.set(doc(firestore, 'CalendariosActuales', site), { calendarioId: record.id, sede: site, actualizadoPor: user.uid, actualizadoEn: serverTimestamp() });
      await batch.commit();
      toast({ title: 'Calendario publicado', description: 'Ya está visible en la página pública.' });
      await loadRecords(site);
    } catch (error) {
      toast({ variant: 'destructive', title: 'No se pudo publicar', description: error instanceof Error ? error.message : 'Inténtalo nuevamente.' });
    } finally {
      setWorkingId('');
    }
  };

  const archive = async (record: CalendarRecord) => {
    if (!user || workingId) return;
    setWorkingId(record.id);
    try {
      await updateDoc(doc(firestore, 'Calendarios', record.id), { estado: 'archivado', actualizadoEn: serverTimestamp() });
      const pointerRef = doc(firestore, 'CalendariosActuales', site);
      const pointer = await getDoc(pointerRef);
      if (pointer.exists() && pointer.data().calendarioId === record.id) await deleteDoc(pointerRef);
      toast({ title: 'Calendario archivado', description: 'La imagen de respaldo se mostrará hasta publicar otro.' });
      await loadRecords(site);
    } finally {
      setWorkingId('');
    }
  };

  const remove = async (record: CalendarRecord) => {
    if (!isAdmin || record.estado === 'publicado' || workingId) return;
    if (!window.confirm(`¿Eliminar definitivamente “${record.titulo}”?`)) return;
    setWorkingId(record.id);
    try {
      if (record.storagePath) {
        try { await deleteObject(ref(getStorage(firebaseApp), record.storagePath)); } catch { /* El registro puede sobrevivir a una imagen ya eliminada. */ }
      }
      await deleteDoc(doc(firestore, 'Calendarios', record.id));
      toast({ title: 'Calendario eliminado' });
      await loadRecords(site);
    } finally {
      setWorkingId('');
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary"><CalendarDays className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-[0.2em]">Programación</span></div>
          <h1 className="text-3xl font-black uppercase italic tracking-tighter sm:text-4xl">Calendarios</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sube, revisa y publica el plan mensual sin volver a desplegar la web.</p>
        </div>
        {current && <Badge className="w-fit gap-2 bg-green-500/10 text-green-500 hover:bg-green-500/10"><CheckCircle2 className="h-4 w-4" /> Publicado: {current.titulo}</Badge>}
      </header>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card className="h-fit border-primary/15">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Plus className="h-5 w-5 text-primary" /> Nuevo calendario</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label>Sede</Label><select value={site} onChange={(e) => setSite(e.target.value as Sede)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-bold">{allSites.filter((item) => allowedSites.includes(item.value)).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
            <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Mes</Label><select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-11 w-full rounded-xl border bg-background px-3 text-sm">{months.map((item, index) => <option key={item} value={index + 1}>{item}</option>)}</select></div>
              <div className="space-y-2"><Label>Año</Label><Input type="number" min={2026} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} /></div>
            </div>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-6 text-center transition-colors hover:bg-primary/[0.07]">
              <UploadCloud className="mb-3 h-8 w-8 text-primary" /><span className="text-sm font-black uppercase">Seleccionar imagen</span><span className="mt-1 text-xs text-muted-foreground">PNG, JPG o WebP · máximo 8 MB</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} className="sr-only" />
            </label>
            {preview && <div className="overflow-hidden rounded-xl border"><Image src={preview} alt="Vista previa" width={800} height={600} unoptimized className="h-auto w-full" /></div>}
            <Button className="w-full font-black uppercase" disabled={!file || !title.trim() || saving || allowedSites.length === 0} onClick={saveDraft}>{saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo {progress}%</> : <><FileImage className="mr-2 h-4 w-4" /> Guardar borrador</>}</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black uppercase">Historial · {allSites.find((item) => item.value === site)?.label}</h2><Badge variant="outline">{records.length} registros</Badge></div>
          {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : records.length === 0 ? <Card><CardContent className="grid min-h-64 place-items-center text-center text-muted-foreground"><div><CalendarDays className="mx-auto mb-3 h-9 w-9 opacity-30" /><p className="font-bold">Todavía no hay calendarios para esta sede.</p></div></CardContent></Card> : <div className="grid gap-4 md:grid-cols-2">{records.map((record) => <Card key={record.id} className={record.estado === 'publicado' ? 'border-green-500/35' : 'border-border'}><div className="relative aspect-[4/3] overflow-hidden rounded-t-xl bg-black"><Image src={record.imagenUrl} alt={record.titulo} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" /></div><CardContent className="space-y-4 p-4"><div><div className="mb-2 flex items-center justify-between gap-2"><Badge variant={record.estado === 'publicado' ? 'default' : 'outline'} className={record.estado === 'publicado' ? 'bg-green-600' : ''}>{record.estado}</Badge><span className="text-[10px] font-bold uppercase text-muted-foreground">{months[record.mes - 1]} {record.anio}</span></div><h3 className="font-black leading-tight">{record.titulo}</h3>{record.creadoPorEmail && <p className="mt-1 truncate text-xs text-muted-foreground">Subido por {record.creadoPorEmail}</p>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" asChild><a href={record.imagenUrl} target="_blank" rel="noopener noreferrer"><Eye className="mr-1 h-4 w-4" /> Ver</a></Button>{record.estado !== 'publicado' && <Button size="sm" onClick={() => publish(record)} disabled={!!workingId}>{workingId === record.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />} Publicar</Button>}{record.estado === 'publicado' && <Button size="sm" variant="outline" onClick={() => archive(record)} disabled={!!workingId}><Archive className="mr-1 h-4 w-4" /> Archivar</Button>}{isAdmin && record.estado !== 'publicado' && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(record)} disabled={!!workingId} aria-label="Eliminar calendario"><Trash2 className="h-4 w-4" /></Button>}</div></CardContent></Card>)}</div>}
        </div>
      </div>
    </div>
  );
}

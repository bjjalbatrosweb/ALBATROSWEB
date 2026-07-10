'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Plus, Trash2, Phone, DollarSign, AlertCircle, Pencil, CreditCard, CalendarCheck, CalendarDays, Clock, RotateCcw, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, where, addDoc, deleteDoc } from 'firebase/firestore';
import { deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type PaymentStatus = 'Pagado' | 'Falta de Pago' | 'Retraso';

type AdminAlumno = {
  id: string;
  rfid?: string;
  nombre: string;
  telefono: string;
  diaPago: number;
  esAfiliado: boolean;
  descuento: number;
  montoPago: number;
  estadoPago: PaymentStatus;
  fechaRegistro: any;
};

type Asistencia = {
    id: string;
    alumnoId: string;
    fecha: any;
};

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminAlumno | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkingStudentId, setLinkingStudentId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const firestore = useFirestore();

  const [newStudent, setNewStudent] = useState({
    nombre: '',
    rfid: '',
    telefono: '',
    diaPago: 1,
    esAfiliado: false,
    descuento: 0,
    montoPago: 600,
    estadoPago: 'Falta de Pago' as PaymentStatus,
  });

  const alumnosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'Alumnos'), orderBy('nombre', 'asc'));
  }, [firestore]);

  const { data: alumnos, isLoading: isLoadingAlumnos } = useCollection<AdminAlumno>(alumnosQuery);

  const startOfMonthDate = useMemo(() => {
      const d = new Date();
      d.setDate(1);
      d.setHours(0, 0, 0, 0);
      return d;
  }, []);

  const asistenciasQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'Asistencias'),
          where('fecha', '>=', startOfMonthDate)
      );
  }, [firestore, startOfMonthDate]);

  const { data: asistencias, isLoading: isLoadingAsistencias } = useCollection<Asistencia>(asistenciasQuery);

  const todayDay = new Date().getDate();

  useEffect(() => {
    if (linkingStudentId && alumnos) {
      const student = alumnos.find(a => a.id === linkingStudentId);
      if (student?.rfid) {
        setIsLinking(false);
        setLinkingStudentId(null);
        toast({ 
          title: "¡Vinculación Exitosa!", 
          description: `La tarjeta ha sido asignada correctamente a ${student.nombre}.` 
        });
      }
    }
  }, [alumnos, linkingStudentId, toast]);

  const getAutomaticStatus = (alumno: AdminAlumno): PaymentStatus => {
    if (alumno.estadoPago === 'Pagado') return 'Pagado';
    if (todayDay > alumno.diaPago + 5) return 'Retraso';
    if (todayDay > alumno.diaPago) return 'Falta de Pago';
    return alumno.estadoPago || 'Falta de Pago';
  };

  useEffect(() => {
    if (!alumnos || !firestore) return;
    alumnos.forEach(alumno => {
      const autoStatus = getAutomaticStatus(alumno);
      if (alumno.estadoPago !== autoStatus && alumno.estadoPago !== 'Pagado') {
        const docRef = doc(firestore, 'Alumnos', alumno.id);
        updateDocumentNonBlocking(docRef, { estadoPago: autoStatus });
      }
    });
  }, [alumnos, firestore, todayDay]);

  const filteredAlumnos = useMemo(() => {
    if (!alumnos) return [];
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.rfid && a.rfid.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [alumnos, searchTerm]);

  const attendanceDataMap = useMemo(() => {
      const map: Record<string, { count: number, history: Date[] }> = {};
      asistencias?.forEach(as => {
          if (!map[as.alumnoId]) {
              map[as.alumnoId] = { count: 0, history: [] };
          }
          
          const date = as.fecha?.toDate ? as.fecha.toDate() : new Date(as.fecha);
          const dayKey = format(date, 'yyyy-MM-dd');
          
          const alreadyRegisteredToday = map[as.alumnoId].history.some(d => format(d, 'yyyy-MM-dd') === dayKey);
          
          if (!alreadyRegisteredToday) {
              map[as.alumnoId].count += 1;
              map[as.alumnoId].history.push(date);
          }
      });

      Object.keys(map).forEach(id => {
          map[id].history.sort((a, b) => b.getTime() - a.getTime());
      });

      return map;
  }, [asistencias]);

  const handleStartVinculation = async (studentId: string, nombre: string) => {
    setIsLinking(true);
    setLinkingStudentId(studentId);
    try {
        const res = await fetch('/api/rfid/solicitar-vinculacion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alumnoId: studentId, dispositivo: 'Recepcion' })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.mensaje || "Error en el servidor");
        }

        const data = await res.json();
        if (data.ok) {
            toast({
                title: "Protocolo Iniciado",
                description: `Acerca la TARJETA MAESTRA al lector de Recepción para vincular a ${nombre}.`,
            });
            setTimeout(() => {
                setIsLinking(false);
                setLinkingStudentId(null);
            }, 60000);
        } else {
            throw new Error(data.mensaje || "Error al solicitar vinculación");
        }
    } catch (e: any) {
        setIsLinking(false);
        setLinkingStudentId(null);
        toast({ 
            variant: "destructive", 
            title: "Fallo de Comunicación", 
            description: e.message || "No se pudo conectar con el sistema de hardware." 
        });
    }
  };

  const handleAddStudent = async (autoLink = false) => {
    if (!firestore) return null;
    if (!newStudent.nombre) {
        toast({ variant: "destructive", title: "Error", description: "El nombre es obligatorio." });
        return null;
    }
    
    try {
        const docRef = await addDoc(collection(firestore, 'Alumnos'), {
            ...newStudent,
            rfid: newStudent.rfid ? newStudent.rfid.replace(/\s+/g, '').toUpperCase() : "",
            fechaRegistro: new Date().toISOString(),
        });
        
        if (!autoLink) {
            toast({ title: "Alumno Registrado", description: `${newStudent.nombre} ha sido añadido al equipo.` });
            setIsAddDialogOpen(false);
            setNewStudent({ nombre: '', rfid: '', telefono: '', diaPago: 1, esAfiliado: false, descuento: 0, montoPago: 600, estadoPago: 'Falta de Pago' });
        }
        return docRef.id;
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "No se pudo crear el registro." });
        return null;
    }
  };

  const handleVincularNuevo = async () => {
    const studentId = await handleAddStudent(true);
    if (studentId) {
        await handleStartVinculation(studentId, newStudent.nombre);
    }
  };

  const handleOpenEditDialog = (alumno: AdminAlumno) => {
    setEditingStudent(alumno);
    setIsEditDialogOpen(true);
  };

  const handleUpdateStudent = () => {
    if (!firestore || !editingStudent) return;
    const docRef = doc(firestore, 'Alumnos', editingStudent.id);
    const { id, ...updateData } = editingStudent;
    
    if (updateData.rfid) {
        updateData.rfid = updateData.rfid.replace(/\s+/g, '').toUpperCase();
    }

    updateDocumentNonBlocking(docRef, updateData);
    toast({ title: "Registro Actualizado", description: `La información de ${editingStudent.nombre} ha sido guardada.` });
    setIsEditDialogOpen(false);
    setEditingStudent(null);
  };

  const handleUpdateStatus = (
    id: string,
    newStatus: PaymentStatus
  ) => {
    if (!firestore) return;
  
    const alumnoRef = doc(
      firestore,
      'Alumnos',
      id
    );
  
    if (newStatus === 'Pagado') {
      updateDocumentNonBlocking(alumnoRef, {
        estadoPago: 'Pagado',
        fechaUltimoPago: new Date(),
      });
    } else {
      updateDocumentNonBlocking(alumnoRef, {
        estadoPago: newStatus,
      });
    }
  
    toast({
      title: 'Estado Actualizado',
      description: `Estado cambiado a ${newStatus}.`,
    });
  };

  const handleDeleteIndividual = (id: string, nombre: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'Alumnos', id));
    toast({ title: "Registro Eliminado", description: `${nombre} ha sido removido del sistema.` });
  };

  const handleResetMonthlyAttendance = async () => {
    if (!firestore || !asistencias || asistencias.length === 0) {
        toast({ title: "Sin datos", description: "No hay asistencias registradas este mes." });
        return;
    }
    try {
        const promises = asistencias.map(as => deleteDoc(doc(firestore, 'Asistencias', as.id)));
        await Promise.all(promises);
        toast({ title: "Contador Reiniciado", description: "Todas las asistencias del mes han sido borradas." });
    } catch (e) {
        toast({ variant: "destructive", title: "Error", description: "No se pudieron borrar los registros." });
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAlumnos.length) setSelectedIds([]);
    else setSelectedIds(filteredAlumnos.map(a => a.id));
  };

  const getStatusBadge = (alumno: AdminAlumno) => {
    const status = getAutomaticStatus(alumno);
    switch (status) {
      case 'Pagado': return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-black uppercase text-[10px] italic">PAGADO</Badge>;
      case 'Retraso': return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-black uppercase text-[10px] italic animate-pulse">RETRASO</Badge>;
      default: return <Badge variant="outline" className="text-muted-foreground font-bold uppercase text-[10px] italic">FALTA PAGO</Badge>;
    }
  };

  const isLoading = isLoadingAlumnos || isLoadingAsistencias;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-primary">Gestión Administración</h1>
          <p className="text-muted-foreground">Control táctico del equipo Albatros BJJ.</p>
        </div>
        
        <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="font-bold uppercase tracking-widest">
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Atleta
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic">Registrar Nuevo Atleta</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input id="name" value={newStudent.nombre} onChange={e => setNewStudent({...newStudent, nombre: e.target.value})} placeholder="Ej. Juan Perez" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="rfid" className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4 text-primary" /> Código RFID
                            </Label>
                            <div className="flex gap-2">
                                <Input id="rfid" value={newStudent.rfid} onChange={e => setNewStudent({...newStudent, rfid: e.target.value})} placeholder="UID o espera vinculación..." className="bg-background/50 font-mono text-xs" />
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    type="button" 
                                    className="font-bold uppercase text-[10px]"
                                    disabled={isLinking || !newStudent.nombre}
                                    onClick={handleVincularNuevo}
                                >
                                    {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                                    {isLinking ? "Buscando..." : "Vincular"}
                                </Button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input id="phone" value={newStudent.telefono} onChange={e => setNewStudent({...newStudent, telefono: e.target.value})} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="payday">Día de Pago (1-31)</Label>
                                <Input id="payday" type="number" min="1" max="31" value={newStudent.diaPago} onChange={e => setNewStudent({...newStudent, diaPago: parseInt(e.target.value)})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="amount">Monto Pago ($)</Label>
                                <Input id="amount" type="number" value={newStudent.montoPago} onChange={e => setNewStudent({...newStudent, montoPago: parseInt(e.target.value)})} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">Estado Inicial</Label>
                                <Select value={newStudent.estadoPago} onValueChange={(val: PaymentStatus) => setNewStudent({...newStudent, estadoPago: val})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Falta de Pago">Pendiente</SelectItem>
                                        <SelectItem value="Pagado">Pagado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full font-bold uppercase" onClick={() => handleAddStudent()}>Guardar Registro</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Atletas Activos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{isLoading ? '...' : alumnos?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Asistencias Totales (Mes)</CardTitle>
            <div className="flex items-center gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 text-muted-foreground hover:text-primary transition-all active:scale-90" 
                    onClick={handleResetMonthlyAttendance}
                    title="Reiniciar asistencias del mes"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                </Button>
                <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{isLoading ? '...' : asistencias?.length || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Recaudación</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">${alumnos?.filter(a => getAutomaticStatus(a) === 'Pagado').reduce((acc, curr) => acc + (curr.montoPago || 0), 0).toLocaleString() || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Retrasos</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-destructive">
                {alumnos?.filter(a => getAutomaticStatus(a) === 'Retraso').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/40 border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase italic">Base de Datos de Alumnos</CardTitle>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre o RFID..." 
                className="pl-8 bg-background/50 border-primary/10" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden bg-background/20 backdrop-blur-sm">
                <Table>
                    <TableHeader className="bg-secondary/50">
                        <TableRow className="border-primary/10">
                            <TableHead className="w-[40px]">
                                <Checkbox checked={selectedIds.length === filteredAlumnos.length && filteredAlumnos.length > 0} onCheckedChange={toggleSelectAll} />
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary">Atleta</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center">Estado Pago</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center w-[200px]">Asistencia (Mes)</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-center">Día Pago</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-right">Monto</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] tracking-widest text-primary text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAlumnos.map((alumno) => {
                            const attendance = attendanceDataMap[alumno.id] || { count: 0, history: [] };
                            const attendanceCount = attendance.count;
                            const attendancePercent = Math.min((attendanceCount / 12) * 100, 100);
                            const currentlyLinking = isLinking && linkingStudentId === alumno.id;
                            
                            return (
                                <TableRow key={alumno.id} className="hover:bg-primary/5 transition-colors border-primary/5">
                                    <TableCell>
                                        <Checkbox checked={selectedIds.includes(alumno.id)} onCheckedChange={() => toggleSelection(alumno.id)} />
                                    </TableCell>
                                    <TableCell className="font-bold uppercase text-xs">
                                        <div className="flex items-center gap-2">{alumno.nombre}</div>
                                        <div className="space-y-0.5 mt-1">
                                            <span className="flex items-center gap-1 text-[8px] text-muted-foreground font-mono">
                                                <Phone className="h-2 w-2" /> {alumno.telefono || 'Sin tel'}
                                            </span>
                                            {alumno.rfid ? (
                                                <span className="flex items-center gap-1 text-[8px] text-green-500 font-mono">
                                                    <CreditCard className="h-2 w-2" /> RFID: {alumno.rfid}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[8px] text-destructive/50 font-mono italic">
                                                    <AlertCircle className="h-2 w-2" /> Sin tarjeta vinculada
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Select 
                                            value={getAutomaticStatus(alumno)} 
                                            onValueChange={(val: PaymentStatus) => handleUpdateStatus(alumno.id, val)}
                                        >
                                            <SelectTrigger className="w-fit mx-auto h-7 border-none bg-transparent hover:bg-secondary/30 transition-colors">
                                                {getStatusBadge(alumno)}
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Pagado">Marcar: Pagado</SelectItem>
                                                <SelectItem value="Falta de Pago">Marcar: Pendiente</SelectItem>
                                                <SelectItem value="Retraso">Marcar: Retraso</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex justify-between items-center text-[8px] font-black uppercase italic">
                                                <div className="flex items-center gap-2">
                                                    <span>Puntos: {attendanceCount}/12</span>
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary hover:bg-primary/20">
                                                                <CalendarDays className="h-3 w-3" />
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-0 bg-card border-primary/20" align="start">
                                                            <div className="p-3 border-b border-primary/10 bg-secondary/30 flex items-center justify-between">
                                                                <p className="text-[10px] font-black uppercase italic text-primary">Log de Asistencias (Mes)</p>
                                                                <Badge variant="outline" className="text-[8px] font-bold border-primary/20">{attendanceCount}/12</Badge>
                                                            </div>
                                                            <ScrollArea className="h-48">
                                                                <div className="p-2 space-y-1">
                                                                    {attendance.history.length > 0 ? (
                                                                        attendance.history.map((date, idx) => (
                                                                            <div key={idx} className="flex items-center justify-between p-2 rounded bg-primary/5 border border-primary/5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <CalendarDays className="h-3 w-3 text-primary/50" />
                                                                                    <span className="text-[10px] font-bold uppercase">{format(date, 'dd MMM yyyy', { locale: es })}</span>
                                                                                </div>
                                                                                <div className="flex items-center gap-1 text-primary">
                                                                                    <Clock className="h-3 w-3" />
                                                                                    <span className="text-[10px] font-mono font-black">{format(date, 'HH:mm')}</span>
                                                                                </div>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="py-8 text-center">
                                                                            <p className="text-[10px] text-muted-foreground italic uppercase">Sin registros este mes</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </ScrollArea>
                                                            <div className="p-2 bg-background/50 border-t border-primary/10 text-center">
                                                                <p className="text-[8px] font-bold uppercase italic text-muted-foreground tracking-widest">Albatros Tactical Logger</p>
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <span className={cn(attendancePercent >= 100 ? "text-primary" : "text-muted-foreground")}>{Math.round(attendancePercent)}%</span>
                                            </div>
                                            <Progress value={attendancePercent} className="h-1.5 bg-primary/10" />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={cn(
                                            "font-black border-primary/20 bg-background/40",
                                            todayDay > alumno.diaPago && getAutomaticStatus(alumno) !== 'Pagado' ? "text-destructive border-destructive/40" : "text-primary"
                                        )}>
                                            {alumno.diaPago}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-xs text-foreground/80">${alumno.montoPago}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className={cn("h-8 w-8 hover:text-green-500 hover:bg-green-500/10", currentlyLinking && "animate-pulse text-green-500")} 
                                                onClick={() => handleStartVinculation(alumno.id, alumno.nombre)}
                                                disabled={isLinking}
                                                title="Iniciar vinculación RFID"
                                            >
                                                {currentlyLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary hover:bg-primary/10" onClick={() => handleOpenEditDialog(alumno)}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleDeleteIndividual(alumno.id, alumno.nombre)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogo de Edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic text-primary">Editar Atleta</DialogTitle>
            </DialogHeader>
            {editingStudent && (
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-name">Nombre Completo</Label>
                        <Input id="edit-name" value={editingStudent.nombre} onChange={e => setEditingStudent({...editingStudent, nombre: e.target.value})} className="bg-background/50 border-primary/10" />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-rfid" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" /> Código RFID
                        </Label>
                        <div className="flex gap-2">
                            <Input id="edit-rfid" value={editingStudent.rfid || ''} onChange={e => setEditingStudent({...editingStudent, rfid: e.target.value})} className="bg-background/50 border-primary/10 font-mono text-xs" />
                            <Button 
                                variant="outline" 
                                size="sm" 
                                type="button" 
                                className="font-bold uppercase text-[10px]"
                                disabled={isLinking}
                                onClick={() => handleStartVinculation(editingStudent.id, editingStudent.nombre)}
                            >
                                {isLinking && linkingStudentId === editingStudent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3 mr-1" />}
                                {isLinking && linkingStudentId === editingStudent.id ? "Buscando..." : "Vincular"}
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-phone">Teléfono</Label>
                            <Input id="edit-phone" value={editingStudent.telefono} onChange={e => setEditingStudent({...editingStudent, telefono: e.target.value})} className="bg-background/50 border-primary/10" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-payday">Día de Pago</Label>
                            <Input id="edit-payday" type="number" min="1" max="31" value={editingStudent.diaPago} onChange={e => setEditingStudent({...editingStudent, diaPago: parseInt(e.target.value)})} className="bg-background/50 border-primary/10" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-amount">Monto Pago ($)</Label>
                            <Input id="edit-amount" type="number" value={editingStudent.montoPago} onChange={e => setEditingStudent({...editingStudent, montoPago: parseInt(e.target.value)})} className="bg-background/50 border-primary/10" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-status">Estado de Pago</Label>
                            <Select value={editingStudent.estadoPago} onValueChange={(val: PaymentStatus) => setEditingStudent({...editingStudent, estadoPago: val})}>
                                <SelectTrigger className="bg-background/50 border-primary/10"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Falta de Pago">Pendiente</SelectItem>
                                    <SelectItem value="Pagado">Pagado</SelectItem>
                                    <SelectItem value="Retraso">Retraso</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="edit-affiliate" checked={editingStudent.esAfiliado} onCheckedChange={(checked) => setEditingStudent({...editingStudent, esAfiliado: checked as boolean})} />
                        <Label htmlFor="edit-affiliate" className="text-sm font-bold uppercase italic cursor-pointer">¿Es Afiliado Albatros?</Label>
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button className="w-full font-bold uppercase tracking-widest shadow-lg shadow-primary/20" onClick={handleUpdateStudent}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

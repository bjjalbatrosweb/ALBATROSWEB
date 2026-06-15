
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Search, Plus, Trash2, CheckCircle2, XCircle, Phone, DollarSign, AlertCircle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

type PaymentStatus = 'Pagado' | 'Falta de Pago' | 'Retraso';

type AdminAlumno = {
  id: string;
  nombre: string;
  telefono: string;
  diaPago: number;
  esAfiliado: boolean;
  descuento: number;
  montoPago: number;
  estadoPago: PaymentStatus;
  fechaRegistro: any;
};

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<AdminAlumno | null>(null);
  
  const { toast } = useToast();
  const firestore = useFirestore();

  // New Student Form State
  const [newStudent, setNewStudent] = useState({
    nombre: '',
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

  const { data: alumnos, isLoading } = useCollection<AdminAlumno>(alumnosQuery);

  const todayDay = new Date().getDate();

  const filteredAlumnos = useMemo(() => {
    if (!alumnos) return [];
    return alumnos.filter(a => 
      a.nombre.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [alumnos, searchTerm]);

  const handleAddStudent = () => {
    if (!firestore) return;
    if (!newStudent.nombre) {
        toast({ variant: "destructive", title: "Error", description: "El nombre es obligatorio." });
        return;
    }

    addDocumentNonBlocking(collection(firestore, 'Alumnos'), {
      ...newStudent,
      fechaRegistro: new Date().toISOString(),
    });

    toast({ title: "Alumno Registrado", description: `${newStudent.nombre} ha sido añadido al equipo.` });
    setIsAddDialogOpen(false);
    setNewStudent({ nombre: '', telefono: '', diaPago: 1, esAfiliado: false, descuento: 0, montoPago: 600, estadoPago: 'Falta de Pago' });
  };

  const handleOpenEditDialog = (alumno: AdminAlumno) => {
    setEditingStudent(alumno);
    setIsEditDialogOpen(true);
  };

  const handleUpdateStudent = () => {
    if (!firestore || !editingStudent) return;
    if (!editingStudent.nombre) {
        toast({ variant: "destructive", title: "Error", description: "El nombre es obligatorio." });
        return;
    }

    const docRef = doc(firestore, 'Alumnos', editingStudent.id);
    const { id, ...updateData } = editingStudent;
    
    updateDocumentNonBlocking(docRef, updateData);

    toast({ title: "Registro Actualizado", description: `La información de ${editingStudent.nombre} ha sido guardada.` });
    setIsEditDialogOpen(false);
    setEditingStudent(null);
  };

  const handleUpdateStatus = (id: string, newStatus: PaymentStatus) => {
    if (!firestore) return;
    const docRef = doc(firestore, 'Alumnos', id);
    updateDocumentNonBlocking(docRef, { estadoPago: newStatus });
    toast({ title: "Estado Actualizado", description: `Estado cambiado a ${newStatus}.` });
  };

  const handleDeleteIndividual = (id: string, nombre: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'Alumnos', id));
    toast({ title: "Registro Eliminado", description: `${nombre} ha sido removido del sistema.` });
  };

  const handleDeleteBatch = () => {
    if (!firestore || selectedIds.length === 0) return;
    
    selectedIds.forEach(id => {
      deleteDocumentNonBlocking(doc(firestore, 'Alumnos', id));
    });

    toast({ title: "Eliminación Masiva", description: `${selectedIds.length} registros eliminados.` });
    setSelectedIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredAlumnos.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredAlumnos.map(a => a.id));
    }
  };

  const getStatusBadge = (alumno: AdminAlumno) => {
    let displayStatus = alumno.estadoPago || 'Falta de Pago';
    const isOverdue = todayDay > alumno.diaPago && displayStatus === 'Falta de Pago';
    
    if (isOverdue) displayStatus = 'Retraso';

    switch (displayStatus) {
      case 'Pagado':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 font-black uppercase text-[10px] italic">PAGADO</Badge>;
      case 'Retraso':
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 font-black uppercase text-[10px] italic animate-pulse">RETRASO</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground font-bold uppercase text-[10px] italic">FALTA PAGO</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic">Gestión Administración</h1>
          <p className="text-muted-foreground">Control táctico del equipo Albatros BJJ.</p>
        </div>
        
        <div className="flex gap-2">
            {selectedIds.length > 0 && (
                <Button variant="destructive" className="font-bold uppercase tracking-widest" onClick={handleDeleteBatch}>
                    <Trash2 className="mr-2 h-4 w-4" /> Eliminar ({selectedIds.length})
                </Button>
            )}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="font-bold uppercase tracking-widest">
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Atleta
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black uppercase italic">Registrar Nuevo Atleta</DialogTitle>
                        <DialogDescription>Añade un nuevo miembro al arsenal del equipo.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nombre Completo</Label>
                            <Input id="name" value={newStudent.nombre} onChange={e => setNewStudent({...newStudent, nombre: e.target.value})} placeholder="Ej. Juan Perez" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Teléfono</Label>
                                <Input id="phone" value={newStudent.telefono} onChange={e => setNewStudent({...newStudent, telefono: e.target.value})} placeholder="999..." />
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
                                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Falta de Pago">Falta de Pago</SelectItem>
                                        <SelectItem value="Pagado">Pagado</SelectItem>
                                        <SelectItem value="Retraso">Retraso</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid gap-2">
                             <Label htmlFor="discount">Descuento (%)</Label>
                             <Input id="discount" type="number" value={newStudent.descuento} onChange={e => setNewStudent({...newStudent, descuento: parseInt(e.target.value)})} />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Checkbox id="affiliate" checked={newStudent.esAfiliado} onCheckedChange={(checked) => setNewStudent({...newStudent, esAfiliado: checked as boolean})} />
                            <Label htmlFor="affiliate" className="text-sm font-bold uppercase italic cursor-pointer">¿Es Afiliado Albatros?</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button className="w-full font-bold uppercase" onClick={handleAddStudent}>Guardar Registro</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Atletas Activos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{isLoading ? '...' : alumnos?.length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total registrados en sistema</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Morosidad</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-destructive">
                {alumnos?.filter(a => (a.estadoPago === 'Retraso' || (todayDay > a.diaPago && a.estadoPago !== 'Pagado'))).length || 0}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Atletas con pagos pendientes</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Recaudación Proyectada</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">${alumnos?.reduce((acc, curr) => acc + (curr.montoPago || 0), 0).toLocaleString() || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Basado en montos actuales</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Estatus Afiliados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{alumnos?.filter(a => a.esAfiliado).length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Miembros oficiales del nido</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="bg-card/40 border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase italic">Base de Datos de Alumnos</CardTitle>
              <CardDescription>Consulta, edición y control de pagos del equipo.</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por nombre..." 
                className="pl-8 bg-background/50" 
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
          ) : filteredAlumnos.length === 0 ? (
            <div className="border rounded-md min-h-[300px] flex flex-col items-center justify-center bg-background/30 italic text-muted-foreground gap-4">
              <Users className="h-12 w-12 opacity-20" />
              <p>No hay alumnos registrados que coincidan con la búsqueda.</p>
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
                <Table>
                    <TableHeader className="bg-secondary/50">
                        <TableRow>
                            <TableHead className="w-[40px]">
                                <Checkbox checked={selectedIds.length === filteredAlumnos.length && filteredAlumnos.length > 0} onCheckedChange={toggleSelectAll} />
                            </TableHead>
                            <TableHead className="font-bold uppercase text-[10px]">Nombre</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-center">Estado Pago</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-center">Día Pago</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-center">Afiliado</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">Monto</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAlumnos.map((alumno) => (
                            <TableRow key={alumno.id} className="hover:bg-primary/5 transition-colors">
                                <TableCell>
                                    <Checkbox checked={selectedIds.includes(alumno.id)} onCheckedChange={() => toggleSelection(alumno.id)} />
                                </TableCell>
                                <TableCell className="font-bold uppercase text-xs">
                                    {alumno.nombre}
                                    <span className="block text-[8px] text-muted-foreground font-mono mt-0.5">{alumno.telefono || 'Sin teléfono'}</span>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Select 
                                        defaultValue={alumno.estadoPago || 'Falta de Pago'} 
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
                                <TableCell className="text-center">
                                    <Badge variant="outline" className={cn(
                                        "font-black border-primary/20",
                                        todayDay > alumno.diaPago && alumno.estadoPago !== 'Pagado' ? "text-destructive border-destructive/40" : "text-primary"
                                    )}>
                                        {alumno.diaPago}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    {alumno.esAfiliado ? (
                                        <CheckCircle2 className="h-4 w-4 text-primary mx-auto" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                                    )}
                                </TableCell>
                                <TableCell className="text-right font-black text-xs">
                                    ${alumno.montoPago}
                                    {alumno.descuento > 0 && <span className="block text-[8px] text-primary">-{alumno.descuento}% desc</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-primary" onClick={() => handleOpenEditDialog(alumno)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="hover:text-destructive h-8 w-8" onClick={() => handleDeleteIndividual(alumno.id, alumno.nombre)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-primary/20">
            <DialogHeader>
                <DialogTitle className="text-xl font-black uppercase italic">Editar Atleta</DialogTitle>
                <DialogDescription>Modifica los parámetros del arsenal del equipo.</DialogDescription>
            </DialogHeader>
            {editingStudent && (
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="edit-name">Nombre Completo</Label>
                        <Input id="edit-name" value={editingStudent.nombre} onChange={e => setEditingStudent({...editingStudent, nombre: e.target.value})} placeholder="Ej. Juan Perez" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-phone">Teléfono</Label>
                            <Input id="edit-phone" value={editingStudent.telefono} onChange={e => setEditingStudent({...editingStudent, telefono: e.target.value})} placeholder="999..." />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-payday">Día de Pago (1-31)</Label>
                            <Input id="edit-payday" type="number" min="1" max="31" value={editingStudent.diaPago} onChange={e => setEditingStudent({...editingStudent, diaPago: parseInt(e.target.value)})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-amount">Monto Pago ($)</Label>
                            <Input id="edit-amount" type="number" value={editingStudent.montoPago} onChange={e => setEditingStudent({...editingStudent, montoPago: parseInt(e.target.value)})} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-status">Estado de Pago</Label>
                            <Select value={editingStudent.estadoPago} onValueChange={(val: PaymentStatus) => setEditingStudent({...editingStudent, estadoPago: val})}>
                                <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Falta de Pago">Falta de Pago</SelectItem>
                                    <SelectItem value="Pagado">Pagado</SelectItem>
                                    <SelectItem value="Retraso">Retraso</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="edit-discount">Descuento (%)</Label>
                        <Input id="edit-discount" type="number" value={editingStudent.descuento} onChange={e => setEditingStudent({...editingStudent, descuento: parseInt(e.target.value)})} />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="edit-affiliate" checked={editingStudent.esAfiliado} onCheckedChange={(checked) => setEditingStudent({...editingStudent, esAfiliado: checked as boolean})} />
                        <Label htmlFor="edit-affiliate" className="text-sm font-bold uppercase italic cursor-pointer">¿Es Afiliado Albatros?</Label>
                    </div>
                </div>
            )}
            <DialogFooter>
                <Button className="w-full font-bold uppercase" onClick={handleUpdateStudent}>Guardar Cambios</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

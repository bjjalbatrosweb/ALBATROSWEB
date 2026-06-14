
'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, Calendar, TrendingUp, Search, Plus, Trash2, CheckCircle2, XCircle, UserPlus, Phone, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

type AdminAlumno = {
  id: string;
  nombre: string;
  telefono: string;
  diaPago: number;
  esAfiliado: boolean;
  descuento: number;
  montoPago: number;
  fechaRegistro: any;
};

export default function AdminDashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
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
  });

  const alumnosQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'Alumnos'), orderBy('nombre', 'asc'));
  }, [firestore]);

  const { data: alumnos, isLoading } = useCollection<AdminAlumno>(alumnosQuery);

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
    setNewStudent({ nombre: '', telefono: '', diaPago: 1, esAfiliado: false, descuento: 0, montoPago: 600 });
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
                                <Label htmlFor="discount">Descuento (%)</Label>
                                <Input id="discount" type="number" value={newStudent.descuento} onChange={e => setNewStudent({...newStudent, descuento: parseInt(e.target.value)})} />
                            </div>
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
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Afiliados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">{alumnos?.filter(a => a.esAfiliado).length || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Atletas con estatus oficial</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Recaudación Proyectada</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">${alumnos?.reduce((acc, curr) => acc + curr.montoPago, 0).toLocaleString() || 0}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Basado en montos actuales</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Rendimiento Equipo</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">+100%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Crecimiento operativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <Card className="bg-card/40 border-primary/10">
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-black uppercase italic">Base de Datos de Alumnos</CardTitle>
              <CardDescription>Consulta, edición y depuración de perfiles tácticos.</CardDescription>
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
                            <TableHead className="font-bold uppercase text-[10px]">Teléfono</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-center">Día Pago</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-center">Afiliado</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">Monto</TableHead>
                            <TableHead className="font-bold uppercase text-[10px] text-right">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredAlumnos.map((alumno) => (
                            <TableRow key={alumno.id} className="hover:bg-primary/5 transition-colors">
                                <TableCell>
                                    <Checkbox checked={selectedIds.includes(alumno.id)} onCheckedChange={() => toggleSelection(alumno.id)} />
                                </TableCell>
                                <TableCell className="font-bold uppercase text-xs">{alumno.nombre}</TableCell>
                                <TableCell className="text-xs font-mono">{alumno.telefono || '-'}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="font-black text-primary border-primary/20">{alumno.diaPago}</Badge>
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
                                    <Button variant="ghost" size="icon" className="hover:text-destructive" onClick={() => handleDeleteIndividual(alumno.id, alumno.nombre)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

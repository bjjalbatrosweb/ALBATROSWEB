'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Users, Plus, Trash2, CreditCard, 
    TrendingUp, Calendar, CheckCircle2, 
    Clock, AlertCircle, Search, 
    ArrowLeft, LogOut, Download,
    ShieldAlert
} from "lucide-react";
import { 
    Table, TableBody, TableCell, TableHead, 
    TableHeader, TableRow 
} from "@/components/ui/table";
import { 
    Dialog, DialogContent, DialogDescription, 
    DialogFooter, DialogHeader, DialogTitle, DialogTrigger 
} from "@/components/ui/dialog";
import { 
    BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { Skeleton } from '@/components/ui/skeleton';

// Tipos basados en backend.json
type Student = {
    id: string;
    nombre: string;
    email: string;
    telefono: string;
    mensualidadSugerida: number;
    fechaIngreso: string;
};

type Payment = {
    id: string;
    alumnoId: string;
    alumnoNombre: string;
    monto: number;
    fechaVencimiento: string;
    fechaPago?: string;
    estado: 'pagado' | 'pendiente' | 'retraso';
};

export default function AdminDashboard() {
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();

    // Consultas a Firestore
    const studentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'admin_alumnos'), orderBy('nombre', 'asc'));
    }, [firestore]);

    const paymentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'admin_pagos'), orderBy('fechaVencimiento', 'desc'));
    }, [firestore]);

    const { data: students, isLoading: isLoadingStudents } = useCollection<Student>(studentsQuery);
    const { data: payments, isLoading: isLoadingPayments } = useCollection<Payment>(paymentsQuery);

    // Filtros
    const filteredStudents = useMemo(() => {
        if (!students) return [];
        return students.filter(s => 
            s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [students, searchTerm]);

    // Métricas Financieras
    const stats = useMemo(() => {
        if (!students || !payments) return { theoretical: 0, actual: 0, pending: 0 };
        
        const theoretical = students.reduce((acc, s) => acc + (Number(s.mensualidadSugerida) || 0), 0);
        const actual = payments
            .filter(p => p.estado === 'pagado')
            .reduce((acc, p) => acc + (Number(p.monto) || 0), 0);
        const pending = theoretical - actual;
        
        return { theoretical, actual, pending };
    }, [students, payments]);

    // Datos de la Gráfica
    const chartData = useMemo(() => [
        { name: 'Junio', real: stats.actual, teoria: stats.theoretical },
        { name: 'Julio', real: 0, teoria: stats.theoretical * 1.1 },
        { name: 'Agosto', real: 0, teoria: stats.theoretical * 1.25 },
        { name: 'Sept.', real: 0, teoria: stats.theoretical * 1.4 },
    ], [stats]);

    // Handlers
    const handleAddStudent = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!firestore) return;

        const formData = new FormData(e.currentTarget);
        const mensualidad = Number(formData.get('mensualidad'));
        const nombre = formData.get('nombre') as string;

        const newStudentData = {
            nombre: nombre,
            email: formData.get('email') as string,
            telefono: formData.get('telefono') as string,
            mensualidadSugerida: mensualidad,
            fechaIngreso: new Date().toISOString(),
            createdAt: serverTimestamp(),
        };

        const studentsRef = collection(firestore, 'admin_alumnos');
        addDocumentNonBlocking(studentsRef, newStudentData)
            .then((docRef) => {
                if (docRef) {
                    // Crear pago pendiente automático
                    const paymentsRef = collection(firestore, 'admin_pagos');
                    addDocumentNonBlocking(paymentsRef, {
                        alumnoId: docRef.id,
                        alumnoNombre: nombre,
                        monto: mensualidad,
                        fechaVencimiento: format(new Date(), "yyyy-MM-05"),
                        estado: 'pendiente',
                        createdAt: serverTimestamp(),
                    });
                }
            });
        
        toast({ title: "Misión Cumplida", description: `${nombre} ha sido reclutado.` });
        (e.target as HTMLFormElement).reset();
    };

    const deleteSelected = () => {
        if (!firestore || selectedStudents.length === 0) return;

        selectedStudents.forEach(id => {
            const docRef = doc(firestore, 'admin_alumnos', id);
            deleteDocumentNonBlocking(docRef);
            
            // Borrar también los pagos asociados
            payments?.filter(p => p.alumnoId === id).forEach(p => {
                const pRef = doc(firestore, 'admin_pagos', p.id);
                deleteDocumentNonBlocking(pRef);
            });
        });

        setSelectedStudents([]);
        toast({ title: "Bajas Confirmadas", description: "Los registros han sido eliminados del nido." });
    };

    const togglePaymentStatus = (payment: Payment) => {
        if (!firestore) return;
        
        const isPaying = payment.estado !== 'pagado';
        const paymentRef = doc(firestore, 'admin_pagos', payment.id);
        
        updateDocumentNonBlocking(paymentRef, { 
            estado: isPaying ? 'pagado' : 'pendiente',
            fechaPago: isPaying ? new Date().toISOString() : null,
            updatedAt: serverTimestamp()
        });

        toast({ title: "Logística Actualizada", description: `Estado de pago de ${payment.alumnoNombre} modificado.` });
    };

    const toggleSelectAll = () => {
        if (selectedStudents.length === filteredStudents.length && filteredStudents.length > 0) {
            setSelectedStudents([]);
        } else {
            setSelectedStudents(filteredStudents.map(s => s.id));
        }
    };

    const toggleSelectOne = (id: string) => {
        setSelectedStudents(prev => 
            prev.includes(id) ? prev.filter(sId => sId !== id) : [...prev, id]
        );
    };

    const isLoading = isLoadingStudents || isLoadingPayments;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8">
            {/* Header Admin */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="bg-primary p-3 rounded-lg text-white">
                        <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Panel Administrativo</h1>
                        <p className="text-muted-foreground text-sm font-bold uppercase tracking-widest">Albatros HQ Control</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Volver Web
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => router.push('/login')}>
                        <LogOut className="mr-2 h-4 w-4" /> Salir
                    </Button>
                </div>
            </header>

            {/* Métricas e Ingresos */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Ingreso Teórico</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black tracking-tighter">${stats.theoretical.toLocaleString()} MXN</p>}
                        <p className="text-[10px] text-muted-foreground font-bold mt-1">TOTAL MATRICULADO</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/20 bg-green-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Ingreso Real</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black tracking-tighter text-green-500">${stats.actual.toLocaleString()} MXN</p>}
                        <p className="text-[10px] text-green-500 font-bold mt-1">RECAUDADO ESTE MES</p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Adeudo Pendiente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-black tracking-tighter text-red-500">${stats.pending.toLocaleString()} MXN</p>}
                        <p className="text-[10px] text-red-500 font-bold mt-1">POR RECOLECTAR</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Alumnos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-black tracking-tighter text-blue-500">{students?.length || 0}</p>}
                        <p className="text-[10px] text-blue-500 font-bold mt-1">GUERREROS ACTIVOS</p>
                    </CardContent>
                </Card>
            </div>

            {/* Gráfica y Gestión */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Gráfica de Ingresos */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic">
                            <TrendingUp className="h-5 w-5 text-primary" /> Proyección de Ingresos
                        </CardTitle>
                        <CardDescription>Comparativa Real vs Teórica</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    cursor={{fill: 'transparent'}}
                                    contentStyle={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}
                                />
                                <Bar dataKey="teoria" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Objetivo" />
                                <Bar dataKey="real" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Recaudado" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Lista de Alumnos */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-black uppercase italic">Gestión de Alumnos</CardTitle>
                            <CardDescription>Control de acceso y cobranza en tiempo real</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {selectedStudents.length > 0 && (
                                <Button variant="destructive" size="sm" onClick={deleteSelected}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Borrar ({selectedStudents.length})
                                </Button>
                            )}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="font-bold">
                                        <Plus className="h-4 w-4 mr-2" /> Nuevo Alumno
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Añadir Nuevo Guerrero</DialogTitle>
                                        <DialogDescription>Completa los datos para el despliegue del nuevo miembro.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddStudent} className="space-y-4 pt-4">
                                        <div className="grid gap-2">
                                            <Label htmlFor="nombre">Nombre Completo</Label>
                                            <Input id="nombre" name="nombre" placeholder="Ej. Juan Manuel" required />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="grid gap-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input id="email" name="email" type="email" placeholder="correo@link.com" />
                                            </div>
                                            <div className="grid gap-2">
                                                <Label htmlFor="telefono">WhatsApp</Label>
                                                <Input id="telefono" name="telefono" placeholder="999..." />
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label htmlFor="mensualidad">Monto Mensualidad (MXN)</Label>
                                            <Input id="mensualidad" name="mensualidad" type="number" defaultValue="600" />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit">Guardar Alumno</Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative mb-6">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar guerrero por nombre o email..." 
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <Checkbox 
                                                checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                                                onCheckedChange={toggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Guerrero</TableHead>
                                        <TableHead>Estado Pago</TableHead>
                                        <TableHead>Monto</TableHead>
                                        <TableHead>Fecha Pago</TableHead>
                                        <TableHead className="text-right">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : filteredStudents.map(student => {
                                        const payment = payments?.find(p => p.alumnoId === student.id);
                                        return (
                                            <TableRow key={student.id} className="hover:bg-muted/30 transition-colors">
                                                <TableCell>
                                                    <Checkbox 
                                                        checked={selectedStudents.includes(student.id)}
                                                        onCheckedChange={() => toggleSelectOne(student.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{student.nombre}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{student.email || 'SIN EMAIL'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {payment?.estado === 'pagado' ? (
                                                        <Badge className="bg-green-500 hover:bg-green-600 gap-1 text-white">
                                                            <CheckCircle2 className="h-3 w-3" /> Pagado
                                                        </Badge>
                                                    ) : payment?.estado === 'retraso' ? (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Retraso
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                                                            <Clock className="h-3 w-3" /> Pendiente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold">
                                                    ${student.mensualidadSugerida || 600}
                                                </TableCell>
                                                <TableCell className="text-[10px] font-bold text-muted-foreground italic">
                                                    {payment?.fechaPago ? format(new Date(payment.fechaPago), "dd MMM, HH:mm", {locale: es}) : '--'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {payment && (
                                                        <Button 
                                                            size="sm" 
                                                            variant={payment.estado === 'pagado' ? "outline" : "default"}
                                                            onClick={() => togglePaymentStatus(payment)}
                                                            className="text-[10px] h-7 font-black uppercase"
                                                        >
                                                            {payment.estado === 'pagado' ? "Revertir" : "Cobrar"}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!isLoading && filteredStudents.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                                                No se encontraron alumnos en el radar.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

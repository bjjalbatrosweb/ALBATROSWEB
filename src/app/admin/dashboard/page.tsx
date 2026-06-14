'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Plus, Trash2, 
    TrendingUp, CheckCircle2, 
    Clock, AlertCircle, Search, 
    ArrowLeft, LogOut
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
    CartesianGrid, Tooltip, ResponsiveContainer,
    Cell
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
import { Logo } from "@/components/logo";

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
    fechaPago?: string | null;
    estado: 'pagado' | 'pendiente' | 'retraso';
};

export default function AdminDashboard() {
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();

    // Consultas a Firestore (Acceso libre por reglas corregidas)
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
        const pending = Math.max(0, theoretical - actual);
        
        return { theoretical, actual, pending };
    }, [students, payments]);

    // Datos de la Gráfica
    const chartData = [
        { name: 'Teórico', value: stats.theoretical, color: 'hsl(var(--muted-foreground))' },
        { name: 'Recaudado', value: stats.actual, color: 'hsl(var(--primary))' },
        { name: 'Pendiente', value: stats.pending, color: 'hsl(var(--destructive))' },
    ];

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
        
        toast({ title: "Guerrero Reclutado", description: `${nombre} ha sido añadido al nido.` });
        (e.target as HTMLFormElement).reset();
    };

    const deleteSelected = () => {
        if (!firestore || selectedStudents.length === 0) return;

        selectedStudents.forEach(id => {
            const docRef = doc(firestore, 'admin_alumnos', id);
            deleteDocumentNonBlocking(docRef);
            
            payments?.filter(p => p.alumnoId === id).forEach(p => {
                const pRef = doc(firestore, 'admin_pagos', p.id);
                deleteDocumentNonBlocking(pRef);
            });
        });

        setSelectedStudents([]);
        toast({ title: "Bajas Confirmadas", description: "Atletas eliminados del registro maestro." });
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

        toast({ 
            title: isPaying ? "Pago Registrado" : "Cobro Revertido", 
            description: `Estado de ${payment.alumnoNombre} actualizado el día de hoy.` 
        });
    };

    const handleLogout = () => {
        router.push('/acceso-maestro');
    };

    const isLoading = isLoadingStudents || isLoadingPayments;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-8 dark">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Logo className="h-10 w-10" />
                    <div>
                        <h1 className="text-3xl font-black tracking-tighter uppercase italic text-primary">Panel de Mando Maestro</h1>
                        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Gestión Integral Albatros Team</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => router.push('/')}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Web Pública
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" /> Salir del Mando
                    </Button>
                </div>
            </header>

            {/* Métricas Críticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card/50 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Ingreso Teórico Mensual</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter">${stats.theoretical.toLocaleString()} <span className="text-xs text-muted-foreground">MXN</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 border-green-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-green-500 tracking-widest">Ingreso Real Recaudado</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter text-green-500">${stats.actual.toLocaleString()} <span className="text-xs text-muted-foreground">MXN</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 border-red-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-red-500 tracking-widest">Adeudo Pendiente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter text-red-500">${stats.pending.toLocaleString()} <span className="text-xs text-muted-foreground">MXN</span></div>
                    </CardContent>
                </Card>
                <Card className="bg-card/50 border-blue-500/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase text-blue-500 tracking-widest">Fuerza de Combate (Alumnos)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black tracking-tighter text-blue-500">{students?.length || 0} <span className="text-xs text-muted-foreground uppercase">Atletas</span></div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Gráfica de Salud Financiera */}
                <Card className="lg:col-span-1 bg-card/30">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase italic flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Salud Financiera
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} opacity={0.1} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={80} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Lista y Gestión de Alumnos */}
                <Card className="lg:col-span-2 bg-card/30">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase italic">Base de Datos de Atletas</CardTitle>
                            <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Gestión de activos y control de mensualidades</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            {selectedStudents.length > 0 && (
                                <Button variant="destructive" size="sm" onClick={deleteSelected} className="h-8 text-[10px] font-black uppercase">
                                    <Trash2 className="h-3 w-3 mr-1" /> Baja ({selectedStudents.length})
                                </Button>
                            )}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button size="sm" className="h-8 text-[10px] font-black uppercase">
                                        <Plus className="h-3 w-3 mr-1" /> Reclutar Atleta
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px] dark">
                                    <DialogHeader>
                                        <DialogTitle className="uppercase italic font-black">Nuevo Guerrrero Albatros</DialogTitle>
                                        <DialogDescription className="text-xs uppercase font-bold">Ingresa los datos tácticos del nuevo recluta.</DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAddStudent} className="space-y-4 pt-4">
                                        <div className="space-y-1">
                                            <Label htmlFor="nombre" className="text-[10px] uppercase font-bold">Nombre Completo</Label>
                                            <Input id="nombre" name="nombre" placeholder="Ej. Carlos Albatros" required className="bg-muted/50" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="email" className="text-[10px] uppercase font-bold">Email</Label>
                                                <Input id="email" name="email" type="email" placeholder="atleta@nido.com" className="bg-muted/50" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="telefono" className="text-[10px] uppercase font-bold">WhatsApp</Label>
                                                <Input id="telefono" name="telefono" placeholder="999..." className="bg-muted/50" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor="mensualidad" className="text-[10px] uppercase font-bold">Mensualidad Sugerida (MXN)</Label>
                                            <Input id="mensualidad" name="mensualidad" type="number" defaultValue="600" className="bg-muted/50" />
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" className="w-full font-black uppercase tracking-widest">Confirmar Alta</Button>
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
                                placeholder="Buscar guerrero en el radar..." 
                                className="pl-10 h-10 text-xs bg-muted/30 border-none"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="border border-primary/10 rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="w-[40px]">
                                            <Checkbox 
                                                checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0} 
                                                onCheckedChange={(checked) => setSelectedStudents(checked ? filteredStudents.map(s => s.id) : [])} 
                                            />
                                        </TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">Atleta / Contacto</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">Estado Pago</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">Monto</TableHead>
                                        <TableHead className="text-[10px] uppercase font-black">Día que Pagó</TableHead>
                                        <TableHead className="text-right text-[10px] uppercase font-black">Mando</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        [...Array(3)].map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow>)
                                    ) : filteredStudents.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-xs text-muted-foreground italic uppercase">Nido vacío. Recluta personal para empezar.</TableCell></TableRow>
                                    ) : filteredStudents.map(student => {
                                        const payment = payments?.find(p => p.alumnoId === student.id);
                                        return (
                                            <TableRow key={student.id} className="hover:bg-muted/20 border-b border-primary/5">
                                                <TableCell>
                                                    <Checkbox 
                                                        checked={selectedStudents.includes(student.id)} 
                                                        onCheckedChange={(checked) => setSelectedStudents(prev => checked ? [...prev, student.id] : prev.filter(id => id !== student.id))} 
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-xs uppercase tracking-tight">{student.nombre}</span>
                                                        <span className="text-[9px] text-muted-foreground font-mono">{student.telefono || 'SIN CONTACTO'}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {payment?.estado === 'pagado' ? (
                                                        <Badge className="bg-green-500/20 text-green-500 border-none h-5 text-[9px] font-black uppercase"><CheckCircle2 className="h-2 w-2 mr-1" /> Liquidado</Badge>
                                                    ) : payment?.estado === 'retraso' ? (
                                                        <Badge variant="destructive" className="h-5 text-[9px] font-black uppercase"><AlertCircle className="h-2 w-2 mr-1" /> Retraso</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="h-5 text-[9px] font-black uppercase border-primary/50 text-primary"><Clock className="h-2 w-2 mr-1" /> Pendiente</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-[10px] font-black text-primary">${payment?.monto || student.mensualidadSugerida}</TableCell>
                                                <TableCell className="text-[9px] font-bold text-muted-foreground italic">
                                                    {payment?.fechaPago ? format(new Date(payment.fechaPago), "dd MMM, HH:mm", {locale: es}) : '--'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {payment && (
                                                        <Button 
                                                            size="sm" 
                                                            variant={payment.estado === 'pagado' ? "outline" : "default"}
                                                            onClick={() => togglePaymentStatus(payment)}
                                                            className="text-[9px] h-6 px-2 font-black uppercase tracking-tighter"
                                                        >
                                                            {payment.estado === 'pagado' ? "Revertir" : "Cobrar"}
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Users, Plus, Trash2, CreditCard, 
    TrendingUp, Calendar, CheckCircle2, 
    Clock, AlertCircle, Search, 
    ArrowLeft, LogOut, Download
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
    Select, SelectContent, SelectItem, 
    SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { 
    BarChart, Bar, XAxis, YAxis, 
    CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos basados en backend.json
type Student = {
    id: string;
    nombre: string;
    email: string;
    telefono: string;
    mensualidad: number;
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

// Mock data inicial (idealmente esto vendría de Firebase)
const INITIAL_STUDENTS: Student[] = [
    { id: '1', nombre: 'Juan Pérez', email: 'juan@email.com', telefono: '9991234567', mensualidad: 600, fechaIngreso: '2024-01-15' },
    { id: '2', nombre: 'María García', email: 'maria@email.com', telefono: '9997654321', mensualidad: 900, fechaIngreso: '2024-02-10' },
    { id: '3', nombre: 'Carlos Ruiz', email: 'carlos@email.com', telefono: '9990001122', mensualidad: 1200, fechaIngreso: '2024-03-05' },
];

const INITIAL_PAYMENTS: Payment[] = [
    { id: 'p1', alumnoId: '1', alumnoNombre: 'Juan Pérez', monto: 600, fechaVencimiento: '2024-06-05', estado: 'pagado', fechaPago: '2024-06-04' },
    { id: 'p2', alumnoId: '2', alumnoNombre: 'María García', monto: 900, fechaVencimiento: '2024-06-05', estado: 'pendiente' },
    { id: 'p3', alumnoId: '3', alumnoNombre: 'Carlos Ruiz', monto: 1200, fechaVencimiento: '2024-06-01', estado: 'retraso' },
];

export default function AdminDashboard() {
    const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
    const [payments, setPayments] = useState<Payment[]>(INITIAL_PAYMENTS);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const { toast } = useToast();
    const router = useRouter();

    // Filtros
    const filteredStudents = useMemo(() => {
        return students.filter(s => 
            s.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [students, searchTerm]);

    // Métricas Financieras
    const stats = useMemo(() => {
        const theoretical = students.reduce((acc, s) => acc + s.mensualidad, 0);
        const actual = payments
            .filter(p => p.estado === 'pagado')
            .reduce((acc, p) => acc + p.monto, 0);
        const pending = theoretical - actual;
        
        return { theoretical, actual, pending };
    }, [students, payments]);

    // Datos de la Gráfica
    const chartData = [
        { name: 'Junio', real: stats.actual, teoria: stats.theoretical },
        { name: 'Julio', real: 0, teoria: stats.theoretical * 1.1 },
        { name: 'Agosto', real: 0, teoria: stats.theoretical * 1.25 },
        { name: 'Sept.', real: 0, teoria: stats.theoretical * 1.4 },
    ];

    // Handlers
    const handleAddStudent = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newStudent: Student = {
            id: Math.random().toString(36).substr(2, 9),
            nombre: formData.get('nombre') as string,
            email: formData.get('email') as string,
            telefono: formData.get('telefono') as string,
            mensualidad: Number(formData.get('mensualidad')),
            fechaIngreso: new Date().toISOString(),
        };
        setStudents([...students, newStudent]);
        
        // Crear pago pendiente automático
        const newPayment: Payment = {
            id: 'pay-' + newStudent.id,
            alumnoId: newStudent.id,
            alumnoNombre: newStudent.nombre,
            monto: newStudent.mensualidad,
            fechaVencimiento: format(new Date(), "yyyy-MM-05"),
            estado: 'pendiente'
        };
        setPayments([...payments, newPayment]);

        toast({ title: "Alumno Registrado", description: `${newStudent.nombre} ha sido añadido.` });
    };

    const deleteSelected = () => {
        setStudents(students.filter(s => !selectedStudents.includes(s.id)));
        setSelectedStudents([]);
        toast({ title: "Registros Eliminados", description: "Se han borrado los alumnos seleccionados." });
    };

    const togglePaymentStatus = (pId: string) => {
        setPayments(payments.map(p => {
            if (p.id === pId) {
                const isPaying = p.estado !== 'pagado';
                return { 
                    ...p, 
                    estado: isPaying ? 'pagado' : 'pendiente',
                    fechaPago: isPaying ? new Date().toISOString() : undefined
                };
            }
            return p;
        }));
        toast({ title: "Estado Actualizado", description: "El registro de pago ha sido modificado." });
    };

    const toggleSelectAll = () => {
        if (selectedStudents.length === filteredStudents.length) {
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
                        <p className="text-2xl font-black tracking-tighter">${stats.theoretical.toLocaleString()} MXN</p>
                        <p className="text-[10px] text-muted-foreground font-bold mt-1">TOTAL MATRICULADO</p>
                    </CardContent>
                </Card>
                <Card className="border-green-500/20 bg-green-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Ingreso Real</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black tracking-tighter text-green-500">${stats.actual.toLocaleString()} MXN</p>
                        <p className="text-[10px] text-green-500 font-bold mt-1">RECAUDADO ESTE MES</p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Adeudo Pendiente</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black tracking-tighter text-red-500">${stats.pending.toLocaleString()} MXN</p>
                        <p className="text-[10px] text-red-500 font-bold mt-1">POR RECOLECTAR</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-500/20 bg-blue-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase text-muted-foreground">Total Alumnos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black tracking-tighter text-blue-500">{students.length}</p>
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
                            <CardDescription>Control de acceso y cobranza</CardDescription>
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
                                        <DialogDescription>Completa los datos del nuevo miembro del equipo.</DialogDescription>
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

                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
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
                                    {filteredStudents.map(student => {
                                        const payment = payments.find(p => p.alumnoId === student.id);
                                        return (
                                            <TableRow key={student.id}>
                                                <TableCell>
                                                    <Checkbox 
                                                        checked={selectedStudents.includes(student.id)}
                                                        onCheckedChange={() => toggleSelectOne(student.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{student.nombre}</span>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{student.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {payment?.estado === 'pagado' ? (
                                                        <Badge className="bg-green-500 hover:bg-green-600 gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> Pagado
                                                        </Badge>
                                                    ) : payment?.estado === 'retraso' ? (
                                                        <Badge variant="destructive" className="gap-1">
                                                            <AlertCircle className="h-3 w-3" /> Retraso
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="gap-1">
                                                            <Clock className="h-3 w-3" /> Pendiente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-bold">
                                                    ${student.mensualidad}
                                                </TableCell>
                                                <TableCell className="text-[10px] font-bold text-muted-foreground">
                                                    {payment?.fechaPago ? format(new Date(payment.fechaPago), "dd MMM, HH:mm", {locale: es}) : '--'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        size="sm" 
                                                        variant={payment?.estado === 'pagado' ? "outline" : "default"}
                                                        onClick={() => togglePaymentStatus(payment!.id)}
                                                    >
                                                        {payment?.estado === 'pagado' ? "Revertir" : "Cobrar"}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {filteredStudents.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center text-muted-foreground italic">
                                                No se encontraron alumnos en la base de datos.
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

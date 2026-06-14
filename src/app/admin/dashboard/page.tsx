'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, Calendar, TrendingUp, Search, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic italic">Gestión Administración</h1>
          <p className="text-muted-foreground">Control táctico del equipo Albatros BJJ.</p>
        </div>
        <Button className="font-bold uppercase tracking-widest">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Registro
        </Button>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Atletas Activos</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">42</div>
            <p className="text-[10px] text-muted-foreground mt-1">+3 desde el último mes</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Pagos del Mes</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">85%</div>
            <p className="text-[10px] text-muted-foreground mt-1">36 de 42 al corriente</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Próximos Eventos</CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">2</div>
            <p className="text-[10px] text-muted-foreground mt-1">Torneo Estatal 02 JUL</p>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase text-muted-foreground">Rendimiento Equipo</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">+12%</div>
            <p className="text-[10px] text-muted-foreground mt-1">Crecimiento trimestral</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <Card className="xl:col-span-2 bg-card/40 border-primary/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-black uppercase italic">Base de Datos de Alumnos</CardTitle>
                <CardDescription>Consulta y edición de perfiles tácticos.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre..." className="pl-8 bg-background/50" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md min-h-[300px] flex items-center justify-center bg-background/30 italic text-muted-foreground">
              La lista de alumnos se cargará aquí tras la conexión con la base de datos.
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="bg-card/40 border-primary/10">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase italic">Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Button variant="outline" className="w-full justify-start font-bold uppercase text-xs tracking-widest border-primary/20">
                Registrar Pago
              </Button>
              <Button variant="outline" className="w-full justify-start font-bold uppercase text-xs tracking-widest border-primary/20">
                Pasar Asistencia
              </Button>
              <Button variant="outline" className="w-full justify-start font-bold uppercase text-xs tracking-widest border-primary/20">
                Generar Reporte Mensual
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-destructive/5 border-destructive/20">
            <CardHeader>
              <CardTitle className="text-xl font-black uppercase italic text-destructive">Alertas de Alerta</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-4">
                <li className="text-xs border-l-2 border-destructive pl-3">
                  <p className="font-bold">6 Atletas con pago vencido</p>
                  <p className="text-muted-foreground mt-1">Requiere seguimiento inmediato.</p>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

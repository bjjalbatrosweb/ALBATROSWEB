'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/firebase";
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import { useToast } from "@/hooks/use-toast";

export default function AccesoMaestroPage() {
  const [usuario, setUsuario] = useState("");
  const [pin, setPIN] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (usuario === "admin" && pin === "482662") {
      initiateAnonymousSignIn(auth, (error) => {
        toast({
          variant: "destructive",
          title: "Error de Seguridad",
          description: "No se pudo establecer el enlace táctico con el servidor.",
        });
        setIsLoading(false);
      });
      
      toast({
        title: "Acceso Maestro Concedido",
        description: "Bienvenido al centro de mando, Comandante.",
      });
      router.push("/admin/dashboard");
    } else {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "Credenciales de mando incorrectas. Intento registrado.",
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.05),transparent_70%)] pointer-events-none" />
      
      <Link href="/login" className="absolute top-4 left-4">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Login
        </Button>
      </Link>
      
      <Card className="w-full max-w-sm border-primary/30 shadow-[0_0_50px_rgba(255,0,0,0.1)] relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter uppercase italic flex items-center justify-center gap-2 text-primary">
            <ShieldCheck className="h-6 w-6" /> Acceso Maestro
          </CardTitle>
          <CardDescription className="font-bold uppercase tracking-widest text-[10px]">Terminal de Control Albatros HQ</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="usuario" className="text-xs uppercase font-bold text-muted-foreground">Usuario Administrador</Label>
              <Input 
                id="usuario" 
                placeholder="Identidad de Mando" 
                value={usuario} 
                onChange={(e) => setUsuario(e.target.value)}
                className="bg-muted/50 font-mono text-sm"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pin" className="text-xs uppercase font-bold text-muted-foreground">PIN de Seguridad</Label>
              <Input 
                id="pin" 
                type="password" 
                placeholder="••••••" 
                value={pin} 
                onChange={(e) => setPIN(e.target.value)}
                className="bg-muted/50 font-mono text-sm"
                required
              />
            </div>
            <Button type="submit" className="w-full font-black uppercase tracking-widest h-12" disabled={isLoading}>
              {isLoading ? "Encriptando..." : "Desbloquear Sistema"}
            </Button>
          </form>
          
          <div className="mt-6 p-4 rounded-md border border-dashed border-primary/20 bg-primary/5 text-center">
            <p className="text-[10px] text-primary font-black uppercase tracking-tighter">
              Aviso: Todo acceso administrativo es monitoreado y auditado por Albatros Team.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-[10px] text-muted-foreground uppercase font-bold tracking-[0.3em] animate-pulse">
        Property of Albatros Team • Tactical Control
      </p>
    </div>
  );
}

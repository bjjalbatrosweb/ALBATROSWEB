'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useUser } from "@/firebase";
import { initiateEmailSignIn, initiatePasswordReset, initiateAnonymousSignIn } from "@/firebase/non-blocking-login";
import type { AuthError } from "firebase/auth";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Home, MoreHorizontal, ShieldAlert, ArrowLeft } from "lucide-react";

// Esquema para Atletas
const athleteSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

// Esquema para Administradores (Acceso Maestro)
const adminSchema = z.object({
  usuario: z.string().min(1, "El usuario es obligatorio."),
  pin: z.string().min(1, "El pin es obligatorio."),
});

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Inicialización de formularios
  const athleteForm = useForm<z.infer<typeof athleteSchema>>({
    resolver: zodResolver(athleteSchema),
    defaultValues: { email: "", password: "" },
  });

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: { usuario: "", pin: "" },
  });

  useEffect(() => {
    // Redirigir si ya hay un usuario y no estamos intentando entrar como admin
    if (!isUserLoading && user && !showAdminLogin) {
      if (!localStorage.getItem('albatros_admin_access')) {
        router.replace('/dashboard');
      }
    }
  }, [user, isUserLoading, router, showAdminLogin]);

  const onAthleteSubmit = (values: z.infer<typeof athleteSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password, (error: AuthError) => {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales incorrectas o usuario no encontrado.",
      });
    });
  };

  const onAdminSubmit = (values: z.infer<typeof adminSchema>) => {
    // Validación estricta: usuario 'admin' y pin '482662'
    if (values.usuario.toLowerCase() === 'admin' && values.pin === '482662') {
      initiateAnonymousSignIn(auth, (error) => {
        toast({
          variant: "destructive",
          title: "Error de Conexión",
          description: "No se pudo establecer la sesión administrativa segura.",
        });
      });
      
      localStorage.setItem('albatros_admin_access', 'true');
      toast({
        title: "Acceso Maestro Concedido",
        description: "Bienvenido al Centro de Control Albatros.",
      });
      router.push('/admin/dashboard');
    } else {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "Usuario o PIN incorrectos.",
      });
    }
  };

  const handlePasswordReset = () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: "Error", description: "Introduce tu email para continuar." });
      return;
    }
    initiatePasswordReset(auth, resetEmail, () => {
      toast({ title: "Email Enviado", description: "Revisa tu bandeja de entrada para restablecer tu contraseña." });
      setIsResetDialogOpen(false);
    }, (error) => {
      toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el correo de recuperación." });
    });
  };

  if (isUserLoading) return null;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden">
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline"><Home className="mr-2 h-4 w-4"/>Volver al Inicio</Button>
      </Link>

      {!showAdminLogin ? (
        <Card className="w-full max-w-sm mx-auto border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><Logo /></div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Acceso Guerrero</CardTitle>
            <CardDescription>Entra a tu perfil táctico.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...athleteForm}>
              <form onSubmit={athleteForm.handleSubmit(onAthleteSubmit)} className="grid gap-4">
                <FormField
                  control={athleteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Email de Atleta</FormLabel>
                      <FormControl><Input placeholder="atleta@email.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={athleteForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <div className="flex items-center">
                        <FormLabel>Contraseña</FormLabel>
                        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="link" className="ml-auto text-xs underline p-0 h-auto text-muted-foreground">¿Olvidaste tu contraseña?</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Restablecer Cuenta</DialogTitle></DialogHeader>
                            <div className="py-4">
                                <Input value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="Introduce tu email" />
                            </div>
                            <DialogFooter><Button onClick={handlePasswordReset}>Enviar Instrucciones</Button></DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-black uppercase tracking-widest">Iniciar Sesión</Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">¿Eres nuevo? <Link href="/signup" className="underline text-primary font-bold">Crea tu cuenta aquí</Link></div>
            
            {/* Acceso Maestro Oculto */}
            <button 
              onClick={() => setShowAdminLogin(true)} 
              className="absolute bottom-2 right-2 p-2 text-muted-foreground/20 hover:text-primary/40 transition-colors"
              aria-label="Panel de Mando"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm mx-auto border-primary/50 shadow-2xl bg-card border-2 animate-in zoom-in fade-in duration-300">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 text-primary"><ShieldAlert className="h-12 w-12" /></div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase italic text-primary">Acceso Maestro</CardTitle>
            <CardDescription className="font-bold">Panel Administrativo Independiente</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="grid gap-4">
                <FormField
                  control={adminForm.control}
                  name="usuario"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Escribe el usuario" 
                          className="font-bold uppercase tracking-wider" 
                          {...field} 
                          autoComplete="off"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={adminForm.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Contraseña / PIN</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••" 
                          className="font-bold" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-black uppercase tracking-widest bg-primary hover:bg-primary/90 mt-2">
                  Activar Comando
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-xs text-muted-foreground hover:text-primary" 
                  onClick={() => { setShowAdminLogin(false); adminForm.reset(); }}
                >
                  <ArrowLeft className="mr-2 h-3 w-3" /> Volver a Acceso Guerrero
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

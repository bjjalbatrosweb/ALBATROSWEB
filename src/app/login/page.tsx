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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Home, MoreHorizontal, ShieldAlert, ArrowLeft } from "lucide-react";

// Esquema para Atletas
const formSchema = z.object({
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(1, "La contraseña no puede estar vacía."),
});

// Esquema para Administradores
const adminSchema = z.object({
  username: z.string().min(1, "Usuario requerido."),
  pin: z.string().min(1, "PIN requerido."),
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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: {
      username: "",
      pin: "",
    },
  });

  useEffect(() => {
    if (!isUserLoading && user && !showAdminLogin) {
      // Si el usuario ya está logueado y no estamos intentando entrar como admin, 
      // verificamos si tiene acceso administrativo previo para no bloquearlo.
      if (!localStorage.getItem('albatros_admin_access')) {
        router.replace('/dashboard');
      }
    }
  }, [user, isUserLoading, router, showAdminLogin]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password, (error: AuthError) => {
      let description = "Ocurrió un error inesperado. Inténtalo de nuevo.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        description = "Credenciales incorrectas. Verifica tu email y contraseña.";
      }
      toast({
        variant: "destructive",
        title: "Error de Autenticación",
        description,
      });
    });
  };

  const onAdminSubmit = (values: z.infer<typeof adminSchema>) => {
    const userLower = values.username.toLowerCase();
    if ((userLower === 'admin') && values.pin === '482662') {
      // Usamos Auth Anónimo para cumplir con las reglas de Firestore (isSignedIn())
      initiateAnonymousSignIn(auth, (error) => {
        toast({
          variant: "destructive",
          title: "Error de Acceso Maestro",
          description: "No se pudo establecer la conexión de seguridad.",
        });
      });
      
      localStorage.setItem('albatros_admin_access', 'true');
      toast({
        title: "Acceso Maestro Concedido",
        description: "Bienvenido al Panel de Control Albatros.",
      });
      router.push('/admin/dashboard');
    } else {
      toast({
        variant: "destructive",
        title: "Acceso Denegado",
        description: "Credenciales administrativas inválidas.",
      });
    }
  };

  const handlePasswordReset = () => {
    if (!resetEmail) {
      toast({
        variant: "destructive",
        title: "Email Requerido",
        description: "Por favor, introduce tu dirección de email.",
      });
      return;
    }
    
    initiatePasswordReset(
      auth,
      resetEmail,
      () => {
        toast({
          title: "Email Enviado",
          description: "Revisa tu bandeja de entrada para el enlace de restablecimiento.",
        });
        setIsResetDialogOpen(false);
        setResetEmail("");
      },
      (error: AuthError) => {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo enviar el correo de restablecimiento.",
        });
      }
    );
  };
  
  if (isUserLoading) {
      return <div className="flex items-center justify-center min-h-screen bg-background"></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-background relative">
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline"><Home className="mr-2 h-4 w-4"/>Inicio</Button>
      </Link>

      {!showAdminLogin ? (
        <Card className="w-full max-w-sm mx-auto border-primary/20 shadow-2xl relative overflow-hidden">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Acceso Guerrero</CardTitle>
            <CardDescription>Introduce tus credenciales de combate.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel htmlFor="email">Email de Atleta</FormLabel>
                      <FormControl>
                        <Input
                          id="email"
                          type="email"
                          placeholder="atleta@email.com"
                          className="bg-muted/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <div className="flex items-center">
                        <FormLabel htmlFor="password">Contraseña</FormLabel>
                        <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                          <DialogTrigger asChild>
                            <Button
                              variant="link"
                              type="button"
                              className="ml-auto inline-block text-xs underline p-0 h-auto text-muted-foreground"
                            >
                              ¿Olvidaste tu contraseña?
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Restablecer Contraseña</DialogTitle>
                              <DialogDescription>
                                Introduce tu email para recibir un enlace de restablecimiento.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="reset-email" className="text-right">Email</Label>
                                <Input
                                  id="reset-email"
                                  value={resetEmail}
                                  onChange={(e) => setResetEmail(e.target.value)}
                                  className="col-span-3"
                                  placeholder="atleta@email.com"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handlePasswordReset}>Enviar Email</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <FormControl>
                        <Input id="password" type="password" className="bg-muted/50" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-black uppercase tracking-widest">
                  Entrar al Tatami
                </Button>
              </form>
            </Form>
            <div className="mt-4 text-center text-sm">
              ¿No tienes cuenta?{" "}
              <Link href="/signup" className="underline text-primary font-bold">
                Únete aquí
              </Link>
            </div>
            
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="absolute bottom-2 right-2 p-2 text-muted-foreground/30 hover:text-primary/60 transition-colors"
              title="Acceso Maestro"
              type="button"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full max-w-sm mx-auto border-primary/50 shadow-2xl bg-card border-2 animate-in zoom-in-95 duration-200">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 text-primary">
              <ShieldAlert className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase italic text-primary">Panel Administrativo</CardTitle>
            <CardDescription className="font-bold text-foreground">Acceso restringido para el Alto Mando.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit(onAdminSubmit)} className="grid gap-4">
                <FormField
                  control={adminForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Usuario Maestro</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ADMIN" 
                          className="bg-muted/50 font-black uppercase" 
                          {...field} 
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
                      <FormLabel>PIN Táctico</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••" 
                          className="bg-muted/50 font-black" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" variant="default" className="w-full font-black uppercase tracking-widest bg-primary hover:bg-primary/90">
                  Validar Acceso
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full text-xs"
                  onClick={() => {
                    setShowAdminLogin(false);
                    adminForm.reset();
                  }}
                >
                  <ArrowLeft className="mr-2 h-3 w-3" /> Volver a Atletas
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

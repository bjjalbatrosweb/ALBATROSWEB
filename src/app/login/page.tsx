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
import { Home, ShieldAlert } from "lucide-react";

const formSchema = z.object({
  email: z.string().min(1, "Este campo es obligatorio."),
  password: z.string().min(1, "La contraseña no puede estar vacía."),
});

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      const isAdmin = localStorage.getItem('albatros_admin_access') === 'true';
      if (isAdmin) {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, isUserLoading, router]);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // 🛡️ ACCESO ADMINISTRATIVO ESPECIAL
    if ((values.email.toLowerCase() === 'admin') && values.password === '482662') {
      localStorage.setItem('albatros_admin_access', 'true');
      initiateAnonymousSignIn(auth, (error) => {
        toast({
          variant: "destructive",
          title: "Error de Seguridad",
          description: "No se pudo establecer conexión segura para admin.",
        });
      });
      toast({
        title: "Acceso Maestro",
        description: "Entrando al panel de administración Albatros.",
      });
      return;
    }

    // Acceso normal de atletas
    localStorage.removeItem('albatros_admin_access');
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
    <div className="flex items-center justify-center min-h-screen p-4 bg-background">
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline"><Home className="mr-2 h-4 w-4"/>Inicio</Button>
      </Link>
      <Card className="w-full max-w-sm mx-auto border-primary/20 shadow-2xl">
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
                    <FormLabel htmlFor="email">Atleta / Admin</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        placeholder="Email o Usuario"
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
        </CardContent>
      </Card>
      
      <div className="fixed bottom-4 right-4 opacity-50 flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground">
        <ShieldAlert className="h-3 w-3" /> Solo personal autorizado
      </div>
    </div>
  );
}
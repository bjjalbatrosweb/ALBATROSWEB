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
import { initiateEmailSignIn, initiatePasswordReset } from "@/firebase/non-blocking-login";
import type { AuthError } from "firebase/auth";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Home } from "lucide-react";

// Esquema para Atletas
const athleteSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Inicialización de formulario
  const form = useForm<z.infer<typeof athleteSchema>>({
    resolver: zodResolver(athleteSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    // Redirigir si ya hay un usuario
    if (!isUserLoading && user) {
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = (values: z.infer<typeof athleteSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password, (error: AuthError) => {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Credenciales incorrectas o usuario no encontrado.",
      });
    });
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

      <Card className="w-full max-w-sm mx-auto border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4"><Logo /></div>
          <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Acceso Guerrero</CardTitle>
          <CardDescription>Entra a tu perfil táctico.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
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
                control={form.control}
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
        </CardContent>
      </Card>
    </div>
  );
}

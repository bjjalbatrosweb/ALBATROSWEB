
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
import { Home, ShieldCheck, KeyRound, Loader2 } from "lucide-react";
import { useAuth, useUser } from "@/firebase";
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
import type { AuthError } from "firebase/auth";

const professorSchema = z.object({
  pin: z.string().min(1, "El PIN es obligatorio."),
});

type FormValues = z.infer<typeof professorSchema>;

const ADMIN_EMAIL = "admin@gmial.com";

export default function LoginProfesorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: { pin: "" },
  });

  // Redirigir automáticamente al dashboard si ya hay un usuario (Profesor) detectado
  useEffect(() => {
    if (!isUserLoading && user && (user.email === ADMIN_EMAIL || user.uid === 'qbD1jOSrZ7d5vfDUkb2XndAAa343')) {
      router.replace('/admin/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = (values: FormValues) => {
    setIsLoggingIn(true);
    
    // Iniciamos sesión usando el correo vinculado y el PIN proporcionado como contraseña
    initiateEmailSignIn(auth, ADMIN_EMAIL, values.pin, (error: AuthError) => {
      setIsLoggingIn(false);
      console.error("Error de login profesor:", error.code, error.message);
      
      let message = "PIN incorrecto. Acceso denegado.";
      
      // Manejo específico de errores de Firebase
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = "El PIN ingresado es incorrecto.";
      } else if (error.code === 'auth/user-not-found') {
        message = `El usuario ${ADMIN_EMAIL} no está registrado en el sistema.`;
      } else if (error.code === 'auth/too-many-requests') {
        message = "Demasiados intentos fallidos. Inténtalo más tarde.";
      }
      
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: message,
      });
    });
  };

  if (isUserLoading) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-background">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />
      
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline" size="sm"><Home className="mr-2 h-4 w-4"/>Inicio</Button>
      </Link>

      <div className="w-full max-w-sm space-y-6">
        <Card className="border-primary/40 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><Logo /></div>
            <div className="flex items-center justify-center gap-2 mb-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Acceso Profesor</CardTitle>
            </div>
            <CardDescription>Introduce tu PIN de mando para gestionar el equipo.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>PIN de Seguridad</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="password" 
                            placeholder="••••••" 
                            {...field} 
                            className="pl-10 bg-background/50 h-12 text-lg tracking-widest" 
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && !isLoggingIn && form.handleSubmit(onSubmit)()}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button 
                    type="submit" 
                    className="w-full font-black uppercase tracking-widest h-12 shadow-[0_0_20px_rgba(255,0,0,0.2)]"
                    disabled={isLoggingIn}
                >
                  {isLoggingIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Autenticando...
                      </>
                  ) : "Entrar al Panel"}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-[10px] text-muted-foreground italic uppercase tracking-widest opacity-50">
              Terminal de Administración Albatros
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

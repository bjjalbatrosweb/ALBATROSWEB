'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
import { initiateEmailSignIn } from "@/firebase/non-blocking-login";
import type { AuthError } from "firebase/auth";
import { Home, ShieldAlert } from "lucide-react";

const athleteSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export default function LoginPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof athleteSchema>>({
    resolver: zodResolver(athleteSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
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

  if (isUserLoading) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden">
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline" size="sm"><Home className="mr-2 h-4 w-4"/>Inicio</Button>
      </Link>

      <div className="w-full max-w-sm space-y-6">
        <Card className="border-primary/20 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4"><Logo /></div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">Acceso Guerrero</CardTitle>
            <CardDescription>Entra a tu perfil táctico de Albatros.</CardDescription>
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
                      <FormLabel>Contraseña</FormLabel>
                      <FormControl><Input type="password" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-black uppercase tracking-widest h-12">Iniciar Sesión</Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
              ¿Eres nuevo? <Link href="/signup" className="underline text-primary font-bold">Crea tu cuenta aquí</Link>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
            <Link href="/acceso-maestro">
                <Button variant="ghost" size="sm" className="text-[10px] text-muted-foreground uppercase font-black tracking-widest hover:text-primary transition-colors">
                    <ShieldAlert className="mr-2 h-3 w-3" /> Acceso Maestro
                </Button>
            </Link>
        </div>
      </div>
    </div>
  );
}

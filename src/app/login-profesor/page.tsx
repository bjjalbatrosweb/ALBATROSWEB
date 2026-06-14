
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
import { Home, ShieldCheck } from "lucide-react";

const professorSchema = z.object({
  email: z.string().email("Email institucional requerido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export default function LoginProfesorPage() {
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof professorSchema>>({
    resolver: zodResolver(professorSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      // Por ahora redirigimos al dashboard, se podrá personalizar en el futuro
      router.replace('/dashboard');
    }
  }, [user, isUserLoading, router]);

  const onSubmit = (values: z.infer<typeof professorSchema>) => {
    initiateEmailSignIn(auth, values.email, values.password, (error: AuthError) => {
      toast({
        variant: "destructive",
        title: "Error de Autenticación",
        description: "Credenciales de profesor inválidas o acceso no autorizado.",
      });
    });
  };

  if (isUserLoading) return null;

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
            <CardDescription>Portal exclusivo de gestión administrativa y técnica.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Email Institucional</FormLabel>
                      <FormControl><Input placeholder="profesor@albatrosbjj.com" {...field} className="bg-background/50" /></FormControl>
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
                      <FormControl><Input type="password" {...field} className="bg-background/50" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full font-black uppercase tracking-widest h-12 shadow-[0_0_20px_rgba(255,0,0,0.2)]">
                  Entrar al Panel
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-xs text-muted-foreground italic">
              Este acceso está restringido únicamente a instructores autorizados.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

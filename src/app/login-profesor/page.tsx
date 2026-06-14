
'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { Home, ShieldCheck, KeyRound } from "lucide-react";

const professorSchema = z.object({
  username: z.string().min(1, "El usuario es obligatorio."),
  pin: z.string().min(1, "El PIN es obligatorio."),
});

type FormValues = z.infer<typeof professorSchema>;

export default function LoginProfesorPage() {
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: { username: "", pin: "" },
  });

  const onSubmit = (values: FormValues) => {
    // Validación de credenciales maestras solicitadas
    if (values.username === "admin" && values.pin === "482662") {
      toast({
        title: "Acceso Concedido",
        description: "Bienvenido al panel de gestión, Profesor.",
      });
      // Redirección al dashboard administrativo o general
      router.push('/dashboard');
    } else {
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description: "Usuario o PIN incorrectos. Acceso denegado.",
      });
    }
  };

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
            <CardDescription>Introduce tus credenciales de mando.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Usuario</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre de usuario" {...field} className="bg-background/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pin"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>PIN de Seguridad</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input type="password" placeholder="••••••" {...field} className="pl-10 bg-background/50" />
                        </div>
                      </FormControl>
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
              Este acceso es exclusivo para el personal docente autorizado.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

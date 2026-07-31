
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
import { useAuth, useFirestore, useUser } from "@/firebase";
import type { AuthError } from "firebase/auth";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Home } from "lucide-react";
import { useState } from "react";
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
  type Sede,
} from "@/lib/access-control";

const athleteSchema = z.object({
  email: z.string().email("Email inválido."),
  password: z.string().min(1, "Contraseña requerida."),
});

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isResetting, setIsResetting] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<z.infer<typeof athleteSchema>>({
    resolver: zodResolver(athleteSchema),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (!isUserLoading && user) {
      void redirigirSegunRol(user.uid);
    }
    // redirigirSegunRol usa las instancias estables de Firebase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, router]);

  const redirigirSegunRol = async (uid: string) => {
    const snapshot = await getDoc(doc(firestore, "usuarios", uid));
    const perfil = snapshot.exists()
      ? normalizarPerfilAcceso(snapshot.data())
      : null;

    if (
      perfil?.activo &&
      (perfil.rol === "admin" || perfil.rol === "profesor")
    ) {
      const sedeGuardada = localStorage.getItem("userSede") as Sede | null;
      const sede =
        sedeGuardada && puedeAdministrarSede(perfil, sedeGuardada)
          ? sedeGuardada
          : perfil.sede !== "TODAS" && perfil.sede
            ? perfil.sede
            : perfil.sedes?.[0] || "MMA";
      localStorage.setItem("userSede", sede);
      localStorage.setItem("userRole", perfil.rol);
      router.replace("/admin/dashboard");
      return;
    }

    localStorage.removeItem("userSede");
    localStorage.removeItem("userRole");
    router.replace("/mi-academia");
  };

  const onSubmit = async (values: z.infer<typeof athleteSchema>) => {
    try {
      setIsLoggingIn(true);
      const credential = await signInWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      );
      await redirigirSegunRol(credential.user.uid);
    } catch (error) {
      const authError = error as AuthError;
      toast({
        variant: "destructive",
        title: "Error de Acceso",
        description:
          authError.code === "auth/network-request-failed"
            ? "No se pudo conectar con Firebase."
            : "Credenciales incorrectas o usuario no encontrado.",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const recoverPassword = async () => {
    const email = form.getValues("email").trim();
    if (!z.string().email().safeParse(email).success) {
      form.setError("email", {
        message: "Escribe primero el correo de tu cuenta.",
      });
      return;
    }

    try {
      setIsResetting(true);
      await sendPasswordResetEmail(auth, email);
      toast({
        title: "Revisa tu correo",
        description:
          "Si la cuenta existe, Firebase enviará un enlace para cambiar la contraseña.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "No se pudo enviar el enlace",
        description: "Comprueba el correo e inténtalo nuevamente.",
      });
    } finally {
      setIsResetting(false);
    }
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
                <Button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full font-black uppercase tracking-widest h-12"
                >
                  {isLoggingIn ? "Iniciando..." : "Iniciar Sesión"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isResetting}
                  onClick={() => void recoverPassword()}
                  className="w-full text-xs font-bold"
                >
                  {isResetting
                    ? "Enviando enlace..."
                    : "¿Olvidaste tu contraseña?"}
                </Button>
              </form>
            </Form>
            <div className="mt-6 text-center text-sm">
              ¿Eres nuevo? <Link href="/signup" className="underline text-primary font-bold">Crea tu cuenta aquí</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

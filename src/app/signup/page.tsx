
'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { AuthError } from "firebase/auth";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Logo } from "@/components/logo";
import { useToast } from "@/hooks/use-toast";
import { useAuth, useFirestore, useUser } from "@/firebase";
import { Home } from "lucide-react";
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
  type Sede,
} from "@/lib/access-control";

const formSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio."),
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres."),
});

export default function SignupPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [isSigningUp, setIsSigningUp] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!isUserLoading && user && !isSigningUp) {
      void redirigirSesionExistente(user.uid);
    }
    // La función usa las instancias estables de Firebase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isUserLoading, isSigningUp, router]);

  const redirigirSesionExistente = async (uid: string) => {
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

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsSigningUp(true);
      const credential = await createUserWithEmailAndPassword(
        auth,
        values.email.trim(),
        values.password,
      );
      const name = values.name.trim();
      const [firstName, ...lastName] = name.split(/\s+/);

      await setDoc(doc(firestore, "perfiles", credential.user.uid), {
        id: credential.user.uid,
        email: credential.user.email || values.email.trim(),
        firstName: firstName || "",
        lastName: lastName.join(" "),
        age: 0,
        gender: "male",
        heightCm: 0,
        weightKg: 0,
        activityLevel: 1.2,
        athleticDiscipline: "MMA",
        goal: "maintain",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      router.replace("/mi-academia");
    } catch (error) {
      const authError = error as AuthError;
      let description = "Ocurrió un error inesperado. Inténtalo de nuevo.";
      if (authError.code === 'auth/email-already-in-use') {
        description = "Este email ya está en uso. Prueba a iniciar sesión.";
      }
      toast({
        variant: "destructive",
        title: "Error de Registro",
        description,
      });
      setIsSigningUp(false);
    }
  };

  if (isUserLoading || user) {
    return <div className="flex items-center justify-center min-h-screen"></div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-card">
      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline"><Home className="mr-2 h-4 w-4"/>Volver al Inicio</Button>
      </Link>
      <Card className="w-full max-w-sm mx-auto">
        <CardHeader className="text-center">
           <div className="flex justify-center mb-4">
            <Logo />
          </div>
          <CardTitle className="text-2xl font-black tracking-tighter">Únete al Campamento</CardTitle>
          <CardDescription>Crea tu perfil de atleta para empezar a dominar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel htmlFor="name">Nombre de Atleta</FormLabel>
                    <FormControl>
                      <Input id="name" placeholder="Tu Nombre de Guerra" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel htmlFor="email">Email</FormLabel>
                    <FormControl>
                      <Input
                        id="email"
                        type="email"
                        placeholder="atleta@email.com"
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
                    <FormLabel htmlFor="password">Contraseña</FormLabel>
                    <FormControl>
                      <Input id="password" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-bold" disabled={form.formState.isSubmitting || isSigningUp}>
                {isSigningUp ? "Creando cuenta..." : "Crear Cuenta"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm">
            ¿Ya tienes una cuenta?{" "}
            <Link href="/login" className="underline text-primary font-bold">
              Inicia Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

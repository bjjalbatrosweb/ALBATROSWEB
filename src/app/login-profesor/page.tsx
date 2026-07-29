'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { AuthError } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  ShieldCheck,
  KeyRound,
  Loader2,
  MapPin,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import {
  normalizarPerfilAcceso,
  puedeAdministrarSede,
} from '@/lib/access-control';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';

const professorSchema = z.object({
  sede: z.enum(['MMA', 'CAUCEL', 'JUAN_PABLO'], {
    required_error: 'Selecciona una sede.',
  }),
  password: z
    .string()
    .min(6, 'La contraseña debe contener al menos 6 caracteres.'),
});

type FormValues = z.infer<typeof professorSchema>;

const CONFIGURACION_SEDES: Record<
  Sede,
  {
    email: string;
    nombre: string;
  }
> = {
  MMA: {
    email: 'mma@albatrosbjj.com',
    nombre: 'MMA',
  },
  CAUCEL: {
    email: 'caucel@albatrosbjj.com',
    nombre: 'Caucel',
  },
  JUAN_PABLO: {
    email: 'juanpablo@albatrosbjj.com',
    nombre: 'Juan Pablo',
  },
};

export default function LoginProfesorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const firestore = useFirestore();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(professorSchema),
    mode: 'onChange',
    defaultValues: {
      sede: 'MMA',
      password: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const configuracion = CONFIGURACION_SEDES[values.sede];

    try {
      setIsLoggingIn(true);

      // Cierra cualquier sesión anterior, por ejemplo admin@gmail.com.
      if (auth.currentUser) {
        await signOut(auth);
      }

      // Inicia sesión con la cuenta real de Firebase de la sede.
      const credential = await signInWithEmailAndPassword(
        auth,
        configuracion.email,
        values.password
      );

      const perfilSnapshot = await getDoc(
        doc(firestore, 'usuarios', credential.user.uid),
      );
      const perfil = perfilSnapshot.exists()
        ? normalizarPerfilAcceso(perfilSnapshot.data())
        : null;

      if (!perfil || !puedeAdministrarSede(perfil, values.sede)) {
        await signOut(auth);
        throw new Error('ACCESS_PROFILE_DENIED');
      }

      localStorage.setItem('userSede', values.sede);
      localStorage.setItem('userRole', perfil.rol);

      toast({
        title: 'Acceso concedido',
        description: `Bienvenido al panel de ${configuracion.nombre}.`,
      });

      router.replace('/admin/dashboard');
    } catch (error) {
      const authError = error as AuthError;

      console.error(
        'Error de acceso:',
        authError.code,
        authError.message
      );

      let description =
        'No se pudo iniciar sesión con la cuenta de esta sede.';

      if (authError.message === 'ACCESS_PROFILE_DENIED') {
        description =
          'La cuenta no está activa o no tiene permiso para administrar esta sede.';
      } else if (
        authError.code === 'auth/invalid-credential' ||
        authError.code === 'auth/wrong-password'
      ) {
        description =
          `La contraseña configurada en Firebase para ${configuracion.nombre} no coincide.`;
      } else if (authError.code === 'auth/user-not-found') {
        description =
          `La cuenta de ${configuracion.nombre} no existe en Firebase Authentication.`;
      } else if (authError.code === 'auth/too-many-requests') {
        description =
          'Demasiados intentos. Inténtalo nuevamente más tarde.';
      } else if (authError.code === 'auth/network-request-failed') {
        description =
          'No se pudo conectar con Firebase. Revisa tu conexión.';
      }

      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description,
      });

      form.setValue('password', '');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="dark relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07080c] p-4 text-white">
      <style jsx global>{`
        @keyframes professor-login-enter {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.975);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes professor-login-glow {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.55;
            transform: scale(1.05);
          }
        }

        .professor-login-enter {
          animation: professor-login-enter 650ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .professor-login-enter {
            animation: none;
          }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.15),transparent_36%),radial-gradient(circle_at_12%_88%,rgba(255,0,0,0.06),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="pointer-events-none absolute right-[-10rem] top-1/2 h-[34rem] w-[34rem] -translate-y-1/2 rounded-full border border-primary/10 [animation:professor-login-glow_5s_ease-in-out_infinite]" />

      <Link href="/" className="absolute left-4 top-4 z-20">
        <Button
          variant="outline"
          size="sm"
          className="border-white/10 bg-black/30 text-white backdrop-blur-md hover:bg-white/10 hover:text-white"
        >
          <Home className="mr-2 h-4 w-4" />
          Inicio
        </Button>
      </Link>

      <div className="professor-login-enter relative z-10 w-full max-w-lg">
        <Card className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/65 text-white shadow-[0_30px_90px_-35px_rgba(0,0,0,0.95),0_0_70px_-42px_rgba(255,0,0,0.75)] backdrop-blur-xl">
          <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,0,0,0.07),transparent_40%)]" />

          <CardHeader className="relative px-6 pb-5 pt-10 text-center sm:px-12 sm:pt-12">
            <div className="mb-8 flex justify-center">
              <Logo />
            </div>

            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Acceso restringido
            </div>
            <CardTitle className="text-3xl font-black uppercase italic tracking-tighter">
              Acceso Profesor
            </CardTitle>
            <CardDescription className="text-white/45">
              Selecciona tu sede e introduce la contraseña de la cuenta.
            </CardDescription>
          </CardHeader>

          <CardContent className="relative px-6 pb-10 sm:px-12 sm:pb-12">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-5"
              >
                <FormField
                  control={form.control}
                  name="sede"
                  render={({ field }) => (
                    <FormItem className="grid gap-2.5">
                      <FormLabel className="flex items-center gap-2 text-white/75">
                        <MapPin className="h-4 w-4 text-primary" />
                        Sede
                      </FormLabel>

                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            ['MMA', 'MMA'],
                            ['CAUCEL', 'Caucel'],
                            ['JUAN_PABLO', 'Juan Pablo'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            disabled={isLoggingIn}
                            aria-pressed={field.value === value}
                            onClick={() => {
                              field.onChange(value);
                              form.setValue('password', '');
                            }}
                            className={`min-h-14 rounded-xl border px-2 py-2 text-center text-[10px] font-black uppercase tracking-wide transition-all duration-200 sm:text-xs ${
                              field.value === value
                                ? 'border-primary bg-primary text-white shadow-[0_8px_24px_-12px_hsl(var(--primary))]'
                                : 'border-white/10 bg-white/[0.035] text-white/50 hover:border-primary/40 hover:bg-primary/10 hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid gap-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <FormLabel className="flex items-center gap-2 text-white/75">
                          <KeyRound className="h-4 w-4 text-primary" />
                          Contraseña de acceso
                        </FormLabel>
                      </div>

                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            placeholder="Introduce tu contraseña"
                            {...field}
                            className="h-14 border-white/10 bg-white/[0.035] px-4 pr-12 text-base font-bold text-white placeholder:text-white/20 focus-visible:border-primary focus-visible:ring-primary/30"
                            disabled={isLoggingIn}
                            autoFocus
                            aria-label="Contraseña de acceso"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowPassword((current) => !current)
                            }
                            className="absolute right-1 top-1 flex h-12 w-11 items-center justify-center rounded-lg text-white/35 transition-colors hover:bg-white/5 hover:text-white"
                            aria-label={
                              showPassword
                                ? 'Ocultar contraseña'
                                : 'Mostrar contraseña'
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="h-14 w-full font-black uppercase tracking-[0.16em] shadow-[0_12px_30px_-14px_rgba(255,0,0,0.9)] transition-all hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-13px_rgba(255,0,0,1)]"
                  disabled={isLoggingIn || !form.formState.isValid}
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Autenticando...
                    </>
                  ) : (
                    <>
                      Entrar al panel
                      <ShieldCheck className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-7 flex items-center justify-center gap-2 text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/20">
              <span className="h-px w-7 bg-white/10" />
              Terminal de administración Albatros
              <span className="h-px w-7 bg-white/10" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

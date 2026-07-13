'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import type { AuthError } from 'firebase/auth';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Logo } from '@/components/logo';
import { useToast } from '@/hooks/use-toast';
import {
  Home,
  ShieldCheck,
  KeyRound,
  Loader2,
  MapPin,
} from 'lucide-react';
import { useAuth } from '@/firebase';

type Sede = 'MMA' | 'CAUCEL' | 'JUAN_PABLO';

const professorSchema = z.object({
  sede: z.enum(['MMA', 'CAUCEL', 'JUAN_PABLO'], {
    required_error: 'Selecciona una sede.',
  }),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'El PIN debe contener exactamente 4 números.'),
});

type FormValues = z.infer<typeof professorSchema>;

const CONFIGURACION_SEDES: Record<
  Sede,
  {
    email: string;
    nombre: string;
    pin: string;
    password: string;
  }
> = {
  MMA: {
    email: 'mma@albatrosbjj.com',
    nombre: 'MMA',
    pin: '1908',
    password: 'AL1908',
  },
  CAUCEL: {
    email: 'caucel@albatrosbjj.com',
    nombre: 'Caucel',
    pin: '5959',
    password: 'AL5959',
  },
  JUAN_PABLO: {
    email: 'juanpablo@albatrosbjj.com',
    nombre: 'Juan Pablo',
    pin: '1357',
    password: 'AL1357',
  },
};

export default function LoginProfesorPage() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      sede: 'MMA',
      pin: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const configuracion = CONFIGURACION_SEDES[values.sede];

    if (values.pin !== configuracion.pin) {
      toast({
        variant: 'destructive',
        title: 'Acceso denegado',
        description: `El PIN no corresponde a la sede ${configuracion.nombre}.`,
      });

      form.setValue('pin', '');
      return;
    }

    try {
      setIsLoggingIn(true);

      // Cierra cualquier sesión anterior, por ejemplo admin@gmail.com.
      if (auth.currentUser) {
        await signOut(auth);
      }

      // Inicia sesión con la cuenta real de Firebase de la sede.
      await signInWithEmailAndPassword(
        auth,
        configuracion.email,
        configuracion.password
      );

      // Guarda la sede para que el dashboard pueda filtrarla.
      localStorage.setItem('userSede', values.sede);

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

      if (
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

      form.setValue('pin', '');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent pointer-events-none" />

      <Link href="/" className="absolute top-4 left-4">
        <Button variant="outline" size="sm">
          <Home className="mr-2 h-4 w-4" />
          Inicio
        </Button>
      </Link>

      <div className="w-full max-w-sm space-y-6">
        <Card className="border-primary/40 shadow-2xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Logo />
            </div>

            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldCheck className="h-5 w-5 text-primary" />

              <CardTitle className="text-2xl font-black tracking-tighter uppercase italic">
                Acceso Profesor
              </CardTitle>
            </div>

            <CardDescription>
              Selecciona tu sede e introduce tu PIN.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="grid gap-4"
              >
                <FormField
                  control={form.control}
                  name="sede"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>Sede</FormLabel>

                      <Select
                        value={field.value}
                        onValueChange={(value: Sede) => {
                          field.onChange(value);
                          form.setValue('pin', '');
                        }}
                        disabled={isLoggingIn}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-background/50 h-12">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-muted-foreground" />
                              <SelectValue placeholder="Selecciona ubicación" />
                            </div>
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent>
                          <SelectItem value="MMA">
                            MMA
                          </SelectItem>

                          <SelectItem value="CAUCEL">
                            Caucel
                          </SelectItem>

                          <SelectItem value="JUAN_PABLO">
                            Juan Pablo
                          </SelectItem>
                        </SelectContent>
                      </Select>

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

                          <Input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            autoComplete="current-password"
                            placeholder="••••"
                            {...field}
                            onChange={(event) => {
                              const onlyNumbers =
                                event.target.value.replace(/\D/g, '');

                              field.onChange(onlyNumbers);
                            }}
                            className="pl-10 bg-background/50 h-12 text-lg tracking-widest"
                            disabled={isLoggingIn}
                            autoFocus
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
                  ) : (
                    'Entrar al Panel'
                  )}
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


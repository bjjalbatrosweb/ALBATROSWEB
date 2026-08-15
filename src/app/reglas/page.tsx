'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CreditCard,
  HeartPulse,
  ShieldCheck,
  Shirt,
  Users,
} from 'lucide-react';

import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ruleSections = [
  {
    number: '01',
    title: 'Código de conducta y respeto',
    icon: Users,
    rules: [
      {
        name: 'Saludo y cortesía',
        text: 'Al ingresar y salir del tatami o área de entrenamiento, realiza el saludo correspondiente como muestra de respeto al espacio y a tus compañeros.',
      },
      {
        name: 'Respeto mutuo',
        text: 'Trata a instructores, compañeros y personal con cordialidad. No se toleran el lenguaje ofensivo, la discriminación ni la violencia fuera de la práctica deportiva.',
      },
      {
        name: 'Ego en la puerta',
        text: 'El entrenamiento es un espacio de aprendizaje, no de competencia destructiva. Cuida a tus compañeros de sparring: el objetivo es evolucionar juntos.',
      },
      {
        name: 'Uso marcial responsable',
        text: 'Las técnicas aprendidas en la academia son exclusivamente para entrenamiento y defensa personal. Su uso indebido fuera del gimnasio es motivo de expulsión inmediata.',
      },
    ],
  },
  {
    number: '02',
    title: 'Higiene e indumentaria',
    icon: Shirt,
    rules: [
      {
        name: 'Higiene personal',
        text: 'Mantén las uñas de manos y pies cortas y limpias. Preséntate con buena higiene general, desodorante y aliento fresco.',
      },
      {
        name: 'Equipo y uniforme',
        text: 'Utiliza equipo limpio y adecuado para tu disciplina: Gi o rashguard, protector bucal, vendas, espinilleras y guantes, según corresponda. El vendaje es indispensable por seguridad e higiene.',
      },
      {
        name: 'Prendas seguras',
        text: 'No se permite entrenar con ropa que tenga cierres, botones metálicos o hebillas que puedan dañar el tatami o lesionar a otra persona.',
      },
      {
        name: 'Sin calzado en el tatami',
        text: 'Está estrictamente prohibido pisar el tatami con calzado de calle. Para salir al baño o vestidores, utiliza sandalias o calzado de tránsito.',
      },
    ],
  },
  {
    number: '03',
    title: 'Seguridad y salud',
    icon: HeartPulse,
    rules: [
      {
        name: 'Objetos prohibidos',
        text: 'No entrenes con joyas, anillos, cadenas, aretes, piercings, relojes o pulseras.',
      },
      {
        name: 'Lesiones y condición médica',
        text: 'Notifica al instructor antes de iniciar la clase si tienes alguna lesión, dolencia o condición médica previa.',
      },
      {
        name: 'Paro de combate',
        text: 'Durante las sumisiones o el sparring, el tap o palmeo debe ser respetado inmediatamente por ambas partes.',
      },
    ],
  },
  {
    number: '04',
    title: 'Puntualidad e instalaciones',
    icon: ShieldCheck,
    rules: [
      {
        name: 'Puntualidad',
        text: 'Llega a tiempo. Si llegas tarde, solicita permiso al instructor antes de incorporarte y utiliza la entrada correspondiente.',
      },
      {
        name: 'Cuidado del espacio',
        text: 'Mantén vestidores, baños, recepción y áreas comunes limpios y ordenados. Deposita la basura en su lugar y recoge tus pertenencias.',
      },
      {
        name: 'Dispositivos móviles',
        text: 'Mantén el teléfono en silencio durante las sesiones y fuera del tatami para evitar distracciones.',
      },
    ],
  },
  {
    number: '05',
    title: 'Membresías y administración',
    icon: CreditCard,
    rules: [
      {
        name: 'Pagos',
        text: 'Las cuotas deben cubrirse dentro de las fechas establecidas por la administración. En caso contrario, se negará el acceso.',
      },
      {
        name: 'Derecho de admisión',
        text: 'La academia se reserva el derecho de admisión o permanencia de cualquier usuario que incumpla reiteradamente este reglamento.',
      },
      {
        name: 'Uso del tag',
        text: 'Es obligatorio escanear el tag antes de ingresar al entrenamiento. Incumplir esta norma puede causar suspensión o una multa equivalente al adeudo. La reposición de un tag extraviado tiene un costo de $50 MXN.',
      },
    ],
  },
];

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#08090d] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08090d]/85 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:h-20">
          <Logo />
          <Button asChild variant="outline" className="border-white/15 bg-white/5">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver
            </Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10 px-4 py-16 md:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,0,0,0.16),transparent_48%)]" />
        <div className="container relative mx-auto max-w-5xl text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_35px_-12px_hsl(var(--primary))]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.32em] text-primary">
            Albatros
          </p>
          <h1 className="mt-3 text-4xl font-black uppercase italic tracking-tight sm:text-5xl md:text-6xl">
            Reglamento <span className="text-primary">General</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            Normas para entrenar con seguridad, respeto y disciplina dentro de
            nuestra comunidad.
          </p>
        </div>
      </section>

      <section className="container mx-auto max-w-5xl space-y-5 px-4 py-10 md:py-16">
        {ruleSections.map((section) => {
          const Icon = section.icon;

          return (
            <Card
              key={section.number}
              className="overflow-hidden border-white/10 bg-white/[0.035] text-white shadow-2xl shadow-black/20"
            >
              <CardHeader className="border-b border-white/10 bg-white/[0.025] p-5 md:p-7">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                      Sección {section.number}
                    </p>
                    <CardTitle className="mt-1 text-xl font-black uppercase italic tracking-tight md:text-2xl">
                      {section.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3 p-4 md:grid-cols-2 md:p-6">
                {section.rules.map((rule) => (
                  <article
                    key={rule.name}
                    className="rounded-xl border border-white/[0.07] bg-black/20 p-4 transition-colors hover:border-primary/25 hover:bg-primary/[0.035]"
                  >
                    <div className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" />
                      </span>
                      <div>
                        <h2 className="text-sm font-black uppercase tracking-wide">
                          {rule.name}
                        </h2>
                        <p className="mt-1.5 text-sm leading-6 text-white/70">
                          {rule.text}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>
          );
        })}

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-5 text-center md:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
            Comunidad · Seguridad · Rendimiento
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Este reglamento garantiza la seguridad, el buen ambiente de
            comunidad y el rendimiento de todos los practicantes.
          </p>
        </div>
      </section>
    </main>
  );
}

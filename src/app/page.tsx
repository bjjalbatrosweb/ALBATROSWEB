
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, Phone, ChevronsRight, Flame, HeartPulse, BrainCircuit, Menu, Maximize, AirVent, ParkingCircle, Refrigerator, Wifi, User, ShieldCheck, ChevronRight, MessageCircle, CalendarDays, Clock3, EllipsisVertical, Download, MonitorPlay, ShoppingCart, CreditCard, LockKeyhole } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const sections = [
  { id: 'inicio', name: 'Inicio' },
  { id: 'conocenos', name: 'Conócenos' },
  { id: 'servicios', name: 'Servicios' },
  { id: 'horarios', name: 'Horarios' },
  { id: 'eventos', name: 'Eventos' },
  { id: 'productos', name: 'Productos' },
  { id: 'contacto', name: 'Contacto' },
  { id: 'calendario', name: 'Calendario' },
  { id: 'recompensas', name: 'Recompensas' },
  { id: 'dados', name: 'Dados' },
  { id: 'foro', name: 'Foro' },
  { id: 'test', name: 'Test' },
  { id: 'reglas', name: 'Reglas' },
];

const otherSectionIds = new Set([
  'calendario',
  'recompensas',
  'dados',
  'foro',
  'test',
  'reglas',
]);
const mainSections = sections.filter(
  (section) => !otherSectionIds.has(section.id),
);
const otherSections = sections.filter((section) =>
  otherSectionIds.has(section.id),
);

const products = [
  {
    id: 'rashguard',
    name: 'Rashguard BJJ Albatros Team Japo',
    description: 'Ligero, resistente y diseñado para rendir en cada combate.',
    price: '$600 MXN',
    image: '/camisajapo.png',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'jersey',
    name: 'Jersey Kick Boxing Albatros Team',
    description: 'Protección y durabilidad para asaltos intensos.',
    price: '$300 MXN',
    image: '/camisakick.png',
    sizes: ['S', 'M', 'L', 'XL'],
  },
];

type Event = {
  id: string;
  name: string;
  card_description: string;
  description: string;
  info: string;
  price: string;
  date: string;
  image: string;
};

const events: Event[] = [
    {
      id: 'estatal-jiujitsu',
      name: 'CAMPEONATO ESTATAL DE JIU-JITSU',
      card_description: 'Torneo Gi y No-Gi, FMJJ, reglamento IBJJF.',
      description: 'El evento más importante a nivel estatal. Compite en las modalidades con y sin kimono para coronarte como campeón de Yucatán.',
      info: 'Este evento es clasificatorio para el campeonato nacional. Válido para el ranking de la Federación Mexicana de Jiu-Jitsu (FMJJ).',
      price: '$1400 MXN',
      date: 'EVENTO FINALIZADO · 02 JULIO',
      image: '/estatal.png',
    },
    {
      id: 'proximamente-evento',
      name: 'PRÓXIMAMENTE',
      card_description: 'Próximos torneos en camino.',
      description: 'Estamos trabajando en la organización de más eventos, seminarios con atletas de renombre y campamentos de entrenamiento.',
      info: 'Mantente atento a nuestras redes sociales y a esta sección para ser el primero en enterarte.',
      price: 'Por confirmar',
      date: 'PRÓXIMAMENTE',
      image: '/prox.png',
    },
];

const servicesData = [
  {
      id: 'bjj',
      name: 'Jiu Jitsu Brasileño',
      image: '/bjj.png',
      imageHint: 'jiu-jitsu',
      description: 'Arte marcial enfocado en el control y la sumisión en el suelo, donde la técnica supera a la fuerza.',
      price: '$600 MXN',
      advantages: [
          'Mejora la condición física y la fuerza funcional.',
          'Excelente para la defensa personal efectiva.',
          'Fomenta la disciplina, la resolución de problemas y la confianza.'
      ],
      trial: '¡Clase de prueba totalmente sin costo!',
      whatsappMessage: 'Hola, mi nombre es {name} y estoy interesado en agendar una clase de prueba de Jiu Jitsu Brasileño.'
  },
  {
      id: 'kickboxing',
      name: 'Kick Boxing',
      image: '/kick.png',
      imageHint: 'kickboxing muay-thai',
      description: 'Entrenamiento de combate que combina golpes de puño y patadas.',
      price: '$600 MXN',
      advantages: [
          'Incrementa la resistencia cardiovascular y la potencia.',
          'Quema una gran cantidad de calorías.',
          'Desarrolla la coordinación, agilidad y reflejos.'
      ],
      trial: '¡Clase de prueba totalmente sin costo!',
      whatsappMessage: 'Hola, mi nombre es {name} y estoy interesado en agendar una clase de prueba de Kick Boxing.'
  },
  {
      id: 'mma',
      name: 'MMA',
      image: '/MMA.jpg',
      imageHint: 'mma fighter',
      description: 'La disciplina más completa del combate moderno, integrando lo mejor del striking y el grappling.',
      price: '$600 MXN',
      advantages: [
          'Entrenamiento integral: golpeo, derribos y lucha en el suelo.',
          'Máximo nivel de acondicionamiento físico y mental.',
          'Preparación versátil para cualquier escenario de combate.'
      ],
      trial: '¡Clase de prueba totalmente sin costo!',
      whatsappMessage: 'Hola, mi nombre es {name} y estoy interesado en agendar una clase de prueba de MMA.'
  },
  {
      id: 'promo',
      name: 'PROMOCIÓN 2 DISCIPLINAS',
      image: '/combo.png',
      imageHint: 'training promotion',
      description: 'Dos disciplinas complementándose como una.',
      price: '$900 MXN',
      advantages: [
          'Obtén lo mejor de ambos mundos: grappling y striking.',
          'Plan de entrenamiento completo para ser un peleador versátil.',
          'Ahorra en tu mensualidad al combinar ambas disciplinas.'
      ],
      trial: '¡Pregunta por nuestras clases de prueba!',
      whatsappMessage: 'Hola, mi nombre es {name} y estoy interesado en la promoción de Jiu Jitsu y Kick Boxing.'
  },
  {
      id: 'promo3',
      name: 'PROMOCIÓN 3 DISCIPLINAS',
      image: '/mix.png',
      imageHint: 'full training',
      description: 'Tres disciplinas dominadas como una sola.',
      price: '$1200 MXN',
      advantages: [
          'Jiu Jitsu + Kick Boxing + MMA.',
          'Acceso ilimitado a todas las clases y horarios.',
          'La preparación más completa para el combate real.'
      ],
      trial: '¡El arsenal completo de Albatros a tu disposición!',
      whatsappMessage: 'Hola, mi nombre es {name} y estoy interesado en la PROMOCIÓN 3 de las tres disciplinas (BJJ, Kick Boxing y MMA).'
  }
];

const schedules = [
  {
    id: 'kick-matutino',
    discipline: 'Kick Boxing',
    days: 'Lunes, miércoles y viernes',
    time: '7:00–8:00 a. m.',
    shift: 'Matutino',
  },
  {
    id: 'mma-matutino',
    discipline: 'MMA',
    days: 'Lunes, miércoles y viernes',
    time: '8:00–9:00 a. m.',
    shift: 'Matutino',
  },
  {
    id: 'bjj-matutino',
    discipline: 'Jiu-Jitsu',
    days: 'Lunes, miércoles y viernes',
    time: '9:00–10:00 a. m.',
    shift: 'Matutino',
  },
  {
    id: 'bjj-vespertino',
    discipline: 'Jiu-Jitsu',
    days: 'Martes, jueves y sábado',
    time: '7:00–8:00 p. m.',
    shift: 'Vespertino',
  },
  {
    id: 'kick-vespertino',
    discipline: 'Kick Boxing / MMA',
    days: 'Martes, jueves y sábado',
    time: '8:00–9:00 p. m.',
    shift: 'Vespertino',
  },
  {
    id: 'mma-vespertino',
    discipline: 'MMA',
    days: 'Martes, jueves y sábado',
    time: '9:00–10:00 p. m.',
    shift: 'Vespertino',
  },
];

export default function WelcomePage() {
  const [activeSection, setActiveSection] = useState('inicio');
  const [welcomePhase, setWelcomePhase] = useState<
    'visible' | 'leaving' | 'hidden'
  >('visible');
  const [isOtherMenuOpen, setIsOtherMenuOpen] = useState(false);
  const [isDesktopHeaderVisible, setIsDesktopHeaderVisible] = useState(true);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const navRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const initialScrollTop = useRef(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const router = useRouter();
  
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [currentService, setCurrentService] = useState<(typeof servicesData)[0] | null>(null);
  const [serviceDialogView, setServiceDialogView] = useState<'details' | 'form'>('details');
  const [prospectName, setProspectName] = useState('');
  const [preferredSchedule, setPreferredSchedule] = useState('');
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const [isFunctionsPinOpen, setIsFunctionsPinOpen] = useState(false);
  const [functionsPin, setFunctionsPin] = useState('');
  const [functionsUnlocked, setFunctionsUnlocked] = useState(false);
  const { toast } = useToast();

  const unlockFunctions = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (functionsPin !== '1908') {
      setFunctionsPin('');
      toast({
        variant: 'destructive',
        title: 'PIN incorrecto',
        description: 'Escribe el PIN de cuatro dígitos para abrir Funciones.',
      });
      return;
    }

    sessionStorage.setItem('albatrosFunctionsUnlocked', '1');
    setFunctionsUnlocked(true);
    setFunctionsPin('');
    setIsFunctionsPinOpen(false);
    setIsQuickMenuOpen(true);
  };

  useEffect(() => {
    setFunctionsUnlocked(
      sessionStorage.getItem('albatrosFunctionsUnlocked') === '1',
    );

    const desktopQuery = window.matchMedia('(min-width: 768px)');

    const updateHeaderVisibility = () => {
      if (!desktopQuery.matches) {
        setIsDesktopHeaderVisible(true);
        return;
      }

      setIsDesktopHeaderVisible(window.scrollY <= 80);
    };

    updateHeaderVisibility();
    window.addEventListener('scroll', updateHeaderVisibility, { passive: true });
    desktopQuery.addEventListener('change', updateHeaderVisibility);

    return () => {
      window.removeEventListener('scroll', updateHeaderVisibility);
      desktopQuery.removeEventListener('change', updateHeaderVisibility);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setWelcomePhase('hidden');
      return;
    }

    const leaveTimer = window.setTimeout(
      () => setWelcomePhase('leaving'),
      1050,
    );
    const hideTimer = window.setTimeout(
      () => setWelcomePhase('hidden'),
      1650,
    );

    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  const availableScheduleOptions = currentService?.id === 'bjj'
    ? schedules.filter((schedule) => schedule.discipline === 'Jiu-Jitsu')
    : currentService?.id === 'kickboxing'
      ? schedules.filter((schedule) => schedule.discipline === 'Kick Boxing')
      : currentService?.id === 'mma'
        ? []
        : schedules;

  const handleScheduleClass = () => {
    if (!currentService) return;

    if (!prospectName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Falta tu nombre',
        description: 'Escribe tu nombre para preparar el mensaje.',
      });
      return;
    }

    if (!preferredSchedule) {
      toast({
        variant: 'destructive',
        title: 'Selecciona un horario',
        description: 'Indica qué turno te interesa.',
      });
      return;
    }

    const baseMessage = currentService.whatsappMessage.replace('{name}', prospectName.trim());
    const message = `${baseMessage} Mi horario preferido es: ${preferredSchedule}.`;
    window.open(
      `https://wa.me/529901443886?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-50% 0px -50% 0px', threshold: 0.5 }
    );

    sectionRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  const scrollToSection = useCallback((id: string, behavior: 'smooth' | 'auto' = 'smooth') => {
    if (id === 'foro') {
        router.push('/foro');
        return;
    }
    if (id === 'recompensas') {
        router.push('/recompensas');
        return;
    }
    if (id === 'dados') {
        router.push('/dados');
        return;
    }
    if (id === 'test') {
        router.push('/test');
        return;
    }
    if (id === 'reglas') {
        router.push('/reglas');
        return;
    }
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior, block: 'center' });
  }, [router]);

  const snapToSection = useCallback(() => {
    const currentScroll = window.scrollY + window.innerHeight / 2;
    let closestSectionId = sections[0].id;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref && sections[index].id !== 'foro' && sections[index].id !== 'recompensas' && sections[index].id !== 'dados') {
        const sectionTop = ref.offsetTop;
        const sectionHeight = ref.offsetHeight;
        const sectionCenter = sectionTop + sectionHeight / 2;
        const distance = Math.abs(currentScroll - sectionCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestSectionId = sections[index].id;
        }
      }
    });
    scrollToSection(closestSectionId, 'smooth');
  }, [scrollToSection]);

  const handleMouseDown = (e: React.MouseEvent) => {
    /*
     * Los botones de la píldora son navegación, no inicio de arrastre. Antes
     * el mouseup ejecutaba snapToSection y podía cancelar router.push().
     */
    if ((e.target as HTMLElement).closest('button')) {
      setIsInteracting(true);
      return;
    }

    isDragging.current = true;
    startY.current = e.clientY;
    initialScrollTop.current = window.scrollY;
    setIsInteracting(true);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const deltaY = moveEvent.clientY - startY.current;
      const dragMultiplier = 3;
      window.scrollTo(0, initialScrollTop.current - deltaY * dragMultiplier);
    };

    const onMouseUp = () => {
      isDragging.current = false;
      setIsInteracting(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      
      snapToSection();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) {
      setIsInteracting(true);
      return;
    }

    isDragging.current = true;
    startY.current = e.touches[0].clientY;
    initialScrollTop.current = window.scrollY;
    setIsInteracting(true);

    const onTouchMove = (moveEvent: TouchEvent) => {
        if (!isDragging.current) return;
        const deltaY = moveEvent.touches[0].clientY - startY.current;
        const dragMultiplier = 3;
        window.scrollTo(0, initialScrollTop.current - deltaY * dragMultiplier);
    };

    const onTouchEnd = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        setIsInteracting(false);
        
        window.removeEventListener('touchmove', onTouchMove);
        window.removeEventListener('touchend', onTouchEnd);
        
        snapToSection();
    };

    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);
  };

  return (
    <div className="relative bg-background text-foreground min-h-screen">
      {welcomePhase !== 'hidden' && (
        <div
          className={cn(
            'pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-[#08090d] transition-opacity duration-700 ease-out',
            welcomePhase === 'leaving'
              ? 'opacity-0'
              : 'opacity-100',
          )}
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.13),transparent_42%)]" />
          <div className="albatros-welcome-mark relative flex flex-col items-center">
            <span className="mb-3 h-px w-16 origin-left bg-primary shadow-[0_0_18px_hsl(var(--primary))] [animation:albatros-line_700ms_cubic-bezier(.22,1,.36,1)_both]" />
            <p className="font-headline text-4xl tracking-[0.2em] text-white sm:text-6xl">
              ALBATROS
            </p>
            <p className="mt-2 text-[9px] font-black uppercase tracking-[0.42em] text-primary sm:text-[11px]">
              Centro de alto rendimiento
            </p>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes albatros-welcome {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes albatros-line {
          from {
            opacity: 0;
            transform: scaleX(0);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }

        .albatros-welcome-mark {
          animation: albatros-welcome 700ms cubic-bezier(0.22, 1, 0.36, 1)
            both;
        }

        @keyframes albatros-hero-reveal {
          from {
            opacity: 0;
            transform: translateY(22px);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes albatros-scroll-pulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scaleY(0.55);
            transform-origin: top;
          }
          50% {
            opacity: 1;
            transform: scaleY(1);
            transform-origin: top;
          }
        }

        .albatros-hero-reveal {
          opacity: 0;
          animation: albatros-hero-reveal 700ms
            cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .albatros-scroll-indicator {
          animation: albatros-scroll-pulse 1.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .albatros-hero-reveal {
            opacity: 1;
            animation: none;
          }

          .albatros-scroll-indicator {
            animation: none;
          }
        }
      `}</style>

      {/* Pill Navigation */}
      <nav 
        className={cn(
            "group fixed top-1/2 right-3 -translate-y-1/2 z-50 hidden md:flex transition-[opacity,transform] duration-300",
            isInteracting ? "opacity-100 translate-x-0" : "opacity-65 translate-x-1 hover:opacity-100 hover:translate-x-0",
            "hidden md:flex"
        )}
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => { if(!isDragging.current) setIsInteracting(false); }}
      >
        <div 
          ref={navRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className={cn(
            "flex flex-col overflow-hidden border border-white/10 bg-black/70 py-2 shadow-[0_16px_45px_-18px_rgba(0,0,0,0.9),0_0_30px_-20px_rgba(255,0,0,0.8)] backdrop-blur-xl cursor-grab active:cursor-grabbing transition-[width,border-radius,padding] duration-300 ease-out",
            isInteracting
              ? "w-36 items-stretch rounded-2xl px-2"
              : "w-9 items-center rounded-full px-1.5",
          )}
        >
          {mainSections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "relative flex h-7 items-center rounded-xl transition-colors duration-200",
                isInteracting ? "justify-start gap-2 px-2" : "justify-center",
                activeSection === section.id
                  ? "bg-primary/15 text-white"
                  : "text-white/50 hover:bg-white/5 hover:text-white",
              )}
              aria-label={`Ir a ${section.name}`}
              aria-current={activeSection === section.id ? 'true' : undefined}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full bg-white/25 transition-[background-color,box-shadow,transform] duration-300',
                  activeSection === section.id
                    ? 'scale-125 bg-primary shadow-[0_0_9px_hsl(var(--primary))]'
                    : 'group-hover:bg-white/60'
                )}
              />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap text-[10px] font-black uppercase tracking-wider transition-[max-width,opacity] duration-300",
                  isInteracting
                    ? "max-w-24 opacity-100"
                    : "max-w-0 opacity-0",
                )}
              >
                {section.name}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsOtherMenuOpen((current) => !current)}
            className={cn(
              "relative flex h-7 items-center rounded-xl text-white/50 transition-colors duration-200 hover:bg-white/5 hover:text-white",
              isInteracting ? "justify-start gap-2 px-2" : "justify-center",
              isOtherMenuOpen && "bg-white/5 text-white",
            )}
            aria-expanded={isOtherMenuOpen}
            aria-label="Mostrar otras opciones"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
            <span
              className={cn(
                "flex flex-1 items-center justify-between overflow-hidden whitespace-nowrap text-[10px] font-black uppercase tracking-wider transition-[max-width,opacity] duration-300",
                isInteracting
                  ? "max-w-24 opacity-100"
                  : "max-w-0 opacity-0",
              )}
            >
              Otros
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-200",
                  isOtherMenuOpen && "rotate-90",
                )}
              />
            </span>
          </button>

          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-300",
              isInteracting && isOtherMenuOpen
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="ml-3 border-l border-white/10 pl-1">
                {otherSections.map((section) => (
                  <Link
                    key={section.id}
                    href={`/${section.id}`}
                    className="flex h-7 w-full items-center rounded-lg px-2 text-left text-[9px] font-black uppercase tracking-wider text-white/45 transition-colors hover:bg-primary/10 hover:text-white"
                  >
                    {section.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div
        className="fixed inset-x-0 top-0 z-[41] hidden h-4 md:block"
        onMouseEnter={() => setIsDesktopHeaderVisible(true)}
        aria-hidden="true"
      />

       <header
        className={cn(
          "fixed left-0 right-0 top-0 z-40 translate-y-0 border-b border-primary/10 bg-gray-900/60 backdrop-blur-md transition-transform duration-300 ease-out",
          isDesktopHeaderVisible
            ? "md:translate-y-0"
            : "md:-translate-y-full",
        )}
        onMouseEnter={() => setIsDesktopHeaderVisible(true)}
        onMouseLeave={() => {
          if (window.scrollY > 80) setIsDesktopHeaderVisible(false);
        }}
       >
        <div className="container mx-auto flex h-16 md:h-20 items-center justify-between px-4">
          <Logo className="scale-90 md:scale-100 origin-left" />
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Main Access Button - Mobile Optimized */}
            <div className="flex items-center gap-0">
              <Button 
                  onClick={() => setIsAccessDialogOpen(true)}
                  size="sm"
                  className="font-black uppercase tracking-tighter italic h-9 md:h-11 px-3 md:px-6 shadow-[0_0_15px_rgba(255,0,0,0.3)] hover:shadow-primary/50 transition-all"
              >
                <span className="hidden xs:inline">Acceso</span> Atletas <ChevronsRight className="ml-1 h-4 w-4" />
              </Button>

              <DropdownMenu open={isQuickMenuOpen} onOpenChange={setIsQuickMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="grid h-9 w-7 shrink-0 place-items-center border-0 bg-transparent p-0 text-white/60 outline-none transition-colors hover:text-white focus:bg-transparent focus:outline-none focus-visible:outline-none data-[state=open]:bg-transparent data-[state=open]:text-white md:h-11 md:w-8"
                    aria-label="Más opciones"
                    title="Más opciones"
                  >
                    <EllipsisVertical className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  sideOffset={8}
                  className="w-64 border-white/10 bg-[#0b0c10]/95 text-white shadow-2xl backdrop-blur-xl"
                >
                  <DropdownMenuItem asChild className="cursor-pointer gap-3 py-3 font-bold focus:bg-primary/15 focus:text-white">
                    <Link href="/pagar">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Pagar
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator className="bg-white/10" />

                  {functionsUnlocked ? (
                    <>
                      <DropdownMenuLabel className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                        <LockKeyhole className="h-3.5 w-3.5 text-green-400" />
                        Funciones
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild className="cursor-pointer gap-3 py-3 pl-7 font-bold focus:bg-primary/15 focus:text-white">
                        <Link href="/pantalla">
                          <MonitorPlay className="h-4 w-4 text-primary" />
                          Pantalla TV
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="cursor-pointer gap-3 py-3 pl-7 font-bold focus:bg-primary/15 focus:text-white">
                        <Link href="/comprar">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          Comprar
                        </Link>
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      className="cursor-pointer gap-3 py-3 font-bold focus:bg-primary/15 focus:text-white"
                      onSelect={() => {
                        setFunctionsPin('');
                        setIsFunctionsPinOpen(true);
                      }}
                    >
                      <LockKeyhole className="h-4 w-4 text-primary" />
                      Funciones
                      <ChevronRight className="ml-auto h-4 w-4 text-white/40" />
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="bg-white/10" />

                  <DropdownMenuItem
                    className="cursor-pointer gap-3 py-3 font-bold focus:bg-primary/15 focus:text-white"
                    onSelect={() => window.dispatchEvent(new Event('albatros:install-app'))}
                  >
                    <Download className="h-4 w-4 text-primary" />
                    Agregar a pantalla de inicio
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Dialog
              open={isFunctionsPinOpen}
              onOpenChange={(open) => {
                setIsFunctionsPinOpen(open);
                if (!open) setFunctionsPin('');
              }}
            >
              <DialogContent className="w-[calc(100vw-2rem)] max-w-sm border-white/10 bg-[#0b0c10]/95 text-white shadow-2xl backdrop-blur-xl">
                <form onSubmit={unlockFunctions}>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-black uppercase italic">
                      <LockKeyhole className="h-5 w-5 text-primary" />
                      Funciones
                    </DialogTitle>
                    <DialogDescription className="text-white/60">
                      Ingresa el PIN de cuatro dígitos para ver Pantalla TV y Comprar.
                    </DialogDescription>
                  </DialogHeader>
                  <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    value={functionsPin}
                    onChange={(event) => setFunctionsPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="mt-5 h-14 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-center text-2xl font-black tracking-[0.5em] text-white outline-none transition-colors focus:border-primary"
                    aria-label="PIN de Funciones"
                    placeholder="••••"
                  />
                  <DialogFooter className="mt-5 gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button type="button" variant="ghost" className="text-white/65 hover:bg-white/10 hover:text-white">
                        Cancelar
                      </Button>
                    </DialogClose>
                    <Button type="submit" disabled={functionsPin.length !== 4} className="font-black uppercase italic">
                      Desbloquear
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="md:hidden">
                <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                    <Menu className="h-6 w-6 text-primary" />
                    <span className="sr-only">Abrir menú</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-card/95 backdrop-blur-xl w-3/4 border-l border-primary/20">
                    <nav className="flex flex-col gap-5 text-lg font-black uppercase italic tracking-tighter mt-12">
                        {mainSections.map((section) => (
                            <SheetClose asChild key={section.id}>
                                <Link
                                    href={`#${section.id}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const targetSection = document.getElementById(section.id);
                                        targetSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }}
                                    className="text-foreground hover:text-primary transition-colors flex items-center justify-between group"
                                >
                                    {section.name}
                                    <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </SheetClose>
                        ))}

                        <div className="border-t border-primary/15 pt-5">
                          <p className="mb-4 text-xs tracking-[0.22em] text-primary">
                            Otros
                          </p>
                          <div className="flex flex-col gap-4 pl-3 text-base">
                            {otherSections.map((section) => (
                              <SheetClose asChild key={section.id}>
                                <Link
                                  href={`/${section.id}`}
                                  className="flex items-center justify-between text-foreground/70 transition-colors hover:text-primary"
                                >
                                  {section.name}
                                  <ChevronRight className="h-4 w-4 text-primary/60" />
                                </Link>
                              </SheetClose>
                            ))}
                          </div>
                        </div>
                    </nav>
                </SheetContent>
                </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Access Selection Dialog - Mobile Friendly */}
      <Dialog open={isAccessDialogOpen} onOpenChange={setIsAccessDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md bg-card/98 backdrop-blur-2xl border-primary/30 p-6 rounded-2xl">
          <DialogHeader className="text-center space-y-2">
            <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter leading-none">Centro de Comando</DialogTitle>
            <DialogDescription className="font-bold text-muted-foreground italic text-sm">Identifica tu perfil para entrar al nido.</DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 gap-4 py-6">
            <Card 
              className="group cursor-pointer hover:border-primary active:scale-95 transition-all bg-background/50 border-primary/10 overflow-hidden"
              onClick={() => {
                setIsAccessDialogOpen(false);
                router.push('/login');
              }}
            >
              <CardContent className="p-5 flex items-center gap-5">
                <div className="bg-primary/10 p-4 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg group-hover:shadow-primary/30">
                  <User className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight italic leading-tight">Perfil Atleta</h3>
                  <p className="text-[10px] text-muted-foreground italic mt-1 uppercase tracking-widest font-bold opacity-70">Rendimiento y Nutrición</p>
                </div>
                <ChevronsRight className="ml-auto h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>

            <Card 
              className="group cursor-pointer hover:border-primary active:scale-95 transition-all bg-background/50 border-primary/10 overflow-hidden"
              onClick={() => {
                setIsAccessDialogOpen(false);
                router.push('/login-profesor');
              }}
            >
              <CardContent className="p-5 flex items-center gap-5">
                <div className="bg-primary/10 p-4 rounded-xl text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg group-hover:shadow-primary/30">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight italic leading-tight">Panel Profesor</h3>
                  <p className="text-[10px] text-muted-foreground italic mt-1 uppercase tracking-widest font-bold opacity-70">Administración y Técnica</p>
                </div>
                <ChevronsRight className="ml-auto h-5 w-5 text-muted-foreground/30 group-hover:text-primary transition-colors" />
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="sm:justify-center">
            <p className="text-[10px] text-muted-foreground text-center italic uppercase tracking-widest font-black opacity-40">
              ALBATROS BJJ TACTICAL SYSTEMS
            </p>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="scroll-mt-20">
        <section
          id="inicio"
          ref={(el) => { sectionRefs.current[0] = el; }}
          className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-black"
        >
          <Image
            src="/Mibaner.png"
            alt="Banner de Albatros"
            fill
            className="z-0 scale-[1.03] object-cover object-center"
            priority
          />
          <div className="absolute inset-0 z-[1] bg-[linear-gradient(90deg,rgba(0,0,0,.94)_0%,rgba(0,0,0,.70)_48%,rgba(0,0,0,.42)_100%)]" />
          <div className="absolute inset-0 z-[1] bg-[radial-gradient(circle_at_50%_42%,rgba(255,0,0,.13),transparent_38%)]" />
          <div className="absolute inset-x-0 bottom-0 z-[1] h-48 bg-gradient-to-t from-black via-black/50 to-transparent" />

          <div className="container relative z-10 mx-auto px-5 pt-20 sm:px-8">
            <div className="mx-auto max-w-5xl text-center text-white">
              <div className="albatros-hero-reveal mx-auto flex w-fit items-center gap-3 rounded-full border border-white/15 bg-black/35 px-4 py-2 backdrop-blur-md [animation-delay:100ms]">
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_14px_rgba(255,0,0,.9)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.28em] text-white/75 sm:text-xs">
                  Centro de alto rendimiento
                </span>
              </div>

              <h1 className="albatros-hero-reveal mt-6 font-headline text-[clamp(4.5rem,15vw,11rem)] uppercase leading-[0.78] tracking-[-0.035em] text-primary drop-shadow-[0_12px_35px_rgba(255,0,0,.24)] [animation-delay:180ms]">
                Albatros
              </h1>

              <div className="albatros-hero-reveal mx-auto mt-7 flex max-w-3xl items-center gap-4 [animation-delay:300ms] sm:gap-6">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/70" />
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/65 sm:text-xs">
                  Jiu-Jitsu · Kick Boxing · MMA
                </p>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/70" />
              </div>

              <p className="albatros-hero-reveal mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-white/80 [animation-delay:420ms] sm:text-lg md:text-xl">
                Ciencia, disciplina y combate para desarrollar atletas
                preparados para rendir al máximo.
              </p>

              <div className="albatros-hero-reveal mt-9 flex flex-col items-center justify-center gap-3 [animation-delay:540ms] sm:flex-row">
                <Button
                  size="lg"
                  className="group h-12 min-w-52 rounded-full px-7 text-sm font-black uppercase italic tracking-wide shadow-[0_12px_35px_rgba(255,0,0,.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(255,0,0,.4)]"
                  onClick={() => scrollToSection('conocenos')}
                >
                  Conoce Albatros
                  <ChevronsRight className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 min-w-52 rounded-full border-white/20 bg-white/[0.04] px-7 text-sm font-black uppercase italic tracking-wide text-white backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10 hover:text-white"
                  onClick={() => scrollToSection('servicios')}
                >
                  Ver disciplinas
                </Button>
              </div>

              <div className="mt-5 grid w-full place-items-center">
                <button
                  type="button"
                  onClick={() => scrollToSection('conocenos')}
                  className="flex flex-col items-center gap-2 text-white/45 transition-colors duration-300 hover:text-white"
                  aria-label="Bajar a la siguiente sección"
                >
                  <span className="text-center text-[9px] font-black uppercase tracking-[0.3em] [text-indent:0.3em]">
                    Explora
                  </span>
                  <span className="albatros-scroll-indicator block h-8 w-px bg-gradient-to-b from-primary to-transparent" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section
          id="conocenos"
          ref={(el) => { sectionRefs.current[1] = el; }}
          className="min-h-screen flex items-center py-20 px-4"
        >
          <div className="container mx-auto">
            <div className="flex flex-col items-center gap-16 md:gap-24">
              <div className="space-y-6 text-center">
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestra Misión: <span className="text-primary">Forjar Campeones</span></h2>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                  En Albatros, no creemos en las casualidades. Creemos en la preparación implacable, la disciplina y la ciencia aplicada al rendimiento.
                </p>
              </div>

              <div className="w-full max-w-6xl">
                <Card className="overflow-hidden bg-card/50">
                  <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="relative h-80 md:h-auto">
                      <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7449.178724250698!2d-89.72824297829675!3d21.009091526797064!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f560b0061e7587f%3A0x5b09cf156e511a59!2sJiu-Jitsu%20%26%20Kick%20Boxing.%20ALBATROS!5e0!3m2!1sen!2smx!4v1774850838488!5m2!1sen!2smx"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen={false}
                        loading="lazy"
                        className="absolute inset-0"
                      ></iframe>
                    </div>
                    <div className="p-6 md:p-8">
                      <h3 className="text-2xl font-bold mb-6">Instalaciones de Élite</h3>
                      <ul className="space-y-5 text-lg">
                        <li className="flex items-center gap-4"><Maximize className="h-7 w-7 text-primary flex-shrink-0" /><span>Más de 100 m² de tatami</span></li>
                        <li className="flex items-center gap-4"><AirVent className="h-7 w-7 text-primary flex-shrink-0" /><span>Ventilación multizona</span></li>
                        <li className="flex items-center gap-4"><ParkingCircle className="h-7 w-7 text-primary flex-shrink-0" /><span>Estacionamiento</span></li>
                        <li className="flex items-center gap-4"><Refrigerator className="h-7 w-7 text-primary flex-shrink-0" /><span>Frigobar</span></li>
                        <li className="flex items-center gap-4"><Wifi className="h-7 w-7 text-primary flex-shrink-0" /><span>WiFi de alta velocidad</span></li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section
          id="servicios"
          ref={(el) => { sectionRefs.current[2] = el; }}
          className="min-h-screen flex items-center py-20 px-4"
        >
           <div className="container mx-auto">
              <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestros <span className="text-primary">Servicios</span></h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {servicesData.map((service) => (
                  <Dialog key={service.id} onOpenChange={(isOpen) => { if (!isOpen) { setServiceDialogView('details'); setCurrentService(null); setProspectName(''); setPreferredSchedule(''); } }}>
                    <DialogTrigger asChild>
                      <Card className="group overflow-hidden cursor-pointer" onClick={() => setCurrentService(service)}>
                        <div className="relative h-48 w-full overflow-hidden">
                          <Image src={service.image} alt={service.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="text-xl font-bold">{service.name}</h3>
                          <p className="text-primary font-bold text-lg mt-2">{service.price}</p>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    {currentService && currentService.id === service.id && (
                    <DialogContent className="sm:max-w-md">
                      {serviceDialogView === 'details' && (
                        <>
                          <DialogHeader><DialogTitle>{currentService.name}</DialogTitle></DialogHeader>
                          <div className="py-4 space-y-4">
                            {currentService.advantages && (
                              <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2">
                                {currentService.advantages.map((advantage, i) => <li key={i}>{advantage}</li>)}
                              </ul>
                            )}
                          </div>
                          <DialogFooter>
                            <Button size="lg" className="w-full" onClick={() => setServiceDialogView('form')}>AGENDAR CLASE</Button>
                          </DialogFooter>
                        </>
                      )}
                      {serviceDialogView === 'form' && (
                        <>
                          <DialogHeader>
                            <DialogTitle>Agenda tu clase de prueba</DialogTitle>
                            <DialogDescription>
                              {currentService.name} · Completa los datos y continuaremos por WhatsApp.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="py-4 space-y-4">
                            <div className="space-y-2">
                              <label htmlFor="prospect-name" className="text-sm font-bold">
                                Nombre
                              </label>
                              <input
                                id="prospect-name"
                                value={prospectName}
                                onChange={(event) => setProspectName(event.target.value)}
                                placeholder="Escribe tu nombre"
                                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                autoFocus
                              />
                            </div>

                            <div className="space-y-2">
                              <label htmlFor="preferred-schedule" className="text-sm font-bold">
                                Horario preferido
                              </label>
                              <select
                                id="preferred-schedule"
                                value={preferredSchedule}
                                onChange={(event) => setPreferredSchedule(event.target.value)}
                                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              >
                                <option value="">Selecciona una opción</option>
                                {availableScheduleOptions.map((schedule) => (
                                  <option
                                    key={schedule.id}
                                    value={`${schedule.discipline}, ${schedule.days}, ${schedule.time}`}
                                  >
                                    {schedule.discipline} · {schedule.days} · {schedule.time}
                                  </option>
                                ))}
                                <option value="quiero conocer los horarios disponibles">Quiero conocer los horarios</option>
                              </select>
                            </div>
                          </div>

                          <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setServiceDialogView('details')}>
                              Volver
                            </Button>
                            <Button onClick={handleScheduleClass} className="font-bold">
                              <MessageCircle className="mr-2 h-4 w-4" />
                              Continuar por WhatsApp
                            </Button>
                          </DialogFooter>
                        </>
                      )}
                    </DialogContent>
                    )}
                  </Dialog>
                ))}
              </div>
           </div>
        </section>

        <section
          id="horarios"
          ref={(el) => { sectionRefs.current[3] = el; }}
          className="min-h-screen flex items-center py-20 px-4 bg-card/35"
        >
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">
                Horarios de <span className="text-primary">Entrenamiento</span>
              </h2>
              <p className="mt-3 text-muted-foreground">
                Sede Cd. Caucel · Clase de prueba gratis y sin inscripción.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {schedules.map((schedule) => (
                <Card
                  key={schedule.id}
                  className="border-primary/15 bg-background/55 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_35px_rgba(255,0,0,0.08)]"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-primary">
                          {schedule.shift}
                        </p>
                        <h3 className="text-2xl font-black italic uppercase mt-1">
                          {schedule.discipline}
                        </h3>
                      </div>
                      <CalendarDays className="h-6 w-6 text-primary" />
                    </div>
                    <div className="mt-5 space-y-3 text-sm text-muted-foreground">
                      <p className="flex items-center gap-3">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {schedule.days}
                      </p>
                      <p className="flex items-center gap-3">
                        <Clock3 className="h-4 w-4 text-primary" />
                        {schedule.time}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-10">
              <Button
                size="lg"
                className="font-black uppercase tracking-wide"
                onClick={() => scrollToSection('servicios')}
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Agendar clase gratis
              </Button>
            </div>
          </div>
        </section>

        <section
          id="eventos"
          ref={(el) => { sectionRefs.current[4] = el; }}
          className="min-h-screen flex items-center py-20"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Próximos <span className="text-primary">Eventos</span></h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {events.map((event) => (
                <Dialog key={event.id} onOpenChange={(isOpen) => { if (!isOpen) { setCurrentEvent(null); } }}>
                  <DialogTrigger asChild>
                    <Card className="group overflow-hidden cursor-pointer" onClick={() => setCurrentEvent(event)}>
                      <Image src={event.image} alt={event.name} width={400} height={300} className="w-full h-48 object-cover" />
                      <CardContent className="p-4">
                        <h3 className="text-xl font-bold">{event.name}</h3>
                        <p className="text-primary font-bold text-lg mt-2">{event.date}</p>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                   {currentEvent && currentEvent.id === event.id && (
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{currentEvent.name}</DialogTitle>
                            <DialogDescription>{currentEvent.description}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <p className="text-sm text-muted-foreground">{currentEvent.info}</p>
                            <p className="text-lg font-black text-primary mt-4">{currentEvent.price}</p>
                        </div>
                    </DialogContent>
                   )}
                </Dialog>
              ))}
            </div>
          </div>
        </section>

        <section
          id="productos"
          ref={(el) => { sectionRefs.current[5] = el; }}
          className="min-h-screen flex items-center py-20 bg-card"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestros <span className="text-primary">Productos</span></h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
               {products.map((product) => (
                <Card key={product.id} className="group overflow-hidden">
                  <Image src={product.image} alt={product.name} width={400} height={300} className="w-full h-48 object-cover" />
                  <CardContent className="p-4">
                    <h3 className="text-xl font-bold">{product.name}</h3>
                    <p className="text-primary font-bold text-lg mt-2">{product.price}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <footer
          id="contacto"
          ref={(el) => { sectionRefs.current[6] = el; }}
          className="bg-card py-20"
        >
          <div className="container mx-auto text-center px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Establecer <span className="text-primary">Contacto</span></h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <a href="https://maps.app.goo.gl/epiGiZkjwYH3Mk938" target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row items-center gap-4 p-4 hover:bg-accent transition-colors rounded-lg">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg"><MapPin className="h-8 w-8" /></div>
                    <div><h3 className="text-xl font-bold">Ubicación</h3><p className="text-muted-foreground">Cd. Caucel, Mérida, Yucatán</p></div>
                </a>
                <a href="https://wa.me/message/MLU5C2HUNOCEN1" target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row items-center gap-4 p-4 hover:bg-accent transition-colors rounded-lg">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg"><Phone className="h-8 w-8" /></div>
                    <div><h3 className="text-xl font-bold">Teléfono</h3><p className="text-muted-foreground">+52 990 144 3886</p></div>
                </a>
                <div className="flex flex-col md:flex-row items-center gap-4 p-4 rounded-lg">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg"><Mail className="h-8 w-8" /></div>
                    <div><h3 className="text-xl font-bold">Email</h3><p className="text-muted-foreground">administrador@albatrosbjj.com</p></div>
                </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

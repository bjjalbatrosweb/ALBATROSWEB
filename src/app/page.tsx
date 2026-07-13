
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, Phone, ChevronsRight, Menu, Maximize, AirVent, ParkingCircle, Wifi, User, ShieldCheck, ChevronRight } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const sections = [
  { id: 'inicio', name: 'Inicio' },
  { id: 'conocenos', name: 'Conócenos' },
  { id: 'servicios', name: 'Servicios' },
  { id: 'eventos', name: 'Eventos' },
  { id: 'productos', name: 'Productos' },
  { id: 'contacto', name: 'Contacto' },
  {
    id: 'otros',
    name: 'Otros',
    subsections: [
      { id: 'foro', name: 'Foro' },
      { id: 'dados', name: 'Dados' },
      { id: 'recompensas', name: 'Recompensas' },
      { id: 'test', name: 'Test', newTab: true },
    ],
  },
];

const products = [
  {
    id: 'rashguard',
    name: 'Rashguard bjj Albatros Team.',
    description: 'Ligero, resistente y diseñado para la victory.',
    price: '$300 MXN',
    image: '/camisabjj.png',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: 'jersey',
    name: 'Rashguard japones Albtatros Team.',
    description: 'Protección y durabilidad para asaltos intensos.',
    price: '$550 MXN',
    image: '/camisajapo.png',
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
      id: 'proximamente-evento',
      name: 'PROXIMAMENTE',
      card_description: 'Proximos Torneos en camino.',
      description: 'Estamos trabajando en la organización de más eventos, seminarios con atletas de renombre y campamentos de entrenamiento.',
      info: 'Mantente atento a nuestras redes sociales y a esta sección para ser el primero en enterarte.',
      price: 'Por confirmar',
      date: 'PROXIMAMENTE',
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
      name: 'PROMOCION 2 DISCIPLINAS',
      image: '/combo.png',
      imageHint: 'training promotion',
      description: 'Dos disciplinas complementandose como una.',
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
      name: 'PROMOCION 3 DISCIPLINAS',
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

export default function WelcomePage() {
  const [activeSection, setActiveSection] = useState('inicio');
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
  const [isAccessDialogOpen, setIsAccessDialogOpen] = useState(false);
  const { toast } = useToast();

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

  const handleSectionClick = (id: string, newTab: boolean = false) => {
    if (newTab) {
      window.open(`/${id}`, '_blank');
    } else if (['foro', 'dados', 'recompensas'].includes(id)) {
      router.push(`/${id}`);
    } else {
      const section = document.getElementById(id);
      section?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const snapToSection = useCallback(() => {
    const currentScroll = window.scrollY + window.innerHeight / 2;
    let closestSectionId = sections[0].id;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      const section = sections.find(s => s.id === ref?.id)
      if (ref && !section?.subsections) {
        const sectionTop = ref.offsetTop;
        const sectionHeight = ref.offsetHeight;
        const sectionCenter = sectionTop + sectionHeight / 2;
        const distance = Math.abs(currentScroll - sectionCenter);

        if (distance < minDistance) {
          minDistance = distance;
          closestSectionId = ref.id;
        }
      }
    });
    handleSectionClick(closestSectionId);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
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
      {/* Pill Navigation */}
      <nav 
        className={cn(
            "fixed top-1/2 right-4 -translate-y-1/2 z-50 flex transition-all duration-300",
            isInteracting ? "opacity-100 scale-105" : "opacity-50 scale-90 hover:opacity-100 hover:scale-100",
            "hidden md:flex"
        )}
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => { if(!isDragging.current) setIsInteracting(false); }}
      >
        <div 
          ref={navRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="flex flex-col items-center gap-3 bg-black/30 backdrop-blur-lg p-2 rounded-full border border-neutral-700 cursor-grab active:cursor-grabbing"
        >
          {sections.map((section) => (
            'subsections' in section ? (
              <DropdownMenu key={section.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="group relative flex items-center"
                    aria-label={`Ir a ${section.name}`}
                  >
                    <div
                      className={cn(
                        'h-3 w-3 rounded-full bg-muted-foreground/50 transition-all duration-300',
                        activeSection === section.id ? 'bg-primary scale-150' : 'group-hover:bg-primary/80'
                      )}
                    />
                    <span className="absolute right-full mr-3 px-2 py-1 bg-card border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                      {section.name}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {(section.subsections as {id: string, name: string, newTab?: boolean}[]).map((subsection) => (
                    <DropdownMenuItem key={subsection.id} onClick={() => handleSectionClick(subsection.id, subsection.newTab)}>
                      {subsection.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className="group relative flex items-center"
                aria-label={`Ir a ${section.name}`}
              >
                <div
                  className={cn(
                    'h-3 w-3 rounded-full bg-muted-foreground/50 transition-all duration-300',
                    activeSection === section.id ? 'bg-primary scale-150' : 'group-hover:bg-primary/80'
                  )}
                />
                <span className="absolute right-full mr-3 px-2 py-1 bg-card border rounded-md text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none hidden md:block">
                  {section.name}
                </span>
              </button>
            )
          ))}
        </div>
      </nav>

      {/* Header */}
       <header className="fixed top-0 left-0 right-0 z-40 bg-gray-900/60 backdrop-blur-md border-b border-primary/10">
        <div className="container mx-auto flex h-16 md:h-20 items-center justify-between px-4">
          <Logo className="scale-90 md:scale-100 origin-left" />
          
          <div className="flex items-center gap-2 md:gap-4">
            {/* Main Access Button - Mobile Optimized */}
            <Button 
                onClick={() => setIsAccessDialogOpen(true)}
                size="sm"
                className="font-black uppercase tracking-tighter italic h-9 md:h-11 px-3 md:px-6 shadow-[0_0_15px_rgba(255,0,0,0.3)] hover:shadow-primary/50 transition-all"
            >
              <span className="hidden xs:inline">Acceso</span> Atletas <ChevronsRight className="ml-1 h-4 w-4" />
            </Button>

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
                        {sections.map((section) => (
                          'subsections' in section ? (
                            <Collapsible key={section.id} className="w-full">
                              <CollapsibleTrigger className="text-foreground hover:text-primary transition-colors flex items-center justify-between group w-full uppercase">
                                {section.name}
                                <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="flex flex-col gap-2 pl-4 mt-2">
                                {(section.subsections as {id: string, name: string, newTab?: boolean}[]).map((subsection) => (
                                    <SheetClose asChild key={subsection.id}>
                                      <a
                                        href={`/${subsection.id}`}
                                        target={subsection.newTab ? '_blank' : '_self'}
                                        rel="noopener noreferrer"
                                        className="text-foreground hover:text-primary transition-colors flex items-center justify-between group normal-case"
                                      >
                                        {subsection.name}
                                      </a>
                                    </SheetClose>
                                ))}
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ) : (
                            <SheetClose asChild key={section.id}>
                                <Link
                                    href={`#${section.id}`}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        handleSectionClick(section.id);
                                    }}
                                    className="text-foreground hover:text-primary transition-colors flex items-center justify-between group"
                                >
                                    {section.name}
                                    <ChevronRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Link>
                            </SheetClose>
                          )
                        ))}
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
          ref={(el) => (sectionRefs.current[0] = el)}
          className="h-screen flex items-center justify-center relative overflow-hidden"
        >
          <Image
            src="/Mibaner.png"
            alt="Banner de Albatros"
            fill
            className="object-cover z-0"
            priority
          />
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 text-center text-white p-4">
            <h1 className="font-headline text-5xl md:text-8xl tracking-wider text-primary">ALBATROS</h1>
            <p className="mt-4 text-lg md:text-2xl font-light max-w-2xl mx-auto">
              Donde la ciencia y el combate se encuentran. Nutrición táctica para atletas de élite.
            </p>
            <Button size="lg" className="mt-8 font-bold text-lg" onClick={() => handleSectionClick('conocenos')}>
              Descubre Más
            </Button>
          </div>
        </section>

        <section
          id="conocenos"
          ref={(el) => (sectionRefs.current[1] = el)}
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
                        <li className="flex items-center gap-4"><ParkingCircle className="h-7 w-7 text-primary flex-shrink-0" /><span>Frigobar</span></li>
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
          ref={(el) => (sectionRefs.current[2] = el)}
          className="min-h-screen flex items-center py-20 px-4"
        >
           <div className="container mx-auto">
              <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestros <span className="text-primary">Servicios</span></h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {servicesData.map((service) => (
                  <Dialog key={service.id} onOpenChange={(isOpen) => { if (!isOpen) { setServiceDialogView('details'); setCurrentService(null); } }}>
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
                    </DialogContent>
                    )}
                  </Dialog>
                ))}
              </div>
           </div>
        </section>

        <section
          id="eventos"
          ref={(el) => (sectionRefs.current[3] = el)}
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
          ref={(el) => (sectionRefs.current[4] = el)}
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
          ref={(el) => (sectionRefs.current[5] = el)}
          className="bg-card py-20"
        >
          <div className="container mx-auto text-center px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Establecer <span className="text-primary">Contacto</span></h2>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <a href="https://maps.app.goo.gl/epiGiZkjwYH3Mk938" target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row items-center gap-4 p-4 hover:bg-accent transition-colors rounded-lg">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg"><MapPin className="h-8 w-8" /></div>
                    <div><h3 className="text-xl font-bold">Ubicación</h3><p className="text-muted-foreground">Cd. Caulcel, Merida Yucatán</p></div>
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

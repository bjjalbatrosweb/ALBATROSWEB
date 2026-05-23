'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, MapPin, Phone, ChevronsRight, Flame, HeartPulse, BrainCircuit, Menu, Copy, Maximize, AirVent, ParkingCircle, Refrigerator, Wifi } from 'lucide-react';
import { Logo } from '@/components/logo';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const sections = [
  { id: 'inicio', name: 'Inicio' },
  { id: 'conocenos', name: 'Conócenos' },
  { id: 'rendimiento', name: 'Rendimiento' },
  { id: 'servicios', name: 'Servicios' },
  { id: 'eventos', name: 'Eventos' },
  { id: 'productos', name: 'Productos' },
  { id: 'contacto', name: 'Contacto' },
  { id: 'foro', name: 'Foro' },
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
    name: 'Jersey Kick Boxing Albtatros Team.',
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
      name: 'CAMPEONATO ESTATAL DE JIU JITSU',
      card_description: 'Torneo Gi y No-Gi, FMJJ, reglamento IBJJF.',
      description: 'El evento más importante a nivel estatal. Compite en las modalidades con y sin kimono para coronarte como campeón de Yucatán.',
      info: 'Este evento es clasificatorio para el campeonato nacional. Válido para el ranking de la Federación Mexicana de Jiu-Jitsu (FMJJ).',
      price: '$1400 MXN',
      date: '02 JULIO',
      image: '/estatal.png',
    },
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

const mmaImage = PlaceHolderImages.find(img => img.id === 'service_mma');

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
  
  const [dialogView, setDialogView] = useState<'details' | 'form' | 'payment' | 'code'>('details');
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [currentRegistrationId, setCurrentRegistrationId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [currentService, setCurrentService] = useState<(typeof servicesData)[0] | null>(null);
  const [serviceDialogView, setServiceDialogView] = useState<'details' | 'form'>('details');
  const [trialUserName, setTrialUserName] = useState('');

  // Intersection Observer to set active section
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
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior, block: 'center' });
  }, [router]);

  const snapToSection = useCallback(() => {
    const currentScroll = window.scrollY + window.innerHeight / 2;
    let closestSectionId = sections[0].id;
    let minDistance = Infinity;

    sectionRefs.current.forEach((ref, index) => {
      if (ref && sections[index].id !== 'foro') {
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
  
  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
        toast({
            title: "Copiado",
            description: "Número de referencia copiado al portapapeles.",
        });
    }).catch(err => {
        console.error("Error al copiar:", err);
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudo copiar la referencia.",
        });
    });
  };

  const handleFinalizeRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentEvent) return;

    setIsSubmitting(true);
    toast({
        title: "Procesando inscripción...",
        description: "Por favor espera un momento.",
    });

    const form = e.currentTarget;
    const formData = new FormData(form);
    
    const fullName = formData.get('fullName') as string;
    const age = formData.get('age') as string;
    const category = formData.get('category') as string;
    const birthDate = formData.get('birthDate') as string;

    if (!fullName || !age || !category || !birthDate) {
        toast({
            variant: "destructive",
            title: "Campos incompletos",
            description: "Por favor, completa todos los campos obligatorios.",
        });
        setIsSubmitting(false);
        return;
    }

    try {
        let app;
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }
        const db = getFirestore(app);
        
        const newDocRef = doc(collection(db, "registro_eventos"));

        const registrationData = {
            id: newDocRef.id,
            eventId: currentEvent.id,
            eventName: currentEvent.name,
            fullName: fullName,
            age: Number(age),
            category: category,
            birthDate: birthDate,
            curp: formData.get('curp') as string || '',
            phone: formData.get('phone') as string || '',
            email: formData.get('email') as string || '',
            status: 'pending_payment' as const,
            createdAt: serverTimestamp(),
            paymentReference: newDocRef.id,
        };

        await setDoc(newDocRef, registrationData);

        setCurrentRegistrationId(newDocRef.id);
        setDialogView('payment');
        toast({
            title: "¡Inscripción Recibida!",
            description: "Ahora puedes proceder con el pago.",
        });
    } catch (error) {
        console.error("Error saving to Firestore:", error);
        toast({
            variant: "destructive",
            title: "Error en el registro",
            description: error instanceof Error ? error.message : "Hubo un error al guardar tu inscripción. Por favor, inténtalo de nuevo.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleCodeRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!currentEvent) return;

    setIsSubmitting(true);
    toast({
        title: "Procesando inscripción...",
        description: "Por favor espera un momento.",
    });

    const form = e.currentTarget;
    const formData = new FormData(form);
    const eventCode = formData.get('eventCode') as string;

    if (!eventCode) {
        toast({
            variant: "destructive",
            title: "Código requerido",
            description: "Por favor, ingresa el código de tu profesor.",
        });
        setIsSubmitting(false);
        return;
    }

    try {
        let app;
        if (!getApps().length) {
            app = initializeApp(firebaseConfig);
        } else {
            app = getApp();
        }
        const db = getFirestore(app);
        
        const newDocRef = doc(collection(db, "registro_eventos"));

        const registrationData = {
            id: newDocRef.id,
            eventId: currentEvent.id,
            eventName: currentEvent.name,
            fullName: `Inscripción por Código`, // Placeholder
            age: 0, // Placeholder
            category: `Código: ${eventCode}`, // Store code here
            birthDate: new Date().toISOString().split('T')[0], // Placeholder
            curp: '',
            phone: '',
            email: '',
            status: 'pending_payment' as const,
            createdAt: serverTimestamp(),
            paymentReference: newDocRef.id,
        };

        await setDoc(newDocRef, registrationData);

        setCurrentRegistrationId(newDocRef.id);
        setDialogView('payment');
        toast({
            title: "¡Código Aceptado!",
            description: "Ahora puedes proceder con el pago para finalizar la inscripción.",
        });
    } catch (error) {
        console.error("Error saving with code to Firestore:", error);
        toast({
            variant: "destructive",
            title: "Error en el registro",
            description: error instanceof Error ? error.message : "Hubo un error al procesar el código. Por favor, inténtalo de nuevo.",
        });
    } finally {
        setIsSubmitting(false);
    }
  };


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
      const dragMultiplier = 3; // Adjust drag sensitivity
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
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
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
          ))}
        </div>
      </nav>

      {/* Header */}
       <header className="fixed top-0 left-0 right-0 z-40 bg-gray-900/60 backdrop-blur-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          <Logo />
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <Button asChild>
              <Link href="/login">
                Acceso Atletas <ChevronsRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </nav>
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6 text-primary" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-card/90 backdrop-blur-sm w-3/4">
                  <nav className="flex flex-col gap-6 text-lg font-medium mt-16">
                      {sections.map((section) => (
                          <SheetClose asChild key={section.id}>
                              <Link
                                  href={section.id === 'foro' ? '/foro' : `#${section.id}`}
                                  onClick={(e) => {
                                      if (section.id !== 'foro') {
                                        e.preventDefault();
                                        const targetSection = document.getElementById(section.id);
                                        targetSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                      }
                                  }}
                                  className="text-foreground hover:text-primary transition-colors"
                              >
                                  {section.name}
                              </Link>
                          </SheetClose>
                      ))}
                      <Separator className="my-2 bg-border" />
                       <SheetClose asChild>
                         <Button asChild className="w-full">
                            <Link href="/login">
                              Acceso Atletas <ChevronsRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                       </SheetClose>
                  </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="scroll-mt-20">
        {/* Section: Inicio */}
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
            <Button size="lg" className="mt-8 font-bold text-lg" onClick={() => scrollToSection('conocenos')}>
              Descubre Más
            </Button>
          </div>
        </section>

        {/* Section: Conócenos */}
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
                  En Albatros, no creemos en las casualidades. Creemos en la preparación implacable, la disciplina y la ciencia aplicada al rendimiento. Somos un equipo de nutricionistas, entrenadores y ex-atletas dedicados a una sola cosa: llevar tu potencial al límite.
                </p>
                <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
                  Nuestra filosofía es simple: cada gramo de comida es una herramienta, cada entrenamiento es una misión y cada día es una oportunidad para ser más letal. Fusionamos la última tecnología en análisis biométrico con la experiencia real del combate para crear sistemas nutricionales que construyen máquinas de pelear.
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
                        referrerPolicy="no-referrer-when-downgrade"
                        className="absolute inset-0"
                      ></iframe>
                    </div>
                    <div className="p-6 md:p-8">
                      <h3 className="text-2xl font-bold mb-6">Instalaciones de Élite</h3>
                      <ul className="space-y-5 text-lg">
                        <li className="flex items-center gap-4">
                          <Maximize className="h-7 w-7 text-primary flex-shrink-0" />
                          <span>Más de 100 m² de tatami</span>
                        </li>
                        <li className="flex items-center gap-4">
                          <AirVent className="h-7 w-7 text-primary flex-shrink-0" />
                          <span>Aire Acondicionado Multizona</span>
                        </li>
                        <li className="flex items-center gap-4">
                          <ParkingCircle className="h-7 w-7 text-primary flex-shrink-0" />
                          <span>Estacionamiento</span>
                        </li>
                        <li className="flex items-center gap-4">
                          <svg
                            viewBox="0 0 512 512"
                            fill="currentColor"
                            className="h-7 w-7 text-primary flex-shrink-0"
                          >
                            <path d="M416 0c-17.67 0-32 14.33-32 32s14.33 32 32 32h32v48H64V64h32c17.67 0 32-14.33 32-32S113.7 0 96 0H32C14.33 0 0 14.33 0 32v128c0 17.67 14.33 32 32 32h11.23c14.65 67.24 63.88 122.9 128.8 144.9v83.13C104.9 432.2 48 459.7 48 496c0 8.837 7.163 16 16 16h384c8.837 0 16-7.163 16-16c0-36.27-56.9-63.76-124-75.97V336.9c64.89-21.99 114.1-77.63 128.8-144.9H480c17.67 0 32-14.33 32-32V32C512 14.33 497.7 0 480 0H416zM320 447.2C365.2 454.4 397.6 468.2 400 480H112c2.42-11.75 34.8-25.56 80-32.77V480h128V447.2zM176 331.4c-56.76-17.75-99.8-67.6-103.8-128.4l-.1719-2.969h367.9l-.1719 2.969c-4.041 60.83-47.08 110.7-103.8 128.4V368h-160V331.4z" />
                          </svg>
                          <span>Sanitarios</span>
                        </li>
                        <li className="flex items-center gap-4">
                          <Refrigerator className="h-7 w-7 text-primary flex-shrink-0" />
                          <span>Frigobar</span>
                        </li>
                        <li className="flex items-center gap-4">
                          <Wifi className="h-7 w-7 text-primary flex-shrink-0" />
                          <span>WiFi de alta velocidad</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>
        
        {/* Section: Rendimiento */}
        <section
          id="rendimiento"
          ref={(el) => (sectionRefs.current[2] = el)}
          className="min-h-screen flex items-center py-20 relative"
        >
          <Image
            src="/bjj.png"
            alt="Nuestro Rendimiento"
            fill
            className="object-cover z-0"
          />
          <div className="absolute inset-0 bg-black/70" />
          <div className="container mx-auto px-4 relative z-10">
              <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter text-white">Nuestro <span className="text-primary">Rendimiento</span></h2>
                  <p className="mt-4 text-lg text-white/80 max-w-3xl mx-auto">Arsenal completo para tu preparación. No dejamos nada al azar.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <Card className="p-8 text-center flex flex-col items-center bg-card/70 backdrop-blur-sm border-white/10">
                    <Flame className="h-12 w-12 text-primary mb-4"/>
                    <h3 className="text-xl md:text-2xl font-bold mb-2">Planes Nutricionales Tácticos</h3>
                    <p className="text-muted-foreground">Dietas personalizadas basadas en tu biometría, disciplina y objetivos. Máxima eficiencia energética y recuperación.</p>
                  </Card>
                  <Card className="p-8 text-center flex flex-col items-center bg-card/70 backdrop-blur-sm border-white/10">
                    <HeartPulse className="h-12 w-12 text-primary mb-4"/>
                    <h3 className="text-xl md:text-2xl font-bold mb-2">Seguimiento Biométrico Avanzado</h3>
                    <p className="text-muted-foreground">Análisis de composición corporal, metabolismo y marcadores de rendimiento para ajustes precisos y en tiempo real.</p>
                  </Card>
                   <Card className="p-8 text-center flex flex-col items-center bg-card/70 backdrop-blur-sm border-white/10">
                    <BrainCircuit className="h-12 w-12 text-primary mb-4"/>
                    <h3 className="text-xl md:text-2xl font-bold mb-2">Consultoría de Rendimiento</h3>
                    <p className="text-muted-foreground">Asesoramiento uno a uno para estrategias de corte de peso, picos de rendimiento y suplementación estratégica.</p>
                  </Card>
              </div>
          </div>
        </section>

        {/* Section: Servicios */}
        <section
          id="servicios"
          ref={(el) => (sectionRefs.current[3] = el)}
          className="min-h-screen flex items-center py-20 px-4"
        >
           <div className="container mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestros <span className="text-primary">Servicios</span></h2>
                   <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">Nuestro espacio multi disciplinar y complementario.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {servicesData.map((service) => (
                  <Dialog key={service.id} onOpenChange={(isOpen) => { if (!isOpen) { setServiceDialogView('details'); setTrialUserName(''); setCurrentService(null); } }}>
                    <DialogTrigger asChild>
                      <Card className="group overflow-hidden cursor-pointer" onClick={() => setCurrentService(service)}>
                        <div className="relative h-48 w-full overflow-hidden">
                          <Image src={service.image} data-ai-hint={service.imageHint} alt={service.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <CardContent className="p-4">
                          <h3 className="text-xl font-bold">{service.name}</h3>
                          <p className="text-muted-foreground text-sm mt-1">{service.description}</p>
                          <p className="text-primary font-bold text-lg mt-2">{service.price}</p>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    {currentService && currentService.id === service.id && (
                    <DialogContent className="sm:max-w-md">
                      {serviceDialogView === 'details' && (
                        <>
                          <DialogHeader>
                            <DialogTitle>{currentService.name}</DialogTitle>
                            <DialogDescription>{currentService.description}</DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            {currentService.advantages && (
                              <div>
                                <h4 className="font-semibold text-foreground">Ventajas</h4>
                                <ul className="text-sm text-muted-foreground list-disc pl-5 mt-2">
                                  {currentService.advantages.map((advantage, i) => <li key={i}>{advantage}</li>)}
                                </ul>
                              </div>
                            )}
                            {currentService.trial && (
                              <div className="p-4 rounded-md border bg-secondary/50 text-center">
                                <p className="font-bold text-primary">{currentService.trial}</p>
                              </div>
                            )}
                          </div>
                          <DialogFooter>
                            {currentService.whatsappMessage ? (
                              <Button size="lg" className="w-full" onClick={() => setServiceDialogView('form')}>
                                AGENDAR CLASE
                              </Button>
                            ) : <DialogClose asChild><Button size="lg" className="w-full" variant="outline">Cerrar</Button></DialogClose>}
                          </DialogFooter>
                        </>
                      )}
                      {serviceDialogView === 'form' && currentService.whatsappMessage && (
                        <>
                          <DialogHeader>
                            <DialogTitle>Agendar Clase de Prueba</DialogTitle>
                            <DialogDescription>Para personalizar tu experiencia, por favor dinos tu nombre.</DialogDescription>
                          </DialogHeader>
                          <div className="py-4 space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="trial-name">Tu Nombre</Label>
                              <Input
                                id="trial-name"
                                placeholder="Nombre Completo"
                                value={trialUserName}
                                onChange={(e) => setTrialUserName(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setServiceDialogView('details')}>Volver</Button>
                            <Button asChild size="lg" disabled={!trialUserName.trim()}>
                              <a
                                href={`https://wa.me/529901443886?text=${encodeURIComponent(currentService.whatsappMessage.replace('{name}', trialUserName.trim()))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Enviar WhatsApp
                              </a>
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

        {/* Section: Eventos */}
        <section
          id="eventos"
          ref={(el) => (sectionRefs.current[4] = el)}
          className="min-h-screen flex items-center py-20 bg-background"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Próximos <span className="text-primary">Eventos</span></h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
                Mantente al día de nuestros próximos seminarios, competiciones y eventos especiales. No te quedes fuera del octágono.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {events.map((event) => (
                <Dialog key={event.id} onOpenChange={(isOpen) => { if (!isOpen) { setDialogView('details'); setCurrentRegistrationId(''); } }}>
                  <DialogTrigger asChild>
                    <Card className="group overflow-hidden cursor-pointer" onClick={() => setCurrentEvent(event)}>
                      <Image src={event.image} data-ai-hint="competition" alt={event.name} width={400} height={300} className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
                      <CardContent className="p-4">
                        <h3 className="text-xl font-bold">{event.name}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{event.card_description}</p>
                        <p className="text-primary font-bold text-lg mt-2">{event.date}</p>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    {dialogView === 'details' && (
                      <>
                        <DialogHeader>
                          <DialogTitle>{event.name}</DialogTitle>
                          <DialogDescription>{event.date}</DialogDescription>
                        </DialogHeader>
                        <div className="py-4 space-y-4">
                          <Image src={event.image} alt={event.name} width={400} height={225} className="w-full aspect-video rounded-md object-cover" />
                          <div className="space-y-3">
                             <div>
                                <h4 className="font-semibold text-foreground">Descripción</h4>
                                <p className="text-sm text-muted-foreground">{event.description}</p>
                            </div>
                            <div>
                                <h4 className="font-semibold text-foreground">Información Adicional</h4>
                                <p className="text-sm text-muted-foreground">{event.info}</p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center pt-2">
                            <p className="text-3xl font-black text-primary tracking-tighter">{event.price}</p>
                            <Button size="lg" disabled={event.id === 'proximamente-evento'} onClick={() => setDialogView('form')}>INSCRIBIRSE</Button>
                          </div>
                        </div>
                      </>
                    )}

                    {dialogView === 'form' && (
                        <>
                            <DialogHeader>
                              <DialogTitle>Registro para {currentEvent?.name}</DialogTitle>
                              <DialogDescription>
                                Completa tus datos o{" "}
                                <Button variant="link" className="p-0 h-auto text-primary" onClick={() => setDialogView('code')}>
                                  inscribe con código
                                </Button>
                                .
                              </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleFinalizeRegistration} className="py-4 space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="fullName">Nombre Completo</Label>
                                <Input id="fullName" name="fullName" placeholder="Nombre y Apellido" required />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="age">Edad</Label>
                                  <Input id="age" name="age" type="number" placeholder="25" required />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="category">Categoría</Label>
                                  <Input id="category" name="category" placeholder="Ej. Peso Pluma" required />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="birthDate">Fecha de Nacimiento</Label>
                                <Input id="birthDate" name="birthDate" type="date" required />
                              </div>
                              <Separator />
                              <h4 className="text-sm font-medium text-muted-foreground">Datos Opcionales</h4>
                              <div className="space-y-2">
                                <Label htmlFor="curp">CURP</Label>
                                <Input id="curp" name="curp" placeholder="Clave Única de Registro de Población" />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="phone">Teléfono Celular</Label>
                                  <Input id="phone" name="phone" type="tel" placeholder="999-999-9999" />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="email">Correo Electrónico</Label>
                                  <Input id="email" name="email" type="email" placeholder="atleta@email.com" />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogView('details')} type="button">Volver</Button>
                                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registrando...' : 'Finalizar Inscripción'}</Button>
                              </DialogFooter>
                            </form>
                          </>
                    )}

                    {dialogView === 'payment' && (
                         <>
                            <DialogHeader>
                              <DialogTitle>¡Inscripción Recibida!</DialogTitle>
                              <DialogDescription>
                                Para completar tu registro para {currentEvent?.name}, realiza el pago de <span className="font-bold text-primary">{currentEvent?.price}</span>.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-6">
                              <div className="p-4 rounded-md border bg-secondary/50">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-sm text-muted-foreground">Tu número de referencia:</p>
                                  <Button variant="ghost" size="icon" onClick={() => handleCopyToClipboard(currentRegistrationId)}>
                                    <Copy className="h-4 w-4" />
                                    <span className="sr-only">Copiar referencia</span>
                                  </Button>
                                </div>
                                <p className="text-2xl font-bold font-mono text-center">{currentRegistrationId}</p>
                                <p className="text-xs text-muted-foreground text-center mt-1">Usa esta referencia en el concepto de tu pago.</p>
                              </div>
                              <div className="space-y-4">
                                <div>
                                  <h4 className="font-semibold text-foreground mb-2">Opción 1: Transferencia Bancaria</h4>
                                  <ul className="text-sm text-muted-foreground list-none space-y-1 p-4 border rounded-md">
                                    <li><span className="font-semibold text-foreground">CLABE:</span> 722969020451950629</li>
                                    <li><span className="font-semibold text-foreground">Beneficiario:</span> Jorge Vega Cortes</li>
                                    <li><span className="font-semibold text-foreground">Institución:</span> Mercado Pago</li>
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-foreground mb-2">Opción 2: Tarjeta de Crédito/Débito</h4>
                                  <Button asChild className="w-full" size="lg">
                                    <a href="https://mpago.la/2GBPeGU" target="_blank" rel="noopener noreferrer">
                                      Pagar con Mercado Pago
                                    </a>
                                  </Button>
                                </div>
                              </div>
                              <Separator />
                              <div>
                                <h4 className="font-semibold text-foreground mb-2">Paso Final: Confirmar Pago</h4>
                                <p className="text-sm text-muted-foreground mb-3">
                                  Una vez realizado el pago, envíanos tu comprobante por WhatsApp para asegurar tu lugar.
                                </p>
                                <Button asChild className="w-full">
                                  <a
                                    href={`https://wa.me/529901443886?text=Hola, he completado mi inscripción al evento "${currentEvent?.name}". Mi referencia de pago es ${currentRegistrationId}. Adjunto mi comprobante.`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Notificar Pago por WhatsApp
                                  </a>
                                </Button>
                              </div>
                            </div>
                            <DialogFooter>
                              <DialogClose asChild>
                                <Button variant="outline">Cerrar</Button>
                              </DialogClose>
                            </DialogFooter>
                          </>
                    )}

                    {dialogView === 'code' && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Inscripción con Código</DialogTitle>
                                <DialogDescription>Ingresa el código que te proporcionó tu profesor para registrarte en {currentEvent?.name}.</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleCodeRegistration} className="py-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="eventCode">Código de Profesor</Label>
                                    <Input id="eventCode" name="eventCode" placeholder="Ingresa tu código" required />
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setDialogView('form')} type="button">Volver</Button>
                                    <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Confirmando...' : 'Confirmar Código'}</Button>
                                </DialogFooter>
                            </form>
                        </>
                    )}
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Productos */}
        <section
          id="productos"
          ref={(el) => (sectionRefs.current[5] = el)}
          className="min-h-screen flex items-center py-20 bg-card"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Nuestros <span className="text-primary">Productos</span></h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
                Equipamiento de élite para el guerrero moderno. Testeado en combate, construido para durar.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
               {products.map((product) => (
                <Dialog key={product.id}>
                  <DialogTrigger asChild>
                    <Card className="group overflow-hidden cursor-pointer">
                      <Image src={product.image} alt={product.name} width={400} height={300} className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
                      <CardContent className="p-4">
                        <h3 className="text-xl font-bold">{product.name}</h3>
                        <p className="text-muted-foreground text-sm mt-1">{product.description}</p>
                        <p className="text-primary font-bold text-lg mt-2">{product.price}</p>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>{product.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                      <Image src={product.image} alt={product.name} width={400} height={300} className="w-full rounded-md object-cover" />
                      <div>
                        <Label className="text-base font-medium">Talla</Label>
                        <RadioGroup defaultValue="M" className="flex gap-2 mt-2">
                          {product.sizes.map(size => (
                            <Label
                              key={size}
                              htmlFor={`size-${product.id}-${size}`}
                              className="flex items-center justify-center border rounded-md p-2 text-sm font-medium cursor-pointer has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:checked]:border-primary aspect-square w-12 h-12"
                            >
                              <RadioGroupItem value={size} id={`size-${product.id}-${size}`} className="sr-only" />
                              {size}
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <p className="text-3xl font-black text-primary tracking-tighter">{product.price}</p>
                        <Button size="lg">Comprar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Contacto */}
        <footer
          id="contacto"
          ref={(el) => (sectionRefs.current[6] = el)}
          className="bg-card py-20"
        >
          <div className="container mx-auto text-center px-4">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter">Establecer <span className="text-primary">Contacto</span></h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">¿Listo para el siguiente nivel? Aquí nos encuentras. No pierdas nuestro tiempo.</p>
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <a href="https://maps.app.goo.gl/epiGiZkjwYH3Mk938" target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row items-center gap-4 p-4 -m-4 rounded-lg hover:bg-accent transition-colors">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg flex-shrink-0">
                        <MapPin className="h-8 w-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Ubicación</h3>
                        <p className="text-muted-foreground">Calle 114, Cd. Caulcel Supermanzana 2,
                        <br/>Cp: 97314. Merida Yucatán</p>
                    </div>
                </a>
                <a href="https://wa.me/message/MLU5C2HUNOCEN1" target="_blank" rel="noopener noreferrer" className="flex flex-col md:flex-row items-center gap-4 p-4 -m-4 rounded-lg hover:bg-accent transition-colors">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg flex-shrink-0">
                        <Phone className="h-8 w-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Teléfono</h3>
                        <p className="text-muted-foreground">+52 990 144 3886</p>
                    </div>
                </a>
                 <div className="flex flex-col md:flex-row items-center gap-4 p-4 -m-4 rounded-lg hover:bg-accent transition-colors">
                    <div className="bg-primary/10 text-primary p-4 rounded-lg flex-shrink-0">
                        <Mail className="h-8 w-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Email</h3>
                        <p className="text-muted-foreground">administrador@albatrosbjj.com</p>
                    </div>
                </div>
            </div>
             <div className="mt-16 border-t pt-8 text-sm text-muted-foreground">
                <p>&copy; {new Date().getFullYear()} Albatros Performance. Todos los derechos reservados. Forjado en combate.</p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

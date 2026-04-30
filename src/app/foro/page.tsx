
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Lock, MessageSquare, ArrowLeft, BookOpen, GraduationCap, ChevronRight, Layout, PlayCircle, Info, Filter, ShieldAlert, HeartPulse, BrainCircuit, Activity, AlertTriangle, Trophy, Gi, Shirt } from "lucide-react";
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const CATEGORIES = ['Todas', 'Sumisiones', 'Derribos', 'Escapes', 'Controles', 'Pases de guardia'] as const;
type Category = typeof CATEGORIES[number];

const MODALITIES = ['Todas', 'Con Gi', 'Sin Gi', 'Mixto'] as const;
type Modality = typeof MODALITIES[number];

const NIVEL_1_TECNICAS = [
  // 1.1: Fundamentos de Sumisión
  { 
    id: '1.1', 
    name: 'Mataleón', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia', 
    description: 'Rear Naked Choke (RNC). Estrangulación sanguínea definitiva desde la espalda.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Asfixia sanguínea (vascular)',
      mechanism: 'Oclusión del flujo sanguíneo cerebral',
      difficultyNote: 'Fácil de aprender, difícil de perfeccionar.',
      principles: [
        'Control de espalda (back control)',
        'Inserción profunda del brazo bajo el mentón',
        'Cierre del sistema brazo-bíceps-cabeza',
        'Control de la cabeza del oponente',
        'Conexión pecho-espalda'
      ],
      mechanics: [
        'Inserción: El antebrazo se desliza debajo del mentón, alineado con las carótidas.',
        'Cierre: Mano del brazo estrangulador al bíceps opuesto; mano libre tras la cabeza.',
        'Presión: Aducción de brazos, retracción escapular y expansión torácica.'
      ],
      medical: {
        structures: ['Arterias carótidas comunes e internas', 'Venas yugulares', 'Seno carotídeo'],
        physiological: [
          'Oclusión bilateral de arterias carótidas.',
          'Disminución del flujo sanguíneo cerebral (CBF).',
          'Disminución de aporte de O2 y glucosa.',
          'Isquemia cerebral aguda transitoria.'
        ],
        nervous: [
          'Estimulación del seno carotídeo.',
          'Activación del sistema parasimpático (nervio vago).',
          'Bradiacardia y disminución de presión arterial.'
        ],
        venous: 'Compresión de venas yugulares que aumenta la presión intracraneal.',
        time: '5 a 10 segundos para la pérdida de consciencia.'
      },
      biomechanics: {
        type: 'Compresión lateral del cuello (no directa sobre tráquea).',
        vectors: ['Medial (hacia el centro)', 'Posterior (hacia atrás)'],
        elements: [
          'Brazo estrangulador: Generador principal.',
          'Brazo de soporte: Cierra el sistema.',
          'Pecho: Estabiliza.',
          'Hombros: Compresión final.'
        ]
      },
      errors: [
        'Comprimir la tráquea en lugar de las carótidas.',
        'Inserción profunda insuficiente.',
        'Falta de control de la cabeza.',
        'Codos abiertos.',
        'Falta de conexión pecho-espalda.'
      ],
      highLevel: [
        'Ocultar la mano estranguladora para evitar defensas.',
        'Control previo del mentón.',
        'Microajustes en lugar de fuerza bruta.',
        'Presión progresiva.'
      ],
      safety: [
        'Liberar inmediatamente al tap.',
        'No mantener tras pérdida de consciencia.',
        'Evitar aplicación brusca.',
        'Practicar bajo supervisión.'
      ],
      competition: 'Alta efectividad en Gi, No-Gi y MMA. Considerada la sumisión reina del Grappling.',
      concept: 'El mata león no corta el aire, corta el flujo sanguíneo hacia el cerebro.'
    }
  },
  { 
    id: '1.2', 
    name: 'Armbar', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia', 
    description: 'Juji Gatame. Palanca de brazo fundamental basada en hiperextensión del codo.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Hiperextensión',
      mechanism: 'Hiperextensión de la articulación húmero-ulnar',
      difficultyNote: 'Técnica fundamental, pero con alto nivel de detalle en control y ángulos.',
      principles: [
        'Aislamiento del brazo del oponente',
        'Control distal (muñeca) y proximal (hombro)',
        'Alineación de la palanca (pulgar hacia arriba)',
        'Uso de la cadera como fulcro/punto de apoyo',
        'Control de la línea del brazo'
      ],
      mechanics: [
        'Control: Sujeción firme de la muñeca alineando el codo con la cadera propia.',
        'Posicionamiento: Cadera debajo del codo del rival, piernas controlando el torso.',
        'Finalización: Elevación de cadera mientras se tracciona el brazo hacia abajo.'
      ],
      medical: {
        structures: [
          'Articulación húmero-ulnar',
          'Ligamento colateral ulnar (UCL)',
          'Ligamento colateral radial (RCL)',
          'Cápsula articular del codo',
          'Tendones flexores y extensores'
        ],
        physiological: [
          'Hiperextensión forzada superando los 0° de extensión fisiológica.',
          'Estrés ligamentario progresivo en el compartimento medial.',
          'Daño capsular anterior por tracción excesiva.',
          'Secuencia: Estiramiento -> Microdesgarros -> Ruptura -> Luxación.'
        ],
        nervous: [
          'Activación de nociceptores por distensión capsular.',
          'Dolor intenso por compromiso de fibras nerviosas periféricas.'
        ],
        time: 'Inmediato (daño estructural si se ignora el tap)'
      },
      biomechanics: {
        type: 'Palanca de primer género (Balancín)',
        vectors: ['Extensión longitudinal del brazo', 'Elevación vertical de la cadera'],
        elements: [
          'Punto de apoyo: Cadera del ejecutor',
          'Resistencia: Articulación del codo del oponente',
          'Fuerza: Tracción manual + Puente de cadera'
        ]
      },
      errors: [
        'Cadera demasiado lejos del codo (pérdida de palanca).',
        'No controlar la dirección del pulgar.',
        'Rodillas abiertas permitiendo el escape del hombro.',
        'Falta de control del torso del oponente.',
        'Movimientos explosivos sin control previo.'
      ],
      highLevel: [
        'Mantener rodillas cerradas para aislar el hombro.',
        'Controlar la rotación del pulgar durante toda la técnica.',
        'Romper la postura del oponente antes de intentar la luxación.',
        'Pierna sobre la cabeza para evitar que el oponente se siente.'
      ],
      safety: [
        'Aplicar presión de forma progresiva y con control.',
        'Liberar inmediatamente al sentir el tap.',
        'Cuidado con principiantes.',
        'Evitar aplicación brusca.'
      ],
      competition: 'Fundamental en Gi, No-Gi y MMA.',
      concept: 'El armbar no depende de fuerza, sino de palanca.'
    }
  },
  { 
    id: '1.3', 
    name: 'Americana', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia', 
    description: 'Keylock. Ataque al hombro y codo desde posición lateral o montada.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional (rotación interna)',
      mechanism: 'Rotación interna forzada de la articulación glenohumeral',
      difficultyNote: 'Técnica accesible, pero dependiente del control posicional.',
      principles: [
        'Control del torso (side control / montada)',
        'Control distal (muñeca fijada al suelo)',
        'Ángulo de 90° en el brazo del oponente',
        'Elevación del codo como fulcro',
        'Inmovilización del hombro del oponente'
      ],
      mechanics: [
        'Control: Muñeca del oponente fija al suelo con el codo a 90° (forma de L).',
        'Agarre: Agarre de figura 4 (una mano a la muñeca, la otra bajo el brazo a tu propia muñeca).',
        'Finalización: Elevar el codo del oponente deslizando la muñeca por el suelo.'
      ],
      medical: {
        structures: ['Articulación glenohumeral', 'Manguito rotador', 'Labrum glenoideo'],
        physiological: ['Rotación interna forzada del húmero.', 'Estrés en cápsula anterior.'],
        time: 'Progresivo.'
      },
      biomechanics: {
        type: 'Palanca rotacional',
        vectors: ['Rotación interna', 'Elevación vertical'],
        elements: ['Punto de apoyo: Hombro', 'Fuerza: Elevación codo']
      },
      errors: ['Separar muñeca del suelo', 'No mantener 90 grados'],
      highLevel: ['Controlar escápula'],
      safety: ['Presión progresiva'],
      competition: 'Efectiva en posiciones dominantes.',
      concept: 'La americana utiliza el suelo como tope.'
    }
  },
  { 
    id: '1.4', 
    name: 'Kimura', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia', 
    description: 'Double Wrist Lock. Rotación de hombro utilizando el agarre de figura 4.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional',
      mechanism: 'Rotación interna forzada del hombro.',
      difficultyNote: 'Requiere buen control posicional.',
      principles: ['Aislamiento brazo', 'Figura 4'],
      mechanics: ['Control muñeca', 'Cierre figura 4', 'Elevación codo'],
      medical: {
        structures: ['Articulación glenohumeral', 'Cápsula posterior'],
        physiological: ['Rotación interna forzada.'],
        time: 'Inmediato.'
      },
      biomechanics: {
        type: 'Palanca rotacional doble',
        vectors: ['Rotación interna'],
        elements: ['Cierre: Brazos ejecutor']
      },
      errors: ['Espacios figura 4'],
      highLevel: ['Usar cuerpo entero'],
      safety: ['Presión progresiva'],
      competition: 'Muy versátil.',
      concept: 'Sistema de control y palanca.'
    }
  },
  { 
    id: '1.5', 
    name: 'Guillotina', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia', 
    description: 'Estrangulación frontal al cuello, efectiva en transiciones.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta',
      mechanism: 'Compresión carótidas o tráquea.',
      difficultyNote: 'Sensible a detalles.',
      principles: ['Control cabeza', 'Elevación antebrazo'],
      mechanics: ['Rodeo cuello', 'Cierre agarre', 'Elevación antebrazo'],
      medical: {
        structures: ['Carótidas', 'Tráquea'],
        physiological: ['Hipoxia cerebral o aérea.'],
        time: '5-10s (vascular).'
      },
      biomechanics: {
        type: 'Compresión + Flexión',
        vectors: ['Compresión anterior'],
        elements: ['Dorsales y core']
      },
      errors: ['Falta control cadera'],
      highLevel: ['High Elbow'],
      safety: ['No explosivo'],
      competition: 'Excelente contra derribos.',
      concept: 'Compresión frontal letal.'
    }
  },
  // 1.2: Ataques de Solapa y Piernas
  { 
    id: '1.6', 
    name: 'Ezekiel Choke', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia', 
    description: 'Sode Guruma Jime. Estrangulación de antebrazo utilizando la propia manga o presión directa.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta',
      mechanism: 'Compresión en tijera sobre el cuello.',
      difficultyNote: 'Depende del timing.',
      principles: ['Inserción profunda'],
      mechanics: ['Brazo posterior rodea', 'Brazo frontal empuja'],
      medical: {
        structures: ['Carótidas', 'Tráquea'],
        physiological: ['Compresión bilateral.'],
        time: '5-10s.'
      },
      biomechanics: {
        type: 'Compresión tijera',
        vectors: ['Lateral y anterior'],
        elements: ['Pecho amplificador']
      },
      errors: ['No cerrar espacio'],
      highLevel: ['Ajuste progresivo'],
      safety: ['Liberar al tap'],
      competition: 'Ataque sorpresa efectivo.',
      concept: 'Efecto tijera sobre el cuello.'
    }
  },
  { 
    id: '1.7', 
    name: 'Collar Choke desde guardia', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Intermedia', 
    description: 'Cross Collar Choke from Guard. Estrangulación vascular utilizando las solapas del gi.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      mechanism: 'Oclusión bilateral carótidas.',
      difficultyNote: 'Precisión en agarres.',
      principles: ['Romper postura', 'Agarre profundo'],
      mechanics: ['Mano profunda solapa', 'Cerrar codos'],
      medical: {
        structures: ['Carótidas', 'Vago'],
        physiological: ['Isquemia transitoria.'],
        time: '5-10s.'
      },
      biomechanics: {
        type: 'Tensión solapas',
        vectors: ['Compresión medial'],
        elements: ['Piernas control postura']
      },
      errors: ['Codos abiertos'],
      highLevel: ['Jalar con piernas'],
      safety: ['Progresivo'],
      competition: 'Clásica de Gi.',
      concept: 'Tensión coordinada.'
    }
  },
  { 
    id: '1.8', 
    name: 'Collar Choke desde montada', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Básica a Intermedia', 
    description: 'Cross Collar Choke from Mount. Estrangulación vascular desde posición dominante.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      mechanism: 'Oclusión bilateral carótidas.',
      difficultyNote: 'Control posicional.',
      principles: ['Estabilidad montada', 'Peso adelante'],
      mechanics: ['Agarre profundo', 'Cerrar codos', 'Peso adelante'],
      medical: {
        structures: ['Carótidas'],
        physiological: ['Reducción flujo sanguíneo.'],
        time: '5-10s.'
      },
      biomechanics: {
        type: 'Presión descendente',
        vectors: ['Compresión + Peso'],
        elements: ['Core estabilización']
      },
      errors: ['Falta estabilidad'],
      highLevel: ['Microángulos antebrazo'],
      safety: ['Liberar al tap'],
      competition: 'Muy alta efectividad.',
      concept: 'Tensión + Gravedad.'
    }
  },
  { 
    id: '1.9', 
    name: 'Bow and Arrow', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Intermedia', 
    description: 'Sumisión de Gi utilizando solapa y pantalón.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      mechanism: 'Compresión potente mediante solapa y extensión.',
      difficultyNote: 'Control espalda.',
      principles: ['Control sólido', 'Extensión oponente'],
      mechanics: ['Mano solapa', 'Mano pantalón', 'Abrir ángulo'],
      medical: {
        structures: ['Carótidas'],
        physiological: ['Oclusión masiva.'],
        time: '5-10s.'
      },
      biomechanics: {
        type: 'Compresión + Tracción',
        vectors: ['Arco y Flecha'],
        elements: ['Pierna amplificador']
      },
      errors: ['Falta extensión'],
      highLevel: ['Pierna palanca'],
      safety: ['Evitar tirones bruscos'],
      competition: 'Reina del Gi.',
      concept: 'Tensión opuesta extrema.'
    }
  },
  { 
    id: '1.10', 
    name: 'Triángulo', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Intermedia', 
    description: 'Estrangulación de piernas desde la guardia.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      mechanism: 'Oclusión carótidas con piernas y hombro.',
      difficultyNote: 'Coordinación y ángulo.',
      principles: ['Aislamiento brazo', 'Ángulo'],
      mechanics: ['Piernas figura 4', 'Cerrar rodillas', 'Elevar cadera'],
      medical: {
        structures: ['Carótidas'],
        physiological: ['Isquemia bilateral.'],
        time: '5-10s.'
      },
      biomechanics: {
        type: 'Compresión lateral piernas',
        vectors: ['Compresión medial'],
        elements: ['Cadera motor principal']
      },
      errors: ['No crear ángulo'],
      highLevel: ['Cortar ángulo antes'],
      safety: ['Progresivo'],
      competition: 'Sumamente efectiva.',
      concept: 'Sistema de piernas y ángulos.'
    }
  },
  // Otros
  { id: '1.11', name: 'Double Leg', category: 'Derribos', modality: 'Mixto', difficulty: 'Básica', description: 'Derribo fundamental atacando ambas piernas.' },
  { id: '1.12', name: 'Escape de Montada (Upa)', category: 'Escapes', modality: 'Mixto', difficulty: 'Básica', description: 'Escape explosivo usando puente y balance.' },
];

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');
  const [activeModality, setActiveModality] = useState<Modality>('Todas');
  const [selectedTecnica, setSelectedTecnica] = useState<typeof NIVEL_1_TECNICAS[0] | null>(null);

  const CORRECT_PASSWORD = "SoyTeamAlbatrosBjj";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  const filteredTecnicas = useMemo(() => {
    let result = NIVEL_1_TECNICAS;
    
    // Filtro por categoría
    if (activeCategory !== 'Todas') {
      result = result.filter(t => t.category === activeCategory);
    }
    
    // Filtro por modalidad
    if (activeModality !== 'Todas') {
      result = result.filter(t => t.modality === activeModality);
    }
    
    // Ordenar por dificultad (aquí asumimos el orden del array como dificultad ascendente/predeterminada)
    return result;
  }, [activeCategory, activeModality]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Link href="/" className="absolute top-4 left-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
        </Link>
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-6">
              <Logo />
            </div>
            <CardTitle className="text-2xl font-black tracking-tighter uppercase">Acceso al Foro</CardTitle>
            <CardDescription>Solo para guerreros del equipo. Introduce la contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña de equipo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn("bg-background", error && "border-destructive")}
                />
                {error && <p className="text-xs text-destructive font-medium">Contraseña incorrecta. Solo los Albatros pasan aquí.</p>}
              </div>
              <Button type="submit" className="w-full font-bold uppercase tracking-widest">
                <Lock className="mr-2 h-4 w-4" /> Entrar al Nido
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista Detallada de Técnica
  if (selectedTecnica) {
    const details = selectedTecnica.detailedInfo;
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <header className="flex justify-between items-center mb-8">
          <Button variant="ghost" onClick={() => setSelectedTecnica(null)}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Biblioteca
          </Button>
          <Logo />
        </header>

        <div className="max-w-4xl mx-auto space-y-8">
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary text-white font-black">{selectedTecnica.id}</Badge>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic">{selectedTecnica.name}</h1>
            </div>
            <p className="text-xl text-muted-foreground italic">"{details?.concept || selectedTecnica.description}"</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-primary/30 text-primary">{details?.type || selectedTecnica.category}</Badge>
              <Badge variant="secondary">{selectedTecnica.modality}</Badge>
              <Badge variant="secondary">{selectedTecnica.difficulty}</Badge>
            </div>
          </section>

          <Separator className="bg-primary/20" />

          {details ? (
            <div className="grid gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-card/30 border-primary/10">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                      <BrainCircuit className="h-5 w-5 text-primary" /> Principios Críticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {details.principles.map((p, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card className="bg-card/30 border-primary/10">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" /> Mecánica de Ejecución
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {details.mechanics.map((m, i) => (
                        <li key={i} className="text-sm text-muted-foreground border-l-2 border-primary/20 pl-3">
                          {m}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="medical" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 font-black uppercase text-sm">
                      <HeartPulse className="h-5 w-5 text-primary" /> Comprensión Médica y Fisiológica
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs uppercase text-primary">Estructuras Afectadas</h5>
                        <div className="flex flex-wrap gap-1">
                          {details.medical.structures.map((s, i) => <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>)}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h5 className="font-bold text-xs uppercase text-primary">Respuesta Nerviosa</h5>
                        <ul className="text-xs space-y-1">
                          {details.medical.nervous?.map((n: string, i: number) => <li key={i}>• {n}</li>)}
                          {!details.medical.nervous && <li>• Respuesta de estrés autonómico típica de estrangulación.</li>}
                        </ul>
                      </div>
                    </div>
                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                       <h5 className="font-bold text-xs uppercase text-primary mb-2">Mecanismo Fisiológico Principal</h5>
                       <ul className="text-sm space-y-1 italic">
                          {details.medical.physiological.map((p, i) => <li key={i}>{p}</li>)}
                       </ul>
                       {details.medical.time && (
                         <p className="mt-4 text-xs font-bold text-center uppercase tracking-widest text-primary">Efecto Estimado: {details.medical.time}</p>
                       )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="biomechanics" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 font-black uppercase text-sm">
                      <Activity className="h-5 w-5 text-primary" /> Biomecánica y Vectores
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <p className="text-sm font-medium">{details.biomechanics.type}</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-bold text-xs uppercase text-primary mb-2">Vectores de Fuerza</h5>
                        {details.biomechanics.vectors.map((v, i) => <p key={i} className="text-xs">• {v}</p>)}
                      </div>
                      <div>
                        <h5 className="font-bold text-xs uppercase text-primary mb-2">Elementos Clave</h5>
                        {details.biomechanics.elements.map((e, i) => <p key={i} className="text-xs">• {e}</p>)}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="errors" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 font-black uppercase text-sm text-destructive">
                      <AlertTriangle className="h-5 w-5" /> Errores Comunes y Seguridad
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs uppercase">Errores que te hacen perder la técnica:</h5>
                      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {details.errors.map((e, i) => <li key={i} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">✕ {e}</li>)}
                      </ul>
                    </div>
                    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                       <h5 className="font-bold text-xs uppercase text-destructive flex items-center gap-2 mb-2">
                        <ShieldAlert className="h-4 w-4" /> Protocolo de Seguridad
                       </h5>
                       <ul className="text-xs space-y-1">
                          {details.safety.map((s, i) => <li key={i}>• {s}</li>)}
                       </ul>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="pro" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 font-black uppercase text-sm text-primary">
                      <Trophy className="h-5 w-5" /> Detalles de Alto Nivel
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <div className="bg-card p-4 border rounded-lg border-primary/20 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {details.highLevel.map((h, i) => (
                          <div key={i} className="text-xs font-mono p-2 border-b border-primary/10">{h}</div>
                        ))}
                      </div>
                      <p className="text-sm font-bold italic text-center p-2 bg-primary/10 rounded">"{details.competition}"</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed rounded-lg">
              <p className="text-muted-foreground italic">Detalles técnicos en proceso de carga para esta técnica.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vista de Técnicas del Nivel 1
  if (activeModule === 'nivel-1') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Logo />
            <Separator orientation="vertical" className="h-8 hidden md:block" />
            <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Nivel 1: Biblioteca Técnica</h1>
          </div>
          <Button variant="ghost" onClick={() => { setActiveModule(null); setActiveCategory('Todas'); setActiveModality('Todas'); }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Módulos
          </Button>
        </header>

        <div className="max-w-6xl mx-auto space-y-8">
          {/* Barra de Filtros */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Filtro Especialidad */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Filter className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Especialidad</span>
                    </div>
                    <ScrollArea className="w-full whitespace-nowrap pb-4">
                        <div className="flex w-max space-x-2">
                            {CATEGORIES.map((cat) => (
                            <Button
                                key={cat}
                                variant={activeCategory === cat ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveCategory(cat)}
                                className={cn(
                                "font-bold uppercase tracking-tighter text-[11px]",
                                activeCategory === cat ? "bg-primary" : "hover:border-primary/50"
                                )}
                            >
                                {cat}
                            </Button>
                            ))}
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </div>

                {/* Filtro Modalidad */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                        <Layout className="h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Modalidad</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {MODALITIES.map((mod) => (
                            <Button
                                key={mod}
                                variant={activeModality === mod ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveModality(mod)}
                                className={cn(
                                    "font-bold uppercase tracking-tighter text-[11px]",
                                    activeModality === mod ? "bg-primary" : "hover:border-primary/50"
                                )}
                            >
                                {mod === 'Con Gi' && <Gi className="mr-1.5 h-3 w-3" />}
                                {mod === 'Sin Gi' && <Shirt className="mr-1.5 h-3 w-3" />}
                                {mod}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTecnicas.map((tecnica) => (
              <Card key={tecnica.id} className="bg-card/40 border-primary/10 hover:border-primary/40 transition-all group">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20">{tecnica.id}</Badge>
                        <Badge variant="secondary" className="text-[10px] uppercase font-black">{tecnica.modality}</Badge>
                    </div>
                    <Badge className="text-[10px] uppercase">{tecnica.category}</Badge>
                  </div>
                  <CardTitle className="text-xl font-black uppercase italic group-hover:text-primary transition-colors">
                    {tecnica.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tecnica.description}
                  </p>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Dificultad: {tecnica.difficulty}</span>
                    <Button size="sm" className="font-bold uppercase tracking-tighter" onClick={() => setSelectedTecnica(tecnica)}>
                      <PlayCircle className="mr-1 h-4 w-4" /> Ver Detalles
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredTecnicas.length === 0 && (
              <div className="col-span-full py-20 text-center border border-dashed rounded-lg bg-muted/20">
                <p className="text-muted-foreground italic font-medium">Aún no hay técnicas registradas con estos filtros en el Nivel 1.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Dashboard del Foro
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Logo />
          <Separator orientation="vertical" className="h-8 hidden md:block" />
          <h1 className="text-3xl font-black tracking-tighter uppercase text-primary italic">Foro Albatros</h1>
        </div>
        <Link href="/">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" /> Salir del Foro
          </Button>
        </Link>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-widest">
            <GraduationCap className="h-3 w-3" /> Area de Entrenamiento
          </div>
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">¡Bienvenido al Nido, Guerrero!</h2>
          <h3 className="text-xl font-bold uppercase tracking-tight">Análisis Técnico y Tutoriales</h3>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Este es tu centro de comando técnico. Aquí tendrás acceso exclusivo a tutoriales detallados, 
            desgloses estratégicos y anotaciones de técnicas avanzadas. Todo nuestro arsenal está 
            dividido por nivel y dificultad para que tu progresión sea constante y letal.
          </p>
        </section>

        <Separator className="bg-primary/20" />

        <section className="grid gap-6">
          <h3 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2">
            <Layout className="h-5 w-5 text-primary" /> Módulos Disponibles
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="group hover:border-primary transition-all duration-300 bg-card/40 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black tracking-tight text-primary uppercase">Nivel 1</CardTitle>
                <CardDescription className="font-bold text-foreground">Cinta blanca principiante</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground italic">
                  Fundamentos críticos, movilidad básica y escapes esenciales. El cimiento de tu juego de combate.
                </p>
                <Button 
                  onClick={() => setActiveModule('nivel-1')}
                  className="w-full font-black uppercase tracking-tighter group-hover:bg-primary group-hover:text-white transition-colors"
                >
                  Explorar Técnicas <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            <Card className="opacity-50 grayscale border-dashed bg-muted/20">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-black tracking-tight uppercase">Nivel 2</CardTitle>
                <CardDescription className="font-bold">Intermedio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">
                  Próximamente disponible. Enfocado en transiciones y ataques encadenados.
                </p>
                <Button disabled className="w-full mt-4 font-black uppercase tracking-tighter" variant="secondary">
                   <Lock className="mr-2 h-4 w-4" /> Bloqueado
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="p-6 rounded-lg border border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h4 className="font-bold uppercase tracking-tight">¿Dudas sobre la técnica?</h4>
              <p className="text-sm text-muted-foreground">Consulta directamente con el equipo de instructores.</p>
            </div>
          </div>
          <Button variant="outline" asChild>
            <a href="https://wa.me/message/MLU5C2HUNOCEN1" target="_blank" rel="noopener noreferrer">Consultar por WhatsApp</a>
          </Button>
        </section>
      </div>
    </div>
  );
}

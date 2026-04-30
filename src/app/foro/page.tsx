'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Lock, MessageSquare, ArrowLeft, ChevronRight, Layout, PlayCircle, Filter, ShieldAlert, HeartPulse, BrainCircuit, Activity, AlertTriangle, Trophy, ListFilter, SortAsc, CheckCircle2 } from "lucide-react";
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

type Difficulty = 'Básica' | 'Básica a Intermedia' | 'Intermedia' | 'Avanzada';
const difficultyOrder: Record<Difficulty, number> = {
  'Básica': 1,
  'Básica a Intermedia': 2,
  'Intermedia': 3,
  'Avanzada': 4,
};

const NIVEL_1_TECNICAS = [
  // 1.1: Con Gi
  { 
    id: '1.7', 
    name: 'Collar Choke (Guardia)', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Cross Collar Choke from Guard. Estrangulación vascular utilizando las solapas del gi.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Romper postura', 'Agarre profundo', 'Cerrar codos'],
      mechanics: ['Primer agarre a nuca.', 'Segundo agarre cruzado.', 'Cerrar codos.'],
      medical: { structures: ['Carótidas'], physiological: ['Oclusión bilateral.'], time: '5-10s' },
      biomechanics: { type: 'Tensión solapas', vectors: ['Compresión medial'], elements: ['Piernas (jalón)'] },
      errors: ['Codos abiertos', 'Agarre superficial'],
      highLevel: ['Usar piernas para jalar'],
      safety: ['Progresivo'],
      competition: 'Clásica de Gi.',
      concept: 'Tensión coordinada.'
    }
  },
  { 
    id: '1.8', 
    name: 'Collar Choke (Montada)', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Cross Collar Choke from Mount. Estrangulación vascular desde posición dominante.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Estabilidad montada', 'Peso adelante', 'Codos cerrados'],
      mechanics: ['Agarre profundo.', 'Peso sobre el oponente.', 'Cerrar codos.'],
      medical: { structures: ['Carótidas'], physiological: ['Isquemia transitoria.'], time: '5-10s' },
      biomechanics: { type: 'Presión + Gravedad', vectors: ['Descendente', 'Medial'], elements: ['Peso corporal'] },
      errors: ['Perder balance', 'Codos abiertos'],
      highLevel: ['Bajar la cabeza al suelo'],
      safety: ['Liberar al tap'],
      competition: 'Muy efectiva.',
      concept: 'Tensión + Gravedad.'
    }
  },
  { 
    id: '1.9', 
    name: 'Bow and Arrow', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Sumisión de Gi utilizando solapa y pantalón desde la espalda.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Control espalda', 'Extensión oponente', 'Ángulo lateral'],
      mechanics: ['Mano a solapa profunda.', 'Mano a pantalón.', 'Extender pierna.'],
      medical: { structures: ['Carótidas'], physiological: ['Oclusión masiva.'], time: '5-10s' },
      biomechanics: { type: 'Compresión + Tracción', vectors: ['Arco y Flecha'], elements: ['Pierna palanca'] },
      errors: ['Falta extensión', 'Perder espalda'],
      highLevel: ['Ángulo 90 grados con oponente'],
      safety: ['Evitar tirones'],
      competition: 'Reina del Gi.',
      concept: 'Tensión opuesta extrema.'
    }
  },
  // 1.2: Sin Gi
  { 
    id: '1.1', 
    name: 'Mataleón', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Rear Naked Choke (RNC). Estrangulación sanguínea definitiva desde la espalda.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Asfixia sanguínea (vascular)',
      principles: ['Control de espalda (back control)', 'Inserción profunda del brazo bajo el mentón', 'Cierre del sistema brazo-bíceps-cabeza'],
      mechanics: ['Inserción: Antebrazo bajo mentón.', 'Cierre: Mano a bíceps opuesto.', 'Presión: Aducción y retracción.'],
      medical: { structures: ['Carótidas comunes', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Oclusión bilateral carótidas.', 'Isquemia cerebral transitoria.'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral del cuello', vectors: ['Medial', 'Posterior'], elements: ['Brazo estrangulador', 'Core'] },
      errors: ['Comprimir la tráquea', 'Codos abiertos'],
      highLevel: ['Ocultar mano', 'Microajustes'],
      safety: ['Liberar al tap', 'No explosivo'],
      competition: 'Alta efectividad en Gi, No-Gi y MMA.',
      concept: 'El mata león no corta el aire, corta el flujo sanguíneo.'
    }
  },
  { 
    id: '1.5', 
    name: 'Guillotina', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Estrangulación frontal al cuello, efectiva en transiciones y contra derribos.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta',
      principles: ['Control cabeza', 'Elevación antebrazo', 'Cierre cadera'],
      mechanics: ['Rodeo cuello.', 'Agarre firme.', 'Cierre con piernas.'],
      medical: { structures: ['Carótidas', 'Tráquea'], physiological: ['Hipoxia cerebral/aérea.'], time: '5-10s' },
      biomechanics: { type: 'Compresión + Flexión', vectors: ['Vertical', 'Anterior'], elements: ['Antebrazo'] },
      errors: ['Falta control cadera', 'Jalar en lugar de comprimir'],
      highLevel: ['High Elbow'],
      safety: ['Cuidado con cervicales'],
      competition: 'Reina de los contraataques.',
      concept: 'Compresión frontal letal.'
    }
  },
  { 
    id: '1.10', 
    name: 'Triángulo', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Estrangulación de piernas desde la guardia, aislando un brazo.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Aislamiento brazo', 'Ángulo (no frontal)', 'Cierre figura 4'],
      mechanics: ['Pierna sobre hombro.', 'Cierre tras rodilla.', 'Bajar cabeza.'],
      medical: { structures: ['Carótidas'], physiological: ['Isquemia bilateral.'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral piernas', vectors: ['Medial'], elements: ['Cadera'] },
      errors: ['Quedarse frontal', 'Triángulo flojo'],
      highLevel: ['Cortar ángulo antes de cerrar'],
      safety: ['Progresivo'],
      competition: 'Súper efectiva.',
      concept: 'Sistema de piernas y ángulos.'
    }
  },
  // 1.3: Mixto
  { 
    id: '1.2', 
    name: 'Armbar', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Juji Gatame. Palanca de brazo fundamental basada en hiperextensión del codo.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Hiperextensión',
      principles: ['Aislamiento brazo', 'Pulgar arriba', 'Cadera fulcro'],
      mechanics: ['Control muñeca.', 'Piernas controlando torso.', 'Elevación cadera.'],
      medical: { structures: ['Articulación húmero-ulnar', 'UCL'], physiological: ['Hiperextensión forzada.'], time: 'Inmediato' },
      biomechanics: { type: 'Palanca de primer género', vectors: ['Extensión longitudinal', 'Elevación vertical'], elements: ['Cadera (fulcro)'] },
      errors: ['Cadera lejos del codo', 'Rodillas abiertas'],
      highLevel: ['Cerrar rodillas', 'Control hombro'],
      safety: ['Presión progresiva'],
      competition: 'Fundamental.',
      concept: 'Palanca pura: cadera vs articulación.'
    }
  },
  { 
    id: '1.3', 
    name: 'Americana', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Keylock. Ataque al hombro y codo desde posición lateral o montada.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional',
      principles: ['Control torso', 'Ángulo 90 grados', 'Muñeca fija suelo'],
      mechanics: ['Muñeca al suelo.', 'Agarre figura 4.', 'Elevar codo.'],
      medical: { structures: ['Hombro', 'Manguito rotador'], physiological: ['Rotación interna forzada.'], time: 'Progresivo' },
      biomechanics: { type: 'Palanca rotacional', vectors: ['Rotación interna'], elements: ['Suelo como tope'] },
      errors: ['Separar muñeca suelo', 'No mantener 90 grados'],
      highLevel: ['Controlar escápula'],
      safety: ['Presión progresiva'],
      competition: 'Efectiva desde posiciones dominantes.',
      concept: 'Fijar y rotar.'
    }
  },
  { 
    id: '1.4', 
    name: 'Kimura', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Double Wrist Lock. Rotación de hombro utilizando el agarre de figura 4.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional',
      principles: ['Aislamiento brazo', 'Figura 4 potente', 'Espalda controlada'],
      mechanics: ['Control muñeca.', 'Cierre figura 4.', 'Llevar mano a espalda.'],
      medical: { structures: ['Cápsula posterior hombro', 'Labrum'], physiological: ['Rotación interna extrema.'], time: 'Inmediato' },
      biomechanics: { type: 'Palanca rotacional doble', vectors: ['Rotación interna'], elements: ['Core como motor'] },
      errors: ['Espacios en agarre', 'Finalizar solo con brazos'],
      highLevel: ['Usar cuerpo entero'],
      safety: ['Cuidado extremo: daño rápido'],
      competition: 'Versátil y letal.',
      concept: 'Sistema de control y destrucción articular.'
    }
  },
  { 
    id: '1.6', 
    name: 'Ezekiel Choke', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Sode Guruma Jime. Estrangulación de antebrazo utilizando la propia manga o presión directa.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta',
      principles: ['Inserción profunda', 'Efecto tijera'],
      mechanics: ['Brazo posterior rodea.', 'Brazo frontal empuja.', 'Cierre de tijera.'],
      medical: { structures: ['Carótidas', 'Tráquea'], physiological: ['Compresión bilateral.'], time: '5-10s' },
      biomechanics: { type: 'Compresión tijera', vectors: ['Lateral', 'Anterior'], elements: ['Pecho'] },
      errors: ['Dar espacio', 'No alinear con carótidas'],
      highLevel: ['Presión progresiva'],
      safety: ['Liberar al tap'],
      competition: 'Ataque sorpresa potente.',
      concept: 'Efecto tijera sobre el eje del cuello.'
    }
  },
  // Fundamentales Nivel 1
  { id: '1.11', name: 'Double Leg', category: 'Derribos', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Derribo fundamental atacando ambas piernas.' },
  { id: '1.12', name: 'Single Leg', category: 'Derribos', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Derribo de control sobre una pierna.' },
  { id: '1.13', name: 'Escape Montada (Upa)', category: 'Escapes', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Escape explosivo usando puente y balance.' },
  { id: '1.14', name: 'Codo-Rodilla', category: 'Escapes', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Escape de recuperación de media guardia.' },
  { id: '1.15', name: 'Control Lateral', category: 'Controles', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Inmovilización fundamental desde el lado.' },
  { id: '1.16', name: 'Torreando', category: 'Pases de guardia', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Pase explosivo por los lados de la guardia.' },
];

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');
  const [activeModality, setActiveModality] = useState<Modality>('Todas');
  const [sortOrder, setSortAsc] = useState(true);
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
    let result = [...NIVEL_1_TECNICAS];
    
    if (activeCategory !== 'Todas') {
      result = result.filter(t => t.category === activeCategory);
    }
    
    if (activeModality !== 'Todas') {
      result = result.filter(t => t.modality === activeModality);
    }

    result.sort((a, b) => {
      const diffA = difficultyOrder[a.difficulty];
      const diffB = difficultyOrder[b.difficulty];
      return sortOrder ? diffA - diffB : diffB - diffA;
    });
    
    return result;
  }, [activeCategory, activeModality, sortOrder]);

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
                      <HeartPulse className="h-5 w-5 text-primary" /> Comprensión Médica
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
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

                <AccordionItem value="errors" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2 font-black uppercase text-sm text-destructive">
                      <AlertTriangle className="h-5 w-5" /> Errores y Seguridad
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6 pt-4">
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {details.errors.map((e, i) => <li key={i} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">✕ {e}</li>)}
                    </ul>
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
              </Accordion>
            </div>
          ) : (
            <div className="py-20 text-center border border-dashed rounded-lg">
              <p className="text-muted-foreground italic">Detalles tácticos próximamente.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

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

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Sidebar de Filtros */}
          <aside className="md:col-span-1 space-y-6">
            <Card className="bg-card/20 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Filter className="h-3 w-3" /> Especialidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase transition-all flex justify-between items-center",
                      activeCategory === cat ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {cat}
                    {activeCategory === cat && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-card/20 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <ListFilter className="h-3 w-3" /> Modalidad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {MODALITIES.map((mod) => (
                  <button
                    key={mod}
                    onClick={() => setActiveModality(mod)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase transition-all flex justify-between items-center",
                      activeModality === mod ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {mod}
                    {activeModality === mod && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Button 
              variant="outline" 
              className="w-full text-xs font-bold uppercase border-primary/20"
              onClick={() => setSortAsc(!sortOrder)}
            >
              <SortAsc className="mr-2 h-3 w-3" /> Dificultad: {sortOrder ? 'Asc' : 'Desc'}
            </Button>
          </aside>

          {/* Contenido Principal */}
          <div className="md:col-span-3 space-y-12">
            {activeModality === 'Todas' ? (
              ['Con Gi', 'Sin Gi', 'Mixto'].map((mod) => {
                const group = filteredTecnicas.filter(t => t.modality === mod);
                if (group.length === 0) return null;
                return (
                  <div key={mod} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic text-primary">{mod}</h3>
                      <Separator className="flex-1 bg-primary/20" />
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {group.map((tecnica) => (
                        <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTecnicas.map((tecnica) => (
                  <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                ))}
              </div>
            )}
            
            {filteredTecnicas.length === 0 && (
              <div className="py-20 text-center border border-dashed rounded-lg bg-muted/20">
                <p className="text-muted-foreground italic font-medium">Sin técnicas registradas bajo estos filtros.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

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
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">¡Bienvenido al Nido!</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Tu centro de comando técnico. Acceso exclusivo a desgloses estratégicos divididos por nivel y modalidad.
          </p>
        </section>

        <Separator className="bg-primary/20" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="group hover:border-primary transition-all duration-300 bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg font-black text-primary uppercase">Nivel 1</CardTitle>
              <CardDescription className="font-bold text-foreground">Principiante / Cinturón Blanco</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground italic mb-6">
                Fundamentos críticos y escapes esenciales. El cimiento de tu juego.
              </p>
              <Button onClick={() => setActiveModule('nivel-1')} className="w-full font-black uppercase">
                Explorar Técnicas <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          
          <Card className="opacity-50 grayscale border-dashed bg-muted/20">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase">Nivel 2</CardTitle>
                <CardDescription className="font-bold">Intermedio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">Próximamente disponible.</p>
                <Button disabled className="w-full mt-4 font-black uppercase" variant="secondary">
                   <Lock className="mr-2 h-4 w-4" /> Bloqueado
                </Button>
              </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

function TecnicaCard({ tecnica, onSelect }: { tecnica: any, onSelect: (t: any) => void }) {
  return (
    <Card className="bg-card/40 border-primary/10 hover:border-primary/40 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">{tecnica.id}</Badge>
          <Badge className="text-[10px] uppercase">{tecnica.category}</Badge>
        </div>
        <CardTitle className="text-xl font-black uppercase italic group-hover:text-primary transition-colors">
          {tecnica.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{tecnica.description}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{tecnica.difficulty}</span>
          <Button size="sm" className="font-bold uppercase tracking-tighter" onClick={() => onSelect(tecnica)}>
            <PlayCircle className="mr-1 h-4 w-4" /> Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

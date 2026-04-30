
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { 
    Lock, ArrowLeft, ChevronRight, PlayCircle, Filter, 
    ShieldAlert, HeartPulse, BrainCircuit, Activity, 
    AlertTriangle, Trophy, ListFilter, SortAsc, 
    CheckCircle2, Image as ImageIcon, Plus, Trash2,
    Save, X, ChevronLeft, ChevronRight as ChevronRightIcon
} from "lucide-react";
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  // SUMISIONES
  { 
    id: '1.1', 
    name: 'Mata león (RNC)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Estrangulación sanguínea definitiva aplicada desde la espalda.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Asfixia sanguínea (vascular)',
      principles: ['Control de espalda (back control)', 'Inserción profunda del brazo bajo el mentón', 'Cierre del sistema brazo-bíceps-cabeza', 'Conexión pecho-espalda'],
      mechanics: ['Inserción: Antebrazo bajo mentón, alineado con carótidas.', 'Cierre: Mano a bíceps opuesto, mano libre tras nuca.', 'Presión: Aducción de brazos y retracción escapular.'],
      medical: { structures: ['Carótidas comunes', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Oclusión bilateral carótidas.', 'Isquemia cerebral aguda transitoria.', 'Estimulación nervio vago (bradicardia).'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral del cuello', vectors: ['Medial (centro)', 'Posterior (atrás)'], elements: ['Brazo estrangulador (fuerza)', 'Core (estabilización)'] },
      errors: ['Comprimir la tráquea', 'Codos abiertos', 'Falta de conexión pecho-espalda'],
      highLevel: ['Ocultar mano estranguladora', 'Control previo del mentón', 'Microajustes progresivos'],
      safety: ['Liberar al tap', 'No mantener tras pérdida de conciencia', 'Evitar aplicación brusca'],
      competition: 'Alta efectividad en Gi, No-Gi y MMA.',
      concept: 'No corta el aire, corta el flujo sanguíneo cerebral.'
    }
  },
  { 
    id: '1.2', 
    name: 'Armbar (Juji Gatame)', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Palanca de brazo fundamental basada en la hiperextensión del codo.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Hiperextensión',
      principles: ['Aislamiento del brazo', 'Control distal (muñeca) y proximal (hombro)', 'Pulgar hacia arriba', 'Cadera como fulcro'],
      mechanics: ['Control muñeca.', 'Cadera bajo el codo.', 'Elevación de cadera y tracción del brazo.'],
      medical: { structures: ['Articulación húmero-ulnar', 'Ligamento colateral ulnar (UCL)', 'Cápsula anterior'], physiological: ['Hiperextensión forzada más allá de 0°.', 'Estrés ligamentario y posible ruptura.'], time: 'Inmediato' },
      biomechanics: { type: 'Palanca de primer género', vectors: ['Extensión longitudinal', 'Elevación vertical'], elements: ['Cadera (punto de apoyo)'] },
      errors: ['Cadera lejos del codo', 'Rodillas abiertas', 'Pulgar mal alineado'],
      highLevel: ['Cerrar rodillas para aislar', 'Ajustar ángulo antes de la fuerza', 'Romper postura previa'],
      safety: ['Presión progresiva', 'Liberar al tap inmediato'],
      competition: 'Técnica fundamental del grappling.',
      concept: 'Control total de la extremidad usando la cadera como motor.'
    }
  },
  { 
    id: '1.3', 
    name: 'Americana (Keylock)', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Ataque al hombro forzando la rotación interna desde posición dominante.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional (rotación interna)',
      principles: ['Control del torso', 'Muñeca fijada al suelo', 'Ángulo de 90° en el brazo', 'Codo como punto de palanca'],
      mechanics: ['Fijar muñeca oponente al suelo.', 'Agarre figura cuatro.', 'Elevar codo gradualmente.'],
      medical: { structures: ['Articulación glenohumeral', 'Cápsula articular del hombro', 'Manguito rotador (subescapular)', 'Labrum glenoideo'], physiological: ['Rotación interna forzada del húmero.', 'Estrés sobre la cápsula anterior.', 'Compresión intraarticular.'], time: 'Progresivo' },
      biomechanics: { type: 'Palanca rotacional', vectors: ['Rotación interna del húmero', 'Elevación del codo'], elements: ['Muñeca fijada (estabilización)'] },
      errors: ['Separar muñeca del suelo', 'No mantener los 90°', 'Elevar muñeca en lugar del codo'],
      highLevel: ['Controlar escápula para limitar movilidad', 'Deslizar codo gradualmente', 'Cerrar espacios de agarre'],
      safety: ['Presión lenta', 'Especial cuidado con principiantes'],
      competition: 'Efectiva en side control y montada.',
      concept: 'Fijar y rotar hasta superar el rango fisiológico.'
    }
  },
  { 
    id: '1.4', 
    name: 'Kimura (Double Wrist Lock)', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Potente rotación de hombro utilizando el sistema de palanca larga.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Rotacional (rotación interna)',
      principles: ['Aislamiento del brazo', 'Control distal (muñeca)', 'Configuración de "figura cuatro"', 'Separación del brazo del torso', 'Control de cadera oponente'],
      mechanics: ['Asegurar muñeca.', 'Cerrar figura cuatro sin espacios.', 'Llevar mano oponente a su espalda elevando su codo.'],
      medical: { structures: ['Articulación glenohumeral', 'Cápsula posterior hombro', 'Subescapular', 'Labrum glenoideo'], physiological: ['Rotación interna extrema bajo abducción.', 'Cizallamiento articular y riesgo de desgarro.'], time: 'Rápido/Inmediato' },
      biomechanics: { type: 'Palanca rotacional de doble brazo', vectors: ['Rotación interna del húmero', 'Tracción posterior', 'Elevación del codo'], elements: ['Torso como estabilizador', 'Brazos como sistema de cierre'] },
      errors: ['Espacios in la figura cuatro', 'No separar brazo del cuerpo', 'Finalizar solo con fuerza de brazos'],
      highLevel: ['Muñeca pegada a tu pecho', 'Usar rotación del cuerpo entero', 'Controlar cadera para evitar escapes'],
      safety: ['Cuidado extremo: el daño ocurre muy rápido', 'Presión controlada'],
      competition: 'Versátil desde guardia, side control y espalda.',
      concept: 'Sistema de control y destrucción estructural del hombro.'
    }
  },
  { 
    id: '1.5', 
    name: 'Guillotina', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Estrangulación frontal al cuello, letal en transiciones y contra derribos.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta (vascular y aérea)',
      principles: ['Control de cabeza', 'Elevación del antebrazo bajo el cuello', 'Cierre del sistema de agarre', 'Uso del cuerpo completo'],
      mechanics: ['Rodear cuello por debajo del mentón.', 'Configurar agarre (High Elbow u otros).', 'Compresión con core y dorsales.'],
      medical: { structures: ['Arterias carótidas', 'Tráquea', 'Laringe'], physiological: ['Isquemia cerebral (vascular) o hipoxia (aérea).', 'Reflejo de protección de vía aérea.'], time: '5-10s (vascular)' },
      biomechanics: { type: 'Compresión + Flexión cervical', vectors: ['Compresión anterior', 'Elevación vertical', 'Flexión anterior cabeza'], elements: ['Antebrazo (superficie de presión)'] },
      errors: ['No subir el antebrazo', 'Falta de control de cadera', 'Jalar solo con brazos'],
      highLevel: ['Variante High Elbow para máxima compresión', 'Uso de dorsales para cerrar espacio', 'Control de cadera antes de cerrar'],
      safety: ['Presión progresiva', 'Cuidado con cervicales'],
      competition: 'Reina de los contraataques en MMA y No-Gi.',
      concept: 'Sistema de compresión del cuello donde el ángulo determina la velocidad de sumisión.'
    }
  },
  { 
    id: '1.6', 
    name: 'Ezekiel Choke', 
    category: 'Sumisiones', 
    modality: 'Mixto',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Estrangulación tipo tijera utilizando presión directa frontal.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Mixta (vascular y aérea)',
      principles: ['Inserción profunda posterior', 'Puño/antebrazo como presión frontal', 'Efecto tijera simultáneo', 'Reducción de espacio'],
      mechanics: ['Brazo posterior rodea nuca.', 'Brazo frontal empuja tráquea/carótidas.', 'Cierre de tijera usando el pecho.'],
      medical: { structures: ['Arterias carótidas', 'Tráquea', 'Laringe'], physiological: ['Compresión bilateral carótidas o colapso traqueal.', 'Respuesta de estrés intenso.'], time: '5-10s (vascular)' },
      biomechanics: { type: 'Compresión en tijera', vectors: ['Compresión lateral', 'Compresión anterior'], elements: ['Pecho (amplificador de fuerza)'] },
      errors: ['Inserción superficial', 'Mala sincronización de brazos', 'Dejar espacios'],
      highLevel: ['Ajuste progresivo', 'Usar peso del pecho', 'Alinear presión hacia carótidas'],
      safety: ['Liberar al tap', 'Evitar presión explosiva en tráquea'],
      competition: 'Ataque sorpresa potente desde montada.',
      concept: 'Efecto tijera sobre el eje del cuello.'
    }
  },
  { 
    id: '1.7', 
    name: 'Collar Choke (Guardia)', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Estrangulación vascular utilizando las solapas desde la guardia cerrada.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Romper postura', 'Agarre profundo inicial', 'Control de distancia con piernas', 'Cierre de codos'],
      mechanics: ['Primer agarre profundo hasta la nuca.', 'Segundo agarre complementario.', 'Cerrar codos y activar dorsales.'],
      medical: { structures: ['Carótidas comunes', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Oclusión bilateral carótidas por tensión de solapas.', 'Estimulación parasimpática (vago).'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral con tensión', vectors: ['Compresión medial', 'Tracción opuesta', 'Flexión cervical'], elements: ['Solapas del gi (medio de tensión)'] },
      errors: ['Agarre superficial', 'Codos abiertos', 'No romper postura'],
      highLevel: ['Jalar al oponente con las piernas', 'Mantener tensión constante', 'Ajustar ángulo del cuerpo'],
      safety: ['Presión progresiva', 'Evitar tirones bruscos'],
      competition: 'Fundamental en Jiu-Jitsu clásico.',
      concept: 'Las piernas rompen la postura, los codos finalizan la misión.'
    }
  },
  { 
    id: '1.8', 
    name: 'Collar Choke (Montada)', 
    category: 'Sumisiones', 
    modality: 'Con Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Estrangulación vascular desde posición dominante usando el peso corporal.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Estabilidad en montada', 'Agarre profundo cerca de nuca', 'Cierre de codos', 'Peso corporal hacia adelante'],
      mechanics: ['Fijar base en montada.', 'Insertar agarres profundos.', 'Inclinar peso y tirar en direcciones opuestas.'],
      medical: { structures: ['Carótidas comunes', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Isquemia transitoria acelerada por presión descendente.', 'Activación vago (caída presión arterial).'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral + Presión descendente', vectors: ['Compresión medial', 'Tensión solapas', 'Presión vertical'], elements: ['Gravedad/Peso corporal (amplificador)'] },
      errors: ['Falta de equilibrio', 'Codos abiertos', 'Tirar solo con bíceps'],
      highLevel: ['Cabeza al suelo para balance', 'Ajustar microángulos de antebrazos', 'Profundidad extrema del primer agarre'],
      safety: ['Liberar al tap', 'Controlar intensidad'],
      competition: 'Técnica de altísima eficacia cuando los agarres se fijan.',
      concept: 'Tensión de solapas + Gravedad = Estrangulación inmediata.'
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
      principles: ['Control sólido de espalda', 'Agarre profundo solapa', 'Extensión del oponente', 'Ángulo lateral'],
      mechanics: ['Mano a solapa profunda.', 'Mano opuesta a pantalón/pierna.', 'Tirar solapa mientras extiendes al oponente con la pierna.'],
      medical: { structures: ['Carótidas comunes', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Oclusión carotídea masiva por tensión cruzada.', 'Isquemia cerebral aguda.'], time: '5-10s' },
      biomechanics: { type: 'Compresión + Tracción opuesta', vectors: ['Medial', 'Tracción posterior', 'Extensión horizontal'], elements: ['Pierna como palanca de extensión'] },
      errors: ['Agarre superficial', 'No extender al oponente', 'Tirar solo con brazos'],
      highLevel: ['Ángulo de 90° con el oponente', 'Usar pierna para "abrir el arco"', 'Mantener tensión constante'],
      safety: ['Evitar tirones cervicales', 'Liberar al tap'],
      competition: 'La sumisión reina del Jiu-Jitsu con Gi desde la espalda.',
      concept: 'Tensión extrema en direcciones opuestas.'
    }
  },
  { 
    id: '1.10', 
    name: 'Triángulo', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Estrangulación de piernas desde la guardia, atrapando el hombro del oponente.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Vascular',
      principles: ['Aislamiento de un brazo', 'Control de cabeza', 'Ángulo lateral (no frontal)', 'Cierre en figura triangular', 'Elevación de cadera'],
      mechanics: ['Atrapar brazo y cuello.', 'Cerrar pierna tras la rodilla opuesta.', 'Cortar ángulo y bajar cabeza oponente.'],
      medical: { structures: ['Arterias carótidas', 'Venas yugulares', 'Seno carotídeo'], physiological: ['Presión lateral de pierna + presión del propio hombro oponente.', 'Oclusión bilateral carótidas.'], time: '5-10s' },
      biomechanics: { type: 'Compresión lateral con sistema de piernas', vectors: ['Medial', 'Presión hombro oponente', 'Elevación de cadera'], elements: ['Cadera (fulcro de fuerza)'] },
      errors: ['Quedarse frontal', 'Triángulo flojo', 'No controlar la cabeza'],
      highLevel: ['Cortar ángulo antes de cerrar', 'Ajustar posición del pie para cierre fuerte', 'Microajustes progresivos'],
      safety: ['Presión lenta', 'No cerrar explosivamente'],
      competition: 'Alta tasa de finalización y permite transiciones a palancas.',
      concept: 'Sistema donde el ángulo y la compresión de piernas dictan la victoria.'
    }
  },

  // DERRIBOS
  { 
    id: '1.11', 
    name: 'Double Leg Takedown', 
    category: 'Derribos', 
    modality: 'Mixto', 
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Derribo fundamental atacando ambas piernas con penetración profunda.',
    detailedInfo: {
      type: 'Derribo',
      subtype: 'Proyección por ataque a ambas piernas',
      principles: ['Cambio de nivel (level change)', 'Entrada profunda (penetration step)', 'Espalda recta y cabeza activa', 'Conexión cuerpo-cuerpo', 'Finalización con dirección'],
      mechanics: [
        'Preparación: Romper postura o crear reacción. Mantener distancia.',
        'Entrada: Cambio de nivel. Paso profundo. Rodilla cercana al suelo.',
        'Conexión: Brazos rodean piernas. Cabeza lateral contra torso. Espalda recta.',
        'Finalización: Empuje frontal con cambio de dirección ("turn the corner").'
      ],
      medical: { 
        structures: ['Articulaciones de cadera', 'Rodillas (LCA/LCL)', 'Tobillos', 'Columna lumbar'], 
        physiological: ['Desplazamiento del centro de gravedad.', 'Pérdida de base de apoyo.', 'Transferencia de potencia desde tren inferior.'], 
        time: 'Inmediato' 
      },
      biomechanics: { 
        type: 'Empuje + Tracción + Elevación', 
        vectors: ['Horizontal (empuje)', 'Ascendente (elevación)', 'Lateral (dirección)'], 
        elements: ['Piernas (potencia)', 'Cadera (transmisión)', 'Espalda (estructura)', 'Brazos (sujeción)'] 
      },
      errors: ['No bajar el nivel correctamente', 'Entrada superficial', 'Espalda encorvada', 'Cabeza mal posicionada'],
      highLevel: ['Usar setups (fintas)', 'Mantener cabeza activa', '"Cortar la esquina" lateralmente'],
      safety: ['Evitar impactar cabeza', 'Controlar caída del compañero', 'No forzar rodilla'],
      competition: 'Pilar fundamental en lucha libre, MMA y No-Gi.',
      concept: 'Cambio de nivel, entrada profunda y uso del cuerpo completo.'
    }
  },
  { 
    id: '1.12', 
    name: 'Single Leg Takedown', 
    category: 'Derribos', 
    modality: 'Mixto', 
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Aislamiento de una pierna para desequilibrar y derribar.',
    detailedInfo: {
      type: 'Derribo',
      subtype: 'Ataque a una pierna',
      principles: ['Cambio de nivel (level change)', 'Entrada limpia a una pierna', 'Control firme de la pierna', 'Mantener postura', 'Uso del ángulo'],
      mechanics: [
        'Preparación: Crear reacción. Mantener distancia.',
        'Entrada: Cambio de nivel. Paso hacia la pierna. Hombro conectado a cadera.',
        'Control: Rodear pierna. Asegurar tras rodilla/tobillo. Pegar pierna al cuerpo.',
        'Finalización: Elevación, barrido o cambio de dirección.'
      ],
      medical: { 
        structures: ['Cadera', 'Rodilla (LCA, LCL)', 'Tobillo', 'Columna lumbar'], 
        physiological: ['Eliminación de un punto de apoyo.', 'Desbalance lateral o posterior.'], 
        time: 'Inmediato' 
      },
      biomechanics: { 
        type: 'Tracción + Elevación + Desequilibrio', 
        vectors: ['Ascendente', 'Lateral', 'Posterior'], 
        elements: ['Brazos (control)', 'Piernas (potencia)', 'Cadera (transmisión)', 'Cabeza (dirección)'] 
      },
      errors: ['No pegar pierna al cuerpo', 'Espalda encorvada', 'No controlar equilibrio'],
      highLevel: ['Mantener pierna "pegada"', 'Cabeza como punto de presión', 'Fluidez en finalización'],
      safety: ['Evitar giros bruscos de rodilla', 'Controlar caída', 'Proteger espalda'],
      competition: 'Muy efectivo en lucha, MMA y No-Gi.',
      concept: 'Eliminar base del oponente y usar dirección para derribar.'
    }
  },
  
  // ESCAPES
  { id: '1.13', name: 'Escape Montada (Upa)', category: 'Escapes', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Escape explosivo usando puente y balance.' },
  { id: '1.14', name: 'Codo-Rodilla', category: 'Escapes', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Escape de recuperación de media guardia.' },
  
  // CONTROLES
  { id: '1.15', name: 'Control Lateral', category: 'Controles', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Inmovilización fundamental desde el lado.' },
  
  // PASES
  { id: '1.16', name: 'Torreando', category: 'Pases de guardia', modality: 'Mixto', difficulty: 'Básica' as Difficulty, description: 'Pase explosivo por los lados de la guardia.' },
];

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');
  const [activeModality, setActiveModality] = useState<Modality>('Todas');
  const [sortOrder, setSortAsc] = useState(true);
  const [selectedTecnica, setSelectedTecnica] = useState<typeof NIVEL_1_TECNICAS[0] | null>(null);
  const [showDifficultySort, setShowDifficultySort] = useState(false);
  
  const { toast } = useToast();

  const CORRECT_PASSWORD = "SoyTeamAlbatrosBjj";
  const ADMIN_PASSWORD = "Admin482662";

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setIsAdmin(true);
      setError(false);
      toast({ title: "Modo Administrador Activo", description: "Puedes gestionar las imágenes de las técnicas." });
    } else if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setIsAdmin(false);
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

    if (showDifficultySort) {
      result.sort((a, b) => {
        const diffA = difficultyOrder[a.difficulty];
        const diffB = difficultyOrder[b.difficulty];
        return sortOrder ? diffA - diffB : diffB - diffA;
      });
    }
    
    return result;
  }, [activeCategory, activeModality, sortOrder, showDifficultySort]);

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
                Entrar al Nido
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedTecnica) {
    return (
      <TecnicaDetail 
        tecnica={selectedTecnica} 
        onBack={() => setSelectedTecnica(null)} 
        isAdmin={isAdmin}
      />
    );
  }

  if (activeModule === 'nivel-1') {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <Logo />
            <Separator orientation="vertical" className="h-8 hidden md:block" />
            <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Biblioteca Técnica</h1>
            {isAdmin && <Badge className="bg-yellow-500 text-black font-black">ADMIN</Badge>}
          </div>
          <Button variant="ghost" onClick={() => { setActiveModule(null); setActiveCategory('Todas'); setActiveModality('Todas'); setShowDifficultySort(false); }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Módulos
          </Button>
        </header>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
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
              variant={showDifficultySort ? "default" : "outline"} 
              className="w-full text-xs font-bold uppercase border-primary/20"
              onClick={() => {
                if (!showDifficultySort) setShowDifficultySort(true);
                else setSortAsc(!sortOrder);
              }}
            >
              <SortAsc className="mr-2 h-3 w-3" /> Dificultad: {sortOrder ? 'Asc' : 'Desc'}
            </Button>
            
            {showDifficultySort && (
               <Button 
               variant="ghost" 
               className="w-full text-[10px] uppercase text-muted-foreground"
               onClick={() => setShowDifficultySort(false)}
             >
               Resetear Orden
             </Button>
            )}
          </aside>

          <div className="md:col-span-3 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTecnicas.map((tecnica) => (
                  <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                ))}
            </div>
            
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
          {isAdmin && <Badge className="bg-yellow-500 text-black font-black">MODO ADMIN</Badge>}
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
                Fundamentos críticos, escapes esenciales y sumisiones primarias. El cimiento de tu juego.
              </p>
              <Button onClick={() => setActiveModule('nivel-1')} className="w-full font-black uppercase">
                Explorar Biblioteca <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
          
          <Card className="opacity-50 grayscale border-dashed bg-muted/20">
              <CardHeader>
                <CardTitle className="text-lg font-black uppercase">Nivel 2</CardTitle>
                <CardDescription className="font-bold">Intermedio</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic">Próximamente disponible para atletas avanzados.</p>
                <Button disabled className="w-full mt-4 font-black uppercase" variant="secondary">
                   Bloqueado
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
          <div className="flex gap-1">
             <Badge className="text-[10px] uppercase">{tecnica.category}</Badge>
             <Badge variant="secondary" className="text-[10px] uppercase">{tecnica.modality}</Badge>
          </div>
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

function TecnicaDetail({ tecnica, onBack, isAdmin }: { tecnica: any, onBack: () => void, isAdmin: boolean }) {
  const firestore = useFirestore();
  const details = tecnica.detailedInfo;
  const { toast } = useToast();

  const tecnicaContentRef = useMemoFirebase(() => 
    firestore ? doc(firestore, 'foro_tecnicas', tecnica.id) : null,
    [firestore, tecnica.id]
  );
  const { data: remoteContent, isLoading: isLoadingContent } = useDoc<any>(tecnicaContentRef);

  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (remoteContent?.images) {
      setImages(remoteContent.images);
    }
  }, [remoteContent]);

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    setImages(prev => [...prev, newImageUrl.trim()]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveImages = async () => {
    if (!tecnicaContentRef) return;
    setIsSaving(true);
    
    setDocumentNonBlocking(tecnicaContentRef, {
      id: tecnica.id,
      images: images,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    toast({ title: "Contenido Guardado", description: "La secuencia de imágenes ha sido actualizada." });
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Biblioteca
        </Button>
        <div className="flex items-center gap-4">
            {isAdmin && <Badge className="bg-yellow-500 text-black font-black">ADMIN PANEL</Badge>}
            <Logo />
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        {isAdmin && (
            <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                        <Save className="h-4 w-4" /> Gestión de Contenido Visual
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input 
                            placeholder="URL de la imagen (Unsplash, Picsum, etc.)" 
                            value={newImageUrl}
                            onChange={(e) => setNewImageUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddImage()}
                        />
                        <Button onClick={handleAddImage} size="icon"><Plus className="h-4 w-4" /></Button>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                        {images.map((url, i) => (
                            <div key={i} className="relative group aspect-square rounded-md overflow-hidden border">
                                <Image src={url} alt={`Step ${i+1}`} fill className="object-cover" />
                                <button 
                                    onClick={() => handleRemoveImage(i)}
                                    className="absolute top-1 right-1 bg-destructive text-destructive-foreground p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                         <Button variant="outline" onClick={() => setImages(remoteContent?.images || [])} disabled={isSaving}>Descartar</Button>
                         <Button onClick={handleSaveImages} disabled={isSaving} className="font-bold">
                            {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                         </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white font-black">{tecnica.id}</Badge>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">{tecnica.name}</h1>
          </div>
          <p className="text-xl text-muted-foreground italic">"{details?.concept || tecnica.description}"</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-primary/30 text-primary">{details?.type || tecnica.category}</Badge>
            <Badge variant="secondary">{tecnica.modality}</Badge>
            <Badge variant="secondary">{tecnica.difficulty}</Badge>
          </div>
        </section>

        <Separator className="bg-primary/20" />

        {details ? (
          <div className="grid gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/30 border-primary/10 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-primary" /> Principios Críticos
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2">
                    {details.principles.map((p: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-primary/10 flex flex-col">
                <CardHeader>
                  <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" /> Mecánica de Ejecución
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {details.mechanics.map((m: string, i: number) => (
                      <li key={i} className="text-sm text-muted-foreground border-l-2 border-primary/20 pl-3">
                        {m}
                      </li>
                    ))}
                  </ul>
                </CardContent>
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
                     <h5 className="font-bold text-xs uppercase text-primary mb-2">Anatomía y Fisiología</h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <h6 className="text-[10px] uppercase font-bold text-muted-foreground">Estructuras Afectadas</h6>
                          <ul className="text-sm space-y-1">
                              {details.medical.structures.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                          </ul>
                       </div>
                       <div>
                          <h6 className="text-[10px] uppercase font-bold text-muted-foreground">Mecanismo Fisiológico</h6>
                          <ul className="text-sm space-y-1 italic">
                              {details.medical.physiological.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                       </div>
                     </div>
                     {details.medical.time && (
                       <p className="mt-4 text-xs font-bold text-center uppercase tracking-widest text-primary border-t border-primary/10 pt-4">Tiempo Estimado de Efecto: {details.medical.time}</p>
                     )}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="biomechanics" className="border-primary/10">
                  <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 font-black uppercase text-sm">
                          <Activity className="h-5 w-5 text-primary" /> Biomecánica Táctica
                      </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                              <h6 className="text-[10px] uppercase font-bold text-primary">Vectores de Fuerza</h6>
                              <ul className="text-sm space-y-1">
                                  {details.biomechanics.vectors.map((v: string, i: number) => <li key={i}>→ {v}</li>)}
                              </ul>
                          </div>
                          <div className="space-y-2">
                              <h6 className="text-[10px] uppercase font-bold text-primary">Elementos Clave</h6>
                              <ul className="text-sm space-y-1">
                                  {details.biomechanics.elements.map((e: string, i: number) => <li key={i}>• {e}</li>)}
                              </ul>
                          </div>
                      </div>
                      <p className="text-xs italic text-muted-foreground bg-muted/20 p-2 rounded mt-2">Tipo de fuerza: {details.biomechanics.type}</p>
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
                      {details.errors.map((e: string, i: number) => <li key={i} className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">✕ {e}</li>)}
                  </ul>
                  <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                     <h5 className="font-bold text-xs uppercase text-destructive flex items-center gap-2 mb-2">
                      <ShieldAlert className="h-4 w-4" /> Protocolo de Seguridad
                     </h5>
                     <ul className="text-xs space-y-1">
                        {details.safety.map((s: string, i: number) => <li key={i}>• {s}</li>)}
                     </ul>
                  </div>
                </AccordionContent>
              </AccordionItem>
              
              <AccordionItem value="competition" className="border-primary/10">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2 font-black uppercase text-sm">
                    <Trophy className="h-5 w-5 text-primary" /> Aplicación en Combate
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <p className="text-sm italic leading-relaxed">
                      {details.competition}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-8">
              <GalleryViewer 
                images={images} 
                tecnicaName={tecnica.name}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
              <div className="py-20 text-center border border-dashed rounded-lg">
                  <p className="text-muted-foreground italic">Detalles tácticos próximamente.</p>
              </div>
              <GalleryViewer 
                images={images} 
                tecnicaName={tecnica.name}
              />
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryViewer({ images, tecnicaName }: { images: string[], tecnicaName: string }) {
    const [currentIndex, setCurrentIndex] = useState(0);

    if (images.length === 0) {
        return (
            <div className="py-12 text-center border border-dashed rounded-lg bg-muted/10">
                <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground italic text-sm">Secuencia de imágenes en preparación por el administrador.</p>
            </div>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button 
                    size="lg" 
                    className="w-full font-black uppercase tracking-widest"
                >
                    <ImageIcon className="mr-2 h-5 w-5" /> Ver Secuencia de Imágenes ({images.length})
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl bg-black/95 border-none p-0 overflow-hidden sm:rounded-none h-[90vh]">
                <DialogHeader className="absolute top-4 left-4 z-50 pointer-events-none">
                    <DialogTitle className="text-white font-black uppercase tracking-tighter drop-shadow-md">
                        {tecnicaName} <span className="text-primary ml-2">— Paso {currentIndex + 1} de {images.length}</span>
                    </DialogTitle>
                </DialogHeader>
                
                <div className="relative w-full h-full flex items-center justify-center">
                    <div className="relative w-full h-full">
                        <Image 
                            src={images[currentIndex]} 
                            alt={`${tecnicaName} step ${currentIndex + 1}`} 
                            fill 
                            className="object-contain"
                            priority
                        />
                    </div>

                    {/* Navigation */}
                    <div className="absolute inset-x-4 flex justify-between items-center pointer-events-none">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("pointer-events-auto bg-black/20 hover:bg-black/50 text-white rounded-full h-12 w-12", currentIndex === 0 && "opacity-0")}
                            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentIndex === 0}
                        >
                            <ChevronLeft className="h-8 w-8" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("pointer-events-auto bg-black/20 hover:bg-black/50 text-white rounded-full h-12 w-12", currentIndex === images.length - 1 && "opacity-0")}
                            onClick={() => setCurrentIndex(prev => Math.min(images.length - 1, prev + 1))}
                            disabled={currentIndex === images.length - 1}
                        >
                            <ChevronRightIcon className="h-8 w-8" />
                        </Button>
                    </div>

                    {/* Thumbnails / Progress */}
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                        {images.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "h-1.5 w-8 rounded-full transition-all",
                                    i === currentIndex ? "bg-primary w-12" : "bg-white/30 hover:bg-white/50"
                                )}
                            />
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

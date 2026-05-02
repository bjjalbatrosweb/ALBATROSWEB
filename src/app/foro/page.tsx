
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { 
    ArrowLeft, ChevronRight, PlayCircle, Filter, 
    HeartPulse, BrainCircuit, Activity, 
    AlertTriangle, Trophy, ListFilter, SortAsc, 
    CheckCircle2, Search
} from "lucide-react";
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

const CATEGORIES = ['Todas', 'Sumisiones', 'Derribos', 'Escapes', 'Controles', 'Pases de guardia'] as const;
type Category = typeof CATEGORIES[number];

const MODALITIES = ['Todas', 'Con Gi', 'Sin Gi'] as const;
type Modality = typeof MODALITIES[number];

type Difficulty = 'Básica' | 'Básica a Intermedia' | 'Intermedia' | 'Avanzada';
const difficultyOrder: Record<Difficulty, number> = {
  'Básica': 1,
  'Básica a Intermedia': 2,
  'Intermedia': 3,
  'Avanzada': 4,
};

const SUMISIONES_ORDENADAS = [
  'Mata león (RNC)',
  'Armbar (Juji Gatame)',
  'Americana (Keylock)',
  'Kimura (Double Wrist Lock)',
  'Guillotina',
  'Ezekiel Choke',
  'Collar Choke (Guardia)',
  'Collar Choke (Montada)',
  'Bow and Arrow',
  'Triángulo'
];

const NIVEL_1_TECNICAS = [
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
      safety: ['Liberar al tap', 'No mantener tras pérdida de conciencia', 'Evitar aplicación brusca'],
      competition: 'Alta efectividad en Gi, No-Gi y MMA.',
      concept: 'No corta el aire, corta el flujo sanguíneo cerebral.'
    }
  },
  { 
    id: '1.2', 
    name: 'Armbar (Juji Gatame)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
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
      safety: ['Presión progresiva', 'Liberar al tap inmediato'],
      competition: 'Técnica fundamental del grappling.',
      concept: 'Control total de la extremidad usando la cadera como motor.'
    }
  },
  { 
    id: '1.3', 
    name: 'Americana (Keylock)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
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
      safety: ['Presión lenta', 'Especial cuidado con principiantes'],
      competition: 'Efectiva en side control y montada.',
      concept: 'Fijar y rotar hasta superar el rango fisiológico.'
    }
  },
  { 
    id: '1.4', 
    name: 'Kimura (Double Wrist Lock)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
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
      safety: ['Presión progresiva', 'Cuidado con cervicales'],
      competition: 'Reina de los contraataques en MMA y No-Gi.',
      concept: 'Sistema de compresión del cuello donde el ángulo determina la velocidad de sumisión.'
    }
  },
  { 
    id: '1.6', 
    name: 'Ezekiel Choke', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
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
      safety: ['Presión lenta', 'No cerrar explosivamente'],
      competition: 'Alta tasa de finalización y permite transiciones a palancas.',
      concept: 'Sistema donde el ángulo y la compresión de piernas dictan la victoria.'
    }
  },
  { 
    id: '1.11', 
    name: 'Double Leg Takedown', 
    category: 'Derribos', 
    modality: 'Sin Gi', 
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Derribo fundamental atacando ambas piernas con penetración profunda.',
    detailedInfo: {
      type: 'Derribo',
      subtype: 'Proyección por ataque a ambas piernas',
      principles: ['Cambio de nivel', 'Entrada profunda', 'Espalda recta', 'Finalización con dirección'],
      mechanics: ['Cambio de nivel.', 'Paso profundo.', 'Cabeza lateral contra torso.', 'Empuje frontal con cambio de dirección.'],
      medical: { structures: ['Cadera', 'Rodillas', 'Columna lumbar'], physiological: ['Desplazamiento del centro de gravedad.', 'Transferencia de potencia desde tren inferior.'], time: 'Inmediato' },
      biomechanics: { type: 'Empuje + Tracción', vectors: ['Horizontal', 'Ascendente', 'Lateral'], elements: ['Piernas (potencia)', 'Core', 'Brazos'] },
      errors: ['No bajar nivel', 'Entrada superficial', 'Espalda encorvada'],
      safety: ['Evitar impactar cabeza', 'Controlar caída compañero'],
      competition: 'Pilar fundamental en lucha y MMA.',
      concept: 'Cambio de nivel, entrada profunda y uso del cuerpo completo.'
    }
  },
  { 
    id: '1.12', 
    name: 'Single Leg Takedown', 
    category: 'Derribos', 
    modality: 'Sin Gi', 
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Aisla una pierna del oponente para desequilibrar y llevarlo al suelo.',
    detailedInfo: {
      type: 'Derribo',
      subtype: 'Ataque a una pierna',
      principles: ['Cambio de nivel', 'Entrada limpia', 'Control firme de la pierna', 'Uso del ángulo'],
      mechanics: ['Paso hacia la pierna.', 'Hombro conectado a cadera.', 'Asegurar tras rodilla/tobillo.', 'Finalización con el elevación o barrido.'],
      medical: { structures: ['Cadera', 'Rodilla', 'Tobillo'], physiological: ['Eliminación de un punto de apoyo.', 'Desbalance lateral.'], time: 'Inmediato' },
      biomechanics: { type: 'Tracción + Elevación', vectors: ['Ascendente', 'Lateral'], elements: ['Brazos (control)', 'Piernas (impulso)'] },
      errors: ['No pegar pierna al cuerpo', 'Espalda encorvada'],
      safety: ['Evitar giros bruscos de rodilla', 'Proteger espalda'],
      competition: 'Muy efectivo en lucha y No-Gi.',
      concept: 'Eliminar base del oponente y usar dirección para derribar.'
    }
  },
  { 
    id: '1.13', 
    name: 'Harai Goshi (Barrido de cadera)', 
    category: 'Derribos', 
    modality: 'Sin Gi', 
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Proyección potente desequilibrando al frente, cargando sobre cadera y barriendo la pierna.',
    detailedInfo: {
      type: 'Proyección',
      subtype: 'Técnica de cadera + barrido',
      principles: ['Kuzushi (desequilibrio frontal)', 'Tsukuri (entrada con giro)', 'Kake (ejecución con barrido)', 'Contacto de cadera'],
      mechanics: ['Tirar al oponente hacia adelante.', 'Girar espalda y colocar cadera.', 'Barrer pierna oponente mientras elevas cadera.'],
      medical: { structures: ['Articulación coxofemoral', 'Rodillas', 'Columna lumbar'], physiological: ['Desplazamiento del centro de gravedad.', 'Eliminación de la base de apoyo.'], time: 'Inmediato' },
      biomechanics: { type: 'Rotación + Elevación + Barrido', vectors: ['Rotacional', 'Ascendente', 'Lateral'], elements: ['Cadera (eje)', 'Pierna de barrido', 'Brazos'] },
      errors: ['No generar kuzushi', 'Cadera lejos', 'Barrer sin cargar peso'],
      safety: ['Practicar ukemi correctamente', 'No barrer descontroladamente'],
      competition: 'Muy efectiva en BJJ con Gi y clinch.',
      concept: 'Combinación de desequilibrio y giro de cadera que elimina la base mediante un barrido fluido.'
    }
  },
  { 
    id: '1.14', 
    name: 'Uchi Mata (Barrido interno de muslo)', 
    category: 'Derribos', 
    modality: 'Sin Gi', 
    difficulty: 'Intermedia' as Difficulty, 
    description: 'Proyección vertical donde se entra con la cadera y se eleva la pierna desde la parte interna del muslo.',
    detailedInfo: {
      type: 'Proyección',
      subtype: 'Técnica de cadera + elevación interna',
      principles: ['Kuzushi hacia adelante', 'Entrada profunda con giro', 'Elevación interna del muslo', 'Sincronización total'],
      mechanics: ['Tirar al oponente hacia adelante.', 'Girar alineando la cadera.', 'Elevar pierna oponente desde la cara interna del muslo.'],
      medical: { structures: ['Cadera', 'Rodillas', 'Columna lumbar'], physiological: ['Elevación del centro de gravedad.', 'Eliminación de base.'], time: 'Inmediato' },
      biomechanics: { type: 'Elevación + Rotación', vectors: ['Ascendente', 'Rotacional', 'Anterior'], elements: ['Cadera', 'Pierna de ataque', 'Brazos'] },
      errors: ['No generar kuzushi', 'Cadera lejos', 'No elevar correctamente'],
      safety: ['Practicar ukemi', 'Evitar torsiones de rodilla'],
      competition: 'Técnica icónica adaptable a BJJ en clinch.',
      concept: 'Elevación interna que rompe la base del oponente y lo proyecta mediante rotación.'
    }
  },
  { 
    id: '1.15', 
    name: 'Escape UPA (Bridge & Roll Escape)', 
    category: 'Escapes', 
    modality: 'Sin Gi', 
    difficulty: 'Básica' as Difficulty, 
    description: 'Escape fundamental basado en el puenteo y rotación para invertir la posición de montada.',
    detailedInfo: {
      type: 'Escape',
      subtype: 'Reversa',
      principles: ['Atrapar brazo', 'Bloquear pie', 'Puente explosivo', 'Dirección del giro'],
      mechanics: ['Controlar un brazo del oponente.', 'Atrapar pie del mismo lado.', 'Elevar cadera explosivamente y rodar.'],
      medical: { structures: ['Cadera', 'Columna lumbar', 'Core'], physiological: ['Generación de fuerza desde la extensión de cadera.'], time: 'Inmediato' },
      biomechanics: { type: 'Extensión + Rotación', vectors: ['Vertical (puente)', 'Lateral (giro)'], elements: ['Cadera (potencia)', 'Brazos (control)'] },
      errors: ['No atrapar brazo', 'No bloquear pie', 'Puente débil'],
      safety: ['Evitar forzar el cuello', 'Controlar intensidad'],
      competition: 'Escape básico esencial contra montada.',
      concept: 'Eliminar base del oponente e invertir usando la cadera.'
    }
  },
  { 
    id: '1.16', 
    name: 'Fuga de Cadera (Shrimp / Hip Escape)', 
    category: 'Escapes', 
    modality: 'Sin Gi', 
    difficulty: 'Básica' as Difficulty, 
    description: 'Movimiento fundamental para crear espacio y recuperar la guardia desde posiciones inferiores.',
    detailedInfo: {
      type: 'Escape',
      subtype: 'Recuperación de espacio',
      principles: ['Crear marco (frames)', 'Movimiento lateral de cadera', 'Uso de pies', 'Mantener distancia'],
      mechanics: ['Antebrazos contra el oponente (frames).', 'Empujar con el pie y deslizar cadera lateralmente.', 'Insertar rodilla para recuperar guardia.'],
      medical: { structures: ['Cadera', 'Core', 'Hombros'], physiological: ['Creación de espacio estructural.'], time: 'Continuo' },
      biomechanics: { type: 'Empuje + Desplazamiento lateral', vectors: ['Lateral', 'Posterior'], elements: ['Pies (impulso)', 'Cadera', 'Brazos (frames)'] },
      errors: ['No usar frames', 'Moverse en línea recta'],
      safety: ['Evitar movimientos bruscos de columna', 'Proteger cuello'],
      competition: 'Base de todos los escapes en grappling.',
      concept: 'Crear espacio de forma constante hasta recuperar una posición segura.'
    }
  },
  {
    id: '1.18',
    name: 'Escape de guardia cerrada (Apertura básica)',
    category: 'Escapes',
    modality: 'Sin Gi',
    difficulty: 'Básica' as Difficulty,
    description: 'Fundamental para romper la estructura de piernas del oponente desde adentro.',
    detailedInfo: {
      type: 'Escape / Apertura',
      subtype: 'Romper guardia',
      principles: ['Postura correcta', 'Control de cadera', 'Presión descendente', 'Uso de rodilla'],
      mechanics: ['Postura: Espalda recta, manos en cadera.', 'Base: Una rodilla al centro, otra firme.', 'Presión: Empujar cadera hacia abajo.', 'Apertura: Llevar rodilla central hacia atrás.', 'Salida: Pasar a guardia abierta.'],
      medical: { structures: ['Cadera', 'Rodillas del oponente'], physiological: ['Aplicación de presión descendente sobre el eje de la cadera.'], time: 'Progresivo' },
      biomechanics: { type: 'Presión + Palanca', vectors: ['Descendente', 'Separación'], elements: ['Rodilla', 'Brazos', 'Postura'] },
      errors: ['Espalda encorvada', 'Dejarse romper postura', 'Mala base'],
      safety: ['Evitar presión excesiva en rodillas', 'Mantener equilibrio'],
      competition: 'Paso obligatorio antes de cualquier pase.',
      concept: 'Postura + presión + palanca para romper la estructura controladamente.'
    }
  },
  {
    id: '1.19',
    name: 'Escape de toma de espalda (Back Escape)',
    category: 'Escapes',
    modality: 'Sin Gi',
    difficulty: 'Intermedia' as Difficulty,
    description: 'Defensa posicional para salir del control de espalda y recuperar la guardia.',
    detailedInfo: {
      type: 'Escape',
      subtype: 'Defensa posicional',
      principles: ['Defensa del cuello', 'Control de manos', 'Eliminar ganchos', 'Lado seguro'],
      mechanics: ['Defender cuello: Bloquear el choke con ambas manos.', 'Control de manos: Sujetar mano agresora.', 'Caer al lado correcto: Lado del brazo que no estrangula.', 'Eliminar hooks: Quitar ganchos con las piernas.', 'Girar: Fuga de cadera y recuperar frente al oponente.'],
      medical: { structures: ['Carótidas', 'Cervicales', 'Cadera'], physiological: ['Prevención de asfixia vascular y liberación de carga posterior.'], time: 'Crítico' },
      biomechanics: { type: 'Defensa + Rotación + Desplazamiento', vectors: ['Lateral', 'Posterior'], elements: ['Manos (bloqueo)', 'Cadera', 'Piernas'] },
      errors: ['Ignorar defensa cuello', 'Girar al lado incorrecto', 'Pánico'],
      safety: ['Nunca descuidar el cuello', 'Mantener la calma'],
      competition: 'Crítica para sobrevivir en situaciones de vulnerabilidad.',
      concept: 'Sobrevivir primero protegiendo el cuello, luego crear espacio y finalmente girar.'
    }
  },
  {
    id: '1.20',
    name: 'Control de montada (Mount Control)',
    category: 'Controles',
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty,
    description: 'Mantenimiento de posición dominante controlando el torso y limitando la movilidad.',
    detailedInfo: {
      type: 'Control',
      subtype: 'Control posicional dominante',
      principles: ['Base estable (rodillas activas)', 'Control de cadera y torso', 'Distribución del peso', 'Adaptación al movimiento'],
      mechanics: ['Posición base: Rodillas cerca del torso, pies activos, cadera centrada.', 'Control del cuerpo: Manos controlando brazos o torso.', 'Distribución de peso: Peso hacia adelante o neutro según reacción.', 'Ajustes: Subir montada si empuja, bajar base si intenta puente.'],
      medical: { structures: ['Tronco', 'Cadera', 'Columna'], physiological: ['Restricción de movilidad torácica.', 'Control del centro de masa oponente.'], time: 'Continuo' },
      biomechanics: { type: 'Presión + Estabilidad', vectors: ['Descendente', 'Reactivo'], elements: ['Cadera', 'Rodillas', 'Core', 'Brazos'] },
      errors: ['Base inestable', 'Pies flojos', 'No controlar brazos', 'Atacar sin asegurar'],
      safety: ['Mantener equilibrio', 'Controlar presión'],
      competition: 'Posición de alto puntaje y gran desgaste.',
      concept: 'Controlar el equilibrio, eliminar escapes y dominar antes de atacar.'
    }
  },
  {
    id: '1.21',
    name: 'Control lateral (Side Control)',
    category: 'Controles',
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty,
    description: 'Inmovilización desde el costado controlando torso y cadera para neutralizar escapes.',
    detailedInfo: {
        type: 'Control',
        subtype: 'Control posicional dominante',
        principles: ['Control de cabeza (crossface) y cadera', 'Presión constante sin espacios', 'Base estable', 'Distribución del peso'],
        mechanics: ['Posición base: Cuerpo perpendicular, pecho contra pecho, rodillas para base.', 'Control superior: Un brazo rodea cabeza (crossface), otro controla brazo/cadera.', 'Distribución de peso: Cargar peso sobre esternón, evitar apoyarse de más en suelo.', 'Ajustes: Adaptarse a intentos de shrimp o cambiar posición.'],
        medical: { structures: ['Tronco superior', 'Cervicales', 'Diafragma'], physiological: ['Inmovilización del centro de masa y restricción de movilidad escapular.'], time: 'Continuo' },
        biomechanics: { type: 'Presión + Control', vectors: ['Descendente', 'Lateral'], elements: ['Hombro (crossface)', 'Cadera', 'Core'] },
        errors: ['Falta de presión', 'Dejar espacio', 'No controlar cabeza'],
        safety: ['Evitar presión excesiva en cuello', 'Mantener base'],
        competition: 'Posición fundamental para transiciones.',
        concept: 'Eliminar espacio, controlar extremos (cabeza/cadera) y usar el peso.'
    }
  },
  {
    id: '1.22',
    name: 'Pase de rodilla (Knee Slice / Knee Cut)',
    category: 'Pases de guardia',
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty,
    description: 'Atraviesa la guardia del oponente cortando con la rodilla bajo presión constante.',
    detailedInfo: {
      type: 'Pase de guardia',
      subtype: 'Pase por presión y corte',
      principles: ['Control superior', 'Presión hacia adelante', 'Rodilla cortando en ángulo', 'Eliminación de espacio'],
      mechanics: ['Control inicial: Crossface o control de torso y cadera.', 'Posicionamiento: Una rodilla entre piernas, otra abierta.', 'Corte: Deslizar rodilla en diagonal atravesando línea de piernas.', 'Presión: Mantener al oponente plano con peso hacia adelante.', 'Finalización: Establecer control lateral o montada.'],
      medical: { structures: ['Rodilla', 'Cadera', 'Columna'], physiological: ['Compresión de cadera y restricción de movilidad defensiva.'], time: 'Inmediato' },
      biomechanics: { type: 'Presión + Desplazamiento', vectors: ['Descendente', 'Diagonal'], elements: ['Rodilla', 'Cadera', 'Core', 'Brazos'] },
      errors: ['Falta de presión', 'Rodilla sin dirección', 'Dejar espacio'],
      safety: ['Evitar presión excesiva en cuello', 'Controlar rodillas'],
      competition: 'Alta efectividad y base de sistemas de presión.',
      concept: 'Presión, control y ángulo para atravesar la guardia.'
    }
  },
  {
    id: '1.23',
    name: 'Pase Toreando (Bullfighter Pass)',
    category: 'Pases de guardia',
    modality: 'Sin Gi',
    difficulty: 'Básica' as Difficulty,
    description: 'Controla las piernas del oponente y muévete rápidamente alrededor para superar su guardia.',
    detailedInfo: {
      type: 'Pase de guardia',
      subtype: 'Pase por movilidad',
      principles: ['Control de tobillos', 'Mantener distancia', 'Movimiento lateral rápido', 'Control de cadera final'],
      mechanics: ['Control inicial: Sujetar tobillos/pantalones con brazos extendidos.', 'Desvío: Empujar piernas hacia un lado fuera de la línea central.', 'Movimiento lateral: Pasar rápidamente al lado opuesto.', 'Finalización: Establecer control lateral bloqueando cadera.'],
      medical: { structures: ['Articulaciones de cadera', 'Piernas', 'Cadera propia'], physiological: ['Desplazamiento dinámico del centro de gravedad.'], time: 'Inmediato' },
      biomechanics: { type: 'Empuje + Desplazamiento lateral', vectors: ['Lateral', 'Horizontal'], elements: ['Brazos', 'Piernas', 'Cadera', 'Core'] },
      errors: ['Ir lento', 'No controlar piernas', 'Sin ángulo'],
      safety: ['Evitar movimientos bruscos', 'No exponer el cuello'],
      competition: 'Técnica fundamental contra guardias abiertas.',
      concept: 'Quitar obstáculos del camino y moverte más rápido que la recuperación del oponente.'
    }
  },
  {
    id: '1.24',
    name: 'Control de espalda (Back Control)',
    category: 'Controles',
    modality: 'Sin Gi',
    difficulty: 'Intermedia' as Difficulty,
    description: 'Control dominante desde atrás limitando la movilidad y preparando ataques directos al cuello.',
    detailedInfo: {
      type: 'Control',
      subtype: 'Control posicional dominante',
      principles: ['Control del torso (pecho a espalda)', 'Ganchos (hooks) o body lock', 'Control de manos (hand fighting)', 'Mantener conexión constante', 'Control del cuello'],
      mechanics: ['Posición base: Pecho pegado a la espalda, cabeza cerca, cadera alineada.', 'Control inferior: Colocar ganchos con ambos pies o body lock.', 'Control superior: Brazos controlando hombros or manos.', 'Ajustes: Seguir el movimiento del oponente sin dejar espacio.'],
      medical: { structures: ['Tronco superior', 'Cervicales', 'Articulación del hombro'], physiological: ['Restricción de la movilidad escapular.', 'Control del centro de masa posterior.'], time: 'Continuo' },
      biomechanics: { type: 'Control + Presión constante', vectors: ['Posterior', 'Reactivo'], elements: ['Piernas (cadera)', 'Brazos (manos/cuello)', 'Core', 'Pecho (conexión)'] },
      errors: ['Perder conexión pecho-espalda', 'Hooks flojos', 'No controlar las manos', 'Intentar estrangular sin control'],
      safety: ['No forzar el cuello', 'Controlar la presión', 'Liberar al tap'],
      competition: 'Posición de máximo control y alta tasa de finalización.',
      concept: 'Conexión total, control de manos y eliminación de cualquier espacio antes de atacar.'
    }
  },
  {
    id: '1.25',
    name: 'Guardia cerrada (Closed Guard)',
    category: 'Controles',
    modality: 'Sin Gi',
    difficulty: 'Básica' as Difficulty,
    description: 'Posición fundamental para controlar al oponente desde abajo usando las piernas cerradas alrededor de su torso.',
    detailedInfo: {
      type: 'Control',
      subtype: 'Control posicional desde abajo',
      principles: ['Control de postura del oponente', 'Uso activo de las piernas', 'Conexión cadera-torso', 'Control de brazos', 'Creación de ángulos'],
      mechanics: ['Posición base: Piernas cerradas, tobillos cruzados, cadera conectada.', 'Control superior: Romper postura controlando cuello/brazos.', 'Activación cadera: Movimiento constante para crear ángulos de ataque.', 'Finalización: Buscar sumisiones o raspados tras romper equilibrio.'],
      medical: { structures: ['Tronco inferior', 'Cadera', 'Columna lumbar'], physiological: ['Restricción de movilidad del torso mediante tracción de piernas.'], time: 'Continuo' },
      biomechanics: { type: 'Control + Tracción', vectors: ['Posterior', 'Lateral'], elements: ['Piernas', 'Cadera (motor)', 'Brazos', 'Core'] },
      errors: ['No controlar la postura', 'Piernas pasivas', 'Quedarse estático'],
      safety: ['Evitar presión excesiva en rodillas', 'No forzar posiciones'],
      competition: 'Posición altamente ofensiva desde abajo y base para múltiples ataques.',
      concept: 'No es solo cerrar las piernas: es controlar postura, distancia y crear oportunidades.'
    }
  },
  {
    id: '1.26',
    name: 'Media guardia (Half Guard)',
    category: 'Controles',
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty,
    description: 'Posición intermedia fundamental para controlar una pierna del oponente, limitar su movilidad y crear oportunidades de ataque o recuperación.',
    detailedInfo: {
      type: 'Control',
      subtype: 'Control posicional desde abajo (y transición)',
      principles: ['Control de la pierna atrapada', 'Posicionamiento de cadera (de lado)', 'Uso de underhook', 'Frames para crear espacio', 'Control de distancia'],
      mechanics: ['Posición base: Una pierna atrapada, cuerpo de lado, cadera activa.', 'Control superior: Buscar underhook y evitar control de cabeza.', 'Creación espacio: Usar frames para mantener distancia.', 'Finalización: Buscar raspados o recuperar guardia completa.'],
      medical: { structures: ['Cadera', 'Rodilla', 'Core'], physiological: ['Restricción de movilidad lateral del oponente.'], time: 'Continuo' },
      biomechanics: { type: 'Control + Palanca', vectors: ['Lateral', 'Posterior'], elements: ['Piernas (trampa)', 'Cadera (motor)', 'Brazos (espacio/underhook)'] },
      errors: ['Quedarse plano', 'No buscar underhook', 'Falta de control de cabeza', 'No usar frames'],
      safety: ['Evitar torsiones de rodilla', 'Mantener control del cuello'],
      competition: 'Posición clave para defensa y ataque.',
      concept: 'Controlar ángulos, usar la cadera y convertir una posición intermedia en ataque.'
    }
  },
  {
    id: '1.27',
    name: 'Tani Otoshi (Caída en el valle)',
    category: 'Derribos',
    modality: 'Con Gi',
    difficulty: 'Intermedia' as Difficulty,
    description: 'Derribo por bloqueo posterior y caída lateral, aprovechando la reacción del oponente.',
    detailedInfo: {
      type: 'Proyección',
      subtype: 'Derribo por bloqueo y caída',
      principles: ['Timing (momento exacto)', 'Uso de la reacción del oponente', 'Bloqueo de la base', 'Control del torso', 'Caída controlada'],
      mechanics: ['Preparación: Estar en contacto con el oponente (clinch).', 'Entrada: Colocarse ligeramente detrás del oponente.', 'Bloqueo: Extender la pierna detrás de ambas piernas del oponente.', 'Caída: Caer hacia atrás o lateral jalando al oponente.', 'Finalización: Establecer posición dominante.'],
      medical: { structures: ['Pierna (base)', 'Torso', 'Cadera', 'Core'], physiological: ['Desplazamiento del centro de gravedad y bloqueo de puntos de apoyo.'], time: 'Inmediato' },
      biomechanics: { type: 'Tracción + Bloqueo + Caída', vectors: ['Posterior', 'Descendente'], elements: ['Pierna (bloqueo)', 'Brazos (jalón)', 'Core'] },
      errors: ['Mala sincronización (timing)', 'Posicionamiento incorrecto', 'Caer sin control'],
      safety: ['Evitar caer sobre la rodilla del oponente', 'Controlar la caída', 'No ejecutar de forma explosiva sin control'],
      competition: 'Muy usado en Judo y BJJ con Gi. Efectivo como contraataque en clinch.',
      concept: 'Bloquear la base y usar el propio movimiento del oponente para hacerlo caer hacia atrás con control.'
    }
  }
];

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');
  const [activeModality, setActiveModality] = useState<Modality>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortAsc] = useState(true);
  const [selectedTecnica, setSelectedTecnica] = useState<typeof NIVEL_1_TECNICAS[0] | null>(null);
  const [showDifficultySort, setShowDifficultySort] = useState(false);

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

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(term) || 
        t.description.toLowerCase().includes(term)
      );
    }

    if (activeCategory === 'Sumisiones' && activeModality === 'Todas' && !showDifficultySort && !searchTerm) {
      result.sort((a, b) => {
        return SUMISIONES_ORDENADAS.indexOf(a.name) - SUMISIONES_ORDENADAS.indexOf(b.name);
      });
    } else if (showDifficultySort) {
      result.sort((a, b) => {
        const diffA = difficultyOrder[a.difficulty];
        const diffB = difficultyOrder[b.difficulty];
        return sortOrder ? diffA - diffB : diffB - diffA;
      });
    }
    
    return result;
  }, [activeCategory, activeModality, searchTerm, sortOrder, showDifficultySort]);

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
          </div>
          <Button variant="ghost" onClick={() => { setActiveModule(null); setActiveCategory('Todas'); setActiveModality('Todas'); setSearchTerm(''); setShowDifficultySort(false); }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Módulos
          </Button>
        </header>

        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1 space-y-6">
             <Card className="bg-card/20 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Search className="h-3 w-3" /> Buscar Técnica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Nombre o descripción..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 bg-background/50 h-9 text-xs"
                  />
                </div>
              </CardContent>
            </Card>

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
                {MODALITIES.filter(m => m !== 'Todas').map((mod) => (
                  <button
                    key={mod}
                    onClick={() => setActiveModality(mod as Modality)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase transition-all flex justify-between items-center",
                      activeModality === mod ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {mod}
                    {activeModality === mod && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
                <button
                    onClick={() => setActiveModality('Todas')}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase transition-all flex justify-between items-center",
                      activeModality === 'Todas' ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    Todas
                    {activeModality === 'Todas' && <CheckCircle2 className="h-3 w-3" />}
                </button>
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
            
            {(showDifficultySort || searchTerm || activeCategory !== 'Todas' || activeModality !== 'Todas') && (
               <Button 
               variant="ghost" 
               className="w-full text-[10px] uppercase text-muted-foreground"
               onClick={() => {
                 setShowDifficultySort(false);
                 setSearchTerm('');
                 setActiveCategory('Todas');
                 setActiveModality('Todas');
               }}
             >
               Limpiar Filtros
             </Button>
            )}
          </aside>

          <div className="md:col-span-3 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTecnicas.length > 0 ? (
                  filteredTecnicas.map((tecnica) => (
                    <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <Search className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                    <p className="text-muted-foreground italic">No se encontraron técnicas con esos criterios.</p>
                  </div>
                )}
            </div>
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
        <section className="space-y-6">
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">¡Bienvenido al Nido!</h2>
          
          <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Busca una técnica (ej. Mata León, Armbar...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-12 text-lg bg-card/50 border-primary/20 focus:border-primary placeholder:text-muted-foreground/50"
              />
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed">
            Tu centro de comando técnico. Acceso exclusivo a desgloses estratégicos divididos por nivel y modalidad.
          </p>
        </section>

        <Separator className="bg-primary/20" />

        {searchTerm ? (
          <div className="space-y-6">
             <div className="flex items-center justify-between">
                <h3 className="text-xl font-black uppercase tracking-tighter italic text-primary">Resultados de Búsqueda</h3>
                <Button variant="ghost" size="sm" onClick={() => setSearchTerm('')} className="text-xs uppercase font-bold">Limpiar</Button>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredTecnicas.map((tecnica) => (
                  <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                ))}
                {filteredTecnicas.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-card/20 border border-dashed rounded-lg">
                    <p className="text-muted-foreground italic">No se encontraron técnicas que coincidan con "{searchTerm}"</p>
                  </div>
                )}
             </div>
          </div>
        ) : (
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
        )}
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
             <Badge variant="secondary" className="text-[10px] uppercase">{tecnica.category}</Badge>
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

function TecnicaDetail({ tecnica, onBack }: { tecnica: any, onBack: () => void }) {
  const details = tecnica.detailedInfo;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Biblioteca
        </Button>
        <Logo />
      </header>

      <div className="max-w-4xl mx-auto space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white font-black">{tecnica.id}</Badge>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">{tecnica.name}</h1>
          </div>
          <p className="text-xl text-muted-foreground italic">"{details?.concept || tecnica.description}"</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="uppercase font-bold">{details?.type || tecnica.category}</Badge>
            <Badge variant="secondary" className="uppercase font-bold">{tecnica.modality}</Badge>
            <Badge variant="secondary" className="uppercase font-bold">{tecnica.difficulty}</Badge>
          </div>
        </section>

        <Separator className="bg-primary/20" />

        {details && (
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
                    {details.principles.map((p: string, i: number) => (
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
                    {details.mechanics.map((m: string, i: number) => (
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
                     <h5 className="font-bold text-xs uppercase text-primary mb-2">Anatomía y Fisiología</h5>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div>
                          <h6 className="text-[10px] uppercase font-bold text-muted-foreground">Estructuras Afectadas</h6>
                          <ul className="text-sm space-y-1">
                              {details.medical?.structures?.map((s: string, i: number) => <li key={i}>• {s}</li>) || <li>No especificado</li>}
                          </ul>
                       </div>
                       <div>
                          <h6 className="text-[10px] uppercase font-bold text-muted-foreground">Mecanismo Fisiológico</h6>
                          <ul className="text-sm space-y-1 italic">
                              {details.medical?.physiological?.map((p: string, i: number) => <li key={i}>{p}</li>) || <li>No especificado</li>}
                          </ul>
                       </div>
                     </div>
                     <p className="mt-4 text-xs font-bold text-center uppercase tracking-widest text-primary border-t border-primary/10 pt-4">Tiempo Estimado de Efecto: {details.medical?.time || 'N/A'}</p>
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
                      <HeartPulse className="h-4 w-4" /> Protocolo de Seguridad
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
          </div>
        )}
      </div>
    </div>
  );
}

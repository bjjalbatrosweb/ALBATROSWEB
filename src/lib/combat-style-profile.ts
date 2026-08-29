export type BodyBand = "corta" | "media" | "larga";
export type WidthBand = "estrecha" | "media" | "ancha";
export type CapacityBand = "por_desarrollar" | "media" | "destacada";
export type BuildBand = "compacta" | "equilibrada" | "longilinea" | "robusta";
export type ExperienceBand = "inicial" | "intermedia" | "avanzada";
export type GenderOption = "mujer" | "hombre" | "otro" | "sin_especificar";
export type HeightBand = "baja" | "media" | "alta";
export type StanceOption = "diestra" | "zurda" | "cambiante" | "sin_definir";

export type CombatStyleProfile = {
  genero: GenderOption;
  estatura: HeightBand;
  alturaCm?: number;
  pesoKg?: number;
  envergaduraCm?: number;
  cinturaCm?: number;
  caderaCm?: number;
  musloCm?: number;
  complexion: BuildBand;
  torso: BodyBand;
  brazos: BodyBand;
  piernas: BodyBand;
  hombros: WidthBand;
  cintura: WidthBand;
  cadera: WidthBand;
  gluteos: WidthBand;
  muslos: WidthBand;
  manos: WidthBand;
  movilidad: CapacityBand;
  explosividad: CapacityBand;
  resistencia: CapacityBand;
  agarre: CapacityBand;
  equilibrio: CapacityBand;
  velocidad: CapacityBand;
  controlCorporal: CapacityBand;
  experiencia: ExperienceBand;
  guardia: StanceOption;
  objetivos: string[];
  restricciones: string;
  notas: string;
};

export type StyleRecommendation = {
  id: string;
  title: string;
  level: "Probar primero" | "Segunda ruta" | "Complemento";
  score: number;
  summary: string;
  reasons: string[];
  techniques: string[];
  drill: string;
  watch: string;
  submissions?: SubmissionOption[];
};

export type SubmissionOption = {
  id: string;
  name: string;
  entry: string;
  family: "estrangulación" | "brazo" | "hombro";
  caution: string;
};

export type SubmissionRecommendation = SubmissionOption & {
  priority: "Principal" | "Alternativa";
  routeTitle: string;
  why: string;
};

export type DeprioritizedRecommendation = {
  id: string;
  domain: "Grappling" | "Wrestling" | "Striking";
  technique: string;
  status: "Menor prioridad" | "Evitar por ahora";
  reason: string;
  alternative: string;
  validation: string;
};

export type CombatStyleReport = {
  quality: "inicial" | "útil" | "detallado";
  qualityLabel: string;
  reachRatio?: number;
  waistHeightRatio?: number;
  waistHipRatio?: number;
  effectiveArms: BodyBand;
  submissions: SubmissionRecommendation[];
  deprioritized: DeprioritizedRecommendation[];
  grappling: StyleRecommendation[];
  wrestling: StyleRecommendation[];
  striking: StyleRecommendation[];
  validationPlan: Array<{ session: string; task: string; measure: string }>;
  caveats: string[];
};

export const COMBAT_STYLE_PROFILE_VERSION = "perfil-tecnico-v2";

export const DEFAULT_COMBAT_STYLE_PROFILE: CombatStyleProfile = {
  genero: "sin_especificar",
  estatura: "media",
  complexion: "equilibrada",
  torso: "media",
  brazos: "media",
  piernas: "media",
  hombros: "media",
  cintura: "media",
  cadera: "media",
  gluteos: "media",
  muslos: "media",
  manos: "media",
  movilidad: "media",
  explosividad: "media",
  resistencia: "media",
  agarre: "media",
  equilibrio: "media",
  velocidad: "media",
  controlCorporal: "media",
  experiencia: "inicial",
  guardia: "sin_definir",
  objetivos: [],
  restricciones: "",
  notas: "",
};

type Candidate = Omit<StyleRecommendation, "level" | "score" | "reasons"> & {
  base?: number;
  rules: Array<{ points: number; reason: string; when: (profile: CombatStyleProfile, arms: BodyBand) => boolean }>;
};

const goal = (profile: CombatStyleProfile, value: string) => profile.objetivos.includes(value);

const grapplingCandidates: Candidate[] = [
  {
    id: "guardia-distancia",
    title: "Guardia de distancia y ataques con piernas",
    summary: "Crear marcos, romper postura y encadenar ataques sin aceptar presión innecesaria.",
    techniques: ["Guardia sentada / De la Riva", "Triángulo", "Armbar", "Omoplata o barrido técnico"],
    submissions: [
      { id: "triangulo-guardia", name: "Triángulo", entry: "Guardia y control de postura", family: "estrangulación", caution: "Cerrar el ángulo antes de comprimir y soltar al tap." },
      { id: "armbar-guardia", name: "Armbar", entry: "Guardia cerrada o transición del triángulo", family: "brazo", caution: "Controlar pulgar y cadera; extender de forma gradual." },
      { id: "omoplata", name: "Omoplata", entry: "Guardia cuando el rival retira el brazo", family: "hombro", caution: "Controlar la cintura antes de elevar la cadera." },
    ],
    drill: "3 × 3 min: conservar distancia, entrar a una guardia elegida y lograr barrido o espalda.",
    watch: "Si se pierde la postura o aparecen molestias de cadera, reducir amplitud y priorizar marcos.",
    rules: [
      { points: 4, reason: "Piernas largas favorecen probar controles de distancia.", when: p => p.piernas === "larga" },
      { points: 3, reason: "Movilidad destacada amplía las opciones de retención y ángulos.", when: p => p.movilidad === "destacada" },
      { points: 2, reason: "Control corporal destacado ayuda a conservar estructura al cambiar de ángulo.", when: p => p.controlCorporal === "destacada" },
      { points: 2, reason: "Una estructura longilínea invita a explorar palancas largas.", when: p => p.complexion === "longilinea" },
      { points: 2, reason: "Coincide con el objetivo de finalizar.", when: p => goal(p, "finalizar") },
    ],
  },
  {
    id: "media-mariposa",
    title: "Media guardia, mariposa y entradas compactas",
    summary: "Trabajar cerca, entrar debajo del centro de masa y convertir encuadres pequeños en barridos.",
    techniques: ["Media guardia con knee shield", "Mariposa", "Kimura trap", "Guillotina frontal"],
    submissions: [
      { id: "kimura-media", name: "Kimura", entry: "Media guardia o kimura trap", family: "hombro", caution: "Mantener el codo rival flexionado y aplicar despacio." },
      { id: "guillotina", name: "Guillotina", entry: "Front headlock tras defender la entrada", family: "estrangulación", caution: "No jalar el cuello; cerrar espacio con el torso." },
      { id: "armbar-mariposa", name: "Armbar desde mariposa", entry: "Brazo aislado después del barrido", family: "brazo", caution: "Primero estabilizar; después extender con control." },
    ],
    drill: "5 entradas por lado desde sentado; después 3 × 2 min empezando con underhook disputado.",
    watch: "No depender solo de fuerza de brazos: conectar cadera, cabeza y agarres antes del barrido.",
    rules: [
      { points: 4, reason: "Una estructura compacta puede trabajar bien en espacios cortos.", when: p => p.complexion === "compacta" },
      { points: 3, reason: "Brazos cortos invitan a cerrar distancia en vez de perseguir agarres lejanos.", when: (_p, arms) => arms === "corta" },
      { points: 2, reason: "Muslos anchos pueden aportar una base estable para elevaciones.", when: p => p.muslos === "ancha" },
      { points: 2, reason: "Cadera o glúteos anchos invitan a probar una base sentada estable.", when: p => p.cadera === "ancha" || p.gluteos === "ancha" },
      { points: 2, reason: "Coincide con el objetivo de barrer y cambiar posición.", when: p => goal(p, "barrer") },
    ],
  },
  {
    id: "presion-superior",
    title: "Presión superior y control por capas",
    summary: "Ganar media guardia, fijar cadera y hombros, y avanzar sin regalar espacios.",
    techniques: ["Half guard top", "Control lateral", "Montada", "Triángulo de brazo / kimura"],
    submissions: [
      { id: "triangulo-brazo", name: "Triángulo de brazo", entry: "Montada o control lateral", family: "estrangulación", caution: "Ajustar hombro y cabeza sin presión cervical lateral." },
      { id: "kimura-control", name: "Kimura desde control", entry: "Control lateral o norte-sur", family: "hombro", caution: "Aislar hombro y aplicar rotación de forma progresiva." },
      { id: "armbar-montada", name: "Armbar desde montada", entry: "Brazo extendido al defender la presión", family: "brazo", caution: "Sentarse con control y conservar las rodillas cerradas." },
    ],
    drill: "3 × 3 min desde media guardia arriba: pasar, estabilizar 3 s y avanzar una posición.",
    watch: "La presión debe salir de posición y distribución de peso, no de cargar articulaciones ni contener la respiración.",
    rules: [
      { points: 4, reason: "Complexión robusta sugiere explorar control de peso bien distribuido.", when: p => p.complexion === "robusta" },
      { points: 3, reason: "Hombros anchos pueden facilitar marcos de presión y control del torso.", when: p => p.hombros === "ancha" },
      { points: 3, reason: "Resistencia destacada ayuda a sostener secuencias largas de control.", when: p => p.resistencia === "destacada" },
      { points: 2, reason: "Control corporal destacado favorece transferir peso sin perder base.", when: p => p.controlCorporal === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de controlar.", when: p => goal(p, "controlar") },
    ],
  },
  {
    id: "espalda-estrangulaciones",
    title: "Espalda, controles de torso y estrangulaciones",
    summary: "Usar conexiones alrededor del torso para conservar la espalda y atacar por etapas.",
    techniques: ["Seat belt", "Back mount", "Mataleón", "Arco y flecha con gi"],
    submissions: [
      { id: "mataleon", name: "Mataleón", entry: "Espalda con seat belt y control de manos", family: "estrangulación", caution: "Antebrazo bajo el mentón, sin torsión, y liberación inmediata." },
      { id: "arco-flecha", name: "Arco y flecha", entry: "Espalda con agarre de solapa", family: "estrangulación", caution: "Solo con gi y reglas compatibles; controlar la caída." },
      { id: "armbar-espalda", name: "Armbar desde espalda", entry: "El rival libera el cuello y extiende el brazo", family: "brazo", caution: "Cambiar de posición antes de extender la articulación." },
    ],
    drill: "4 × 90 s desde seat belt: conservar pecho-espalda y recuperar ganchos antes de atacar.",
    watch: "No cruzar los pies frente al rival y liberar inmediatamente ante la señal de rendición.",
    rules: [
      { points: 4, reason: "Brazos largos permiten probar conexiones amplias alrededor del torso.", when: (_p, arms) => arms === "larga" },
      { points: 3, reason: "Agarre destacado puede sostener transiciones sin apresurar la finalización.", when: p => p.agarre === "destacada" },
      { points: 2, reason: "La resistencia favorece el control paciente de la espalda.", when: p => p.resistencia === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de finalizar.", when: p => goal(p, "finalizar") },
    ],
  },
];

const wrestlingCandidates: Candidate[] = [
  {
    id: "derribos-distancia",
    title: "Single leg, ankle pick y ataques desde distancia",
    summary: "Amenazar con nivel y alcance, terminar por ángulo y evitar chocar de frente.",
    techniques: ["Single leg exterior", "Ankle pick", "Sweep single", "Salida por esquina"],
    drill: "6 entradas limpias por lado y 3 × 90 s donde solo puntúa terminar fuera de la línea central.",
    watch: "La longitud no sustituye una buena postura: cabeza arriba, espalda organizada y rodilla protegida.",
    rules: [
      { points: 4, reason: "Brazos largos permiten explorar contactos iniciales a mayor distancia.", when: (_p, arms) => arms === "larga" },
      { points: 3, reason: "Estatura alta favorece probar ataques por ángulo en lugar de nivel profundo.", when: p => p.estatura === "alta" },
      { points: 3, reason: "Explosividad destacada ayuda en la entrada y el cambio de dirección.", when: p => p.explosividad === "destacada" },
      { points: 2, reason: "Velocidad destacada favorece entradas antes de que el rival cierre distancia.", when: p => p.velocidad === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de derribar.", when: p => goal(p, "derribar") },
    ],
  },
  {
    id: "doble-pierna",
    title: "Double leg, cambios de nivel y finalizaciones compactas",
    summary: "Cerrar distancia con postura sólida y conducir con piernas, no con la espalda.",
    techniques: ["Double leg", "High crotch", "Cambio single–double", "Finalización contra pared"],
    drill: "5 cambios de nivel técnicos + 5 entradas por lado; terminar solo con postura estable.",
    watch: "No golpear la rodilla contra el piso ni flexionar la espalda bajo carga.",
    rules: [
      { points: 4, reason: "Estructura compacta puede facilitar cambios de nivel cortos.", when: p => p.complexion === "compacta" },
      { points: 4, reason: "Muslos anchos sugieren probar producción de fuerza desde piernas.", when: p => p.muslos === "ancha" },
      { points: 3, reason: "Explosividad destacada favorece entradas breves y decididas.", when: p => p.explosividad === "destacada" },
      { points: 2, reason: "Equilibrio destacado ayuda a terminar sin perder postura.", when: p => p.equilibrio === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de derribar.", when: p => goal(p, "derribar") },
    ],
  },
  {
    id: "clinch-cuerpo",
    title: "Underhooks, body lock y lucha de pared",
    summary: "Ganar posición interior, controlar cadera y derribar desde contacto seguro.",
    techniques: ["Pummeling", "Body lock", "Inside trip", "Mat return"],
    drill: "4 × 2 min de pummeling: puntúa doble underhook, salida lateral o derribo controlado.",
    watch: "Evitar tirar con la zona lumbar; entrar con pasos, cadera próxima y control del compañero.",
    rules: [
      { points: 4, reason: "Hombros anchos invitan a probar controles interiores de torso.", when: p => p.hombros === "ancha" },
      { points: 3, reason: "Agarre destacado ayuda a conservar conexiones en clinch.", when: p => p.agarre === "destacada" },
      { points: 3, reason: "Complexión robusta puede adaptarse bien al trabajo de pared.", when: p => p.complexion === "robusta" },
      { points: 2, reason: "Control corporal destacado facilita conectar torso, cadera y pasos.", when: p => p.controlCorporal === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de controlar.", when: p => goal(p, "controlar") },
    ],
  },
  {
    id: "cabeza-frontal",
    title: "Snapdown, front headlock y cadenas de reacción",
    summary: "Provocar postura, controlar cabeza-brazo y convertir la defensa rival en otra entrada.",
    techniques: ["Snapdown", "Front headlock", "Go-behind", "Anaconda / D'Arce según reglas"],
    drill: "3 × 2 min desde collar tie: snapdown, go-behind y reinicio; primero precisión, luego ritmo.",
    watch: "Controlar el cuello sin torsiones bruscas y respetar inmediatamente la rendición.",
    rules: [
      { points: 4, reason: "Brazos largos pueden facilitar controles de cabeza y brazo.", when: (_p, arms) => arms === "larga" },
      { points: 3, reason: "Agarre destacado ayuda a encadenar sin apretar de más.", when: p => p.agarre === "destacada" },
      { points: 2, reason: "Resistencia destacada favorece cadenas de reacción.", when: p => p.resistencia === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de defender y contraatacar.", when: p => goal(p, "defender") },
    ],
  },
];

const strikingCandidates: Candidate[] = [
  {
    id: "larga-distancia",
    title: "Golpeo de larga distancia",
    summary: "Administrar el centro con herramientas rectas y salir antes del intercambio corto.",
    techniques: ["Jab", "Cross", "Teep / patada frontal", "Low kick al final de combinación"],
    drill: "3 × 2 min: tocar con jab o teep, pivotar y volver al centro; medir salidas limpias.",
    watch: "No extender el codo al límite ni retroceder siempre en línea recta.",
    rules: [
      { points: 4, reason: "Brazos largos justifican probar control de distancia con golpes rectos.", when: (_p, arms) => arms === "larga" },
      { points: 3, reason: "Piernas largas permiten explorar teep y patadas de entrada.", when: p => p.piernas === "larga" },
      { points: 3, reason: "Estatura alta favorece una primera hipótesis de pelea exterior.", when: p => p.estatura === "alta" },
      { points: 2, reason: "Velocidad destacada ayuda a tocar y salir antes del intercambio.", when: p => p.velocidad === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de manejar distancia.", when: p => goal(p, "distancia") },
    ],
  },
  {
    id: "bolsillo-angulos",
    title: "Boxeo de bolsillo y salidas por ángulo",
    summary: "Entrar detrás de defensa activa, trabajar golpes curvos y abandonar el centro.",
    techniques: ["Hook", "Uppercut", "Cross–hook", "Low kick tras salida lateral"],
    drill: "5 combinaciones cortas por lado; después 3 × 90 s donde cada ataque termina con pivote.",
    watch: "Entrar con cabeza fuera de la línea y no permanecer quieto después de golpear.",
    rules: [
      { points: 4, reason: "Brazos cortos pueden sentirse eficientes en golpes curvos a corta distancia.", when: (_p, arms) => arms === "corta" },
      { points: 3, reason: "Estructura compacta invita a explorar entradas protegidas.", when: p => p.complexion === "compacta" },
      { points: 3, reason: "Muslos anchos permiten probar base y rotación en golpes cortos.", when: p => p.muslos === "ancha" },
      { points: 2, reason: "Equilibrio destacado ayuda a golpear y pivotar sin quedar plantado.", when: p => p.equilibrio === "destacada" },
      { points: 2, reason: "Coincide con el objetivo de presionar.", when: p => goal(p, "presionar") },
    ],
  },
  {
    id: "presion-corte",
    title: "Presión inteligente y corte de espacio",
    summary: "Quitar salidas con pasos pequeños, atacar cuerpo y piernas, y conservar defensa.",
    techniques: ["Doble jab al cuerpo", "Corte de jaula", "Low kick", "Hook al cuerpo"],
    drill: "4 × 90 s en espacio marcado: puntúa cerrar una salida sin correr ni cruzar los pies.",
    watch: "Presionar no significa recibir golpes; mantener guardia, respiración y ruta de salida.",
    rules: [
      { points: 4, reason: "Resistencia destacada permite probar presión sostenida con buena forma.", when: p => p.resistencia === "destacada" },
      { points: 3, reason: "Complexión robusta puede adaptarse al contacto cercano.", when: p => p.complexion === "robusta" },
      { points: 2, reason: "Hombros anchos pueden aportar estabilidad en intercambios cortos.", when: p => p.hombros === "ancha" },
      { points: 2, reason: "Coincide con el objetivo de presionar.", when: p => goal(p, "presionar") },
    ],
  },
  {
    id: "contragolpe-movil",
    title: "Contragolpe, ritmo y movilidad",
    summary: "Hacer fallar, responder con una acción corta y cambiar inmediatamente de posición.",
    techniques: ["Pull cross", "Check hook", "Slip–cross", "Paso atrás y low kick"],
    drill: "3 × 2 min: compañero inicia una señal conocida; responder una vez y salir a un cono lateral.",
    watch: "No confiar solo en reflejos; usar lectura, distancia y una defensa que pueda repetirse bajo fatiga.",
    rules: [
      { points: 4, reason: "Movilidad destacada favorece cambios de ángulo.", when: p => p.movilidad === "destacada" },
      { points: 3, reason: "Explosividad destacada ayuda en respuestas cortas.", when: p => p.explosividad === "destacada" },
      { points: 3, reason: "Velocidad destacada permite explorar respuestas simples y oportunas.", when: p => p.velocidad === "destacada" },
      { points: 2, reason: "Equilibrio destacado favorece defender y salir en una misma acción.", when: p => p.equilibrio === "destacada" },
      { points: 2, reason: "Una guardia cambiante puede aprovechar transiciones de ángulo.", when: p => p.guardia === "cambiante" },
      { points: 2, reason: "Coincide con el objetivo de defender y contraatacar.", when: p => goal(p, "defender") },
    ],
  },
  {
    id: "clinch-rodillas",
    title: "Clinch, rodillas y control de cabeza",
    summary: "Cerrar distancia con marcos, ganar posición interior y golpear sin perder balance.",
    techniques: ["Entrada con jab", "Collar tie", "Rodilla recta", "Salida con marco y giro"],
    drill: "3 × 90 s de pummeling con una rodilla técnica al obtener control; potencia moderada.",
    watch: "Solo aplicar codos o rodillas conforme a reglas, edad, equipo y supervisión de la clase.",
    rules: [
      { points: 4, reason: "Piernas largas permiten explorar rodillas desde clinch.", when: p => p.piernas === "larga" },
      { points: 3, reason: "Agarre destacado puede ayudar a conservar posición interior.", when: p => p.agarre === "destacada" },
      { points: 2, reason: "Estatura alta sugiere probar control de cabeza con postura estable.", when: p => p.estatura === "alta" },
      { points: 2, reason: "Coincide con el objetivo de controlar.", when: p => goal(p, "controlar") },
    ],
  },
];

function effectiveArmBand(profile: CombatStyleProfile) {
  if (!profile.alturaCm || !profile.envergaduraCm) return profile.brazos;
  const ratio = profile.envergaduraCm / profile.alturaCm;
  if (ratio >= 1.035) return "larga";
  if (ratio <= 0.965) return "corta";
  return "media";
}

function rank(candidates: Candidate[], profile: CombatStyleProfile, arms: BodyBand) {
  return candidates
    .map(candidate => {
      const matched = candidate.rules.filter(rule => rule.when(profile, arms));
      return {
        ...candidate,
        score: (candidate.base || 1) + matched.reduce((total, rule) => total + rule.points, 0),
        reasons: matched.map(rule => rule.reason).slice(0, 3),
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es"))
    .slice(0, 3)
    .map((candidate, index): StyleRecommendation => ({
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      techniques: candidate.techniques,
      submissions: candidate.submissions || [],
      drill: candidate.drill,
      watch: candidate.watch,
      score: candidate.score,
      level: index === 0 ? "Probar primero" : index === 1 ? "Segunda ruta" : "Complemento",
      reasons: candidate.reasons.length ? candidate.reasons : ["Perfil equilibrado: conviene validarlo en rounds técnicos."],
    }));
}

function profileQuality(profile: CombatStyleProfile) {
  const detailed = [profile.alturaCm, profile.pesoKg, profile.envergaduraCm, profile.cinturaCm, profile.caderaCm, profile.musloCm].filter(value => value !== undefined).length;
  const distinctive = [
    profile.estatura !== "media", profile.complexion !== "equilibrada", profile.torso !== "media",
    profile.brazos !== "media", profile.piernas !== "media", profile.hombros !== "media",
    profile.cintura !== "media", profile.cadera !== "media", profile.gluteos !== "media",
    profile.muslos !== "media", profile.manos !== "media", profile.movilidad !== "media",
    profile.explosividad !== "media", profile.resistencia !== "media", profile.agarre !== "media",
    profile.equilibrio !== "media", profile.velocidad !== "media", profile.controlCorporal !== "media",
  ].filter(Boolean).length;
  const total = detailed + distinctive + Math.min(profile.objetivos.length, 3);
  if (total >= 9) return { quality: "detallado" as const, qualityLabel: "Perfil detallado" };
  if (total >= 4) return { quality: "útil" as const, qualityLabel: "Base útil para probar" };
  return { quality: "inicial" as const, qualityLabel: "Hipótesis inicial" };
}

function buildDeprioritizedRecommendations(profile: CombatStyleProfile, arms: BodyBand): DeprioritizedRecommendation[] {
  const items: Array<DeprioritizedRecommendation & { order: number }> = [];
  const add = (order: number, item: DeprioritizedRecommendation) => items.push({ order, ...item });

  if (profile.restricciones.trim()) add(100, {
    id: "restriccion-individual",
    domain: "Grappling",
    technique: "Movimientos que reproduzcan dolor o limiten el control",
    status: "Evitar por ahora",
    reason: "Hay una restricción registrada y debe prevalecer sobre cualquier coincidencia corporal.",
    alternative: "Usar una variante sin dolor validada por el entrenador y, cuando corresponda, por un profesional de salud.",
    validation: "No probar bajo resistencia hasta confirmar un rango cómodo y controlado.",
  });
  if (arms === "corta") {
    add(95, {
      id: "guillotina-arm-in-alcance-corto",
      domain: "Grappling",
      technique: "Guillotina con brazo dentro y cierre largo",
      status: "Menor prioridad",
      reason: "Un alcance corto puede dificultar rodear cuello, hombro y brazo sin perder conexión del torso.",
      alternative: "Guillotina compacta sin brazo, high-wrist, kimura o go-behind.",
      validation: "Comparar 10 cierres sin brazo frente a 10 con brazo dentro; conservar solo la variante con ajuste limpio y sin tirar del cuello.",
    });
    add(92, {
      id: "darce-anaconda-alcance-corto",
      domain: "Wrestling",
      technique: "D’Arce o anaconda sobre torsos amplios",
      status: "Menor prioridad",
      reason: "Estas configuraciones exigen atravesar cabeza y brazo; el cierre puede depender demasiado de fuerza si falta alcance.",
      alternative: "Front headlock, snapdown y go-behind; después probar una variante corta con agarre palma-bíceps.",
      validation: "Exigir conexión pecho-hombro antes de cerrar y abandonar la variante si el agarre no llega sin comprimir de forma brusca.",
    });
  }
  if (profile.piernas === "corta") {
    add(88, {
      id: "triangulo-frontal-piernas-cortas",
      domain: "Grappling",
      technique: "Triángulo frontal sin cortar el ángulo",
      status: "Menor prioridad",
      reason: "Piernas cortas pueden hacer ineficiente cerrar de frente, especialmente contra hombros o torsos amplios.",
      alternative: "Cortar el ángulo, usar triángulo lateral o cambiar a armbar, omoplata o barrido.",
      validation: "Debe cerrar sin cruzar los pies ni forzar rodillas; medir 6 de 10 repeticiones técnicas antes de usarlo como ruta principal.",
    });
  }
  if (profile.movilidad === "por_desarrollar") add(86, {
    id: "inversion-movilidad-baja",
    domain: "Grappling",
    technique: "Inversiones profundas y guardias que carguen cuello o zona lumbar",
    status: "Evitar por ahora",
    reason: "La movilidad observada todavía no sostiene esos rangos con control repetible.",
    alternative: "Knee shield, marcos, guardia sentada y recuperación de cadera en rangos cómodos.",
    validation: "Reintroducir solo después de completar el patrón sin dolor, impulso ni pérdida de respiración.",
  });
  if (profile.agarre === "por_desarrollar") add(82, {
    id: "solapa-agarre-bajo",
    domain: "Grappling",
    technique: "Estrangulaciones de solapa sostenidas como plan principal",
    status: "Menor prioridad",
    reason: "El agarre observado puede agotarse antes de completar el control posicional.",
    alternative: "Priorizar posición, agarres de dos contra uno y finalizaciones que conecten torso y cadera.",
    validation: "Comparar precisión antes y después de 30 segundos de agarre específico.",
  });
  if (profile.equilibrio === "por_desarrollar") add(80, {
    id: "giros-equilibrio-bajo",
    domain: "Striking",
    technique: "Golpes giratorios o patadas altas bajo fatiga",
    status: "Evitar por ahora",
    reason: "El equilibrio actual no garantiza una recuperación estable de la guardia.",
    alternative: "Jab, cross, low kick y pivotes cortos con base recuperable.",
    validation: "Completar 10 repeticiones por lado y recuperar guardia sin pasos extra antes de aumentar velocidad.",
  });
  if (profile.explosividad === "por_desarrollar") add(76, {
    id: "double-leg-distancia-explosividad-baja",
    domain: "Wrestling",
    technique: "Double leg iniciado desde larga distancia",
    status: "Menor prioridad",
    reason: "Una entrada larga puede exponer postura si todavía falta aceleración para cerrar el espacio.",
    alternative: "Preparar con snapdown, clinch, pared o cambio de nivel desde contacto.",
    validation: "Contar entradas con postura estable, no solo derribos completados.",
  });

  return items.sort((a, b) => b.order - a.order).slice(0, 4).map(item => ({
    id: item.id,
    domain: item.domain,
    technique: item.technique,
    status: item.status,
    reason: item.reason,
    alternative: item.alternative,
    validation: item.validation,
  }));
}

export function validateCombatStyleProfile(profile: CombatStyleProfile) {
  if (profile.alturaCm !== undefined && (!Number.isFinite(profile.alturaCm) || profile.alturaCm < 80 || profile.alturaCm > 230)) return "La altura debe estar entre 80 y 230 cm.";
  if (profile.pesoKg !== undefined && (!Number.isFinite(profile.pesoKg) || profile.pesoKg < 15 || profile.pesoKg > 250)) return "El peso debe estar entre 15 y 250 kg.";
  if (profile.envergaduraCm !== undefined && (!Number.isFinite(profile.envergaduraCm) || profile.envergaduraCm < 70 || profile.envergaduraCm > 260)) return "La envergadura debe estar entre 70 y 260 cm.";
  if (profile.cinturaCm !== undefined && (!Number.isFinite(profile.cinturaCm) || profile.cinturaCm < 30 || profile.cinturaCm > 200)) return "La cintura debe estar entre 30 y 200 cm.";
  if (profile.caderaCm !== undefined && (!Number.isFinite(profile.caderaCm) || profile.caderaCm < 40 || profile.caderaCm > 220)) return "La cadera debe estar entre 40 y 220 cm.";
  if (profile.musloCm !== undefined && (!Number.isFinite(profile.musloCm) || profile.musloCm < 20 || profile.musloCm > 120)) return "El muslo debe estar entre 20 y 120 cm.";
  if (profile.alturaCm && profile.envergaduraCm) {
    const ratio = profile.envergaduraCm / profile.alturaCm;
    if (ratio < 0.75 || ratio > 1.25) return "Revisa altura y envergadura; la proporción capturada parece improbable.";
  }
  if (profile.objetivos.length > 4) return "Selecciona como máximo cuatro objetivos.";
  if (profile.restricciones.trim().length > 500 || profile.notas.trim().length > 500) return "Las notas no pueden superar 500 caracteres.";
  return "";
}

export function buildCombatStyleReport(profile: CombatStyleProfile): CombatStyleReport {
  const arms = effectiveArmBand(profile);
  const quality = profileQuality(profile);
  const reachRatio = profile.alturaCm && profile.envergaduraCm
    ? Math.round((profile.envergaduraCm / profile.alturaCm) * 1000) / 1000
    : undefined;
  const waistHeightRatio = profile.alturaCm && profile.cinturaCm
    ? Math.round((profile.cinturaCm / profile.alturaCm) * 1000) / 1000
    : undefined;
  const waistHipRatio = profile.caderaCm && profile.cinturaCm
    ? Math.round((profile.cinturaCm / profile.caderaCm) * 1000) / 1000
    : undefined;
  const grappling = rank(grapplingCandidates, profile, arms).map(route => arms === "corta" && route.id === "media-mariposa" ? {
    ...route,
    techniques: route.techniques.map(technique => technique === "Guillotina frontal" ? "Guillotina compacta sin brazo" : technique),
    submissions: (route.submissions || []).map(submission => submission.id === "guillotina" ? {
      ...submission,
      name: "Guillotina compacta sin brazo",
      entry: "Front headlock con conexión pecho-cabeza",
    } : submission),
  } : route);
  const seenSubmissions = new Set<string>();
  const submissions = grappling.flatMap((route, routeIndex) => (route.submissions || []).map(submission => ({
    ...submission,
    priority: routeIndex === 0 ? "Principal" as const : "Alternativa" as const,
    routeTitle: route.title,
    why: route.reasons[0] || "Conviene validarla dentro de esta ruta técnica.",
  }))).filter(submission => {
    if (seenSubmissions.has(submission.id)) return false;
    seenSubmissions.add(submission.id);
    return true;
  }).slice(0, 6);
  return {
    ...quality,
    reachRatio,
    waistHeightRatio,
    waistHipRatio,
    effectiveArms: arms,
    submissions,
    deprioritized: buildDeprioritizedRecommendations(profile, arms),
    grappling,
    wrestling: rank(wrestlingCandidates, profile, arms),
    striking: rank(strikingCandidates, profile, arms),
    validationPlan: [
      { session: "Sesión 1", task: "Técnica aislada", measure: "¿Puede repetirla 6/10 veces con postura y control?" },
      { session: "Sesión 2", task: "Situación conocida", measure: "Intentos, éxitos y errores técnicos; no contar fuerza bruta." },
      { session: "Sesión 3", task: "Round técnico", measure: "Entradas limpias, control de 3 s y salidas seguras." },
      { session: "Sesión 4", task: "Comparar ruta A/B", measure: "Elegir la que conserve técnica, decisiones y energía." },
    ],
    caveats: [
      "La forma corporal orienta qué probar primero; no predice por sí sola el rendimiento ni limita el repertorio.",
      "Género y peso se guardan como contexto, pero no cambian automáticamente la selección técnica.",
      "Dolor, lesión, reglas, edad y experiencia prevalecen sobre cualquier sugerencia.",
      "La recomendación final pertenece al entrenador después de observar varias sesiones comparables.",
    ],
  };
}

export type CombatStyleShareOptions = {
  includePhysicalProfile?: boolean;
  profile?: CombatStyleProfile;
};

export type PublicPhysicalProfile = {
  estatura: string;
  complexion: string;
  torso: string;
  brazos: string;
  piernas: string;
  hombros: string;
  cintura: string;
  cadera: string;
  gluteos: string;
  muslos: string;
};

export type PublicCombatStyleSnapshot = {
  version: 1 | 2;
  qualityLabel: string;
  athleteName?: string;
  physicalProfile?: PublicPhysicalProfile;
  submissions: Array<Pick<SubmissionRecommendation, "name" | "entry" | "family" | "caution" | "priority" | "why">>;
  deprioritized?: DeprioritizedRecommendation[];
  primaryRoutes: Array<{
    domain: "Grappling" | "Wrestling" | "Striking";
    title: string;
    summary: string;
    techniques: string[];
    reason: string;
    drill: string;
    watch: string;
  }>;
  validationPlan: CombatStyleReport["validationPlan"];
};

function physicalProfileShareLines(profile: CombatStyleProfile) {
  const height = { baja: "baja", media: "media", alta: "alta" }[profile.estatura];
  const build = { compacta: "compacta", equilibrada: "equilibrada", longilinea: "longilínea", robusta: "robusta" }[profile.complexion];
  const body = { corta: "corto/a", media: "medio/a", larga: "largo/a" } as const;
  const width = { estrecha: "estrecho/a", media: "medio/a", ancha: "ancho/a" } as const;
  return [
    "PERFIL CORPORAL PARA CONFIRMAR",
    `Estatura percibida: ${height}`,
    `Complexión: ${build}`,
    `Torso: ${body[profile.torso]} · Brazos: ${body[profile.brazos]} · Piernas: ${body[profile.piernas]}`,
    `Hombros: ${width[profile.hombros]} · Cintura: ${width[profile.cintura]}`,
    `Cadera: ${width[profile.cadera]} · Glúteos: ${width[profile.gluteos]} · Muslos: ${width[profile.muslos]}`,
    "¿Esta descripción coincide contigo? Responde: Sí / Parcialmente / No, e indica qué cambiarías.",
    "No se incluyeron peso, centímetros ni información de salud.",
  ];
}

function publicPhysicalProfile(profile: CombatStyleProfile): PublicPhysicalProfile {
  const height = { baja: "Baja", media: "Media", alta: "Alta" }[profile.estatura];
  const build = { compacta: "Compacta", equilibrada: "Equilibrada", longilinea: "Longilínea", robusta: "Robusta" }[profile.complexion];
  const body = { corta: "Corto/a", media: "Medio/a", larga: "Largo/a" } as const;
  const width = { estrecha: "Estrecho/a", media: "Medio/a", ancha: "Ancho/a" } as const;
  return {
    estatura: height,
    complexion: build,
    torso: body[profile.torso],
    brazos: body[profile.brazos],
    piernas: body[profile.piernas],
    hombros: width[profile.hombros],
    cintura: width[profile.cintura],
    cadera: width[profile.cadera],
    gluteos: width[profile.gluteos],
    muslos: width[profile.muslos],
  };
}

function shareableDeprioritized(report: CombatStyleReport) {
  return report.deprioritized.filter(item => item.id !== "restriccion-individual");
}

export function buildPublicCombatStyleSnapshot(
  profile: CombatStyleProfile,
  report: CombatStyleReport,
  options: { includePhysicalProfile?: boolean; athleteName?: string } = {},
): PublicCombatStyleSnapshot {
  const route = (domain: "Grappling" | "Wrestling" | "Striking", item: StyleRecommendation) => ({
    domain,
    title: item.title,
    summary: item.summary,
    techniques: item.techniques.slice(0, 3),
    reason: item.reasons[0],
    drill: item.drill,
    watch: item.watch,
  });
  return {
    version: 2,
    qualityLabel: report.qualityLabel,
    ...(options.athleteName?.trim() ? { athleteName: options.athleteName.trim().slice(0, 100) } : {}),
    ...(options.includePhysicalProfile ? { physicalProfile: publicPhysicalProfile(profile) } : {}),
    submissions: report.submissions.slice(0, 4).map(({ name, entry, family, caution, priority, why }) => ({ name, entry, family, caution, priority, why })),
    deprioritized: shareableDeprioritized(report).map(item => ({ ...item })),
    primaryRoutes: [
      route("Grappling", report.grappling[0]),
      route("Wrestling", report.wrestling[0]),
      route("Striking", report.striking[0]),
    ],
    validationPlan: report.validationPlan.map(item => ({ ...item })),
  };
}

export function combatStyleShareText(athleteName: string, report: CombatStyleReport, options: CombatStyleShareOptions = {}) {
  const section = (title: string, items: StyleRecommendation[]) => [
    title.toUpperCase(),
    ...items.map((item, index) => `${index + 1}. ${item.title} — ${item.techniques.slice(0, 3).join(", ")}`),
  ].join("\n");
  const publicDeprioritized = shareableDeprioritized(report);
  return [
    `PERFIL TÉCNICO · ${athleteName.trim() || "Atleta"}`,
    report.qualityLabel,
    "",
    ...(options.includePhysicalProfile && options.profile ? [...physicalProfileShareLines(options.profile), ""] : []),
    "SUMISIONES RECOMENDADAS",
    ...report.submissions.slice(0, 4).map((item, index) => `${index + 1}. ${item.name} · desde ${item.entry}`),
    "",
    section("Grappling", report.grappling),
    "",
    section("Wrestling", report.wrestling),
    "",
    section("Striking", report.striking),
    "",
    ...(publicDeprioritized.length ? [
      "NO RECOMENDADAS POR AHORA",
      ...publicDeprioritized.map((item, index) => `${index + 1}. ${item.technique} · ${item.status}. ${item.reason} Alternativa: ${item.alternative}`),
      "",
    ] : []),
    "Validar las rutas durante cuatro sesiones técnicas. La decisión final pertenece al coach.",
    "El resumen no incluye peso, medidas corporales, lesiones ni notas privadas.",
  ].join("\n");
}

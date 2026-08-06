export type Discipline = 'BJJ' | 'MMA';

export type ActivityBlock = {
  range: string;
  title: string;
  detail: string;
  minutes: number;
};

export type ClassActivity = {
  id: string;
  date: string;
  session: number;
  discipline: Discipline;
  focus: 'Físico' | 'Técnico' | 'Práctico';
  rpe: string;
  emphasis: string;
  title: string;
  blocks: ActivityBlock[];
};

type BlockInput = [range: string, title: string, detail: string];

const SUCCESS_CRITERION =
  'Movimiento seguro, decisiones cada vez menos guiadas y calidad conservada durante la oposición.';

function block([range, title, detail]: BlockInput): ActivityBlock {
  const [start, end] = range.split('-').map(Number);
  return { range, title, detail, minutes: end - start };
}

function activity(
  value: Omit<ClassActivity, 'id' | 'blocks'> & { blocks: BlockInput[] },
): ClassActivity {
  return {
    ...value,
    id: `${value.discipline.toLowerCase()}-${value.date}`,
    blocks: value.blocks.map(block),
  };
}

const BJJ_ACTIVITIES: ClassActivity[] = [
  activity({
    date: '2026-08-04', session: 1, discipline: 'BJJ', focus: 'Físico', rpe: '7',
    emphasis: 'Calidad antes que fatiga', title: 'Base atlética: postura, cadera y agarre',
    blocks: [
      ['0-8', 'Activación RAMP', 'Movilidad de cuello, cadera y tobillo; shrimp, puente y technical stand-up. 2 rondas fluidas.'],
      ['8-20', 'Fuerza específica', '3 rondas: 20 s arrastre de pareja/dummy + 20 s bear crawl + 20 s plancha con toque + 40 s pausa. Principiante: carga suave; intermedio: resistencia moderada.'],
      ['20-32', 'Repetición técnica', 'Pummeling de agarres de pie, cambio de nivel y penetración sin finalizar: 3 x 2 min, 45 s descanso.'],
      ['32-48', 'CLA específico', 'Juego: tocar ambas rodillas o conseguir underhook; área 3 x 3 m; sin derribo. 4 x 2 min. Restricción obliga a postura, distancia y ángulo.'],
      ['48-56', 'Intervalos BJJ', '8 x 20 s entrada rápida + 20 s recuperación; alternar lado y pareja.'],
      ['56-60', 'Cierre', 'Respiración nasal, movilidad y RPE 1-10. Meta: técnica estable aun con pulso alto.'],
    ],
  }),
  activity({
    date: '2026-08-06', session: 2, discipline: 'BJJ', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Técnica cooperativa', title: 'Derribo seguro: single leg y salida',
    blocks: [
      ['0-8', 'Calentamiento', 'Caídas atrás/lateral progresivas, stance-motion y hand fighting suave.'],
      ['8-18', 'Demostración', 'Single leg: entrada, cabeza alta, control de rodilla, giro de esquina y descenso seguro. Defensa: whizzer + base.'],
      ['18-32', 'Repetición por bloques', '5 x 90 s por rol: entrada; entrada + control; finalización. 30 s para feedback externo breve.'],
      ['32-44', 'Variabilidad', 'Misma solución desde agarre de muñeca, collar-tie y después de snap. Principiante inicia con agarre; intermedio lo crea.'],
      ['44-56', 'CLA 40-60 %', 'Atacante gana al tocar cadera/rodilla con control; defensor gana al cuadrarse o aplicar whizzer. 4 x 2 min.'],
      ['56-60', 'Repaso', 'Cada pareja explica una señal perceptiva y ejecuta 2 repeticiones limpias.'],
    ],
  }),
  activity({
    date: '2026-08-08', session: 3, discipline: 'BJJ', focus: 'Práctico', rpe: '7-8',
    emphasis: 'Oposición progresiva', title: 'Aplicación 1: derribo a control superior',
    blocks: [
      ['0-7', 'Preparación', 'Ukemi, pummeling y 3 aceleraciones de 10 s.'],
      ['7-15', 'Recordatorio', 'Single leg, sprawl/whizzer y estabilización 3 s en side control.'],
      ['15-31', 'Sparring situacional', '4 x 3 min desde pie: punto por derribo controlado; reinicio si salen. 1 min descanso/coaching.'],
      ['31-47', 'Cadena suelo', '4 x 3 min desde half guard superior: arriba pasa; abajo recupera guardia o se levanta.'],
      ['47-57', 'Rounds integrados', '2 x 4 min desde pie, 1 min pausa. Principiante 60-70 %; intermedio 70-80 %.'],
      ['57-60', 'Debrief', 'Registrar derribos, pases y escapes exitosos; una prioridad para la semana 2.'],
    ],
  }),
  activity({
    date: '2026-08-11', session: 4, discipline: 'BJJ', focus: 'Físico', rpe: '7-8',
    emphasis: 'Semana de control', title: 'Tracción, isometría y escape de cadera',
    blocks: [
      ['0-8', 'RAMP', 'Hip heist, puente, shrimp con compañero y movilidad escapular.'],
      ['8-22', 'Circuito 4 estaciones', '3 x 35 s/25 s: remo con toalla/gi y pareja, squeeze de balón/dummy, puente isométrico, levantada técnica. No llegar al fallo.'],
      ['22-34', 'Repetición', 'Frames desde side control + puente-shrimp-reposición: 6 repeticiones por lado.'],
      ['34-50', 'CLA de escape', 'Abajo debe conectar rodilla-codo; arriba solo puede controlar con pecho y cambiar base, sin sumisión. 4 x 2 min.'],
      ['50-57', 'Finisher aláctico', '6 x 8 s de hip-heist máximo / 32 s suave; máxima velocidad, técnica limpia.'],
      ['57-60', 'Control', 'RPE y chequeo: hombro, cuello y rodilla sin dolor agudo.'],
    ],
  }),
  activity({
    date: '2026-08-13', session: 5, discipline: 'BJJ', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Capas de dificultad', title: 'Control lateral: estabilizar y progresar',
    blocks: [
      ['0-8', 'Calentamiento', 'Animal flow corto, movilidad de hombros y repaso de frames.'],
      ['8-20', 'Técnica A', 'Side control: crossface seguro, underhook, cadera baja y cambio de base; presión sin aplastar cuello.'],
      ['20-30', 'Técnica B', 'Knee-on-belly a mount cuando el rival crea frame; volver a side control si pierde equilibrio.'],
      ['30-42', 'Repetición variable', 'Secuencia 3-3-3: 3 sin resistencia, 3 con reacción pactada, 3 con elección libre.'],
      ['42-56', 'CLA', 'Arriba suma 1 por mantener 5 s y 2 por mount; abajo suma 2 por recuperar guardia/levantarse. 4 x 2.5 min.'],
      ['56-60', 'Cierre', 'Intercalado: una repetición de escape y una de progresión por lado.'],
    ],
  }),
  activity({
    date: '2026-08-15', session: 6, discipline: 'BJJ', focus: 'Práctico', rpe: '8',
    emphasis: 'Densidad moderada', title: 'Aplicación 2: control, escape y puntuación',
    blocks: [
      ['0-7', 'Preparación', 'Movilidad, frames, bridge y 2 min de flow roll.'],
      ['7-19', 'Rondas de escape', '3 x 3 min desde side control; cambio de rol al escapar o montar.'],
      ['19-31', 'Rondas de control', '3 x 3 min: arriba debe pasar side → KOB → mount; abajo recupera guardia.'],
      ['31-43', 'Problema encadenado', 'Empieza single leg ya tomado; continuar hasta 10 s de control o escape. 3 x 3 min.'],
      ['43-56', 'Sparring condicionado', '3 x 4 min, 45 s pausa; primer minuto desde posición elegida por quien perdió el round anterior.'],
      ['56-60', 'Debrief', 'Semáforo técnico: verde = funciona, amarillo = inestable, rojo = no aparece.'],
    ],
  }),
  activity({
    date: '2026-08-18', session: 7, discipline: 'BJJ', focus: 'Físico', rpe: '8',
    emphasis: '6:1 trabajo-pausa global', title: 'Potencia de cadera y resistencia intermitente',
    blocks: [
      ['0-8', 'RAMP', 'Movilidad dinámica + 3 progresiones de sprawls y levantadas.'],
      ['8-20', 'Potencia', '4 rondas: 5 lanzamientos rotacionales de balón/lado + 5 sprawls explosivos + 45 s pausa. Balón ligero, máxima velocidad.'],
      ['20-32', 'Uchi-komi adaptado', '6 x 30 s entradas alternadas de single/double o body-lock + 30 s pausa.'],
      ['32-48', 'CLA takedown chain', 'Atacante debe combinar dos ataques antes de puntuar; defensor no puede retroceder fuera del área. 4 x 2 min.'],
      ['48-57', 'Trabajo específico', '3 x 2 min: 20 s presión desde top half + 20 s movimiento suave, repetir.'],
      ['57-60', 'Vuelta a calma', 'Respiración 4-6 y RPE; ajustar volumen si técnica se degrada.'],
    ],
  }),
  activity({
    date: '2026-08-20', session: 8, discipline: 'BJJ', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Aprendizaje por señales', title: 'Guardia abierta: distancia, conexión y barrido',
    blocks: [
      ['0-8', 'Calentamiento', 'Pummeling de pies, hip switches y technical stand-up.'],
      ['8-20', 'Técnica A', 'Guardia sentada: controlar muñeca/tobillo, shin-to-shin y desequilibrio frontal-lateral.'],
      ['20-32', 'Técnica B', 'Single-leg wrestle-up o barrido básico según reacción; finalizar arriba con control.'],
      ['32-43', 'Repetición aleatoria', 'Compañero muestra una de dos reacciones; ejecutante identifica y elige solución. 10 intentos por rol.'],
      ['43-56', 'CLA', 'Abajo puntúa por levantarse/barrer; arriba por controlar rodillas y pasar línea de cadera. 4 x 2.5 min.'],
      ['56-60', 'Chequeo', 'Principiante nombra 2 conexiones; intermedio encadena desequilibrio opuesto.'],
    ],
  }),
  activity({
    date: '2026-08-22', session: 9, discipline: 'BJJ', focus: 'Práctico', rpe: '8',
    emphasis: 'Decisión bajo oposición', title: 'Aplicación 3: guardia a lucha de pie',
    blocks: [
      ['0-7', 'Preparación', 'Flow de guardia y levantadas técnicas.'],
      ['7-19', 'Round de conexión', '3 x 3 min desde guardia sentada; abajo debe conectar antes de atacar.'],
      ['19-31', 'Round de decisión', '3 x 3 min: pase, barrido o wrestle-up; reinicio tras puntuación.'],
      ['31-43', 'Transición', '3 x 3 min desde wrestle-up con single; continuar a derribo/control.'],
      ['43-56', 'Sparring', '3 x 4 min; cada round inicia en una posición distinta de las semanas 1-3.'],
      ['56-60', 'Registro', 'Contar primeras acciones efectivas, no solo resultado final.'],
    ],
  }),
  activity({
    date: '2026-08-25', session: 10, discipline: 'BJJ', focus: 'Físico', rpe: '7',
    emphasis: 'Descarga de volumen', title: 'Potencia repetida y agarre con autorregulación',
    blocks: [
      ['0-8', 'RAMP', 'Movilidad global, balance y 2 min de flow.'],
      ['8-20', 'Potencia técnica', '5 x 10 s de entradas explosivas / 50 s descanso; detener si baja velocidad o postura.'],
      ['20-32', 'Agarre inteligente', '3 rondas: 20 s pelea de agarres + 20 s control isométrico + 40 s descanso. Cambiar manos.'],
      ['32-46', 'Circuito de precisión', '3 vueltas: derribo → 3 s control → paso → mount; 60 % y sin pausas largas.'],
      ['46-56', 'CLA de eficiencia', 'Round 2 min: máximo 3 ataques; gana quien obtiene mejor posición con menos intentos. 4 rounds.'],
      ['56-60', 'Recuperación', 'RPE objetivo ≤ 7; movilidad suave y respiración.'],
    ],
  }),
  activity({
    date: '2026-08-27', session: 11, discipline: 'BJJ', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Preparación de evaluación', title: 'Cadenas completas y plan A/B',
    blocks: [
      ['0-8', 'Calentamiento', 'Repaso dirigido por parejas de movimientos clave.'],
      ['8-20', 'Cadena 1', 'Single leg → side control → KOB/mount. 5 repeticiones por rol con reacción pactada.'],
      ['20-32', 'Cadena 2', 'Guardia sentada → barrido/wrestle-up → control. 5 por rol.'],
      ['32-44', 'Plan B', 'Si falla derribo: guardia segura; si falla pase: estabilizar half guard. Repetición con error inducido.'],
      ['44-56', 'CLA de elección', 'Entrenador anuncia objetivo, no técnica: derribar, levantarse o consolidar. 4 x 2.5 min.'],
      ['56-60', 'Ensayo mental', 'Visualización breve y criterios: seguridad, control, decisión y continuidad.'],
    ],
  }),
  activity({
    date: '2026-08-29', session: 12, discipline: 'BJJ', focus: 'Práctico', rpe: '8-9',
    emphasis: 'Sin guerra innecesaria', title: 'Evaluación práctica y festival de rounds',
    blocks: [
      ['0-8', 'Preparación', 'RAMP + chequeo de molestias y parejas por peso/experiencia.'],
      ['8-16', 'Prueba técnica', '2 min por estación: derribo, escape, pase y guardia. Evaluar ejecución, no velocidad.'],
      ['16-28', 'Situacionales', '3 x 3 min: pie, side control y guardia sentada; 1 min feedback.'],
      ['28-50', 'Rounds libres', '4 x 5 min, 1 min descanso. Principiante puede iniciar desde suelo; intermedio desde pie.'],
      ['50-56', 'Round de precisión', '1 x 5 min a 60 %: objetivo de conectar la cadena individual.'],
      ['56-60', 'Cierre del ciclo', 'RPE, logros, una habilidad a conservar y una prioridad del siguiente mes.'],
    ],
  }),
];

const MMA_ACTIVITIES: ClassActivity[] = [
  activity({
    date: '2026-08-04', session: 1, discipline: 'MMA', focus: 'Físico', rpe: '7',
    emphasis: 'Sin saco, máxima intención', title: 'Base física: postura, desplazamiento y potencia',
    blocks: [
      ['0-8', 'RAMP', 'Movilidad, shadowboxing progresivo, sprawls técnicos y desplazamientos.'],
      ['8-20', 'Potencia con balón', '4 rondas: 5 lanzamientos rotacionales/lado + 5 chest pass + 30 s footwork + 45 s pausa. Balón que permita velocidad.'],
      ['20-32', 'Repetición', 'Jab-cross y salida angular en paletas: 4 x 2 min, 45 s pausa; precisión > fuerza.'],
      ['32-47', 'CLA distancia', 'Atacante solo puntúa tocando paleta tras crear ángulo; defensor controla distancia con pasos, sin golpear. 5 x 2 min.'],
      ['47-56', 'Intervalos', '6 x 30 s combinación rápida en paletas / 30 s movilidad. Principiante 70 %; intermedio 80-85 %.'],
      ['56-60', 'Cierre', 'Respiración y RPE; registrar precisión en el último intervalo.'],
    ],
  }),
  activity({
    date: '2026-08-06', session: 2, discipline: 'MMA', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Técnica limpia', title: 'Boxeo MMA: jab, cross, defensa y salida',
    blocks: [
      ['0-8', 'Calentamiento', 'Shadowboxing con guardia, step-drag y slips sin carga.'],
      ['8-19', 'Técnica A', 'Jab al pecho/cabeza, cross con retorno y salida fuera de la línea. Distancia segura.'],
      ['19-30', 'Técnica B', 'Parry jab, high guard ante cross y contraataque de 1-2 golpes.'],
      ['30-42', 'Repetición variable', 'Paletero muestra blanco al azar: jab, cross o 1-2-salida. 6 x 90 s.'],
      ['42-56', 'CLA toque técnico', 'Solo boxeo al cuerpo/hombros, 40-50 %; punto doble por golpear y salir sin respuesta. 4 x 2.5 min.'],
      ['56-60', 'Cierre', 'Feedback: una señal de distancia y una corrección individual.'],
    ],
  }),
  activity({
    date: '2026-08-08', session: 3, discipline: 'MMA', focus: 'Práctico', rpe: '7-8',
    emphasis: 'Contacto controlado', title: 'Aplicación 1: striking con defensa activa',
    blocks: [
      ['0-7', 'Preparación', 'Shadowboxing por reacción y 3 ráfagas de 10 s.'],
      ['7-17', 'Paletas reactivas', '5 x 90 s: entrenador da estímulo visual, atleta responde y sale.'],
      ['17-31', 'Sparring condicionado', '4 x 2.5 min: solo jab/cross, parry/guardia y salida; 1 min descanso.'],
      ['31-43', 'Problema de presión', 'Atacante avanza; defensor debe pivotar y recuperar centro. 4 x 2 min.'],
      ['43-56', 'Rounds técnicos', '3 x 4 min, 1 min pausa, 50-65 %. Principiante con compañero guía; intermedio con más iniciativa.'],
      ['56-60', 'Debrief', 'Contar golpes claros recibidos tras quedarse estático.'],
    ],
  }),
  activity({
    date: '2026-08-11', session: 4, discipline: 'MMA', focus: 'Físico', rpe: '8',
    emphasis: 'Fuerza específica segura', title: 'Resistencia de clinch y anti-derribo',
    blocks: [
      ['0-8', 'RAMP', 'Pummeling, movilidad cervical sin puentes de cuello y sprawls progresivos.'],
      ['8-21', 'Circuito', '3 rondas: 30 s pummeling resistido + 30 s arrastre dummy + 20 s sprawl técnico + 40 s pausa.'],
      ['21-33', 'Repetición', 'Underhook, head position, salida de reja imaginaria y giro: 5 x 90 s por parejas.'],
      ['33-48', 'CLA clinch', 'Área estrecha: punto por doble underhook, giro o separación segura; sin derribo. 5 x 2 min.'],
      ['48-57', 'Intermitente', '6 x 20 s presión de clinch / 40 s recuperación y cambio de rol.'],
      ['57-60', 'Control', 'RPE; detener ante dolor cervical, lumbar o de rodilla.'],
    ],
  }),
  activity({
    date: '2026-08-13', session: 5, discipline: 'MMA', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Cabeza y manos', title: 'Clinch MMA: entrar, controlar y salir golpeando',
    blocks: [
      ['0-8', 'Calentamiento', 'Hand fighting, pummeling y pasos cortos.'],
      ['8-20', 'Técnica A', 'Entrada tras 1-2, collar tie/underhook, cabeza bajo mandíbula sin impactar y postura estable.'],
      ['20-31', 'Técnica B', 'Knee tap o body-lock a desequilibrio controlado; salida con marco y golpe en paleta.'],
      ['31-43', 'Bloques', '3-3-3: cooperativo, reacción pactada y elección entre knee tap/salida.'],
      ['43-56', 'CLA', 'Atacante debe tocar primero con boxeo antes de entrar; defensor gana separándose o cuadrándose. 4 x 2.5 min.'],
      ['56-60', 'Cierre', 'Dos repeticiones perfectas por lado y feedback de postura.'],
    ],
  }),
  activity({
    date: '2026-08-15', session: 6, discipline: 'MMA', focus: 'Práctico', rpe: '8',
    emphasis: 'Usar pared segura si existe', title: 'Aplicación 2: pared, clinch y derribo',
    blocks: [
      ['0-7', 'Preparación', 'Pummeling + sprawls + levantadas de pared.'],
      ['7-19', 'Situacional 1', '3 x 3 min desde underhook en pared: escapar/girar vs estabilizar.'],
      ['19-31', 'Situacional 2', '3 x 3 min desde body-lock: derribo controlado vs base/whizzer.'],
      ['31-43', 'Cadena', 'Jab-cross → clinch → knee tap → control 5 s; 3 x 3 min con oposición creciente.'],
      ['43-56', 'Rounds MMA limitados', '3 x 4 min: boxeo 50 %, clinch/derribo 70 %, sin ground-and-pound duro.'],
      ['56-60', 'Debrief', 'Evaluar: entrada protegida, cabeza, cadera y salida segura.'],
    ],
  }),
  activity({
    date: '2026-08-18', session: 7, discipline: 'MMA', focus: 'Físico', rpe: '8',
    emphasis: 'Calidad neuromuscular', title: 'Potencia repetida: golpeo, sprawl y levantada',
    blocks: [
      ['0-8', 'RAMP', 'Shadowboxing, movilidad y 3 progresiones de sprawl.'],
      ['8-20', 'Complejo balón', '4 rondas: 4 scoop toss/lado + 4 slam + 20 s descanso + 4 sprawls rápidos; 60 s pausa.'],
      ['20-32', 'Paletas alácticas', '8 x 10 s combinación máxima / 50 s descanso activo; detener si precisión cae.'],
      ['32-47', 'CLA reacción', 'Paletero alterna golpeo o señal de derribo; atleta debe combinar o sprawl y contraatacar. 5 x 2 min.'],
      ['47-56', 'Ground burst', '6 x 20 s control + golpes al dummy / 40 s recuperación; postura y base primero.'],
      ['56-60', 'Cierre', 'RPE y respiración; revisar calidad del último bloque.'],
    ],
  }),
  activity({
    date: '2026-08-20', session: 8, discipline: 'MMA', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Seguridad primero', title: 'Transición derribo a control y ground-and-pound',
    blocks: [
      ['0-8', 'Calentamiento', 'Hip heist, technical stand-up y desplazamiento alrededor del dummy.'],
      ['8-20', 'Técnica A', 'Tras derribo: postura en half guard, crossface/underhook y controlar muñeca.'],
      ['20-31', 'Técnica B', 'Ground-and-pound simulado: base, mirada, golpes cortos a paleta/dummy y volver a controlar.'],
      ['31-43', 'Repetición variable', 'Compañero ofrece escape A/B; arriba elige control o golpe simulado. 6 x 90 s.'],
      ['43-56', 'CLA', 'Arriba puntúa por 3 golpes simulados con base; abajo por recuperar guardia o levantarse. 4 x 2.5 min.'],
      ['56-60', 'Cierre', 'Principiante trabaja sin impacto; intermedio con paleta y control estricto.'],
    ],
  }),
  activity({
    date: '2026-08-22', session: 9, discipline: 'MMA', focus: 'Práctico', rpe: '8',
    emphasis: 'Posición antes del volumen', title: 'Aplicación 3: transiciones MMA',
    blocks: [
      ['0-7', 'Preparación', 'Flow: boxeo → sprawl → levantada → clinch.'],
      ['7-19', 'Round de sprawl', '3 x 3 min desde señal de derribo: defender y contraatacar/salir.'],
      ['19-31', 'Round de suelo', '3 x 3 min desde top half: golpes simulados/control vs escape.'],
      ['31-43', 'Round de levantada', '3 x 3 min desde pared/suelo: abajo debe levantarse; arriba retiene.'],
      ['43-56', 'MMA técnico', '3 x 4 min, 1 min pausa; 50-65 % golpeo, 70 % grappling.'],
      ['56-60', 'Registro', '¿Dónde se perdió la secuencia: distancia, entrada, derribo o control?'],
    ],
  }),
  activity({
    date: '2026-08-25', session: 10, discipline: 'MMA', focus: 'Físico', rpe: '7',
    emphasis: 'Descarga de impacto', title: 'Acondicionamiento específico autorregulado',
    blocks: [
      ['0-8', 'RAMP', 'Movilidad + shadowboxing suave.'],
      ['8-20', 'Circuito 3 rondas', '30 s paletas precisión + 30 s dummy drag + 30 s pummeling + 60 s pausa. Mantener conversación corta al final.'],
      ['20-34', 'Técnica bajo fatiga baja', '4 x 2 min: 1-2 → sprawl → salida; 1 min pausa.'],
      ['34-48', 'CLA eficiencia', 'Máximo 4 golpes por intercambio; puntúa salir seguro o convertir a clinch. 4 x 2.5 min.'],
      ['48-56', 'Flow MMA', '2 x 3 min a 50 %, sin ganar; conectar fases con compañero cooperativo.'],
      ['56-60', 'Recuperación', 'RPE objetivo ≤ 7; movilidad y respiración 4-6.'],
    ],
  }),
  activity({
    date: '2026-08-27', session: 11, discipline: 'MMA', focus: 'Técnico', rpe: '5-6',
    emphasis: 'Integración técnica', title: 'Plan A/B: striking, clinch y suelo',
    blocks: [
      ['0-8', 'Calentamiento', 'Repaso libre guiado por señales.'],
      ['8-20', 'Plan A', 'Jab-cross → ángulo; si rival cubre, entrar a clinch. 5 repeticiones por rol.'],
      ['20-32', 'Plan B', 'Si derribo falla, separar con frame; si queda arriba, controlar y golpear dummy/paleta.'],
      ['32-44', 'Error inducido', 'Paletero/pareja cambia reacción; atleta debe abandonar técnica fallida y elegir otra.'],
      ['44-56', 'CLA de fases', 'Cada atleta recibe objetivo secreto: mantener pie, buscar clinch o levantarse. 4 x 2.5 min.'],
      ['56-60', 'Ensayo', 'Revisar reglas de contacto, señales de parar y estrategia individual.'],
    ],
  }),
  activity({
    date: '2026-08-29', session: 12, discipline: 'MMA', focus: 'Práctico', rpe: '8-9',
    emphasis: 'Control y responsabilidad', title: 'Evaluación práctica MMA',
    blocks: [
      ['0-8', 'Preparación', 'RAMP, revisión de equipo y emparejamiento por peso/nivel.'],
      ['8-16', 'Estaciones', '2 min cada una: paletas, sprawl, clinch y levantada. Evaluar precisión y postura.'],
      ['16-30', 'Situacionales', '4 x 2.5 min: striking, pared, top half y levantada; 1 min feedback.'],
      ['30-52', 'Rounds MMA', '4 x 4 min, 90 s descanso; 50-70 % golpeo y grappling técnico. Sin buscar nocaut.'],
      ['52-56', 'Round de precisión', '1 x 3 min a 50 % con objetivo individual.'],
      ['56-60', 'Cierre del ciclo', 'RPE, logros, conducta segura y prioridad para septiembre.'],
    ],
  }),
];

export const CLASS_ACTIVITIES = [...BJJ_ACTIVITIES, ...MMA_ACTIVITIES];

export const TRAINING_DATES = Array.from(
  new Set(CLASS_ACTIVITIES.map((item) => item.date)),
).sort();

export { SUCCESS_CRITERION };

export function getActivityForDate(date: string, discipline: Discipline) {
  return CLASS_ACTIVITIES.find(
    (item) => item.date === date && item.discipline === discipline,
  ) ?? null;
}

export function getActivityDuration(value: ClassActivity) {
  return value.blocks.reduce((total, item) => total + item.minutes, 0);
}

export function getClosestTrainingDate(date: string) {
  return TRAINING_DATES.find((item) => item >= date) ?? TRAINING_DATES.at(-1) ?? date;
}

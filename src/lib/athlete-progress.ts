export type SkillStatus = "pendiente" | "practicando" | "dominada";
export type SkillProgress = Record<string, SkillStatus>;

export const SKINFOLD_SITES = [
  {key:"biceps",label:"Bíceps"},
  {key:"triceps",label:"Tríceps"},
  {key:"subscapular",label:"Subescapular"},
  {key:"iliacCrest",label:"Cresta ilíaca"},
  {key:"supraspinal",label:"Supraespinal"},
  {key:"abdominal",label:"Abdominal"},
  {key:"frontThigh",label:"Muslo anterior"},
  {key:"medialCalf",label:"Pantorrilla medial"},
] as const;
export type SkinfoldKey=typeof SKINFOLD_SITES[number]["key"];
export type SkinfoldReadings=Partial<Record<SkinfoldKey,number[]>>;
export type SkinfoldValues=Partial<Record<SkinfoldKey,number>>;

export type PhysicalAssessment = {
  id: string;
  fecha: string;
  pesoKg: number;
  estaturaCm: number;
  imc: number;
  cinturaEstatura?: number;
  cinturaCadera?: number;
  grasaPorcentaje?: number;
  grasaAutomatica?: boolean;
  edad?: number;
  sexoCalculo?: "masculino" | "femenino";
  metodoGrasa?: string;
  cinturaCm?: number;
  caderaCm?: number;
  pechoCm?: number;
  cuelloCm?: number;
  hombrosCm?: number;
  abdomenCm?: number;
  gluteoCm?: number;
  brazoCm?: number;
  antebrazoCm?: number;
  musloCm?: number;
  pantorrillaCm?: number;
  lagartijas?: number;
  sentadillas?: number;
  abdominales?: number;
  navetteNivel?: number;
  navetteIdas?: number;
  navetteVelocidadFinal?: number;
  vo2MaxEstimado?: number;
  planchaSegundos?: number;
  saltoHorizontalCm?: number;
  saltoVerticalCm?: number;
  sprint10mSegundos?: number;
  agilidad505Segundos?: number;
  sitAndReachCm?: number;
  equilibrioSegundos?: number;
  fuerzaAgarreKg?: number;
  masaGrasaKg?: number;
  masaLibreGrasaKg?: number;
  ffmi?: number;
  plieguesMm?: SkinfoldValues;
  plieguesLecturasMm?: SkinfoldReadings;
  sumaPlieguesMm?: number;
  protocoloPliegues?: "ISAK-8";
  calidadPliegues?: number;
  plicometro?: string;
  calidadMedicion?: number;
  horaMedicion?: string;
  ayunoHoras?: number;
  ejercicioPrevioHoras?: number;
  hidratacion?: "baja" | "habitual" | "alta";
  contextoMenstrual?: boolean;
  faseMenstrual?: "menstruacion" | "folicular" | "ovulatoria" | "lutea" | "premenstrual" | "desconocida";
  anticoncepcionHormonal?: boolean;
  cicloIrregular?: boolean;
  dolorMenstrual?: number;
  fatigaMenstrual?: number;
  retencionLiquidos?: number;
  sangradoMenstrual?: number;
  suenoCalidad?: number;
  esfuerzoPercibido?: number;
  notas?: string;
  registradoPor?: string;
};

export type PhysicalGoals = {
  enfoque?: "salud"|"recomposicion"|"rendimiento"|"competencia"|"mantenimiento";
  fechaObjetivo?: string;
  pesoKg?: number;
  grasaPorcentaje?: number;
  cinturaEstatura?: number;
  vo2Max?: number;
  lagartijas?: number;
  sentadillas?: number;
  abdominales?: number;
  planchaSegundos?: number;
  saltoHorizontalCm?: number;
  sprint10mSegundos?: number;
  notas?: string;
  actualizadoEn?: string;
};

export type WellnessCheckin = {
  fecha: string;
  energia: number;
  sueno: number;
  dolor: number;
  animo: number;
  horasSueno?: number;
  pulsoReposo?: number;
  presionSistolica?: number;
  presionDiastolica?: number;
  zonaDolor?: string;
};

export type BloodPressureStatus = "low"|"normal"|"elevated"|"high1"|"high2"|"urgent"|"unknown";

export function bloodPressureStatus(systolic?:number,diastolic?:number):BloodPressureStatus {
  if(!systolic||!diastolic)return "unknown";
  if(systolic>180||diastolic>120)return "urgent";
  if(systolic<90||diastolic<60)return "low";
  if(systolic>=140||diastolic>=90)return "high2";
  if(systolic>=130||diastolic>=80)return "high1";
  if(systolic>=120&&diastolic<80)return "elevated";
  return "normal";
}

export function readinessScore(checkin:WellnessCheckin){
  // Índice operativo para observar cambios dentro de la misma persona. No es
  // una escala clínica validada ni debe utilizarse para autorizar ejercicio.
  const base=(checkin.energia+checkin.sueno+checkin.animo+(5-checkin.dolor))*5;
  const sleepAdjustment=checkin.horasSueno===undefined?0:checkin.horasSueno<6?-10:checkin.horasSueno<7?-4:checkin.horasSueno>=7?4:0;
  const pressure=bloodPressureStatus(checkin.presionSistolica,checkin.presionDiastolica),pressureAdjustment=pressure==="urgent"?-30:pressure==="high2"?-15:pressure==="high1"?-7:0;
  return Math.max(0,Math.min(100,Math.round(base+sleepAdjustment+pressureAdjustment)));
}

export type BmiZone="blue"|"green"|"yellow"|"red"|"neutral";
export function bmiZone(bmi?:number,age?:number):{zone:BmiZone;label:string;range:string;note:string}{
  if(!bmi)return{zone:"neutral",label:"Sin datos",range:"—",note:"Registra peso y estatura."};
  if(age&&age<20)return{zone:"neutral",label:"Requiere percentil",range:"Percentil por edad y sexo",note:"En menores no deben aplicarse directamente los cortes de adultos."};
  if(bmi<18.5)return{zone:"blue",label:"Bajo peso",range:"< 18.5",note:"Requiere interpretar composición, alimentación y contexto clínico."};
  if(bmi<25)return{zone:"green",label:"Rango saludable",range:"18.5–24.9",note:"Referencia de detección para adultos, no diagnóstico."};
  if(bmi<30)return{zone:"yellow",label:"Sobrepeso",range:"25.0–29.9",note:"En atletas musculados el IMC puede sobreestimar adiposidad."};
  return{zone:"red",label:"Obesidad por IMC",range:"≥ 30.0",note:"Conviene complementar con cintura, PGC y valoración profesional."};
}

export function goalProgress(current?:number,start?:number,target?:number,lowerIsBetter=false){
  if(current===undefined||start===undefined||target===undefined||start===target)return undefined;
  const raw=lowerIsBetter?(start-current)/(start-target):(current-start)/(target-start);
  return Math.max(0,Math.min(100,Math.round(raw*100)));
}

export type IndicatorLevel = "green" | "yellow" | "red" | "neutral";

export const SKILL_TREES = {
  "Jiu-Jitsu": [
    ["Fundamentos", ["Postura y base", "Caídas seguras", "Escape de cadera", "Puente"]],
    ["Defensa", ["Escape de montada", "Escape de control lateral", "Defensa de espalda", "Defensa de sumisión"]],
    ["Control", ["Guardia cerrada", "Control lateral", "Montada", "Control de espalda"]],
    ["Ataque", ["Pase de guardia", "Barrida", "Armbar", "Estrangulación"]],
  ],
  "Kick Boxing": [
    ["Fundamentos", ["Guardia", "Desplazamiento", "Distancia", "Respiración"]],
    ["Boxeo", ["Jab", "Cross", "Gancho", "Uppercut"]],
    ["Patadas", ["Low kick", "Patada media", "Patada alta", "Teep"]],
    ["Aplicación", ["Defensas", "Combinaciones", "Contragolpe", "Sparring técnico"]],
  ],
  MMA: [
    ["Base", ["Guardia mixta", "Distancia", "Desplazamiento", "Caídas seguras"]],
    ["Golpeo", ["Boxeo", "Patadas", "Combinaciones", "Clinch"]],
    ["Derribos", ["Entrada a piernas", "Defensa de derribo", "Proyección", "Control de reja"]],
    ["Suelo", ["Control", "Escapes", "Ground and pound", "Sumisiones"]],
  ],
  Taekwondo: [
    ["Fundamentos", ["Guardia", "Desplazamiento", "Equilibrio", "Flexibilidad"]],
    ["Patadas", ["Ap chagui", "Dollyo chagui", "Yop chagui", "Dwit chagui"]],
    ["Técnica", ["Bloqueos", "Combinaciones", "Poomsae", "Precisión"]],
    ["Combate", ["Distancia", "Contraataque", "Ritmo", "Estrategia"]],
  ],
} as const;

export type SkillDiscipline = keyof typeof SKILL_TREES;
export const SKILL_DISCIPLINES = Object.keys(SKILL_TREES) as SkillDiscipline[];

export function normalizeSkillDiscipline(value?: string): SkillDiscipline {
  const text = (value || "").toLowerCase();
  if (text.includes("kick")) return "Kick Boxing";
  if (text.includes("tae")) return "Taekwondo";
  if (text.includes("mma")) return "MMA";
  return "Jiu-Jitsu";
}

export function nextSkillStatus(value?: SkillStatus): SkillStatus {
  return value === "pendiente" || !value ? "practicando" : value === "practicando" ? "dominada" : "pendiente";
}

export function calculateBmi(weightKg: number, heightCm: number) {
  if (!(weightKg > 0) || !(heightCm > 0)) return 0;
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
}

export function calculateWaistHeight(waistCm?: number, heightCm?: number) {
  if (!waistCm || !heightCm) return undefined;
  return Math.round((waistCm / heightCm) * 100) / 100;
}

export function calculateWaistHip(waistCm?: number, hipCm?: number) {
  if (!waistCm || !hipCm) return undefined;
  return Math.round((waistCm / hipCm) * 100) / 100;
}

export function estimateAdultBodyFat(bmi: number, age?: number, sex?: "masculino" | "femenino") {
  if (!bmi || !age || age < 18 || !sex) return undefined;
  const sexValue = sex === "masculino" ? 1 : 0;
  return Math.max(2, Math.min(60, Math.round((1.2 * bmi + 0.23 * age - 10.8 * sexValue - 5.4) * 10) / 10));
}

export function calculateBodyComposition(weightKg?: number, heightCm?: number, bodyFat?: number) {
  if (!weightKg || !heightCm || bodyFat === undefined) return {};
  const fatMass = Math.round(weightKg * bodyFat) / 100;
  const leanMass = Math.round((weightKg - fatMass) * 10) / 10;
  const ffmi = Math.round((leanMass / ((heightCm / 100) ** 2)) * 10) / 10;
  return { fatMass: Math.round(fatMass * 10) / 10, leanMass, ffmi };
}

export function estimateNavetteVo2(stage?: number, age?: number) {
  if (!stage || stage < 1 || !age || age < 6) return undefined;
  const speed = 8 + 0.5 * stage;
  // Léger et al.: ecuación edad-velocidad para 6–18 años. En adultos, la
  // validación de la versión de etapas de un minuto fija la edad en 18 años.
  // En ambos casos el resultado es una estimación de campo, no una CPET.
  const effectiveAge = Math.min(age, 18);
  const vo2 = 31.025 + 3.238 * speed - 3.248 * effectiveAge + 0.1536 * speed * effectiveAge;
  return Math.round(vo2 * 10) / 10;
}

export function healthyBodyFatRange(age?: number, sex?: "masculino" | "femenino"):[number,number]|undefined {
  if (!age || age < 18 || !sex) return undefined;
  if (sex === "masculino") return age < 40 ? [8, 20] : age < 60 ? [11, 22] : [13, 25];
  return age < 40 ? [21, 33] : age < 60 ? [23, 34] : [24, 36];
}

export function vo2Reference(age?: number, sex?: "masculino" | "femenino") {
  if (!age || age < 20 || age >= 80 || !sex) return undefined;
  const decade = age < 30 ? 0 : age < 40 ? 1 : age < 50 ? 2 : age < 60 ? 3 : age < 70 ? 4 : 5;
  // Medianas aproximadas por década del registro FRIEND para pruebas máximas
  // en caminadora. La Navette sigue siendo una estimación de campo distinta.
  const targets = sex === "masculino" ? [48,42.4,37.8,32.4,29.5,24.4] : [37.6,34.4,30.2,26.1,22.7,18.3];
  return targets[decade];
}

export function measurementQuality(input:{hora?:string;ayunoHoras?:number;exerciseHours?:number;hydration?:string;fluidRetention?:number}) {
  let score=100;
  if (!input.hora) score-=8;
  if (input.ayunoHoras===undefined) score-=8; else if(input.ayunoHoras<2) score-=8;
  if (input.exerciseHours===undefined) score-=8; else if(input.exerciseHours<8) score-=15;
  if (!input.hydration) score-=8; else if(input.hydration!=="habitual") score-=10;
  if ((input.fluidRetention||0)>=2) score-=15;
  return Math.max(35,score);
}

export function personalizedGoals(record:PhysicalAssessment){
  const fatRange=healthyBodyFatRange(record.edad,record.sexoCalculo),vo2=vo2Reference(record.edad,record.sexoCalculo);
  return [
    {label:"Cintura/altura",current:record.cinturaEstatura,target:record.edad&&record.edad>=20?"< 0.50":"Revisión por edad",ok:record.edad!==undefined&&record.edad>=20&&record.cinturaEstatura!==undefined&&record.cinturaEstatura<.5,basis:"Cribado"},
    {label:"Grasa corporal",current:record.grasaPorcentaje,target:fatRange?`${fatRange[0]}–${fatRange[1]} % orientativo`:"Mismo método y tendencia",ok:!!fatRange&&record.grasaPorcentaje!==undefined&&record.grasaPorcentaje>=fatRange[0]&&record.grasaPorcentaje<=fatRange[1],basis:"Estimación"},
    {label:"VO₂ máx. estimado",current:record.vo2MaxEstimado,target:vo2?`≥ ${vo2} ml/kg/min orientativo`:"Crear línea base",ok:!!vo2&&record.vo2MaxEstimado!==undefined&&record.vo2MaxEstimado>=vo2,basis:"Prueba de campo"},
  ];
}

export function bmiLevel(bmi?: number, age?:number): IndicatorLevel {
  if (!bmi || (age!==undefined&&age<20)) return "neutral";
  if (bmi >= 18.5 && bmi < 25) return "green";
  if ((bmi >= 17 && bmi < 18.5) || (bmi >= 25 && bmi < 30)) return "yellow";
  return "red";
}

export function waistHeightLevel(ratio?: number): IndicatorLevel {
  if (ratio === undefined) return "neutral";
  if (ratio < 0.5) return "green";
  if (ratio < 0.6) return "yellow";
  return "red";
}

export function bodyFatLevel(percent?: number, sex?: "masculino" | "femenino"): IndicatorLevel {
  if (percent === undefined || !sex) return "neutral";
  const green = sex === "masculino" ? [10, 25] : [20, 35];
  const yellow = sex === "masculino" ? [6, 30] : [16, 40];
  if (percent >= green[0] && percent <= green[1]) return "green";
  if (percent >= yellow[0] && percent <= yellow[1]) return "yellow";
  return "red";
}

export function wellnessScore(input: { bmi?: number; waistHeight?: number; bodyFat?: number; sex?: "masculino" | "femenino" }) {
  // Compatibilidad con paneles existentes. Es un resumen visual interno, no
  // una puntuación de salud validada ni un cálculo de riesgo médico.
  const metrics = [
    { level: bmiLevel(input.bmi), weight: 30 },
    { level: waistHeightLevel(input.waistHeight), weight: 40 },
    { level: bodyFatLevel(input.bodyFat, input.sex), weight: 30 },
  ];
  const available = metrics.filter(metric => metric.level !== "neutral");
  if (!available.length) return undefined;
  const earned = available.reduce((sum, metric) => sum + metric.weight * (metric.level === "green" ? 1 : metric.level === "yellow" ? 0.6 : 0.25), 0);
  const possible = available.reduce((sum, metric) => sum + metric.weight, 0);
  return Math.round((earned / possible) * 100);
}

export type EvidenceKind="screening"|"field-estimate"|"personal-trend"|"data-quality";
export type HealthIndicator={
  key:string;
  label:string;
  value:string;
  level:IndicatorLevel;
  evidence:EvidenceKind;
  reference:string;
  interpretation:string;
  action:string;
};

export function scientificHealthIndicators(record:PhysicalAssessment):HealthIndicator[]{
  const adult=Boolean(record.edad&&record.edad>=20),bmi=bmiZone(record.imc,record.edad),ratio=record.cinturaEstatura;
  const bmiIndicator:HealthIndicator={
    key:"bmi",label:"IMC",value:record.imc?String(record.imc):"Sin datos",level:adult?bmiLevel(record.imc,record.edad):"neutral",evidence:"screening",
    reference:adult?"CDC · categorías para personas de 20 años o más":"CDC · en menores se requiere percentil por edad y sexo",
    interpretation:adult?`${bmi.label}. El IMC no distingue músculo, grasa y hueso.`:"No se aplican cortes de adultos a este atleta.",
    action:adult?"Interpretar junto con cintura, presión, hábitos y composición corporal.":"Usar curvas de crecimiento con un profesional de salud.",
  };
  const waistIndicator:HealthIndicator={
    key:"waist-height",label:"Cintura / altura",value:ratio===undefined?"Sin datos":ratio.toFixed(2),level:!adult||ratio===undefined?"neutral":ratio<.5?"green":ratio<.6?"yellow":"red",evidence:"screening",
    reference:adult?"Referencia práctica adulta: mantener la cintura por debajo de la mitad de la estatura":"Interpretación individual por edad",
    interpretation:ratio===undefined?"Registra cintura y estatura bajo el mismo protocolo.":!adult?"No se presenta como diagnóstico en menores.":ratio<.5?"Está por debajo de 0.50.":ratio<.6?"Conviene confirmar la medición y observar la tendencia.":"Repite la medición y considera valoración profesional.",
    action:ratio===undefined?"Completar la próxima evaluación.":ratio>=.5&&adult?"Repetir en condiciones comparables; no perseguir cambios rápidos.":"Mantener hábitos sostenibles y seguimiento.",
  };
  const quality=record.calidadMedicion;
  const qualityIndicator:HealthIndicator={
    key:"quality",label:"Calidad del registro",value:quality===undefined?"Sin datos":`${quality}/100`,level:quality===undefined?"neutral":quality>=80?"green":quality>=60?"yellow":"red",evidence:"data-quality",
    reference:"Protocolo interno de comparabilidad; no es una escala clínica",
    interpretation:quality===undefined?"No se registraron las condiciones.":quality>=80?"La evaluación es razonablemente comparable.":"Las condiciones pueden explicar parte del cambio observado.",
    action:quality!==undefined&&quality<80?"Repetir a hora similar, hidratación habitual y sin ejercicio intenso previo.":"Conservar el mismo método, equipo y evaluador.",
  };
  const vo2=record.vo2MaxEstimado;
  const vo2Indicator:HealthIndicator={
    key:"vo2",label:"Capacidad aeróbica",value:vo2===undefined?"Sin datos":`${vo2} ml/kg/min`,level:"neutral",evidence:"field-estimate",
    reference:"Course Navette de 20 m · estimación de campo",
    interpretation:vo2===undefined?"Falta una prueba válida.":"Útil para comparar al atleta consigo mismo usando el mismo protocolo.",
    action:vo2===undefined?"Crear una línea base cuando sea seguro.":"Reevaluar en 6–12 semanas; CPET es el método clínico directo.",
  };
  return[bmiIndicator,waistIndicator,qualityIndicator,vo2Indicator];
}

export type PerformanceDomain={
  key:"cardio"|"push"|"legs"|"core"|"power"|"mobility";
  label:string;
  current?:number;
  baseline?:number;
  unit:string;
  delta?:number;
  change:"improved"|"stable"|"declined"|"baseline";
  detail:string;
  action:string;
};

function performanceDomain(input:Omit<PerformanceDomain,"delta"|"change"|"detail">&{lowerIsBetter?:boolean}):PerformanceDomain{
  const {lowerIsBetter=false,...domain}=input,current=input.current,baseline=input.baseline;
  if(current===undefined||baseline===undefined||baseline===0)return{...domain,change:"baseline",detail:"Se necesita otra evaluación comparable para medir evolución."};
  const raw=((current-baseline)/Math.abs(baseline))*100,directional=lowerIsBetter?-raw:raw,delta=Math.round(raw*10)/10;
  const change=directional>=5?"improved":directional<=-5?"declined":"stable";
  return{...domain,delta,change,detail:change==="improved"?`Mejora personal de ${Math.abs(delta)}% desde la línea base.`:change==="declined"?`Cambio de ${Math.abs(delta)}% en dirección desfavorable; confirma antes de ajustar.`:"Cambio menor al 5%; puede ser estabilidad o variación normal."};
}

export function buildPerformanceProfile(latest:PhysicalAssessment,baseline?:PhysicalAssessment):PerformanceDomain[]{
  const usesPlank=latest.planchaSegundos!==undefined,usesSprint=latest.sprint10mSegundos!==undefined,usesMobility=latest.sitAndReachCm!==undefined;
  return[
    performanceDomain({key:"cardio",label:"Cardio",current:latest.vo2MaxEstimado,baseline:baseline?.vo2MaxEstimado,unit:"ml/kg/min",action:"Trabajo aeróbico progresivo y nueva Navette en 6–12 semanas."}),
    performanceDomain({key:"push",label:"Empuje",current:latest.lagartijas,baseline:baseline?.lagartijas,unit:"reps",action:"Prioriza técnica limpia y progresión gradual de empuje."}),
    performanceDomain({key:"legs",label:"Piernas",current:latest.sentadillas,baseline:baseline?.sentadillas,unit:"reps",action:"Combina fuerza, control de rodilla y resistencia específica."}),
    performanceDomain({key:"core",label:"Core",current:usesPlank?latest.planchaSegundos:latest.abdominales,baseline:usesPlank?baseline?.planchaSegundos:baseline?.abdominales,unit:usesPlank?"s":"reps",action:"Progresar estabilidad sin entrenar con dolor lumbar."}),
    performanceDomain({key:"power",label:usesSprint?"Velocidad":"Potencia",current:usesSprint?latest.sprint10mSegundos:latest.saltoHorizontalCm,baseline:usesSprint?baseline?.sprint10mSegundos:baseline?.saltoHorizontalCm,unit:usesSprint?"s":"cm",lowerIsBetter:usesSprint,action:"Usa intentos frescos, descansos completos y el mismo protocolo."}),
    performanceDomain({key:"mobility",label:"Movilidad y control",current:usesMobility?latest.sitAndReachCm:latest.equilibrioSegundos,baseline:usesMobility?baseline?.sitAndReachCm:baseline?.equilibrioSegundos,unit:usesMobility?"cm":"s",action:"Practica movilidad o equilibrio 2–3 veces por semana sin dolor."}),
  ];
}

export type AthleteAchievement={key:string;title:string;detail:string;unlocked:boolean};
export function athleteAchievements(records:PhysicalAssessment[],wellness:WellnessCheckin[]):AthleteAchievement[]{
  const latest=records[0],baseline=records.at(-1),profile=latest?buildPerformanceProfile(latest,baseline):[],uniqueDays=new Set(wellness.map(item=>item.fecha)).size;
  return[
    {key:"baseline",title:"Punto de partida",detail:"Completaste tu primera evaluación.",unlocked:records.length>=1},
    {key:"quality",title:"Datos confiables",detail:"Evaluación con condiciones comparables.",unlocked:Boolean(latest&&latest.calidadMedicion!==undefined&&latest.calidadMedicion>=80)},
    {key:"consistency",title:"Constancia",detail:"Tres evaluaciones para ver una tendencia real.",unlocked:records.length>=3},
    {key:"recovery",title:"Cuido mi recuperación",detail:"Siete check-ins de bienestar registrados.",unlocked:uniqueDays>=7},
    {key:"personal-best",title:"Mejor que mi inicio",detail:"Mejora clara en al menos una capacidad física.",unlocked:profile.some(item=>item.change==="improved")},
  ];
}

export function nextAssessmentGuidance(latest?:PhysicalAssessment){
  if(!latest)return{label:"Crear línea base",detail:"Registra una evaluación inicial con un protocolo reproducible."};
  const date=new Date(`${latest.fecha}T12:00:00`);date.setDate(date.getDate()+56);
  return{label:"Próxima revisión sugerida",detail:`Alrededor del ${date.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})} (8 semanas).`};
}

export type SkinfoldSiteResult={key:SkinfoldKey;label:string;readings:number[];value?:number;spread?:number;consistent:boolean};
export type SkinfoldAssessment={sites:SkinfoldSiteResult[];values:SkinfoldValues;readings:SkinfoldReadings;sum?:number;complete:boolean;quality:number;needsRepeat:string[]};

export function skinfoldSiteResult(key:SkinfoldKey,label:string,input:number[]=[]):SkinfoldSiteResult{
  const readings=input.filter(value=>Number.isFinite(value)&&value>0&&value<=80).slice(0,3).map(value=>Math.round(value*10)/10),value=readings.length?Math.round(median(readings)*10)/10:undefined,spread=readings.length>1?Math.round((Math.max(...readings)-Math.min(...readings))*10)/10:undefined,tolerance=value===undefined?0:Math.max(1,value*.1),consistent=readings.length>=2&&spread!==undefined&&spread<=tolerance;
  return{key,label,readings,value,spread,consistent};
}

export function assessSkinfolds(input:SkinfoldReadings):SkinfoldAssessment{
  const sites=SKINFOLD_SITES.map(site=>skinfoldSiteResult(site.key,site.label,input[site.key])),values:SkinfoldValues={},readings:SkinfoldReadings={};
  for(const site of sites){if(site.value!==undefined)values[site.key]=site.value;if(site.readings.length)readings[site.key]=site.readings}
  const measured=sites.filter(site=>site.value!==undefined),complete=measured.length===SKINFOLD_SITES.length,sum=complete?Math.round(measured.reduce((total,site)=>total+(site.value||0),0)*10)/10:undefined,consistent=sites.filter(site=>site.consistent).length,quality=Math.round((measured.length/SKINFOLD_SITES.length*.55+consistent/SKINFOLD_SITES.length*.45)*100),needsRepeat=sites.filter(site=>site.readings.length===1||site.readings.length>1&&!site.consistent).map(site=>site.label);
  return{sites,values,readings,sum,complete,quality,needsRepeat};
}

export type BodyMeasureTrend={
  key:keyof PhysicalAssessment;
  label:string;
  current?:number;
  center?:number;
  low?:number;
  high?:number;
  delta?:number;
  percent?:number;
  status:"below"|"usual"|"above"|"baseline";
  healthLevel?:IndicatorLevel;
  healthNote?:string;
};

const bodyMeasureDefinitions:[keyof PhysicalAssessment,string][]=[
  ["cuelloCm","Cuello"],["hombrosCm","Hombros"],["pechoCm","Pecho"],
  ["brazoCm","Brazo"],["antebrazoCm","Antebrazo"],["cinturaCm","Cintura"],
  ["abdomenCm","Abdomen"],["caderaCm","Cadera"],["gluteoCm","Glúteo"],
  ["musloCm","Muslo"],["pantorrillaCm","Pantorrilla"],
];

function median(values:number[]){const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2}

export function bodyMeasurementTrends(records:PhysicalAssessment[]):BodyMeasureTrend[]{
  const latest=records[0];
  if(!latest)return[];
  return bodyMeasureDefinitions.map(([key,label])=>{
    const current=typeof latest[key]==="number"?latest[key] as number:undefined;
    const history=records.slice(1).map(record=>record[key]).filter((value):value is number=>typeof value==="number").slice(0,6);
    if(current===undefined)return{key,label,status:"baseline"};
    if(!history.length)return{key,label,current,status:"baseline"};
    const center=median(history),deviations=history.map(value=>Math.abs(value-center)),mad=median(deviations),tolerance=Math.max(1,2*mad,center*.02),low=Math.round((center-tolerance)*10)/10,high=Math.round((center+tolerance)*10)/10,delta=Math.round((current-center)*10)/10,percent=Math.round(delta/center*1000)/10,status=current<low?"below":current>high?"above":"usual";
    const isAdult=Boolean(latest.edad&&latest.edad>=20),ratio=key==="cinturaCm"?latest.cinturaEstatura:undefined,healthLevel=key==="cinturaCm"&&isAdult&&ratio!==undefined?(ratio<.5?"green":ratio<.6?"yellow":"red"):undefined,healthNote=healthLevel?ratio!>=.5?`Cintura/altura ${ratio!.toFixed(2)}: por debajo de 0.50.`:`Cintura/altura ${ratio!.toFixed(2)}: confirma la medición y revisa la tendencia.`:undefined;
    return{key,label,current,center,low,high,delta,percent,status,healthLevel,healthNote};
  });
}

export function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

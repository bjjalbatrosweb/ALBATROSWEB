import type {PhysicalAssessment} from "./athlete-progress.ts";

export const FITNESS_EXERCISES=["lagartijas","sentadillas","abdominales","burpees"] as const;
export type FitnessExerciseKey=typeof FITNESS_EXERCISES[number];
export type FitnessLevel="inicio"|"desarrollo"|"objetivo"|"destacado"|"sobresaliente";
export type FitnessReferenceKind="externa"|"academia"|"personal"|"linea_base";

export type FitnessExerciseScore={
  key:FitnessExerciseKey;
  label:string;
  repetitions:number;
  target:number;
  score:number;
  level:FitnessLevel;
  levelLabel:string;
  referenceKind:FitnessReferenceKind;
  referenceLabel:string;
  confidence:"alta"|"media"|"inicial";
  change?:number;
  academyPercentile?:number;
};

export type FitnessScoreReport={
  version:"bateria-60s-v1";
  exercises:FitnessExerciseScore[];
  overall?:number;
  overallLevel?:FitnessLevel;
  overallLabel:string;
  completed:number;
  provisional:boolean;
  rankingEligible:boolean;
};

export type FitnessAthlete={id:string;nombre:string;historialFisico?:unknown[]};
export type FitnessRankingEntry={athleteId:string;name:string;rank:number;report:FitnessScoreReport};

type BuildInput={
  values:Partial<Record<FitnessExerciseKey,number|undefined>>;
  age?:number;
  sex?:"masculino"|"femenino";
  weightKg?:number;
  history?:PhysicalAssessment[];
  cohort?:FitnessAthlete[];
  athleteId?:string;
  valuesFromHistory?:boolean;
};

const LABELS:Record<FitnessExerciseKey,string>={lagartijas:"Lagartijas",sentadillas:"Sentadillas",abdominales:"Abdominales",burpees:"Burpees"};
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const round=(value:number)=>Math.round(value);
const number=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:undefined;
const median=(values:number[])=>{if(!values.length)return undefined;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
const ageBand=(age?:number)=>age===undefined?"unknown":age<18?"minor":age<30?"18-29":age<40?"30-39":age<50?"40-49":age<60?"50-59":age<70?"60-69":"70+";

export function fitnessLevel(score:number):{level:FitnessLevel;label:string}{
  if(score<40)return{level:"inicio",label:"Base inicial"};
  if(score<60)return{level:"desarrollo",label:"En desarrollo"};
  if(score<75)return{level:"objetivo",label:"Referencia alcanzada"};
  if(score<90)return{level:"destacado",label:"Destacado"};
  return{level:"sobresaliente",label:"Sobresaliente"};
}

function scoreAgainstTarget(repetitions:number,target:number){
  if(target<=0)return 50;
  const ratio=repetitions/target;
  const anchors:[[number,number],[number,number],[number,number],[number,number],[number,number],[number,number]]=[[0,0],[.5,35],[.75,55],[1,70],[1.25,85],[1.5,100]];
  if(ratio>=1.5)return 100;
  for(let index=1;index<anchors.length;index++){
    const [rightRatio,rightScore]=anchors[index],[leftRatio,leftScore]=anchors[index-1];
    if(ratio<=rightRatio)return round(leftScore+(rightScore-leftScore)*(ratio-leftRatio)/(rightRatio-leftRatio));
  }
  return 100;
}

function iowaTarget(key:FitnessExerciseKey,age?:number,sex?:"masculino"|"femenino"){
  if(age===undefined||age<20||!sex||!(["lagartijas","abdominales"] as string[]).includes(key))return undefined;
  const band=age<30?0:age<40?1:age<50?2:age<60?3:4;
  if(key==="lagartijas"){
    if(sex==="femenino"&&age>=50)return undefined; // La tabla cambia a lagartija de rodillas; no es el mismo protocolo.
    return (sex==="masculino"?[29,24,18,13,10]:[15,11,9,0,0])[band]||undefined;
  }
  return (sex==="masculino"?[38,35,29,24,19]:[32,25,20,14,6])[band];
}

function latestValue(records:PhysicalAssessment[],key:FitnessExerciseKey){for(const record of records){const value=number(record[key]);if(value!==undefined)return value}return undefined}
function previousValue(records:PhysicalAssessment[],key:FitnessExerciseKey,current?:number){let skipped=false;for(const record of records){const value=number(record[key]);if(value===undefined)continue;if(!skipped&&current!==undefined&&value===current){skipped=true;continue}return value}return undefined}
function latestProfile(records:PhysicalAssessment[]){return{age:records.find(record=>number(record.edad)!==undefined)?.edad,sex:records.find(record=>record.sexoCalculo)?.sexoCalculo,weightKg:records.find(record=>number(record.pesoKg)!==undefined)?.pesoKg}}
export function latestFitnessValues(records:PhysicalAssessment[]):Partial<Record<FitnessExerciseKey,number>>{return Object.fromEntries(FITNESS_EXERCISES.map(key=>[key,latestValue(records,key)]).filter(([,value])=>value!==undefined))}

function comparablePool(input:BuildInput,key:FitnessExerciseKey){
  const candidates=(input.cohort||[]).filter(athlete=>athlete.id!==input.athleteId).map(athlete=>{const records=(athlete.historialFisico||[]) as PhysicalAssessment[],profile=latestProfile(records),value=latestValue(records,key);return{...profile,value}}).filter(item=>item.value!==undefined);
  const sameSexAge=candidates.filter(item=>(!input.sex||item.sex===input.sex)&&ageBand(item.age)===ageBand(input.age));
  const sameWeight=sameSexAge.filter(item=>input.weightKg===undefined||item.weightKg===undefined||Math.abs(item.weightKg-input.weightKg)<=Math.max(8,input.weightKg*.15));
  if(sameWeight.length>=5)return sameWeight.map(item=>item.value!);
  if(sameSexAge.length>=5)return sameSexAge.map(item=>item.value!);
  const sameSex=candidates.filter(item=>!input.sex||item.sex===input.sex);
  return sameSex.length>=5?sameSex.map(item=>item.value!):[];
}

function percentile(value:number,pool:number[]){if(!pool.length)return undefined;const below=pool.filter(item=>item<value).length,equal=pool.filter(item=>item===value).length;return round((below+equal*.5)/(pool.length+1)*100)}

function scoreExercise(input:BuildInput,key:FitnessExerciseKey,repetitions:number):FitnessExerciseScore{
  const history=input.history||[],prior=input.valuesFromHistory?previousValue(history,key,repetitions):latestValue(history,key),external=iowaTarget(key,input.age,input.sex),pool=comparablePool(input,key),academyTarget=median(pool);
  let target:number,referenceKind:FitnessReferenceKind,referenceLabel:string,confidence:FitnessExerciseScore["confidence"],score:number;
  if(external!==undefined){target=external;referenceKind="externa";referenceLabel="Referencia operativa de selección policial por edad y sexo · solo válida con el protocolo indicado de 60 s";confidence="media";score=scoreAgainstTarget(repetitions,target)}
  else if(prior!==undefined){target=Math.max(prior+1,Math.ceil(prior*1.05));referenceKind="personal";referenceLabel="Meta próxima frente a su último resultado comparable";confidence="media";score=scoreAgainstTarget(repetitions,target)}
  else if(academyTarget!==undefined){target=Math.max(1,round(academyTarget));referenceKind="academia";referenceLabel=`Mediana de pares comparables de la sede · n=${pool.length}`;confidence="media";score=scoreAgainstTarget(repetitions,target)}
  else{target=Math.max(repetitions+1,Math.ceil(repetitions*1.05));referenceKind="linea_base";referenceLabel="Primera línea base; objetivo inicial de progreso +5%";confidence="inicial";score=50}
  if(external!==undefined&&prior!==undefined&&prior>0)score=clamp(score+clamp((repetitions-prior)/prior*25,-5,5));
  const level=fitnessLevel(score);
  return{key,label:LABELS[key],repetitions,target,score:round(score),level:level.level,levelLabel:level.label,referenceKind,referenceLabel,confidence,change:prior===undefined?undefined:repetitions-prior,academyPercentile:percentile(repetitions,pool)};
}

export function buildFitnessScoreReport(input:BuildInput):FitnessScoreReport{
  const exercises=FITNESS_EXERCISES.map(key=>{const repetitions=number(input.values[key]);return repetitions===undefined?undefined:scoreExercise(input,key,repetitions)}).filter((value):value is FitnessExerciseScore=>value!==undefined);
  const overall=exercises.length?round(exercises.reduce((sum,item)=>sum+item.score,0)/exercises.length):undefined,level=overall===undefined?undefined:fitnessLevel(overall);
  return{version:"bateria-60s-v1",exercises,overall,overallLevel:level?.level,overallLabel:level?.label||"Sin resultados",completed:exercises.length,provisional:exercises.length<4,rankingEligible:exercises.length===4};
}

export function buildFitnessRanking(athletes:FitnessAthlete[]):FitnessRankingEntry[]{
  const entries=athletes.map(athlete=>{const history=(athlete.historialFisico||[]) as PhysicalAssessment[],profile=latestProfile(history),report=buildFitnessScoreReport({values:latestFitnessValues(history),...profile,history,cohort:athletes,athleteId:athlete.id,valuesFromHistory:true});return{athleteId:athlete.id,name:athlete.nombre,report}}).filter(entry=>entry.report.rankingEligible&&entry.report.overall!==undefined).sort((a,b)=>Number(a.report.provisional)-Number(b.report.provisional)||(b.report.overall||0)-(a.report.overall||0)||b.report.completed-a.report.completed||a.name.localeCompare(b.name,"es"));
  return entries.map((entry,index)=>({...entry,rank:index+1}));
}

export function fitnessScoreSnapshot(report:FitnessScoreReport){return{version:report.version,general:report.overall,nivel:report.overallLabel,completadas:report.completed,provisional:report.provisional,ejercicios:Object.fromEntries(report.exercises.map(item=>[item.key,{repeticiones:item.repetitions,objetivo:item.target,puntaje:item.score,nivel:item.levelLabel,referencia:item.referenceKind}]))}}

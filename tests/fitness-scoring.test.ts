import assert from "node:assert/strict";
import test from "node:test";
import {buildFitnessRanking,buildFitnessScoreReport} from "../src/lib/fitness-scoring.ts";

const record=(id:string,values:Record<string,number>)=>({id,fecha:"2026-08-25",tipoRegistro:"pruebas" as const,pesoKg:70,estaturaCm:175,imc:22.9,edad:25,sexoCalculo:"masculino" as const,...values});

test("usa las referencias adultas de 60 segundos cuando el protocolo coincide",()=>{
  const report=buildFitnessScoreReport({values:{lagartijas:29,abdominales:38},age:25,sex:"masculino",weightKg:70});
  assert.equal(report.exercises.find(item=>item.key==="lagartijas")?.target,29);
  assert.equal(report.exercises.find(item=>item.key==="abdominales")?.target,38);
  assert.equal(report.exercises.find(item=>item.key==="lagartijas")?.score,70);
  assert.equal(report.overall,70);
});

test("no castiga pruebas vacías y marca el promedio como provisional",()=>{
  const report=buildFitnessScoreReport({values:{lagartijas:29},age:25,sex:"masculino"});
  assert.equal(report.completed,1);
  assert.equal(report.overall,70);
  assert.equal(report.rankingEligible,false);
  assert.equal(report.provisional,true);
});

test("sentadillas y burpees empiezan con línea base sin inventar un baremo",()=>{
  const report=buildFitnessScoreReport({values:{sentadillas:40,burpees:18},age:30,sex:"femenino"});
  assert.equal(report.exercises.find(item=>item.key==="sentadillas")?.referenceKind,"linea_base");
  assert.equal(report.exercises.find(item=>item.key==="burpees")?.score,50);
  assert.equal(report.exercises.find(item=>item.key==="sentadillas")?.target,42);
});

test("convierte el registro anterior en una meta personal progresiva",()=>{
  const history=[record("old",{burpees:20})];
  const report=buildFitnessScoreReport({values:{burpees:22},age:25,sex:"masculino",history});
  const burpees=report.exercises[0];
  assert.equal(burpees.referenceKind,"personal");
  assert.equal(burpees.target,21);
  assert.equal(burpees.change,2);
  assert.ok(burpees.score>70);
});

test("el ranking exige la batería completa y ordena por puntaje general",()=>{
  const athletes=[
    {id:"a",nombre:"A",historialFisico:[record("a1",{lagartijas:29,abdominales:38,sentadillas:40,burpees:20})]},
    {id:"b",nombre:"B",historialFisico:[record("b1",{lagartijas:15,abdominales:20,sentadillas:25,burpees:12})]},
    {id:"c",nombre:"C",historialFisico:[record("c1",{lagartijas:40})]},
  ];
  const ranking=buildFitnessRanking(athletes);
  assert.equal(ranking.length,2);
  assert.equal(ranking[0].athleteId,"a");
  assert.equal(ranking[0].rank,1);
});

test("el peso contextualiza pares pero no altera por sí solo el baremo externo",()=>{
  const light=buildFitnessScoreReport({values:{lagartijas:29},age:25,sex:"masculino",weightKg:55});
  const heavy=buildFitnessScoreReport({values:{lagartijas:29},age:25,sex:"masculino",weightKg:105});
  assert.equal(light.overall,heavy.overall);
});

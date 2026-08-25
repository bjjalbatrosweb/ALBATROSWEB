import assert from "node:assert/strict";
import test from "node:test";
import {buildAthleteAnalytics} from "../src/lib/physical-analytics.ts";

const record=(id:string,lagartijas:number)=>({id,fecha:"2026-08-24",tipoRegistro:"completo" as const,pesoKg:70,estaturaCm:175,imc:22.9,edad:25,sexoCalculo:"masculino" as const,cinturaEstatura:.46,lagartijas,burpees:20,navetteNivel:8,calidadMedicion:90});

test("ordena el ranking solo con rendimiento",()=>{const result=buildAthleteAnalytics([{id:"a",nombre:"A",historialFisico:[record("1",20)]},{id:"b",nombre:"B",historialFisico:[record("2",40)]},{id:"c",nombre:"C",historialFisico:[record("3",30)]}]);assert.equal(result.find(item=>item.id==="b")?.performanceRank,1);assert.equal(result.find(item=>item.id==="a")?.performanceRank,3)});

test("no inventa puntuaciones cuando no existen evaluaciones",()=>{const [result]=buildAthleteAnalytics([{id:"a",nombre:"Sin datos",historialFisico:[]}]);assert.equal(result.healthScore,undefined);assert.equal(result.performanceScore,undefined);assert.equal(result.dataQuality,0)});

test("conserva separado el cribado de salud del ranking",()=>{const result=buildAthleteAnalytics([{id:"a",nombre:"A",historialFisico:[{...record("1",50),imc:34,cinturaEstatura:.62}]},{id:"b",nombre:"B",historialFisico:[record("2",20)]}]);assert.equal(result.find(item=>item.id==="a")?.performanceRank,1);assert.ok((result.find(item=>item.id==="a")?.healthScore||100)<60)});

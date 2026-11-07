import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAvailability,isTrialDateBlocked} from '../src/lib/trial-availability';
test('bloquea fechas concretas sin bloquear otras fechas',()=>{const config=normalizeAvailability({fechas:['2030-01-07']});assert.equal(isTrialDateBlocked('2030-01-07',config),true);assert.equal(isTrialDateBlocked('2030-01-08',config),false);});
test('bloquea el día semanal en distintas semanas y permite reabrirlo',()=>{const config=normalizeAvailability({diasSemana:[1]});assert.equal(isTrialDateBlocked('2030-01-07',config),true);assert.equal(isTrialDateBlocked('2030-01-14',config),true);assert.equal(isTrialDateBlocked('2030-01-08',config),false);assert.equal(isTrialDateBlocked('2030-01-07',normalizeAvailability()),false);});
test('normaliza duplicados y descarta días semanales inválidos',()=>{assert.deepEqual(normalizeAvailability({fechas:['2030-01-07','2030-01-07','bad'],diasSemana:[1,1,9,-1,'2']}),{fechas:['2030-01-07'],diasSemana:[1]});});

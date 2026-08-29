import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCombatStyleReport,
  buildPublicCombatStyleSnapshot,
  combatStyleShareText,
  DEFAULT_COMBAT_STYLE_PROFILE,
  validateCombatStyleProfile,
  type CombatStyleProfile,
} from "../src/lib/combat-style-profile.ts";

const profile = (changes: Partial<CombatStyleProfile> = {}): CombatStyleProfile => ({
  ...DEFAULT_COMBAT_STYLE_PROFILE,
  ...changes,
  objetivos: changes.objetivos || [],
});

test("un perfil largo y móvil propone distancia sin convertirla en certeza", () => {
  const report = buildCombatStyleReport(profile({
    estatura: "alta",
    complexion: "longilinea",
    brazos: "larga",
    piernas: "larga",
    movilidad: "destacada",
    explosividad: "destacada",
    objetivos: ["distancia", "finalizar", "derribar"],
  }));
  assert.equal(report.grappling[0].id, "guardia-distancia");
  assert.equal(report.wrestling[0].id, "derribos-distancia");
  assert.equal(report.striking[0].id, "larga-distancia");
  assert.equal(report.grappling[0].level, "Probar primero");
  assert.match(report.caveats.join(" "), /no predice/i);
});

test("un perfil compacto con muslos anchos propone rutas cortas y las explica", () => {
  const report = buildCombatStyleReport(profile({
    complexion: "compacta",
    brazos: "corta",
    muslos: "ancha",
    explosividad: "destacada",
    objetivos: ["barrer", "derribar", "presionar"],
  }));
  assert.equal(report.grappling[0].id, "media-mariposa");
  assert.equal(report.wrestling[0].id, "doble-pierna");
  assert.equal(report.striking[0].id, "bolsillo-angulos");
  assert.ok(report.wrestling[0].reasons.length >= 2);
  assert.ok(report.wrestling[0].drill.length > 20);
});

test("brazos cortos adaptan la guillotina y bajan la prioridad de cierres largos", () => {
  const report = buildCombatStyleReport(profile({
    complexion: "compacta",
    brazos: "corta",
    agarre: "destacada",
    objetivos: ["finalizar", "controlar"],
  }));
  assert.equal(report.effectiveArms, "corta");
  assert.ok(report.submissions.some(item => item.name === "Guillotina compacta sin brazo"));
  assert.ok(report.deprioritized.some(item => item.id === "guillotina-arm-in-alcance-corto"));
  assert.ok(report.deprioritized.some(item => item.id === "darce-anaconda-alcance-corto"));
  assert.ok(report.deprioritized.every(item => item.reason && item.alternative && item.validation));
  assert.ok(!report.deprioritized.some(item => item.technique === "Guillotina"));
  const shared = combatStyleShareText("Atleta", report);
  assert.match(shared, /NO RECOMENDADAS POR AHORA/);
  assert.match(shared, /Guillotina con brazo dentro/);
});

test("altura y envergadura medidas corrigen la descripción subjetiva de brazos", () => {
  const report = buildCombatStyleReport(profile({ brazos: "corta", alturaCm: 170, envergaduraCm: 180 }));
  assert.equal(report.effectiveArms, "larga");
  assert.equal(report.reachRatio, 1.059);
});

test("calcula proporciones corporales solo como contexto descriptivo", () => {
  const report = buildCombatStyleReport(profile({ alturaCm: 160, cinturaCm: 72, caderaCm: 96 }));
  assert.equal(report.waistHeightRatio, 0.45);
  assert.equal(report.waistHipRatio, 0.75);
  assert.match(report.caveats.join(" "), /no predice/i);
});

test("glúteos anchos y control corporal pueden orientar una prueba de base sentada", () => {
  const report = buildCombatStyleReport(profile({
    complexion: "compacta",
    gluteos: "ancha",
    controlCorporal: "destacada",
    objetivos: ["barrer"],
  }));
  assert.equal(report.grappling[0].id, "media-mariposa");
  assert.deepEqual(report.submissions.slice(0, 2).map(item => item.name), ["Kimura", "Guillotina"]);
  assert.ok(report.submissions.every(item => item.entry && item.why && item.caution));
});

test("género no altera el repertorio recomendado", () => {
  const woman = buildCombatStyleReport(profile({ genero: "mujer", brazos: "larga", movilidad: "destacada" }));
  const man = buildCombatStyleReport(profile({ genero: "hombre", brazos: "larga", movilidad: "destacada" }));
  assert.deepEqual(woman.grappling.map(item => item.id), man.grappling.map(item => item.id));
  assert.deepEqual(woman.wrestling.map(item => item.id), man.wrestling.map(item => item.id));
  assert.deepEqual(woman.striking.map(item => item.id), man.striking.map(item => item.id));
});

test("rechaza medidas improbables, exceso de objetivos y notas demasiado largas", () => {
  assert.match(validateCombatStyleProfile(profile({ alturaCm: 50 })), /altura/i);
  assert.match(validateCombatStyleProfile(profile({ alturaCm: 170, envergaduraCm: 250 })), /proporción/i);
  assert.match(validateCombatStyleProfile(profile({ objetivos: ["1", "2", "3", "4", "5"] })), /cuatro/i);
  assert.match(validateCombatStyleProfile(profile({ notas: "x".repeat(501) })), /500/i);
});

test("el resultado mantiene tres alternativas por dominio y un plan verificable", () => {
  const report = buildCombatStyleReport(profile());
  assert.equal(report.grappling.length, 3);
  assert.equal(report.wrestling.length, 3);
  assert.equal(report.striking.length, 3);
  assert.equal(report.validationPlan.length, 4);
  assert.ok([...report.grappling, ...report.wrestling, ...report.striking].every(item => item.watch.length > 20));
  assert.ok(!JSON.stringify(report).toLocaleLowerCase("es").includes("heel hook"));
});

test("el resumen compartible omite medidas, lesiones y notas privadas", () => {
  const report = buildCombatStyleReport(profile({
    alturaCm: 170,
    pesoKg: 80,
    cinturaCm: 75,
    restricciones: "dolor privado de rodilla",
    notas: "nota privada del coach",
  }));
  const text = combatStyleShareText("Atleta", report);
  assert.match(text, /SUMISIONES RECOMENDADAS/);
  assert.match(text, /Mataleón|Triángulo|Kimura/);
  assert.match(text, /GRAPPLING/);
  assert.doesNotMatch(text, /170|80 kg|75|dolor privado|nota privada/i);
  assert.match(text, /no incluye peso, medidas corporales, lesiones ni notas privadas/i);
});

test("permite compartir la descripción corporal para que el atleta la confirme sin revelar medidas", () => {
  const described = profile({
    estatura: "baja",
    complexion: "compacta",
    cintura: "estrecha",
    gluteos: "ancha",
    alturaCm: 158,
    pesoKg: 61,
    cinturaCm: 67,
    restricciones: "dato privado",
  });
  const report = buildCombatStyleReport(described);
  const hidden = combatStyleShareText("Atleta", report);
  const included = combatStyleShareText("Atleta", report, { includePhysicalProfile: true, profile: described });

  assert.doesNotMatch(hidden, /PERFIL CORPORAL PARA CONFIRMAR|glúteos/i);
  assert.match(included, /PERFIL CORPORAL PARA CONFIRMAR/);
  assert.match(included, /Estatura percibida: baja/);
  assert.match(included, /Cintura: estrecho\/a/);
  assert.match(included, /Glúteos: ancho\/a/);
  assert.match(included, /Sí \/ Parcialmente \/ No/);
  assert.doesNotMatch(included, /158|61|67|dato privado/);
});

test("la ficha web pública es una instantánea sanitizada y opcional", () => {
  const privateProfile = profile({
    estatura: "baja",
    cintura: "estrecha",
    gluteos: "ancha",
    alturaCm: 158,
    pesoKg: 61,
    cinturaCm: 67,
    restricciones: "lesión privada",
    notas: "nota privada del coach",
  });
  const report = buildCombatStyleReport(privateProfile);
  const hidden = buildPublicCombatStyleSnapshot(privateProfile, report);
  const visible = buildPublicCombatStyleSnapshot(privateProfile, report, { includePhysicalProfile: true, athleteName: "Atleta de prueba" });

  assert.equal(hidden.physicalProfile, undefined);
  assert.equal(visible.physicalProfile?.cintura, "Estrecho/a");
  assert.equal(visible.physicalProfile?.gluteos, "Ancho/a");
  assert.equal(visible.athleteName, "Atleta de prueba");
  assert.equal(visible.version, 2);
  assert.equal(visible.primaryRoutes.length, 3);
  assert.equal(visible.submissions.length, 4);
  assert.ok(Array.isArray(visible.deprioritized));
  assert.doesNotMatch(JSON.stringify(visible), /158|61|67|lesión privada|nota privada|restricción registrada/i);
});

import { randomBytes } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

import { adminDb } from "@/lib/firebase-admin";

export class LivePairingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

type PairingKind = "i" | "g";

function parsePairingToken(raw: unknown) {
  if (typeof raw !== "string") return null;
  const [kind, id, secret] = raw.split(".");
  if ((kind !== "i" && kind !== "g") || !id || !secret) return null;
  return { kind: kind as PairingKind, id, secret };
}

export async function claimLiveControl(input: {
  fightCollection: "CombatesTaekwondo" | "CombatesJiujitsu";
  fightId: string;
  pairingToken: unknown;
  deviceId: unknown;
  hash: (value: string) => string;
  controlLabel: string;
}) {
  const parsed = parsePairingToken(input.pairingToken);
  const deviceId = typeof input.deviceId === "string" ? input.deviceId.trim() : "";
  if (!parsed || deviceId.length < 8 || deviceId.length > 128) {
    throw new LivePairingError("Código de vinculación inválido.", 400);
  }

  const fightRef = adminDb.collection(input.fightCollection).doc(input.fightId);
  const permanentSecret = randomBytes(24).toString("base64url");
  const deviceHash = input.hash(`device:${deviceId}`);
  const now = Date.now();
  let result: { id: string; nombre: string } | null = null;

  await adminDb.runTransaction(async (transaction) => {
    const fightSnapshot = await transaction.get(fightRef);
    if (!fightSnapshot.exists || fightSnapshot.data()?.fase === "finalizado") {
      throw new LivePairingError("El combate ya no está disponible.", 404);
    }

    const activeQuery = fightRef.collection("Controles").where("activo", "==", true);
    const activeSnapshot = await transaction.get(activeQuery);
    const externalControls = activeSnapshot.docs.filter((document) => {
      const data = document.data();
      return (
        data.esMesa !== true &&
        data.expiraEn instanceof Timestamp &&
        data.expiraEn.toMillis() > now
      );
    });
    if (externalControls.length >= 4) {
      throw new LivePairingError("Ya hay cuatro controles vinculados.", 409);
    }

    if (parsed.kind === "i") {
      const controlRef = fightRef.collection("Controles").doc(parsed.id);
      const controlSnapshot = await transaction.get(controlRef);
      const data = controlSnapshot.data();
      if (
        !controlSnapshot.exists ||
        data?.vinculacionUsada === true ||
        !(data?.vinculacionExpiraEn instanceof Timestamp) ||
        data.vinculacionExpiraEn.toMillis() < now ||
        data.vinculacionHash !== input.hash(parsed.secret)
      ) {
        throw new LivePairingError("Este QR ya fue usado o expiró.", 409);
      }
      const nombre = String(data?.nombre || input.controlLabel);
      transaction.update(controlRef, {
        tokenHash: input.hash(permanentSecret),
        activo: true,
        vinculacionUsada: true,
        vinculacionUsadaEn: FieldValue.serverTimestamp(),
        dispositivoHash: deviceHash,
        expiraEn: Timestamp.fromMillis(now + 12 * 60 * 60 * 1000),
        ultimoContacto: FieldValue.serverTimestamp(),
      });
      result = { id: controlRef.id, nombre };
    } else {
      const pairingRef = fightRef.collection("Vinculaciones").doc(parsed.id);
      const pairingSnapshot = await transaction.get(pairingRef);
      const data = pairingSnapshot.data();
      const usedDevices = Array.isArray(data?.dispositivos)
        ? data.dispositivos.map(String)
        : [];
      const claims = Math.max(0, Number(data?.usos) || 0);
      const maximum = Math.max(1, Math.min(4, Number(data?.maximo) || 4));
      if (
        !pairingSnapshot.exists ||
        data?.activo !== true ||
        !(data?.expiraEn instanceof Timestamp) ||
        data.expiraEn.toMillis() < now ||
        data.tokenHash !== input.hash(parsed.secret) ||
        claims >= maximum
      ) {
        throw new LivePairingError("Este QR general ya se completó o expiró.", 409);
      }
      if (usedDevices.includes(deviceHash)) {
        throw new LivePairingError("Este dispositivo ya usó el QR general.", 409);
      }

      const controlRef = fightRef.collection("Controles").doc();
      const nombre = `${input.controlLabel} ${externalControls.length + 1}`;
      transaction.create(controlRef, {
        nombre,
        tokenHash: input.hash(permanentSecret),
        activo: true,
        esMesa: false,
        origen: "qr_general",
        creadoEn: FieldValue.serverTimestamp(),
        expiraEn: Timestamp.fromMillis(now + 12 * 60 * 60 * 1000),
        ultimoContacto: FieldValue.serverTimestamp(),
        dispositivoHash: deviceHash,
      });
      transaction.update(pairingRef, {
        usos: claims + 1,
        dispositivos: [...usedDevices, deviceHash],
        activo: claims + 1 < maximum,
        actualizadoEn: FieldValue.serverTimestamp(),
      });
      result = { id: controlRef.id, nombre };
    }

    transaction.update(fightRef, {
      controlesActivos: Math.min(4, externalControls.length + 1),
      actualizadoEn: FieldValue.serverTimestamp(),
    });
  });

  if (!result) throw new LivePairingError("No se pudo vincular el control.", 500);
  const claimed = result as { id: string; nombre: string };
  return {
    control: claimed,
    controlToken: `${claimed.id}.${permanentSecret}`,
  };
}

async function countExternalControls(
  fightRef: FirebaseFirestore.DocumentReference,
) {
  const snapshot = await fightRef
    .collection("Controles")
    .where("activo", "==", true)
    .get();
  return snapshot.docs.filter((document) => {
    const data = document.data();
    return (
      data.esMesa !== true &&
      data.expiraEn instanceof Timestamp &&
      data.expiraEn.toMillis() > Date.now()
    );
  }).length;
}

export async function createIndividualLivePairing(input: {
  fightRef: FirebaseFirestore.DocumentReference;
  name: string;
  hash: (value: string) => string;
}) {
  if ((await countExternalControls(input.fightRef)) >= 4) {
    throw new LivePairingError("Ya hay cuatro controles vinculados.", 409);
  }
  const secret = randomBytes(24).toString("base64url");
  const controlRef = input.fightRef.collection("Controles").doc();
  await controlRef.create({
    nombre: input.name,
    activo: false,
    esMesa: false,
    origen: "qr_individual",
    vinculacionHash: input.hash(secret),
    vinculacionUsada: false,
    vinculacionExpiraEn: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
    creadoEn: FieldValue.serverTimestamp(),
    ultimoContacto: null,
  });
  return {
    id: controlRef.id,
    nombre: input.name,
    pairingToken: `i.${controlRef.id}.${secret}`,
  };
}

export async function createGeneralLivePairing(input: {
  fightRef: FirebaseFirestore.DocumentReference;
  hash: (value: string) => string;
}) {
  const active = await countExternalControls(input.fightRef);
  const available = Math.max(0, 4 - active);
  if (available === 0) {
    throw new LivePairingError("Ya hay cuatro controles vinculados.", 409);
  }
  const secret = randomBytes(24).toString("base64url");
  const pairingRef = input.fightRef.collection("Vinculaciones").doc();
  await pairingRef.create({
    tokenHash: input.hash(secret),
    activo: true,
    usos: 0,
    maximo: available,
    dispositivos: [],
    creadoEn: FieldValue.serverTimestamp(),
    expiraEn: Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),
  });
  return {
    id: pairingRef.id,
    pairingToken: `g.${pairingRef.id}.${secret}`,
    maxClaims: available,
  };
}

export async function createLiveTableControl(input: {
  fightRef: FirebaseFirestore.DocumentReference;
  name: string;
  hash: (value: string) => string;
}) {
  const secret = randomBytes(24).toString("base64url");
  const controlRef = input.fightRef.collection("Controles").doc();
  await controlRef.create({
    nombre: input.name,
    tokenHash: input.hash(secret),
    activo: true,
    esMesa: true,
    origen: "mesa",
    creadoEn: FieldValue.serverTimestamp(),
    expiraEn: Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000),
    ultimoContacto: null,
  });
  return { id: controlRef.id, nombre: input.name, controlToken: `${controlRef.id}.${secret}` };
}

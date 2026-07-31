import { createHmac, timingSafeEqual } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';

import {
  qualifyWhatsAppLead,
  type WhatsAppLeadResult,
} from '@/ai/flows/qualify-whatsapp-lead';
import { adminDb } from '@/lib/firebase-admin';

type ConversationMessage = {
  role: 'user' | 'assistant';
  text: string;
  at: string;
};

type LeadData = {
  telefono?: string;
  nombre?: string | null;
  nombreWhatsApp?: string | null;
  disciplina?: string | null;
  categoria?: string | null;
  edad?: number | null;
  horario?: string | null;
  sede?: string | null;
  quiereClasePrueba?: boolean | null;
  diaPosible?: string | null;
  etapa?: string;
  nivelInteres?: 'bajo' | 'medio' | 'alto';
  puntuacion?: number;
  totalMensajesUsuario?: number;
  requiereHumano?: boolean;
  motivoTransferencia?: string | null;
  botPausado?: boolean;
  estadoSeguimiento?: string;
  origen?: {
    sourceUrl?: string;
    headline?: string;
    body?: string;
    ctwaClid?: string;
  } | null;
  historial?: ConversationMessage[];
  ultimoMensaje?: string;
  ultimoMessageId?: string;
  notificado?: boolean;
};

type WhatsAppMessage = {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  referral?: {
    source_url?: string;
    headline?: string;
    body?: string;
    ctwa_clid?: string;
  };
};

export type WhatsAppWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      value?: {
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: WhatsAppMessage[];
      };
    }>;
  }>;
};

function cleanText(value: unknown, maxLength = 160): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
  return cleaned || null;
}

function normalizeSite(value: unknown): string | null {
  const normalized = cleanText(value, 40)
    ?.toUpperCase()
    .replace(/\s+/g, '_');

  if (!normalized) return null;
  if (normalized.includes('CAUCEL')) return 'CAUCEL';
  if (normalized.includes('JUAN')) return 'JUAN_PABLO';
  if (normalized === 'MMA') return 'MMA';
  return null;
}

function extractMessageText(message: WhatsAppMessage): string | null {
  if (message.type === 'text') return cleanText(message.text?.body, 1500);
  if (message.type === 'button') {
    return cleanText(message.button?.text || message.button?.payload, 1500);
  }
  if (message.type === 'interactive') {
    return cleanText(
      message.interactive?.button_reply?.title ||
        message.interactive?.list_reply?.title ||
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.id,
      1500,
    );
  }
  return null;
}

function mergeLead(
  current: LeadData,
  result: WhatsAppLeadResult,
): LeadData {
  const next: LeadData = { ...current };
  const textFields = [
    'nombre',
    'disciplina',
    'categoria',
    'horario',
    'diaPosible',
    'motivoTransferencia',
  ] as const;

  textFields.forEach((field) => {
    const value = cleanText(result[field], 120);
    if (value) (next as Record<string, unknown>)[field] = value;
  });

  const site = normalizeSite(result.sede);
  if (site) next.sede = site;
  if (result.edad !== null) next.edad = result.edad;
  if (result.quiereClasePrueba !== null) {
    next.quiereClasePrueba = result.quiereClasePrueba;
  }

  next.etapa = result.etapaSiguiente;
  next.requiereHumano =
    current.requiereHumano === true || result.requiereHumano;
  return next;
}

function scoreLead(lead: LeadData): number {
  let score = 0;
  if (lead.nombre) score += 1;
  if (lead.disciplina) score += 2;
  if (lead.categoria || lead.edad) score += 1;
  if (lead.horario) score += 2;
  if (lead.quiereClasePrueba === true) score += 2;
  if (lead.diaPosible) score += 3;
  if ((lead.totalMensajesUsuario || 0) >= 3) score += 1;
  return score;
}

function interestLevel(score: number): 'bajo' | 'medio' | 'alto' {
  if (score >= 8) return 'alto';
  if (score >= 4) return 'medio';
  return 'bajo';
}

function fallbackResponse(lead: LeadData): WhatsAppLeadResult {
  const stage = lead.etapa || 'disciplina';
  const responses: Record<string, [string, WhatsAppLeadResult['etapaSiguiente']]> = {
    nombre: ['¿Me compartes tu nombre?', 'nombre'],
    disciplina: [
      '¡Hola! 👋 ¿Qué te interesa entrenar: Jiu-Jitsu, Kick Boxing o MMA?',
      'disciplina',
    ],
    categoria: ['¿La clase sería para adulto o menor? ¿Qué edad tiene?', 'categoria'],
    horario: ['¿Te acomodaría mejor entrenar por la mañana o por la noche?', 'horario'],
    sede: ['¿Qué sede te interesa: Caucel, Juan Pablo o MMA?', 'sede'],
    clase_prueba: ['¿Te gustaría tomar una clase de prueba gratuita?', 'clase_prueba'],
    dia_asistencia: ['¿Qué día te sería posible asistir?', 'dia_asistencia'],
  };
  const [respuesta, etapaSiguiente] =
    responses[stage] || responses.disciplina;

  return {
    respuesta,
    nombre: null,
    disciplina: null,
    categoria: null,
    edad: null,
    horario: null,
    sede: null,
    quiereClasePrueba: null,
    diaPosible: null,
    requiereHumano: false,
    motivoTransferencia: null,
    etapaSiguiente,
  };
}

function graphConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';

  if (!token || !phoneNumberId) {
    throw new Error(
      'Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID',
    );
  }

  return { token, phoneNumberId, graphVersion };
}

export async function sendWhatsAppText(to: string, body: string) {
  const { token, phoneNumberId, graphVersion } = graphConfig();
  const response = await fetch(
    `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`WhatsApp respondió ${response.status}: ${detail}`);
  }
}

export function verifyWhatsAppSignature(rawBody: string, signature: string) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !signature.startsWith('sha256=')) return false;

  const expected = `sha256=${createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex')}`;
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

async function reserveMessage(message: WhatsAppMessage): Promise<boolean> {
  const reference = adminDb.collection('WhatsAppMensajes').doc(message.id);

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) return false;

    transaction.create(reference, {
      telefono: message.from,
      tipo: message.type,
      recibidoEn: FieldValue.serverTimestamp(),
    });
    return true;
  });
}

async function notifyQualifiedLead(phone: string, lead: LeadData) {
  if (lead.notificado) return;

  await adminDb.collection('AlertasAdmin').add({
    tipo: 'prospecto_whatsapp',
    titulo: 'Nuevo prospecto calificado',
    mensaje: `${lead.nombre || lead.nombreWhatsApp || phone} · ${
      lead.disciplina || 'Disciplina pendiente'
    } · ${lead.diaPosible || 'Solicita atención'}`,
    telefono: phone,
    prospectoId: phone,
    sede: lead.sede || null,
    leida: false,
    creadoEn: FieldValue.serverTimestamp(),
  });
}

async function processOneMessage(
  message: WhatsAppMessage,
  profileName?: string,
) {
  if (!(await reserveMessage(message))) return;

  const text = extractMessageText(message);
  if (!text) {
    await sendWhatsAppText(
      message.from,
      'Por ahora puedo ayudarte mediante mensajes de texto. ¿Qué información necesitas?',
    );
    return;
  }

  const reference = adminDb
    .collection('ProspectosWhatsApp')
    .doc(message.from);
  const snapshot = await reference.get();
  const current = (snapshot.data() || {}) as LeadData;
  const now = new Date().toISOString();
  const history = Array.isArray(current.historial)
    ? current.historial.slice(-12)
    : [];
  const userMessage: ConversationMessage = {
    role: 'user',
    text,
    at: now,
  };

  if (current.botPausado || current.requiereHumano) {
    await reference.set(
      {
        ultimoMensaje: text,
        ultimoMessageId: message.id,
        historial: [...history, userMessage].slice(-14),
        actualizadoEn: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  const origin = message.referral
    ? {
        sourceUrl: message.referral.source_url,
        headline: message.referral.headline,
        body: message.referral.body,
        ctwaClid: message.referral.ctwa_clid,
      }
    : current.origen || null;

  let result: WhatsAppLeadResult;
  try {
    result = await qualifyWhatsAppLead({
      mensaje: text,
      nombreWhatsApp: profileName || current.nombreWhatsApp || undefined,
      origenAnuncio:
        [origin?.headline, origin?.body].filter(Boolean).join(' · ') ||
        undefined,
      estadoActual: {
        nombre: current.nombre,
        disciplina: current.disciplina,
        categoria: current.categoria,
        edad: current.edad,
        horario: current.horario,
        sede: current.sede,
        quiereClasePrueba: current.quiereClasePrueba,
        diaPosible: current.diaPosible,
        etapa: current.etapa || 'disciplina',
      },
      historial: history.map(({ role, text: historyText }) => ({
        role,
        text: historyText,
      })),
    });
  } catch (error) {
    console.error('WHATSAPP_AI_ERROR:', error);
    result = fallbackResponse(current);
  }

  const totalUserMessages = (current.totalMensajesUsuario || 0) + 1;
  const merged = mergeLead(
    {
      ...current,
      nombreWhatsApp: cleanText(profileName, 120) || current.nombreWhatsApp,
      totalMensajesUsuario: totalUserMessages,
      origen: origin,
    },
    result,
  );
  const score = scoreLead(merged);
  const level = interestLevel(score);
  const qualified =
    level === 'alto' ||
    result.requiereHumano;
  const assistantMessage: ConversationMessage = {
    role: 'assistant',
    text: result.respuesta,
    at: new Date().toISOString(),
  };

  const finalLead: LeadData = {
    ...merged,
    telefono: message.from,
    puntuacion: score,
    nivelInteres: level,
    botPausado: qualified,
    estadoSeguimiento: qualified
      ? current.estadoSeguimiento || 'nuevo'
      : current.estadoSeguimiento || 'conversando',
    historial: [...history, userMessage, assistantMessage].slice(-14),
    ultimoMensaje: text,
    ultimoMessageId: message.id,
  };

  await reference.set(
    {
      ...finalLead,
      actualizadoEn: FieldValue.serverTimestamp(),
      ...(!snapshot.exists
        ? { creadoEn: FieldValue.serverTimestamp() }
        : {}),
    },
    { merge: true },
  );

  await sendWhatsAppText(message.from, result.respuesta);

  if (qualified && !current.notificado) {
    await notifyQualifiedLead(message.from, finalLead);
    await reference.set(
      { notificado: true, notificadoEn: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
}

export async function processWhatsAppWebhook(
  payload: WhatsAppWebhookPayload,
) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;
      const profileName = value?.contacts?.[0]?.profile?.name;
      for (const message of value?.messages || []) {
        try {
          await processOneMessage(message, profileName);
        } catch (error) {
          console.error('WHATSAPP_MESSAGE_ERROR:', message.id, error);
        }
      }
    }
  }
}

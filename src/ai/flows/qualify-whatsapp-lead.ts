'use server';

import { z } from 'genkit';

import { ai } from '@/ai/genkit';

const NullableText = z.string().nullable();

const WhatsAppLeadResultSchema = z.object({
  respuesta: z
    .string()
    .describe('Respuesta breve y natural que se enviará al prospecto.'),
  nombre: NullableText,
  disciplina: NullableText,
  categoria: NullableText,
  edad: z.number().int().min(4).max(90).nullable(),
  horario: NullableText,
  sede: NullableText,
  quiereClasePrueba: z.boolean().nullable(),
  diaPosible: NullableText,
  requiereHumano: z.boolean(),
  motivoTransferencia: NullableText,
  etapaSiguiente: z.enum([
    'nombre',
    'disciplina',
    'categoria',
    'horario',
    'sede',
    'clase_prueba',
    'dia_asistencia',
    'calificado',
    'cerrado',
  ]),
});

export type WhatsAppLeadResult = z.infer<typeof WhatsAppLeadResultSchema>;

type QualifyWhatsAppLeadInput = {
  mensaje: string;
  nombreWhatsApp?: string;
  origenAnuncio?: string;
  estadoActual: Record<string, unknown>;
  historial: Array<{
    role: 'user' | 'assistant';
    text: string;
  }>;
};

const BUSINESS_FACTS = `
INFORMACIÓN OFICIAL DE ALBATROS
- Academia: Albatros Centro de Alto Rendimiento, Mérida, Yucatán.
- Disciplinas: Jiu-Jitsu, Kick Boxing y MMA.
- Precio de una disciplina: $600 MXN mensuales.
- Precio de dos disciplinas: $900 MXN mensuales.
- Clase de prueba gratuita.
- Sin pago de inscripción.
- Horarios matutinos: Kick Boxing 7:00-8:00, MMA 8:00-9:00 y Jiu-Jitsu 9:00-10:00.
- Horarios vespertinos: Jiu-Jitsu 19:00-20:00, Kick Boxing/MMA 20:00-21:00 y MMA 21:00-22:00.
- Sedes registradas: Caucel, Juan Pablo y MMA.
- No inventes días de clase, promociones, direcciones exactas ni información que no aparezca aquí.
`;

export async function qualifyWhatsAppLead(
  input: QualifyWhatsAppLeadInput,
): Promise<WhatsAppLeadResult> {
  const { output } = await ai.generate({
    output: { schema: WhatsAppLeadResultSchema },
    prompt: `
Eres el asistente virtual de Albatros. Atiendes personas que llegan desde
anuncios de Facebook/Instagram o escriben directamente por WhatsApp.

OBJETIVO
Mantén una conversación breve y coherente, resuelve primero la duda del usuario
y averigua gradualmente si de verdad quiere asistir. Haz UNA sola pregunta por
mensaje. No repitas información ya obtenida.

ESTILO
- Español mexicano, amable, directo y natural.
- Máximo 65 palabras, salvo que sea indispensable explicar horarios.
- No digas que estás calificando al prospecto.
- Usa como máximo dos emojis.
- Nunca presiones ni prometas lugares, descuentos o disponibilidad.

REGLAS
- Si el anuncio ya identifica una disciplina, confírmala sin volver a preguntarla.
- Si el usuario da varios datos juntos, extrae todos y pregunta solo el siguiente faltante.
- Si pregunta precio u horario, responde y después formula la siguiente pregunta útil.
- Si escribe ASESOR, HUMANO, PERSONA, pide llamada, muestra molestia o hace una
  pregunta que no puedes responder con los datos oficiales, marca requiereHumano=true.
- Si no está interesado, etapaSiguiente="cerrado".
- Cuando ya haya disciplina, categoría/edad, horario, intención de clase de
  prueba y un día posible, etapaSiguiente="calificado".
- Los campos no confirmados deben ser null. No adivines.

${BUSINESS_FACTS}

ORIGEN DEL ANUNCIO
${input.origenAnuncio || 'No identificado'}

NOMBRE MOSTRADO EN WHATSAPP
${input.nombreWhatsApp || 'No disponible'}

DATOS CONFIRMADOS HASTA AHORA
${JSON.stringify(input.estadoActual)}

HISTORIAL RECIENTE
${JSON.stringify(input.historial)}

MENSAJE NUEVO
${input.mensaje}

Devuelve únicamente la salida estructurada solicitada.
`,
  });

  if (!output) {
    throw new Error('La IA no devolvió una respuesta estructurada');
  }

  return output;
}


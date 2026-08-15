import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";

import { checkRateLimitForIdentifier } from "@/lib/rate-limit";
import {
  RequestAccessError,
  requireActiveActorAccess,
} from "@/lib/server-access";

const requestSchema = z.object({
  calorias: z.coerce.number().min(1000).max(6000),
  proteina: z.coerce.number().min(20).max(400),
  carbs: z.coerce.number().min(20).max(1000),
  grasas: z.coerce.number().min(10).max(300),
  tipo: z.string().trim().min(1).max(60),
});

export async function POST(request: Request) {
  try {
    const actor = await requireActiveActorAccess(request);
    const rate = await checkRateLimitForIdentifier(actor.uid, {
      scope: "chef-ia",
      limit: 10,
      windowMs: 60 * 60_000,
    });
    if (!rate.allowed) {
      return Response.json(
        { error: "Límite de planes alcanzado. Intenta más tarde." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
      );
    }

    const parsed = requestSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return Response.json(
        { error: "Los datos nutricionales no son válidos." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json(
        { error: "El servicio de IA no está configurado." },
        { status: 503 },
      );
    }

    const { calorias, proteina, carbs, grasas, tipo } = parsed.data;
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
    });

    const prompt = `
Eres un nutricionista deportivo profesional.

Responde SIEMPRE en español.
NO uses inglés en ninguna parte.

Genera un plan alimenticio con:
- Calorías: ${calorias}
- Proteína: ${proteina}g
- Carbohidratos: ${carbs}g
- Grasas: ${grasas}g
- Tipo de comida: ${tipo}

Usa alimentos comunes en México.
Organiza el resultado por comidas (desayuno, comida, cena).
Incluye cantidades aproximadas en gramos.
`;

    const result = await model.generateContent(prompt);
    return Response.json({ result: result.response.text() });
  } catch (error) {
    if (error instanceof RequestAccessError) {
      return Response.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("ERROR_GEMINI:", error);
    return Response.json(
      { error: "No se pudo generar el plan." },
      { status: 500 },
    );
  }
}

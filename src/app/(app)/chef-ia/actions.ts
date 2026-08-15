'use server';

import { z } from 'zod';

import {
  generateTacticalRecipes,
  type GenerateTacticalRecipesInput,
  type GenerateTacticalRecipesOutput,
} from '@/ai/flows/generate-tactical-recipes';
import { checkRateLimitForIdentifier } from '@/lib/rate-limit';
import { requireActiveActorToken } from '@/lib/server-access';

const inputSchema = z.object({
  weightKg: z.number().min(30).max(350),
  calorieTarget: z.number().min(1000).max(6000),
  proteinTargetG: z.number().min(20).max(400),
  fatTargetG: z.number().min(10).max(300),
  carbTargetG: z.number().min(20).max(1000),
  dietaryRestrictions: z.array(z.string().trim().max(80)).max(10).optional(),
  mealType: z.string().trim().max(60).optional(),
});

type ActionResult = {
  recipes: GenerateTacticalRecipesOutput | null;
  error?: string;
};

export async function getTacticalRecipes(
  input: GenerateTacticalRecipesInput,
  authToken: string,
): Promise<ActionResult> {
  try {
    const actor = await requireActiveActorToken(authToken);
    const rate = await checkRateLimitForIdentifier(actor.uid, {
      scope: 'recetas-tacticas-ia',
      limit: 6,
      windowMs: 60 * 60_000,
    });
    if (!rate.allowed) {
      return {
        recipes: null,
        error: 'Alcanzaste el límite de recetas por hora. Intenta más tarde.',
      };
    }

    const parsed = inputSchema.safeParse(input);
    if (!parsed.success) {
      return { recipes: null, error: 'Los objetivos nutricionales no son válidos.' };
    }

    const recipes = await generateTacticalRecipes(parsed.data);
    return { recipes };
  } catch (error) {
    console.error('Error in getTacticalRecipes server action:', error);
    return { recipes: null, error: 'No se pudieron generar las recetas debido a un error del servidor.' };
  }
}

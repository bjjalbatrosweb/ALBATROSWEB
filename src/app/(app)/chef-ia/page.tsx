
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getTacticalRecipes } from './actions';
import type { GenerateTacticalRecipesOutput } from '@/ai/flows/generate-tactical-recipes';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Clock, Zap, Users, List, ChefHat, BrainCircuit, Sparkles, Bookmark } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useDailyData } from '@/context/DailyDataProvider';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';

const formSchema = z.object({
  weightKg: z.coerce.number().min(30, "Peso debe ser realista."),
  calorieTarget: z.coerce.number().min(1000, "Calorías deben ser realistas."),
  proteinTargetG: z.coerce.number().min(50, "Proteína debe ser realista."),
  fatTargetG: z.coerce.number().min(20, "Grasas deben ser realistas."),
  carbTargetG: z.coerce.number().min(50, "Carbohidratos deben ser realistas."),
  mealType: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type Recipe = GenerateTacticalRecipesOutput['recipes'][0];


export default function ChefIAPage() {
  const [recipes, setRecipes] = useState<GenerateTacticalRecipesOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { biometrics, dailyTargets, isDataLoading } = useDailyData();
  const { user } = useUser();
  const firestore = useFirestore();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      weightKg: 0,
      calorieTarget: 0,
      proteinTargetG: 0,
      fatTargetG: 0,
      carbTargetG: 0,
      mealType: "any",
    },
  });

  useEffect(() => {
    if (!isDataLoading) {
      form.reset({
        weightKg: biometrics.weight,
        calorieTarget: dailyTargets.calories,
        proteinTargetG: dailyTargets.protein,
        fatTargetG: dailyTargets.fats,
        carbTargetG: dailyTargets.carbs,
        mealType: "any",
      });
    }
  }, [biometrics, dailyTargets, form, isDataLoading]);

  const onSubmit = async (values: FormValues) => {
    setIsLoading(true);
    setRecipes(null);
    if (!user) {
      toast({
        variant: "destructive",
        title: "Sesión requerida",
        description: "Inicia sesión para generar recetas.",
      });
      setIsLoading(false);
      return;
    }
    try {
      const authToken = await user.getIdToken();
      const result = await getTacticalRecipes(values, authToken);
      if (result.error || !result.recipes) {
        toast({
          variant: "destructive",
          title: "Error de IA",
          description: result.error || "No se pudieron generar las recetas.",
        });
      } else {
        setRecipes(result.recipes);
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error de IA",
        description: "No se pudo validar la sesión. Vuelve a intentarlo.",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSaveRecipe = (recipe: Recipe) => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Debes iniciar sesión para guardar recetas.",
      });
      return;
    }

    const recipeData = {
      name: recipe.name,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      estimatedCaloriesPerServing: recipe.macros.calories,
      estimatedProteinPerServing: recipe.macros.proteinG,
      estimatedFatPerServing: recipe.macros.fatG,
      estimatedCarbohydratesPerServing: recipe.macros.carbsG,
      technicalAnalysis: recipe.technicalAnalysis,
      generatedByUserId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const recipesRef = collection(firestore, `perfiles/${user.uid}/recipes`);
    addDocumentNonBlocking(recipesRef, recipeData);

    toast({
      title: "Receta Guardada",
      description: `"${recipe.name}" ha sido añadida a tu perfil.`,
    });
  };
  
  const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
            <CardTitle className="font-black tracking-tighter text-primary">{recipe.name}</CardTitle>
            <Button variant="ghost" size="icon" onClick={() => handleSaveRecipe(recipe)} aria-label="Guardar receta">
                <Bookmark className="h-5 w-5" />
            </Button>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground pt-2">
          <div className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Prep: {recipe.prepTimeMinutes} min</div>
          <div className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Cocción: {recipe.cookTimeMinutes} min</div>
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Porciones: {recipe.servings}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary">CAL: {recipe.macros.calories}</Badge>
          <Badge variant="secondary">P: {recipe.macros.proteinG}g</Badge>
          <Badge variant="secondary">G: {recipe.macros.fatG}g</Badge>
          <Badge variant="secondary">C: {recipe.macros.carbsG}g</Badge>
        </div>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="ingredients">
            <AccordionTrigger><List className="h-4 w-4 mr-2"/>Ingredientes</AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-5 space-y-1 font-mono text-sm">
                {recipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
              </ul>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="instructions">
            <AccordionTrigger><ChefHat className="h-4 w-4 mr-2"/>Instrucciones</AccordionTrigger>
            <AccordionContent>
              <ol className="list-decimal pl-5 space-y-2 font-mono text-sm">
                {recipe.instructions.map((step, i) => <li key={i}>{step}</li>)}
              </ol>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="analysis">
            <AccordionTrigger><BrainCircuit className="h-4 w-4 mr-2"/>Análisis del Coach</AccordionTrigger>
            <AccordionContent>
              <p className="italic text-sm">“{recipe.technicalAnalysis}”</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );

  const LoadingSkeleton = () => (
      <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
              <Card key={i}>
                  <CardHeader>
                      <Skeleton className="h-8 w-3/4" />
                      <Skeleton className="h-4 w-1/2 mt-2" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                      <div className="flex gap-2">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                      </div>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                  </CardContent>
              </Card>
          ))}
      </div>
  );

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Chef IA Táctico</h1>
        <p className="text-muted-foreground">Recetas de combate generadas por el Head Coach de Nutrición.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Parámetros de Misión</CardTitle>
              <CardDescription>Introduce tus datos para generar el plan nutricional.</CardDescription>
            </CardHeader>
            <CardContent>
              {isDataLoading ? (
                <div className="space-y-6">
                  <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-20" /><Skeleton className="h-10 w-full" /></div>
                  </div>
                   <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField control={form.control} name="calorieTarget" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Calorías Objetivo</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="proteinTargetG" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Proteína (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="carbTargetG" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbs (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField control={form.control} name="fatTargetG" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Grasas (g)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={form.control} name="weightKg" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Peso (kg)</FormLabel>
                        <FormControl><Input type="number" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="mealType" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Comida</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="any">Cualquiera</SelectItem>
                          <SelectItem value="breakfast">Desayuno</SelectItem>
                          <SelectItem value="post-workout">Post-Entreno</SelectItem>
                          <SelectItem value="dinner">Cena</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full font-bold" disabled={isLoading}>
                    {isLoading ? "Generando..." : "Generar Plan"}
                  </Button>
                </form>
              </Form>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2">
          {isLoading ? (
            <LoadingSkeleton />
          ) : recipes ? (
            <div className="space-y-6">
              {recipes.recipes.map((recipe, index) => (
                <RecipeCard key={index} recipe={recipe} />
              ))}
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center text-center border rounded-md h-full min-h-[500px] p-8 bg-background/50">
              <Sparkles className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-bold">Esperando Órdenes</h3>
              <p className="text-muted-foreground">Completa los parámetros para recibir tu plan de asalto nutricional.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Weight, Ruler, Cake, Activity, Target, Flame, HeartPulse, PlusCircle } from 'lucide-react';
import { activities, type Activity as MetActivity } from '@/lib/met-values';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDailyData } from '@/context/DailyDataProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function LaboratorioPage() {
  const {
    biometrics,
    setBiometrics,
    goal,
    setGoal,
    dailyTargets,
    saveData,
    isDataLoading,
    setExpenditureCalories
  } = useDailyData();

  const { toast } = useToast();
  
  const [bmr, setBmr] = React.useState<number | null>(null);
  const [tdee, setTdee] = React.useState<number | null>(null);
  const [macros, setMacros] = React.useState<{ protein: number, fat: number, carbs: number } | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  const [selectedActivity, setSelectedActivity] = React.useState<MetActivity | undefined>(activities[0]);
  const [duration, setDuration] = React.useState(30);
  const [burnedCalories, setBurnedCalories] = React.useState<number | null>(null);

  const [bodyFatMethod, setBodyFatMethod] = React.useState<'navy' | 'bmi'>('navy');
  const [measurements, setMeasurements] = React.useState({
    neck: 38,
    waist: 80,
    hip: 95,
  });
  const [bodyFat, setBodyFat] = React.useState<{percentage: number, category: string} | null>(null);

  React.useEffect(() => {
    if (!isDataLoading) {
        setTdee(dailyTargets.calories);
        setMacros({
            protein: dailyTargets.protein,
            fat: dailyTargets.fats,
            carbs: dailyTargets.carbs
        });
        let calculatedBmr;
        if (biometrics.gender === 'male') {
          calculatedBmr = (10 * biometrics.weight) + (6.25 * biometrics.height) - (5 * biometrics.age) + 5;
        } else {
          calculatedBmr = (10 * biometrics.weight) + (6.25 * biometrics.height) - (5 * biometrics.age) - 161;
        }
        setBmr(Math.round(calculatedBmr));
    }
  }, [dailyTargets, biometrics, isDataLoading]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setBiometrics(prev => ({ ...prev, [name]: Number(value) }));
  };
  
  const handleMeasurementChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setMeasurements(prev => ({ ...prev, [name]: Number(value) }));
  };

  const handleCalculateAndSave = () => {
    setIsCalculating(true);
    let calculatedBmr;
    if (biometrics.gender === 'male') {
      calculatedBmr = (10 * biometrics.weight) + (6.25 * biometrics.height) - (5 * biometrics.age) + 5;
    } else {
      calculatedBmr = (10 * biometrics.weight) + (6.25 * biometrics.height) - (5 * biometrics.age) - 161;
    }

    const calculatedTdee = calculatedBmr * biometrics.activityLevel;
    
    let targetCalories = calculatedTdee;
    if (goal === 'lose') {
      targetCalories *= 0.85; // 15% deficit
    } else if (goal === 'gain') {
      targetCalories *= 1.15; // 15% surplus
    }
    const finalTargetCalories = Math.round(targetCalories);
    
    const proteinG = biometrics.weight * 2.2;
    const fatG = biometrics.weight * 0.9;
    const proteinKcal = proteinG * 4;
    const fatKcal = fatG * 9;
    const carbsKcal = finalTargetCalories - proteinKcal - fatKcal;
    const carbsG = carbsKcal / 4;
    const calculatedMacros = {
      protein: Math.round(proteinG),
      fat: Math.round(fatG),
      carbs: Math.round(carbsG < 0 ? 0 : carbsG)
    };

    const newDailyTargets = {
      calories: finalTargetCalories,
      protein: calculatedMacros.protein,
      fats: calculatedMacros.fat,
      carbs: calculatedMacros.carbs
    };

    saveData({
      biometrics,
      goal,
      dailyTargets: newDailyTargets,
    });
    
    toast({
        title: "Datos Guardados",
        description: "Tus nuevas metas han sido calculadas y guardadas en tu perfil.",
    });
    setIsCalculating(false);
  };

  const calculateBurnedCalories = React.useCallback(() => {
    if (selectedActivity && biometrics.weight && duration > 0) {
      const calories = selectedActivity.met * biometrics.weight * (duration / 60);
      const roundedCalories = Math.round(calories);
      setBurnedCalories(roundedCalories);
    } else {
      setBurnedCalories(null);
    }
  }, [selectedActivity, biometrics.weight, duration]);

  const handleAddExpenditure = () => {
    if (burnedCalories && burnedCalories > 0) {
      setExpenditureCalories(prev => prev + burnedCalories);
      toast({
        title: "Gasto Energético Añadido",
        description: `${burnedCalories} kcal han sido sumadas a tu gasto diario.`,
      });
    }
  };

  const calculateBodyFat = React.useCallback(() => {
    const { weight, height, gender, age } = biometrics;
    const { neck, waist, hip } = measurements;

    if (!weight || !height || !neck || !waist || (gender === 'female' && !hip)) {
      setBodyFat(null);
      return;
    }

    let bfp: number;

    if (bodyFatMethod === 'navy') {
      if (gender === 'male') {
        bfp = 86.010 * Math.log10(waist - neck) - 70.041 * Math.log10(height) + 36.76;
      } else {
        bfp = 163.205 * Math.log10(waist + hip - neck) - 97.684 * Math.log10(height) - 78.387;
      }
    } else { // BMI based
      const bmi = weight / ((height / 100) ** 2);
      if (gender === 'male') {
        bfp = 1.20 * bmi + 0.23 * age - 16.2;
      } else {
        bfp = 1.20 * bmi + 0.23 * age - 5.4;
      }
    }
    
    if (bfp < 0) bfp = 2; // Avoid negative values, set to a minimum floor.

    let category = '';
    const bfpRanges = gender === 'male' ?
      { essential: 5, athletes: 13, fitness: 17, average: 24, obese: Infinity } :
      { essential: 13, athletes: 20, fitness: 24, average: 31, obese: Infinity };

    if (bfp <= bfpRanges.essential) category = 'Grasa Esencial';
    else if (bfp <= bfpRanges.athletes) category = 'Atleta';
    else if (bfp <= bfpRanges.fitness) category = 'Fitness';
    else if (bfp <= bfpRanges.average) category = 'Promedio';
    else category = 'Obeso';

    setBodyFat({ percentage: Math.round(bfp * 10) / 10, category });

  }, [biometrics, measurements, bodyFatMethod]);

  React.useEffect(() => {
    calculateBurnedCalories();
    calculateBodyFat();
  }, [biometrics, measurements, goal, calculateBurnedCalories, calculateBodyFat]);

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Laboratorio Biométrico</h1>
        <p className="text-muted-foreground">Calibra tu motor. La precisión es letal.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black tracking-tighter"><User/>Datos del Atleta</CardTitle>
            </CardHeader>
            <CardContent>
              {isDataLoading ? (
                 <div className="space-y-6">
                    <div className="space-y-2"><Skeleton className="h-4 w-12" /><div className="flex gap-4"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-10 w-full" /></div>
                    <div className="space-y-2"><Skeleton className="h-4 w-24" /><div className="flex gap-4"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-24" /></div></div>
                    <Skeleton className="h-10 w-full mt-4" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <Label>Sexo</Label>
                    <RadioGroup defaultValue="male" value={biometrics.gender} onValueChange={(value: 'male' | 'female') => setBiometrics(prev => ({ ...prev, gender: value }))}>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="male" id="male" />
                          <Label htmlFor="male">Masculino</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="female" id="female" />
                          <Label htmlFor="female">Femenino</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight" className="flex items-center gap-2"><Weight className="h-4 w-4"/>Peso (kg)</Label>
                    <Input id="weight" name="weight" type="number" value={biometrics.weight} onChange={handleInputChange} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="height" className="flex items-center gap-2"><Ruler className="h-4 w-4"/>Altura (cm)</Label>
                    <Input id="height" name="height" type="number" value={biometrics.height} onChange={handleInputChange} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="age" className="flex items-center gap-2"><Cake className="h-4 w-4"/>Edad</Label>
                    <Input id="age" name="age" type="number" value={biometrics.age} onChange={handleInputChange} />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="activityLevel" className="flex items-center gap-2"><Activity className="h-4 w-4"/>Nivel de Actividad</Label>
                    <Select value={String(biometrics.activityLevel)} onValueChange={(value) => setBiometrics(prev => ({ ...prev, activityLevel: Number(value) }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona nivel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1.2">Sedentario (oficina)</SelectItem>
                        <SelectItem value="1.375">Ligero (1-3 días/sem)</SelectItem>
                        <SelectItem value="1.55">Moderado (3-5 días/sem)</SelectItem>
                        <SelectItem value="1.725">Intenso (6-7 días/sem)</SelectItem>
                        <SelectItem value="1.9">Atleta (2x día)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2"><Target className="h-4 w-4"/>Objetivo</Label>
                    <RadioGroup defaultValue="maintain" value={goal} onValueChange={(value: 'maintain' | 'lose' | 'gain') => setGoal(value)}>
                      <div className="flex items-center space-x-4 mt-2">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lose" id="lose" />
                          <Label htmlFor="lose">Bajar Peso</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="maintain" id="maintain" />
                          <Label htmlFor="maintain">Mantener</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gain" id="gain" />
                          <Label htmlFor="gain">Subir Masa</Label>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                   <Button onClick={handleCalculateAndSave} disabled={isCalculating} className="w-full mt-4 font-bold">
                    {isCalculating ? 'Guardando...' : 'Calcular y Guardar Metas'}
                   </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="macros" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="macros">Metas Diarias</TabsTrigger>
              <TabsTrigger value="gasto">Gasto por Ejercicio</TabsTrigger>
              <TabsTrigger value="grasa">% Grasa Corporal</TabsTrigger>
            </TabsList>
            <TabsContent value="macros">
              <Card>
                <CardHeader>
                  <CardTitle className="font-black tracking-tighter">Resultados Tácticos</CardTitle>
                  <CardDescription>Tus objetivos diarios calculados.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="p-6 rounded-md border bg-secondary/50">
                      <h3 className="text-muted-foreground tracking-widest uppercase text-sm">Objetivo Calórico Diario</h3>
                      <p className="text-5xl font-black text-primary tracking-tighter">{tdee?.toLocaleString() ?? '...'} <span className="text-3xl text-muted-foreground">kcal</span></p>
                      <p className="text-sm text-muted-foreground mt-1">Metabolismo Basal (BMR): {bmr?.toLocaleString() ?? '...'} kcal</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold tracking-tight mb-4">Macros de Combate</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-md border">
                        <h4 className="text-muted-foreground">Proteína</h4>
                        <p className="text-3xl font-black tracking-tighter">{macros?.protein ?? '...'}g</p>
                        <p className="text-xs text-muted-foreground">2.2g / kg de peso</p>
                      </div>
                      <div className="p-4 rounded-md border">
                        <h4 className="text-muted-foreground">Grasas</h4>
                        <p className="text-3xl font-black tracking-tighter">{macros?.fat ?? '...'}g</p>
                         <p className="text-xs text-muted-foreground">0.9g / kg de peso</p>
                      </div>
                       <div className="p-4 rounded-md border">
                        <h4 className="text-muted-foreground">Carbohidratos</h4>
                        <p className="text-3xl font-black tracking-tighter">{macros?.carbs ?? '...'}g</p>
                         <p className="text-xs text-muted-foreground">Energía explosiva</p>
                      </div>
                    </div>
                  </div>

                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="gasto">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 font-black tracking-tighter"><Flame />Calculadora de Gasto Energético</CardTitle>
                  <CardDescription>Estima las calorías quemadas durante el ejercicio.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Ejercicio</Label>
                      <Select
                        onValueChange={(value) => setSelectedActivity(activities.find(a => a.name === value))}
                        defaultValue={selectedActivity?.name}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona ejercicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {activities.map(activity => (
                            <SelectItem key={activity.name} value={activity.name}>
                              {activity.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duración (minutos)</Label>
                      <Input
                        id="duration"
                        name="duration"
                        type="number"
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                      />
                    </div>
                  </div>
                   <div className="p-4 rounded-md border bg-secondary/50 text-center space-y-4">
                        <div>
                            <h3 className="text-muted-foreground tracking-widest uppercase text-sm">Calorías Quemadas Estimadas</h3>
                            <p className="text-4xl font-black text-primary tracking-tighter">{burnedCalories ?? 0} <span className="text-2xl text-muted-foreground">kcal</span></p>
                        </div>
                        {burnedCalories !== null && burnedCalories > 0 && (
                            <Button onClick={handleAddExpenditure}>
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Sumar Gasto al Dashboard
                            </Button>
                        )}
                    </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="grasa">
               <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-black tracking-tighter"><HeartPulse/>% de Grasa Corporal</CardTitle>
                    <CardDescription>Estima tu composición corporal.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Método de Cálculo</Label>
                        <RadioGroup defaultValue="navy" value={bodyFatMethod} onValueChange={(value: 'navy' | 'bmi') => setBodyFatMethod(value)} className="mt-2">
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="navy" id="navy" />
                                    <Label htmlFor="navy">Método Navy</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bmi" id="bmi" />
                                    <Label htmlFor="bmi">Basado en IMC</Label>
                                </div>
                            </div>
                        </RadioGroup>
                    </div>

                    {bodyFatMethod === 'navy' && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="waist">Cintura (cm)</Label>
                                <Input id="waist" name="waist" type="number" value={measurements.waist} onChange={handleMeasurementChange} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="neck">Cuello (cm)</Label>
                                <Input id="neck" name="neck" type="number" value={measurements.neck} onChange={handleMeasurementChange} />
                            </div>
                            {biometrics.gender === 'female' && (
                                <div className="space-y-2">
                                    <Label htmlFor="hip">Cadera (cm)</Label>
                                    <Input id="hip" name="hip" type="number" value={measurements.hip} onChange={handleMeasurementChange} />
                                </div>
                            )}
                        </div>
                    )}

                    {bodyFat && (
                        <div className="p-4 rounded-md border bg-secondary/50 text-center">
                            <h3 className="text-muted-foreground tracking-widest uppercase text-sm">Grasa Corporal Estimada</h3>
                            <p className="text-4xl font-black text-primary tracking-tighter">{bodyFat.percentage}% <span className="text-2xl text-muted-foreground capitalize">{bodyFat.category}</span></p>
                        </div>
                    )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

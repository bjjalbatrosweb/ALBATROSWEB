
"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { getUfcWeightCategory } from '@/lib/ufc';
import { Separator } from '@/components/ui/separator';
import { useUser, useFirestore, useDoc, useMemoFirebase, setDocumentNonBlocking, useAuth, initiatePasswordReset } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import type { AuthError } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

// Based on docs/backend.json
type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  heightCm: number;
  weightKg: number;
};


export default function PerfilPage() {
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    weightKg: 0,
    heightCm: 0,
    age: 0,
    gender: 'male',
  });
  const [isSaving, setIsSaving] = useState(false);

  const userProfileRef = useMemoFirebase(() =>
    user && firestore ? doc(firestore, 'perfiles', user.uid) : null,
    [user, firestore]
  );

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userProfileRef);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: userProfile.email || '',
        weightKg: userProfile.weightKg || 0,
        heightCm: userProfile.heightCm || 0,
        age: userProfile.age || 0,
        gender: userProfile.gender || 'male',
      });
    }
  }, [userProfile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: Number(value) }));
  };

  const handleGenderChange = (value: string) => {
    setFormData(prev => ({ ...prev, gender: value }));
  };

  const handleSaveChanges = async () => {
    if (!user || !firestore || !userProfileRef) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo guardar. Intenta iniciar sesión de nuevo.",
      });
      return;
    }

    setIsSaving(true);
    
    const dataToSave = {
      ...formData,
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(userProfileRef, dataToSave, { merge: true });

    toast({
      title: "Perfil Actualizado",
      description: "Tus datos de guerrero han sido guardados.",
    });

    setIsSaving(false);
  };
  
  const handlePasswordReset = () => {
    if (!user || !user.email) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo encontrar tu email para restablecer la contraseña.",
      });
      return;
    }

    initiatePasswordReset(
      auth,
      user.email,
      () => { // onSuccess
        toast({
          title: "Email Enviado",
          description: "Revisa tu bandeja de entrada para el enlace de restablecimiento.",
        });
      },
      (error: AuthError) => { // onError
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo enviar el correo de restablecimiento. Inténtalo de nuevo más tarde.",
        });
      }
    );
  };

  const weightCategory = getUfcWeightCategory(formData.weightKg || 0);

  if (isProfileLoading) {
    return (
      <div className="p-4 md:p-8 space-y-8">
        <header>
          <Skeleton className="h-9 w-1/3" />
          <Skeleton className="h-5 w-2/3 mt-2" />
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-7 w-1/4" />
                        <Skeleton className="h-4 w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                             <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>
                             <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>
                             <div className="space-y-2"><Skeleton className="h-5 w-24" /><Skeleton className="h-10 w-full" /></div>
                        </div>
                        <div className="space-y-2">
                             <Skeleton className="h-5 w-24" />
                             <div className="flex space-x-4 pt-2">
                                <Skeleton className="h-10 w-24" />
                                <Skeleton className="h-10 w-24" />
                             </div>
                        </div>
                    </CardContent>
                     <CardContent><Skeleton className="h-10 w-36" /></CardContent>
                </Card>
            </div>
             <div className="space-y-8">
                <Card><CardHeader><Skeleton className="h-7 w-3/4" /></CardHeader><CardContent><Skeleton className="h-12 w-full" /><Skeleton className="h-5 w-1/2 mt-2" /></CardContent></Card>
                <Card><CardHeader><Skeleton className="h-7 w-1/2" /></CardHeader><CardContent className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-black tracking-tighter">Perfil Guerrero</h1>
        <p className="text-muted-foreground">Tus datos, tu identidad de combate.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Datos Biométricos</CardTitle>
              <CardDescription>Mantén tu información actualizada para cálculos precisos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre</Label>
                  <Input id="firstName" value={formData.firstName} onChange={handleInputChange} placeholder="Nombre de pila"/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido</Label>
                  <Input id="lastName" value={formData.lastName} onChange={handleInputChange} placeholder="Apellido de guerra"/>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} readOnly />
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="weightKg">Peso (kg)</Label>
                  <Input id="weightKg" type="number" value={formData.weightKg} onChange={handleNumberInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heightCm">Altura (cm)</Label>
                  <Input id="heightCm" type="number" value={formData.heightCm} onChange={handleNumberInputChange} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="age">Edad</Label>
                  <Input id="age" type="number" value={formData.age} onChange={handleNumberInputChange} />
                </div>
              </div>

               <div className="space-y-2">
                <Label>Sexo</Label>
                <RadioGroup value={formData.gender} onValueChange={handleGenderChange} className="flex space-x-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male">Masculino</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female">Femenino</Label>
                  </div>
                </RadioGroup>
              </div>

            </CardContent>
            <CardContent>
                 <Button className="font-bold" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? 'Guardando...' : 'Guardar Cambios'}
                 </Button>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="font-black tracking-tighter">Categoría de Peso</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-4xl font-black text-primary tracking-tighter">{weightCategory.split(' (')[0]}</p>
                <p className="text-muted-foreground">{weightCategory.split(' (')[1]?.replace(')','')}</p>
            </CardContent>
          </Card>
           <Card>
            <CardHeader>
              <CardTitle>Datos de Cuenta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="p-4 rounded-md border text-center">
                    <p className="text-sm text-muted-foreground">Edad</p>
                    <p className="text-3xl font-black tracking-tighter">{formData.age > 0 ? formData.age : '-'}</p>
                </div>
               <Button variant="outline" className="w-full" onClick={handlePasswordReset}>Cambiar Contraseña</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, Send, Code, ShieldCheck } from "lucide-react";

export default function ApiTestPage() {
  const [rfid, setRfid] = useState("4C D6 10 6");
  const [dispositivo, setDispositivo] = useState("Recepcion");
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rfid, dispositivo })
      });
      const data = await res.json();
      setResponse(data);
    } catch (error) {
      setResponse({ error: "Error de conexión con la API" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-primary flex items-center gap-2">
          <ShieldCheck className="h-8 w-8" /> Depurador de Acceso RFID
        </h1>
        <p className="text-muted-foreground">Herramienta técnica para validar la respuesta del servidor.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-card/40 border-primary/20">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest">Simulador de Lectura</CardTitle>
            <CardDescription>Configura los parámetros de entrada para el POST.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>RFID (Código de Tarjeta)</Label>
              <Input 
                value={rfid} 
                onChange={(e) => setRfid(e.target.value)} 
                className="font-mono bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Dispositivo</Label>
              <Input 
                value={dispositivo} 
                onChange={(e) => setDispositivo(e.target.value)} 
                className="bg-background/50"
              />
            </div>
            <Button 
              onClick={runTest} 
              disabled={isLoading}
              className="w-full font-black uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              {isLoading ? "Procesando..." : (
                <><Send className="mr-2 h-4 w-4" /> Ejecutar POST /api/rfid</>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-black/90 border-neutral-800 font-mono overflow-hidden">
          <CardHeader className="bg-neutral-900/50 border-b border-neutral-800">
            <CardTitle className="text-[10px] font-bold text-green-500 flex items-center gap-2">
              <Terminal className="h-3 w-3" /> HTTP RESPONSE (JSON)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 overflow-auto max-h-[300px]">
            {response ? (
              <pre className="text-xs text-green-400">
                {JSON.stringify(response, null, 2)}
              </pre>
            ) : (
              <p className="text-xs text-neutral-600 italic">Esperando ejecución de prueba...</p>
            )}
          </CardContent>
          {response && (
            <div className="p-2 bg-neutral-900 border-t border-neutral-800 text-[10px] text-neutral-500 text-right">
              Status: 200 OK | Content-Type: application/json
            </div>
          )}
        </Card>
      </div>

      <Card className="bg-primary/5 border-primary/10 italic">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <Code className="inline-block h-3 w-3 mr-1" /> Nota: El RFID se normaliza internamente a <span className="text-primary font-bold">"{rfid.replace(/\s+/g, '').toUpperCase()}"</span> antes de consultar Firestore.
        </CardContent>
      </Card>
    </div>
  );
}

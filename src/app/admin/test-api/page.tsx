'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Terminal, Send, Code, ShieldCheck, Cpu, ClipboardCheck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ApiTestPage() {
  const [rfid, setRfid] = useState("4C D6 10 6");
  const [dispositivo, setDispositivo] = useState("ESP32_Test");
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

  const esp32Code = `// Ejemplo rápido para tu ESP32
#include <HTTPClient.h>

void checkAccess(String rfidUid) {
  HTTPClient http;
  http.begin("https://tudominio.com/api/rfid");
  http.addHeader("Content-Type", "application/json");

  String json = "{\\"rfid\\":\\"" + rfidUid + "\\",\\"dispositivo\\":\\"Puerta_Principal\\"}";
  int httpCode = http.POST(json);

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.println(payload);
    // Parsear con ArduinoJson: payload["permitido"]
  }
  http.end();
}`;

  return (
    <div className="space-y-8 p-4 md:p-8 max-w-5xl mx-auto">
      <header>
        <h1 className="text-4xl font-black tracking-tighter uppercase italic text-primary flex items-center gap-2">
          <ShieldCheck className="h-8 w-8" /> Depurador Táctico RFID
        </h1>
        <p className="text-muted-foreground">Valida la integración entre tu ESP32 y el servidor central.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Lado Izquierdo: Simulador */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="bg-card/40 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest">Simulador Hardware</CardTitle>
              <CardDescription>Emula el envío de datos de tu ESP32.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>RFID (UID de Tarjeta)</Label>
                <Input 
                  value={rfid} 
                  onChange={(e) => setRfid(e.target.value)} 
                  className="font-mono bg-background/50 border-primary/10"
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre Dispositivo</Label>
                <Input 
                  value={dispositivo} 
                  onChange={(e) => setDispositivo(e.target.value)} 
                  className="bg-background/50 border-primary/10"
                />
              </div>
              <Button 
                onClick={runTest} 
                disabled={isLoading}
                className="w-full font-black uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                {isLoading ? "Procesando..." : (
                  <><Send className="mr-2 h-4 w-4" /> Lanzar Petición</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-black uppercase flex items-center gap-1">
                <Code className="h-3 w-3" /> Info de Normalización
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] text-muted-foreground italic">
              El sistema limpia automáticamente espacios y caracteres no alfanuméricos. 
              <br/><br/>
              Input: "{rfid}" <br/>
              Result: <span className="text-primary font-bold">"{rfid.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}"</span>
            </CardContent>
          </Card>
        </div>

        {/* Lado Derecho: Respuesta y Código */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="response" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-background border border-primary/10">
              <TabsTrigger value="response" className="font-bold uppercase text-[10px]">Respuesta JSON</TabsTrigger>
              <TabsTrigger value="code" className="font-bold uppercase text-[10px]">Guía ESP32 (C++)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="response">
              <Card className="bg-black/90 border-neutral-800 font-mono overflow-hidden min-h-[300px]">
                <CardHeader className="bg-neutral-900/50 border-b border-neutral-800 py-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-green-500 flex items-center gap-2">
                      <Terminal className="h-3 w-3" /> HTTP_RESPONSE_BODY
                    </span>
                    {response && <span className="text-[8px] text-neutral-500 uppercase tracking-widest">Status: 200 OK</span>}
                  </div>
                </CardHeader>
                <CardContent className="p-4 overflow-auto">
                  {response ? (
                    <pre className="text-xs text-green-400">
                      {JSON.stringify(response, null, 2)}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 opacity-20">
                      <Cpu className="h-12 w-12 mb-2" />
                      <p className="text-[10px] uppercase font-black">Esperando transmisión...</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="code">
              <Card className="bg-neutral-900 border-neutral-800 font-mono overflow-hidden">
                <CardHeader className="bg-neutral-800/50 py-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-blue-400">
                    <span className="flex items-center gap-2"><Cpu className="h-3 w-3" /> ACCESS_CONTROL.INO</span>
                    <ClipboardCheck className="h-3 w-3 cursor-pointer hover:text-white" />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <pre className="text-[10px] text-neutral-300 p-4 leading-relaxed overflow-x-auto">
                    {esp32Code}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

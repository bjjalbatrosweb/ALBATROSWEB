
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
    ChevronRight, PlayCircle, Filter, 
    BrainCircuit, Activity, 
    ListFilter, SortAsc, 
    CheckCircle2, Search, Zap,
    ChevronLeft
} from "lucide-react";
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn } from "@/lib/utils";

const CATEGORIES = ['Todas', 'Sumisiones', 'Derribos', 'Escapes', 'Controles', 'Pases de guardia'] as const;
type Category = typeof CATEGORIES[number];

const MODALITIES = ['Todas', 'Con Gi', 'Sin Gi'] as const;
type Modality = typeof MODALITIES[number];

type Difficulty = 'Básica' | 'Básica a Intermedia' | 'Intermedia' | 'Avanzada';
const difficultyOrder: Record<Difficulty, number> = {
  'Básica': 1,
  'Básica a Intermedia': 2,
  'Intermedia': 3,
  'Avanzada': 4,
};

const SUMISIONES_ORDENADAS = [
  'Mata león (RNC)',
  'Armbar (Juji Gatame)',
  'Americana (Keylock)',
  'Kimura (Double Wrist Lock)',
  'Guillotina',
  'Ezekiel Choke',
  'Collar Choke (Guardia)',
  'Collar Choke (Montada)',
  'Bow and Arrow',
  'Triángulo'
];

const NIVEL_1_TECNICAS = [
  { 
    id: '1.1', 
    name: 'Mata león (RNC)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Estrangulación sanguínea definitiva aplicada desde la espalda.',
    detailedInfo: {
      type: 'Estrangulación',
      subtype: 'Asfixia sanguínea (vascular)',
      intro: 'El cuello alberga estructuras vitales como las arterias carótidas... El mata león es una de las sumisiones más determinantes.',
      principles: ['Control de espalda', 'Inserción profunda del brazo', 'Cierre del sistema', 'Conexión pecho-espalga'],
      mechanics: ['Inserción bajo mentón', 'Cierre a bíceps', 'Presión coordinada'],
      concept: 'No corta el aire, corta el flujo sanguíneo cerebral.'
    }
  },
  { 
    id: '1.2', 
    name: 'Armbar (Juji Gatame)', 
    category: 'Sumisiones', 
    modality: 'Sin Gi',
    difficulty: 'Básica a Intermedia' as Difficulty, 
    description: 'Palanca de brazo fundamental basada en la hiperextensión del codo.',
    detailedInfo: {
      type: 'Luxación articular',
      subtype: 'Hiperextensión',
      intro: 'El armbar actúa directamente sobre el codo, usando la cadera como punto de apoyo.',
      principles: ['Aislamiento del brazo', 'Pulgar hacia arriba', 'Cadera como fulcro'],
      mechanics: ['Control de muñeca', 'Elevación de cadera'],
      concept: 'Control total de la extremidad usando la cadera como motor.'
    }
  }
  // ... más técnicas pueden ser añadidas aquí
];

const CORRECT_PASSWORD = "SoyTeamAlbatrosBjj";

export default function ForoPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(false);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('Todas');
  const [activeModality, setActiveModality] = useState<Modality>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortAsc] = useState(true);
  const [selectedTecnica, setSelectedTecnica] = useState<any | null>(null);
  const [showDifficultySort, setShowDifficultySort] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      setIsAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  const filteredTecnicas = useMemo(() => {
    let result = [...NIVEL_1_TECNICAS];
    
    if (activeCategory !== 'Todas') result = result.filter(t => t.category === activeCategory);
    if (activeModality !== 'Todas') result = result.filter(t => t.modality === activeModality);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(term) || 
        t.description.toLowerCase().includes(term)
      );
    }

    if (showDifficultySort) {
      result.sort((a, b) => {
        const diffA = difficultyOrder[a.difficulty];
        const diffB = difficultyOrder[b.difficulty];
        return sortOrder ? diffA - diffB : diffB - diffA;
      });
    }
    
    return result;
  }, [activeCategory, activeModality, searchTerm, sortOrder, showDifficultySort]);

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center p-4 min-h-[calc(100vh-80px)]">
        <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-black tracking-tighter uppercase">Acceso al Foro</CardTitle>
            <CardDescription>Solo para guerreros del equipo. Introduce la contraseña.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Contraseña de equipo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn("bg-background", error && "border-destructive")}
                />
                {error && <p className="text-xs text-destructive font-medium">Contraseña incorrecta. Solo los Albatros pasan aquí.</p>}
              </div>
              <Button type="submit" className="w-full font-bold uppercase tracking-widest">
                Entrar al Nido
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedTecnica) {
    return (
      <TecnicaDetail 
        tecnica={selectedTecnica} 
        onBack={() => setSelectedTecnica(null)} 
      />
    );
  }

  if (activeModule === 'nivel-1') {
    return (
      <div className="p-4 md:p-8 space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-xl font-black tracking-tighter uppercase text-primary italic">Biblioteca Técnica</h1>
          <Button variant="ghost" onClick={() => setActiveModule(null)}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Volver a Módulos
          </Button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1 space-y-6">
             <Card className="bg-card/20 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Search className="h-3 w-3" /> Buscar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  type="text"
                  placeholder="Nombre..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-background/50 h-9 text-xs"
                />
              </CardContent>
            </Card>

             <Card className="bg-card/20 border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Especialidad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-xs font-bold uppercase transition-all flex justify-between items-center",
                      activeCategory === cat ? "bg-primary text-white" : "hover:bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {cat}
                    {activeCategory === cat && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Button 
              variant={showDifficultySort ? "default" : "outline"} 
              className="w-full text-xs font-bold uppercase border-primary/20"
              onClick={() => {
                if (!showDifficultySort) setShowDifficultySort(true);
                else setSortAsc(!sortOrder);
              }}
            >
              <SortAsc className="mr-2 h-3 w-3" /> Dificultad: {sortOrder ? 'Asc' : 'Desc'}
            </Button>
          </aside>

          <div className="md:col-span-3 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredTecnicas.map((tecnica) => (
                  <TecnicaCard key={tecnica.id} tecnica={tecnica} onSelect={setSelectedTecnica} />
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      <header>
          <h1 className="text-3xl font-black tracking-tighter uppercase text-primary italic">Foro Albatros</h1>
          <p className="text-muted-foreground">Tu centro de comando técnico y estratégico.</p>
      </header>
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="space-y-6">
          <h2 className="text-4xl font-black tracking-tighter uppercase italic">¡Bienvenido al Nido!</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">Acceso exclusivo a desgloses estratégicos divididos por nivel y modalidad.</p>
        </section>
        <Separator className="bg-primary/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="group hover:border-primary transition-all duration-300 bg-card/40">
              <CardHeader>
                <CardTitle className="text-lg font-black text-primary uppercase">Módulo Técnico</CardTitle>
                <CardDescription className="font-bold text-foreground">Fundamentos Nivel 1</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground italic mb-6">Fundamentos críticos, escapes esenciales y sumisiones primarias.</p>
                <Button onClick={() => setActiveModule('nivel-1')} className="w-full font-black uppercase">Explorar Biblioteca <ChevronRight className="ml-1 h-4 w-4" /></Button>
              </CardContent>
            </Card>
            <Card className="opacity-50 grayscale border-dashed bg-muted/20">
                <CardHeader>
                  <CardTitle className="text-lg font-black uppercase">Módulo Avanzado</CardTitle>
                  <CardDescription className="font-bold">Intermedio Nivel 2</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground italic">Próximamente disponible.</p>
                  <Button disabled className="w-full mt-4 font-black uppercase" variant="secondary">Bloqueado</Button>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}

function TecnicaCard({ tecnica, onSelect }: { tecnica: any, onSelect: (t: any) => void }) {
  return (
    <Card className="bg-card/40 border-primary/10 hover:border-primary/40 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start mb-2">
          <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary">{tecnica.id}</Badge>
          <div className="flex gap-1">
             <Badge variant="secondary" className="text-[10px] uppercase">{tecnica.modality}</Badge>
          </div>
        </div>
        <CardTitle className="text-xl font-black uppercase italic group-hover:text-primary transition-colors">
          {tecnica.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{tecnica.description}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{tecnica.difficulty}</span>
          <Button size="sm" className="font-bold uppercase" onClick={() => onSelect(tecnica)}>
            <PlayCircle className="mr-1 h-4 w-4" /> Detalles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TecnicaDetail({ tecnica, onBack }: { tecnica: any, onBack: () => void }) {
  const details = tecnica.detailedInfo;
  return (
    <div className="space-y-8 p-4 md:p-8">
      <header>
        <Button variant="ghost" onClick={onBack}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
      </header>
      <div className="max-w-4xl mx-auto space-y-8">
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge className="bg-primary text-white font-black">{tecnica.id}</Badge>
            <h1 className="text-4xl font-black tracking-tighter uppercase italic">{tecnica.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="uppercase font-bold">{tecnica.modality}</Badge>
            <Badge variant="secondary" className="uppercase font-bold">{tecnica.difficulty}</Badge>
          </div>
          {details?.intro && (
            <div className="text-lg leading-relaxed text-muted-foreground bg-card/20 p-4 rounded-lg border border-primary/10">{details.intro}</div>
          )}
        </section>
        <Separator className="bg-primary/20" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card/30 border-primary/10">
            <CardHeader><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary" /> Principios</CardTitle></CardHeader>
            <CardContent><ul className="space-y-2">{details?.principles?.map((p: string, i: number) => (<li key={i} className="text-sm flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{p}</span></li>))}</ul></CardContent>
          </Card>
          <Card className="bg-card/30 border-primary/10">
            <CardHeader><CardTitle className="text-lg font-bold uppercase flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /> Mecánica</CardTitle></CardHeader>
            <CardContent><ul className="space-y-3">{details?.mechanics?.map((m: string, i: number) => (<li key={i} className="text-sm text-muted-foreground border-l-2 border-primary/20 pl-3">{m}</li>))}</ul></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

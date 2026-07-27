'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Question = {
  id: number;
  category: string;
  statement: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type Submission = {
  name: string;
  score: number;
  answers: Record<number, string>;
  questions: Question[];
  timedOut: boolean;
};

const TEST_DURATION = 5 * 60;
const ACCESS_CODE = '1908';

const QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'Derribo',
    statement: 'Azul inicia un derribo con ambos atletas de pie, lleva a blanco al suelo, queda arriba y mantiene el control durante 3 segundos.',
    question: '¿Qué puntuación debe conceder el árbitro?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '2 puntos',
    explanation: 'El derribo termina con control superior estabilizado durante 3 segundos, por lo que concede 2 puntos.',
  },
  {
    id: 2,
    category: 'Derribo',
    statement: 'Azul lleva a blanco al suelo, pero blanco se levanta inmediatamente antes de que azul pueda estabilizar cualquier control.',
    question: '¿Cuántos puntos se anotan por el derribo?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'La acción no alcanzó el tiempo de estabilización necesario para conceder puntos.',
  },
  {
    id: 3,
    category: 'Raspado',
    statement: 'Azul está debajo en guardia cerrada, desequilibra a blanco, invierte la posición, termina arriba y controla durante 3 segundos.',
    question: '¿Qué debe marcar el árbitro?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '2 puntos',
    explanation: 'Es un raspado válido iniciado desde la guardia y estabilizado en posición superior.',
  },
  {
    id: 4,
    category: 'Inversión',
    statement: 'Azul está debajo en control lateral. Logra girar a blanco y termina arriba, sin haber recuperado guardia o media guardia antes de invertir.',
    question: '¿La acción cuenta como raspado?',
    options: ['Sí, vale 2 puntos', 'Sí, vale 3 puntos', 'No concede puntos', 'Vale 4 puntos'],
    correctAnswer: 'No concede puntos',
    explanation: 'Para puntuar como raspado, la inversión debe comenzar desde guardia o media guardia.',
  },
  {
    id: 5,
    category: 'Pasaje de guardia',
    statement: 'Azul está arriba dentro de la guardia, supera por completo las piernas de blanco y consolida el control lateral durante 3 segundos.',
    question: '¿Cuántos puntos recibe azul?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '3 puntos',
    explanation: 'Superar la guardia y estabilizar una posición de control concede 3 puntos.',
  },
  {
    id: 6,
    category: 'Pasaje de guardia',
    statement: 'Azul supera las piernas de blanco, pero blanco recupera la guardia antes de que transcurran 3 segundos de control.',
    question: '¿Cuántos puntos se conceden por el pasaje?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'No se completó la estabilización de 3 segundos exigida para los puntos de pasaje.',
  },
  {
    id: 7,
    category: 'Rodilla en abdomen',
    statement: 'Desde control lateral, azul coloca la rodilla sobre el abdomen de blanco, mantiene la otra pierna extendida y controla la posición durante 3 segundos.',
    question: '¿Cuál es la puntuación?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '2 puntos',
    explanation: 'La posición válida de rodilla en abdomen estabilizada concede 2 puntos.',
  },
  {
    id: 8,
    category: 'Rodilla en abdomen',
    statement: 'Azul coloca la rodilla sobre el abdomen de blanco, pero retira la posición después de solamente 2 segundos.',
    question: '¿Cuántos puntos debe anotar el árbitro?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'La posición no se mantuvo durante los 3 segundos necesarios.',
  },
  {
    id: 9,
    category: 'Montada',
    statement: 'Azul pasa a montada completa, con el torso orientado hacia la cabeza de blanco, y mantiene el control durante 3 segundos.',
    question: '¿Qué puntuación corresponde?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '4 puntos',
    explanation: 'La montada completa estabilizada concede 4 puntos.',
  },
  {
    id: 10,
    category: 'Montada',
    statement: 'Azul alcanza la montada, pero blanco escapa antes de completar 3 segundos de control.',
    question: '¿Cuántos puntos obtiene azul por la montada?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'Sin estabilización durante 3 segundos no se conceden los puntos de montada.',
  },
  {
    id: 11,
    category: 'Control de espalda',
    statement: 'Azul controla la espalda de blanco con ambos ganchos colocados y mantiene la posición durante más de 3 segundos.',
    question: '¿Cuántos puntos recibe azul?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '4 puntos',
    explanation: 'El control válido de espalda con ambos ganchos y estabilización concede 4 puntos.',
  },
  {
    id: 12,
    category: 'Control de espalda',
    statement: 'Azul controla la espalda durante 3 segundos, pero solo logra colocar un gancho.',
    question: '¿Cuántos puntos se conceden por control de espalda?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'Un solo gancho no completa la posición necesaria para recibir los 4 puntos.',
  },
  {
    id: 13,
    category: 'Guardia',
    statement: 'Con ambos atletas de pie, azul se sienta voluntariamente y establece guardia sin derribar a blanco.',
    question: '¿Cuántos puntos obtiene azul por sentarse a guardia?',
    options: ['0 puntos', '2 puntos', '3 puntos', '4 puntos'],
    correctAnswer: '0 puntos',
    explanation: 'Jalar o sentarse a guardia no concede puntos por sí mismo.',
  },
  {
    id: 14,
    category: 'Secuencia de puntuación',
    statement: 'Durante el combate, azul consigue un derribo válido de 2 puntos y, más adelante, estabiliza una montada de 4 puntos. No hubo otras puntuaciones.',
    question: '¿Cuál debe ser el total de azul en el marcador?',
    options: ['2 puntos', '4 puntos', '6 puntos', '8 puntos'],
    correctAnswer: '6 puntos',
    explanation: 'Las acciones se acumulan: 2 puntos del derribo más 4 de la montada dan un total de 6.',
  },
  {
    id: 15,
    category: 'Finalización',
    statement: 'Blanco realiza una señal clara de rendición dando palmadas repetidas mientras azul aplica una sumisión.',
    question: '¿Qué debe hacer el árbitro?',
    options: ['Dar 2 puntos a azul', 'Esperar 3 segundos', 'Detener el combate de inmediato', 'Dar una ventaja y continuar'],
    correctAnswer: 'Detener el combate de inmediato',
    explanation: 'Una rendición clara termina el combate; la prioridad del árbitro es detener la acción inmediatamente.',
  },
];

function shuffleQuestions() {
  const shuffled = [...QUESTIONS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export default function TestPage() {
  const [gameState, setGameState] = useState<'initial' | 'running' | 'finished'>('initial');
  const [studentName, setStudentName] = useState('');
  const [questions, setQuestions] = useState<Question[]>(QUESTIONS);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TEST_DURATION);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [accessCode, setAccessCode] = useState('');
  const [resultsUnlocked, setResultsUnlocked] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);

  const finishTest = useCallback((timedOut = false) => {
    if (gameState !== 'running') return;

    const frozenAnswers = { ...answers };
    const frozenQuestions = [...questions];
    const score = frozenQuestions.reduce(
      (total, question) => total + (frozenAnswers[question.id] === question.correctAnswer ? 1 : 0),
      0,
    );

    setSubmission({
      name: studentName.trim(),
      score,
      answers: frozenAnswers,
      questions: frozenQuestions,
      timedOut,
    });
    setShowSubmitWarning(false);
    setGameState('finished');
    setTimeLeft(current => (timedOut ? 0 : current));
  }, [answers, gameState, questions, studentName]);

  useEffect(() => {
    if (gameState !== 'running') return;

    const interval = window.setInterval(() => {
      setTimeLeft(current => {
        if (current <= 1) {
          window.clearInterval(interval);
          window.setTimeout(() => finishTest(true), 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [finishTest, gameState]);

  const startTest = () => {
    if (!studentName.trim()) return;
    setQuestions(shuffleQuestions());
    setCurrentQuestionIndex(0);
    setTimeLeft(TEST_DURATION);
    setAnswers({});
    setSubmission(null);
    setAccessCode('');
    setResultsUnlocked(false);
    setCodeError('');
    setShowSubmitWarning(false);
    setGameState('running');
  };

  const selectAnswer = (answer: string) => {
    const question = questions[currentQuestionIndex];
    setAnswers(current => ({ ...current, [question.id]: answer }));
  };

  const requestSubmit = () => {
    if (Object.keys(answers).length < questions.length) {
      setShowSubmitWarning(true);
      return;
    }
    finishTest(false);
  };

  const unlockResults = () => {
    if (accessCode === ACCESS_CODE) {
      setResultsUnlocked(true);
      setCodeError('');
      return;
    }
    setCodeError('Código incorrecto.');
  };

  const renderInitialScreen = () => (
    <Card className="w-full max-w-xl overflow-hidden border-primary/20 shadow-2xl shadow-primary/5">
      <div className="border-b bg-gradient-to-br from-primary/15 via-background to-background p-7 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-black text-primary-foreground shadow-lg">
          BJJ
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-primary">Evaluación de conocimientos</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Test de Arbitraje</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Responde 15 casos prácticos en un máximo de 5 minutos. Podrás revisar tus respuestas antes de entregar.
        </p>
      </div>

      <div className="space-y-6 p-7 sm:p-10">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xl font-black">15</p>
            <p className="text-xs text-muted-foreground">preguntas</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xl font-black">5:00</p>
            <p className="text-xs text-muted-foreground">minutos</p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-3">
            <p className="text-xl font-black">1</p>
            <p className="text-xs text-muted-foreground">intento</p>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="student-name">Nombre completo del participante</Label>
          <Input
            id="student-name"
            value={studentName}
            onChange={event => setStudentName(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && startTest()}
            placeholder="Escribe tu nombre"
            maxLength={80}
            autoComplete="name"
            className="h-12"
          />
          <Button className="h-12 w-full text-base font-bold" onClick={startTest} disabled={!studentName.trim()}>
            Comenzar evaluación
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderTestScreen = () => {
    const currentQuestion = questions[currentQuestionIndex];
    const selectedAnswer = answers[currentQuestion.id];
    const answeredCount = Object.keys(answers).length;
    const progress = (answeredCount / questions.length) * 100;

    return (
      <div className="w-full max-w-6xl">
        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participante</p>
              <p className="truncate font-bold">{studentName.trim()}</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Progreso</p>
                <p className="font-mono text-xl font-black">{answeredCount}/15</p>
              </div>
              <div className={cn(
                'min-w-24 rounded-xl border px-4 py-2 text-center',
                timeLeft <= 60 && 'border-red-500/50 bg-red-500/10',
              )}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tiempo</p>
                <p className={cn('font-mono text-2xl font-black', timeLeft <= 60 && 'text-red-500')}>
                  {formatTime(timeLeft)}
                </p>
              </div>
            </div>
            <Progress value={progress} className="basis-full" />
          </Card>

          <Button className="hidden h-full min-h-20 font-bold lg:flex" onClick={requestSubmit}>
            Entregar evaluación
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="overflow-hidden border-primary/15 shadow-xl">
            <div className="border-b bg-muted/30 px-5 py-4 sm:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                  {currentQuestion.category}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Pregunta {currentQuestionIndex + 1} de {questions.length}
                </span>
              </div>
            </div>

            <div className="p-5 sm:p-8 lg:p-10">
              <div className="mb-8 rounded-2xl border-l-4 border-l-primary bg-muted/40 p-5 sm:p-6">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Situación</p>
                <p className="text-lg font-medium leading-relaxed sm:text-xl">{currentQuestion.statement}</p>
              </div>

              <h2 className="mb-5 text-xl font-black sm:text-2xl">{currentQuestion.question}</h2>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((option, index) => {
                  const selected = selectedAnswer === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => selectAnswer(option)}
                      className={cn(
                        'group flex min-h-20 items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                        'hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border bg-background',
                      )}
                    >
                      <span className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-black',
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                      )}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="font-semibold leading-snug">{option}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(index => index - 1)}
                  disabled={currentQuestionIndex === 0}
                >
                  Anterior
                </Button>
                {currentQuestionIndex < questions.length - 1 ? (
                  <Button onClick={() => setCurrentQuestionIndex(index => index + 1)}>
                    Siguiente
                  </Button>
                ) : (
                  <Button onClick={requestSubmit}>Finalizar</Button>
                )}
              </div>
            </div>
          </Card>

          <Card className="h-fit p-5 lg:sticky lg:top-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold">Preguntas</p>
              <span className="text-xs text-muted-foreground">Selecciona para revisar</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => setCurrentQuestionIndex(index)}
                  aria-label={`Ir a la pregunta ${index + 1}`}
                  className={cn(
                    'aspect-square rounded-lg border text-sm font-bold transition-colors',
                    index === currentQuestionIndex
                      ? 'border-primary bg-primary text-primary-foreground'
                      : answers[question.id] !== undefined
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {index + 1}
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2 border-t pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-primary" /> Pregunta actual</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border border-primary/30 bg-primary/10" /> Respondida</div>
              <div className="flex items-center gap-2"><span className="h-3 w-3 rounded border bg-background" /> Sin responder</div>
            </div>
          </Card>
        </div>

        <Button className="mt-4 h-12 w-full font-bold lg:hidden" onClick={requestSubmit}>
          Entregar evaluación
        </Button>

        {showSubmitWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md p-6 text-center shadow-2xl">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-xl font-black text-amber-500">!</div>
              <h2 className="mb-2 text-xl font-black">Hay preguntas sin responder</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Faltan {questions.length - answeredCount} respuestas. Si entregas ahora se contarán como incorrectas y la puntuación quedará bloqueada.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => setShowSubmitWarning(false)}>Seguir respondiendo</Button>
                <Button variant="destructive" onClick={() => finishTest(false)}>Entregar ahora</Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const renderFinishedScreen = () => {
    if (!submission) return null;

    return (
      <div className="w-full max-w-4xl space-y-5">
        <Card className="overflow-hidden border-primary/20 shadow-2xl">
          <div className="border-b bg-gradient-to-br from-primary/15 via-background to-background p-7 text-center sm:p-10">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/15 text-2xl text-green-500">✓</div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.25em] text-primary">Evaluación entregada</p>
            <h1 className="text-3xl font-black">Respuestas bloqueadas</h1>
            <p className="mt-3 text-muted-foreground">
              {submission.timedOut
                ? `El tiempo de ${submission.name} terminó y el examen se entregó automáticamente.`
                : `Las respuestas de ${submission.name} se registraron correctamente.`}
            </p>
          </div>

          <div className="p-7 sm:p-10">
            {!resultsUnlocked ? (
              <div className="mx-auto max-w-sm space-y-4">
                <div className="text-center">
                  <h2 className="font-black">Resultados protegidos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ingresa el código autorizado para consultar la puntuación.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="results-code">Código de acceso</Label>
                  <div className="flex gap-2">
                    <Input
                      id="results-code"
                      type="password"
                      inputMode="numeric"
                      value={accessCode}
                      onChange={event => {
                        setAccessCode(event.target.value.replace(/\D/g, '').slice(0, 4));
                        setCodeError('');
                      }}
                      onKeyDown={event => event.key === 'Enter' && unlockResults()}
                      placeholder="••••"
                      className="h-12 text-center font-mono text-xl tracking-[0.4em]"
                    />
                    <Button className="h-12" onClick={unlockResults}>Desbloquear</Button>
                  </div>
                  {codeError && <p className="text-center text-sm font-semibold text-red-500">{codeError}</p>}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Puntuación final</p>
                <div className="my-4 flex items-end justify-center gap-2">
                  <span className="text-6xl font-black text-primary sm:text-7xl">{submission.score}</span>
                  <span className="mb-2 text-2xl font-bold text-muted-foreground">/ 15</span>
                </div>
                <div className="mx-auto mb-4 max-w-xs">
                  <Progress value={(submission.score / 15) * 100} />
                </div>
                <p className="text-lg font-bold">{Math.round((submission.score / 15) * 100)}% de respuestas correctas</p>
                <p className="mt-2 text-sm text-muted-foreground">La calificación quedó fijada al entregar y no puede modificarse.</p>
              </div>
            )}
          </div>
        </Card>

        {resultsUnlocked && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Revisión</p>
                <h2 className="text-2xl font-black">Detalle de respuestas</h2>
              </div>
              <p className="text-sm text-muted-foreground">{submission.name}</p>
            </div>

            {submission.questions.map((question, index) => {
              const selected = submission.answers[question.id];
              const isCorrect = selected === question.correctAnswer;
              return (
                <Card key={question.id} className="overflow-hidden">
                  <div className={cn(
                    'flex items-center justify-between border-b px-5 py-3',
                    isCorrect ? 'bg-green-500/10' : 'bg-red-500/10',
                  )}>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-sm font-black text-white',
                        isCorrect ? 'bg-green-500' : 'bg-red-500',
                      )}>
                        {isCorrect ? '✓' : '×'}
                      </span>
                      <div>
                        <p className="text-sm font-bold">Pregunta {index + 1}</p>
                        <p className="text-xs text-muted-foreground">{question.category}</p>
                      </div>
                    </div>
                    <span className={cn('text-sm font-black', isCorrect ? 'text-green-500' : 'text-red-500')}>
                      {isCorrect ? 'Correcta' : 'Incorrecta'}
                    </span>
                  </div>
                  <div className="space-y-4 p-5">
                    <p className="font-semibold">{question.question}</p>
                    <div className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Respuesta elegida</p>
                        <p className={cn('font-bold', isCorrect ? 'text-green-500' : 'text-red-500')}>
                          {selected ?? 'Sin responder'}
                        </p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-bold uppercase text-muted-foreground">Respuesta correcta</p>
                        <p className="font-bold text-green-500">{question.correctAnswer}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{question.explanation}</p>
                  </div>
                </Card>
              );
            })}
          </section>
        )}
      </div>
    );
  };

  return (
    <main className="container mx-auto flex min-h-screen items-center justify-center p-4 py-8">
      {gameState === 'initial' && renderInitialScreen()}
      {gameState === 'running' && renderTestScreen()}
      {gameState === 'finished' && renderFinishedScreen()}
    </main>
  );
}

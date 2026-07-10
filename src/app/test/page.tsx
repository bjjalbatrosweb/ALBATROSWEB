
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// --- Data for the simulation ---
const actions = [
  {
    description: 'Acción: Uke (azul) ejecuta un derribo de dos piernas y estabiliza la posición de control lateral por 3 segundos.',
    correctPoints: 2,
    explanation: 'Correcto. Los derribos seguidos de una estabilización de 3 segundos en una posición de control valen 2 puntos.',
    incorrectExplanation: 'Incorrecto. Un derribo válido con estabilización otorga 2 puntos según el reglamento de la IBJJF.'
  },
  {
    description: 'Acción: Desde la guardia cerrada, Uke (azul) invierte la posición y termina arriba en la guardia del oponente, estabilizando por 3 segundos.',
    correctPoints: 2,
    explanation: 'Correcto. Un raspado (sweep) desde la guardia que termina en una posición superior estable vale 2 puntos.',
    incorrectExplanation: 'Incorrecto. Esto es un raspado clásico y se puntúa con 2 puntos.'
  },
  {
    description: 'Acción: Uke (azul), en la posición superior, pasa las piernas de Tori (blanco) y establece un control lateral firme durante 3 segundos.',
    correctPoints: 3,
    explanation: 'Correcto. Pasar la guardia del oponente y establecer una posición dominante como el control lateral otorga 3 puntos.',
    incorrectExplanation: 'Incorrecto. El pasaje de guardia es una de las acciones de mayor puntuación y vale 3 puntos.'
  },
  {
    description: 'Acción: Uke (azul) tiene a Tori (blanco) en control lateral y coloca una rodilla sobre su abdomen, manteniendo la posición y el control por 3 segundos.',
    correctPoints: 2,
    explanation: 'Correcto. La posición de rodilla en el abdomen (Knee on Belly) mantenida por 3 segundos se puntúa con 2 puntos.',
    incorrectExplanation: 'Incorrecto. Aunque es una posición transitoria, la rodilla en el abdomen controlada se puntúa con 2 puntos.'
  },
  {
    description: 'Acción: Uke (azul) avanza desde el control lateral a la posición de montada completa sobre Tori (blanco), estabilizando el control.',
    correctPoints: 4,
    explanation: 'Correcto. La montada es una de las posiciones más dominantes y se recompensa con 4 puntos.',
    incorrectExplanation: 'Incorrecto. La montada es una posición de alto valor que otorga 4 puntos.'
  },
  {
    description: 'Acción: Tori (blanco) está de espaldas y Uke (azul) establece control con ambos ganchos y el cinturón de seguridad (seatbelt grip) por más de 3 segundos.',
    correctPoints: 4,
    explanation: 'Correcto. Tomar la espalda con ambos ganchos es, junto con la montada, la acción de mayor puntuación, valiendo 4 puntos.',
    incorrectExplanation: 'Incorrecto. El control de espalda con ganchos es una posición que vale 4 puntos.'
  },
  {
    description: 'Acción: Uke (azul) intenta un derribo, pero Tori (blanco) cae y se levanta inmediatamente sin que Uke pueda estabilizar.',
    correctPoints: 0,
    explanation: 'Correcto. No se otorgan puntos porque no hubo control por 3 segundos. Se podría considerar una ventaja si el intento fue claro.',
    incorrectExplanation: 'Incorrecto. Para que un derribo puntúe, el atleta que lo ejecuta debe mantener a su oponente en el suelo y estabilizar la posición durante 3 segundos.'
  },
].sort(() => Math.random() - 0.5); // Shuffle actions for variety

const MATCH_DURATION = 60; // 1 minute
const DECISION_TIME = 5; // 5 seconds

export default function TestPage() {
  const [gameState, setGameState] = useState('initial'); // initial, running, finished
  const [currentActionIndex, setCurrentActionIndex] = useState(0);
  const [matchTimer, setMatchTimer] = useState(MATCH_DURATION);
  const [decisionTimer, setDecisionTimer] = useState(DECISION_TIME);
  const [feedback, setFeedback] = useState({ message: '', isCorrect: false });
  const [showFeedback, setShowFeedback] = useState(false);
  const [userScore, setUserScore] = useState(0);
  const [totalPossibleScore, setTotalPossibleScore] = useState(0);

  // --- Timer Logics ---
  useEffect(() => {
    if (gameState !== 'running') return;

    // Match timer
    const matchInterval = setInterval(() => {
      setMatchTimer(prev => {
        if (prev <= 1) {
          setGameState('finished');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Decision timer
    const decisionInterval = setInterval(() => {
      setDecisionTimer(prev => {
        if (prev <= 1) {
          handleDecision(-1); // Auto-fail if time runs out
          return DECISION_TIME;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(matchInterval);
      clearInterval(decisionInterval);
    };
  }, [gameState, currentActionIndex]);

  const handleDecision = (points: number) => {
    if (showFeedback) return; // Prevent multiple decisions

    const currentAction = actions[currentActionIndex];
    const isCorrect = points === currentAction.correctPoints;

    if (isCorrect) {
      setFeedback({ message: currentAction.explanation, isCorrect: true });
      setUserScore(prev => prev + 1);
    } else {
      setFeedback({ message: currentAction.incorrectExplanation, isCorrect: false });
    }
    
    setTotalPossibleScore(prev => prev + 1);
    setShowFeedback(true);
    setDecisionTimer(DECISION_TIME); // Reset for next round

    // Move to next action after showing feedback
    setTimeout(() => {
      setShowFeedback(false);
      if (currentActionIndex + 1 < actions.length && matchTimer > 0) {
        setCurrentActionIndex(prev => prev + 1);
      } else {
        setGameState('finished');
      }
    }, 4000);
  };

  const startGame = () => {
    setCurrentActionIndex(0);
    setMatchTimer(MATCH_DURATION);
    setDecisionTimer(DECISION_TIME);
    setUserScore(0);
    setTotalPossibleScore(0);
    setShowFeedback(false);
    setGameState('running');
  };

  const renderInitialScreen = () => (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Simulador de Arbitraje</h1>
      <p className="text-muted-foreground mb-8">Pon a prueba tu conocimiento del reglamento de Jiu-Jitsu.</p>
      <div className="flex justify-center gap-4">
        <Button size="lg" onClick={startGame}>Iniciar Simulación de Combate</Button>
        <Button size="lg" variant="outline" disabled>Opción 2 (Próximamente)</Button>
      </div>
    </div>
  );

  const renderFinishedScreen = () => (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Simulación Terminada</h1>
      <p className="text-xl mb-4">Tu puntuación: <span className="font-bold text-primary">{userScore} de {totalPossibleScore}</span> decisiones correctas.</p>
      <p className="text-muted-foreground mb-8">
        {userScore / totalPossibleScore > 0.7 ? "¡Excelente trabajo! Conoces bien el reglamento." : "Sigue practicando para convertirte en un árbitro experto."}
      </p>
      <Button size="lg" onClick={startGame}>Intentar de Nuevo</Button>
    </div>
  );

  const renderCombatScreen = () => {
    const currentAction = actions[currentActionIndex];
    const pointOptions = [0, 2, 3, 4];

    return (
      <div>
        <Card className="p-6 relative">
          {/* --- Timers and Progress --- */}
          <div className="flex justify-between items-center mb-4">
            <div className="w-1/3">
              <p className="font-bold">Tiempo de Combate</p>
              <p className="text-4xl font-mono">0:{matchTimer.toString().padStart(2, '0')}</p>
            </div>
            <div className="w-1/3 text-center">
                <p className="font-bold">Decisión</p>
                <p className="text-6xl font-mono text-red-500">{decisionTimer}</p>
            </div>
            <div className="w-1/3 text-right">
              <p className="font-bold">Acción</p>
              <p className="text-4xl font-mono">{currentActionIndex + 1}/{actions.length}</p>
            </div>
          </div>
          <Progress value={(matchTimer / MATCH_DURATION) * 100} className="mb-6" />

          {/* --- Action Description --- */}
          <div className="text-center my-12 min-h-[100px]">
            <p className="text-2xl font-semibold">{currentAction.description}</p>
          </div>

          {/* --- Decision Buttons --- */}
          <div className="grid grid-cols-4 gap-4">
            {pointOptions.map(points => (
              <Button key={points} onClick={() => handleDecision(points)} disabled={showFeedback} className="py-6 text-lg">
                {points} Puntos
              </Button>
            ))}
          </div>

          {/* --- Feedback Overlay --- */}
          {showFeedback && (
            <div className={cn(
              "absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col justify-center items-center p-8 text-center",
              feedback.isCorrect ? 'text-green-500' : 'text-red-500'
            )}>
              <h2 className="text-3xl font-bold mb-4">{feedback.isCorrect ? '¡Correcto!' : 'Incorrecto'}</h2>
              <p className="text-lg text-foreground">{feedback.message}</p>
            </div>
          )}
        </Card>
      </div>
    );
  };

  return (
    <main className="container mx-auto p-4 flex items-center justify-center min-h-screen">
      {gameState === 'initial' && renderInitialScreen()}
      {gameState === 'running' && renderCombatScreen()}
      {gameState === 'finished' && renderFinishedScreen()}
    </main>
  );
}

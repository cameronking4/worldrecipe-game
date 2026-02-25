'use client';

import { useEffect, useState, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { HUD } from '@/components/ui/HUD';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { v4 as uuidv4 } from 'uuid';
import type { EnemyInstance, Weapon } from '@/types/game';

const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a]">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
        <p className="text-lg font-medium text-white">Loading AI Arena...</p>
        <p className="text-sm text-white/50 mt-2">Preparing combat zone</p>
      </div>
    </div>
  ),
});

// ============================================
// Mission Briefing Screen
// ============================================
function MissionBriefing({ onStart }: { onStart: () => void }) {
  const world = useGameStore((s) => s.world);

  if (!world?.mission) return null;

  const { mission } = world;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
      <Card className="w-full max-w-lg bg-[#111122]/95 border-red-500/30 animate-in zoom-in-95 duration-300">
        <CardHeader className="text-center border-b border-white/10">
          <div className="text-red-400 text-xs font-mono uppercase tracking-wider mb-2">
            Mission Briefing
          </div>
          <CardTitle className="text-3xl text-white">{mission.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <p className="text-white/70 text-sm leading-relaxed">{mission.briefing}</p>

          <div className="grid grid-cols-3 gap-3 py-2">
            <div className="text-center bg-white/5 rounded-lg p-3">
              <div className="text-xl font-mono font-bold text-red-400">{mission.waves.length}</div>
              <div className="text-[10px] text-white/50 uppercase">Waves</div>
            </div>
            <div className="text-center bg-white/5 rounded-lg p-3">
              <div className="text-xl font-mono font-bold text-yellow-400">{mission.enemyTypes.length}</div>
              <div className="text-[10px] text-white/50 uppercase">Enemy Types</div>
            </div>
            <div className="text-center bg-white/5 rounded-lg p-3">
              <div className="text-xl font-mono font-bold text-blue-400">{mission.availableWeapons.length}</div>
              <div className="text-[10px] text-white/50 uppercase">Weapons</div>
            </div>
          </div>

          {/* Enemy types preview */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-white/40 uppercase">Threat Assessment</div>
            {mission.enemyTypes.slice(0, 3).map((enemy) => (
              <div
                key={enemy.enemyTypeId}
                className="flex items-center gap-3 bg-white/5 rounded-lg p-2"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: enemy.color }}
                />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{enemy.name}</div>
                  <div className="text-[10px] text-white/50">{enemy.description}</div>
                </div>
                <div className="text-[10px] text-white/40 font-mono uppercase">{enemy.behavior}</div>
              </div>
            ))}
          </div>

          {/* Storyline */}
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <p className="text-xs text-red-300/80 italic">"{mission.storyline}"</p>
          </div>

          <Button
            className="w-full h-12 text-lg font-bold bg-red-600 hover:bg-red-700"
            onClick={onStart}
          >
            ENGAGE
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Pause Menu
// ============================================
function PauseMenu() {
  const setPaused = useGameStore((s) => s.setPaused);
  const playTimeSeconds = useGameStore((s) => s.playTimeSeconds);
  const kills = usePlayerStore((s) => s.kills);
  const score = usePlayerStore((s) => s.score);
  const accuracy = usePlayerStore((s) => s.getAccuracy());

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <Card className="w-full max-w-md bg-[#111122]/95 border-white/20 animate-in zoom-in-95 duration-200">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">PAUSED</CardTitle>
          <p className="text-sm text-white/50 font-mono">{formatTime(playTimeSeconds)}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 py-2 text-center">
            <div>
              <div className="text-lg font-mono font-bold text-yellow-400">{score}</div>
              <div className="text-[10px] text-white/50 uppercase">Score</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-red-400">{kills}</div>
              <div className="text-[10px] text-white/50 uppercase">Kills</div>
            </div>
            <div>
              <div className="text-lg font-mono font-bold text-blue-400">{accuracy}%</div>
              <div className="text-[10px] text-white/50 uppercase">Accuracy</div>
            </div>
          </div>

          <Button
            className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
            onClick={() => setPaused(false)}
          >
            Resume
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 border-white/20 text-white hover:bg-white/10"
            onClick={() => (window.location.href = '/')}
          >
            Main Menu
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Victory Screen
// ============================================
function VictoryScreen() {
  const world = useGameStore((s) => s.world);
  const kills = usePlayerStore((s) => s.kills);
  const score = usePlayerStore((s) => s.score);
  const accuracy = usePlayerStore((s) => s.getAccuracy());
  const playTimeSeconds = useGameStore((s) => s.playTimeSeconds);
  const health = usePlayerStore((s) => s.health);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Calculate rating
  const getRating = () => {
    if (accuracy >= 70 && health >= 80) return { grade: 'S', color: 'text-yellow-400' };
    if (accuracy >= 50 && health >= 50) return { grade: 'A', color: 'text-green-400' };
    if (accuracy >= 30) return { grade: 'B', color: 'text-blue-400' };
    return { grade: 'C', color: 'text-white' };
  };

  const rating = getRating();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
      <div className="text-center animate-in zoom-in duration-500 max-w-md w-full">
        <div className={`text-8xl font-black mb-4 ${rating.color} animate-bounce`}>
          {rating.grade}
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">MISSION COMPLETE</h1>
        <p className="text-white/60 mb-6">{world?.mission?.completionMessage}</p>

        <Card className="bg-white/5 border-white/10 mb-6">
          <CardContent className="p-6 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-mono font-bold text-yellow-400">{score.toLocaleString()}</p>
              <p className="text-sm text-white/50">Score</p>
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-red-400">{kills}</p>
              <p className="text-sm text-white/50">Kills</p>
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-blue-400">{accuracy}%</p>
              <p className="text-sm text-white/50">Accuracy</p>
            </div>
            <div>
              <p className="text-3xl font-mono font-bold text-green-400">{formatTime(playTimeSeconds)}</p>
              <p className="text-sm text-white/50">Time</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-x-4">
          <Button
            size="lg"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Play Again
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => (window.location.href = '/')}
          >
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Defeat Screen
// ============================================
function DefeatScreen() {
  const currentWave = useGameStore((s) => s.currentWave);
  const totalWaves = useGameStore((s) => s.totalWaves);
  const kills = usePlayerStore((s) => s.kills);
  const score = usePlayerStore((s) => s.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90">
      <div className="text-center animate-in zoom-in duration-500">
        <div className="text-6xl mb-4 text-red-500 animate-pulse">DEFEATED</div>
        <p className="text-white/60 mb-6">
          Eliminated on Wave {currentWave} of {totalWaves}
        </p>

        <Card className="bg-white/5 border-white/10 mb-6 max-w-sm mx-auto">
          <CardContent className="p-4 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-mono font-bold text-yellow-400">{score}</p>
              <p className="text-xs text-white/50">Score</p>
            </div>
            <div>
              <p className="text-2xl font-mono font-bold text-red-400">{kills}</p>
              <p className="text-xs text-white/50">Kills</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-x-4">
          <Button
            size="lg"
            className="bg-red-600 hover:bg-red-700"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
            onClick={() => (window.location.href = '/')}
          >
            Main Menu
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Wave Manager (game loop logic)
// ============================================
function useWaveManager() {
  const world = useGameStore((s) => s.world);
  const phase = useGameStore((s) => s.phase);
  const currentWave = useGameStore((s) => s.currentWave);
  const enemiesAlive = useGameStore((s) => s.enemiesAlive);
  const setPhase = useGameStore((s) => s.setPhase);
  const startWave = useGameStore((s) => s.startWave);
  const endWave = useGameStore((s) => s.endWave);
  const spawnEnemies = useGameStore((s) => s.spawnEnemies);
  const health = usePlayerStore((s) => s.health);
  const addWeapon = usePlayerStore((s) => s.addWeapon);
  const intermissionTimer = useRef<NodeJS.Timeout | null>(null);
  const waveSpawnTimer = useRef<NodeJS.Timeout[]>([]);
  const weaponsGiven = useRef(false);

  // Give player weapons at start
  useEffect(() => {
    if (world?.mission && !weaponsGiven.current) {
      weaponsGiven.current = true;
      const weapons = world.mission.availableWeapons;
      // Player already has pistol, give additional weapons
      weapons.forEach((w) => {
        if (w.type !== 'pistol') {
          addWeapon(w as Weapon);
        }
      });
    }
  }, [world, addWeapon]);

  // Check for player death
  useEffect(() => {
    if (health <= 0 && phase === 'combat') {
      setPhase('defeat');
    }
  }, [health, phase, setPhase]);

  // Wave completion check
  useEffect(() => {
    if (phase === 'combat' && enemiesAlive <= 0 && currentWave > 0) {
      endWave();
    }
  }, [phase, enemiesAlive, currentWave, endWave]);

  // Handle intermission -> next wave
  useEffect(() => {
    if (phase !== 'intermission' || !world?.mission) return;

    const mission = world.mission;
    const nextWaveIndex = currentWave; // currentWave is 1-indexed, array is 0-indexed
    const nextWaveConfig = mission.waves[nextWaveIndex];

    if (!nextWaveConfig) {
      // All waves complete
      setPhase('victory');
      return;
    }

    const intermissionMs = (nextWaveConfig.intermissionDuration || 5) * 1000;

    intermissionTimer.current = setTimeout(() => {
      // Spawn enemies for next wave
      const enemyInstances: EnemyInstance[] = [];
      const spawnPoints = nextWaveConfig.spawnPoints.length > 0
        ? nextWaveConfig.spawnPoints
        : mission.arena.enemySpawnPoints;

      let spawnIdx = 0;
      nextWaveConfig.enemies.forEach((group) => {
        for (let i = 0; i < group.count; i++) {
          const sp = spawnPoints[spawnIdx % spawnPoints.length];
          // Add some randomness to spawn position
          const offset = [(Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4];
          enemyInstances.push({
            instanceId: uuidv4(),
            typeId: group.enemyTypeId,
            position: [sp[0] + offset[0], 1, sp[2] + offset[2]],
            rotation: 0,
            health: getEnemyHealth(group.enemyTypeId, mission.enemyTypes, nextWaveConfig.difficultyMultiplier),
            maxHealth: getEnemyHealth(group.enemyTypeId, mission.enemyTypes, nextWaveConfig.difficultyMultiplier),
            isAlive: true,
            lastAttackTime: 0,
            state: 'idle',
          });
          spawnIdx++;
        }
      });

      spawnEnemies(enemyInstances, mission.enemyTypes as any);
      startWave(nextWaveConfig.waveNumber);
    }, intermissionMs);

    return () => {
      if (intermissionTimer.current) clearTimeout(intermissionTimer.current);
      waveSpawnTimer.current.forEach(clearTimeout);
    };
  }, [phase, currentWave, world, spawnEnemies, startWave, setPhase]);
}

function getEnemyHealth(
  enemyTypeId: string,
  enemyTypes: { enemyTypeId: string; health: number }[],
  multiplier: number
): number {
  const type = enemyTypes.find((t) => t.enemyTypeId === enemyTypeId);
  return Math.round((type?.health || 50) * multiplier);
}

// ============================================
// Game Page Content
// ============================================
function GamePageContent() {
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitialized = useRef(false);
  const searchParams = useSearchParams();

  const isPaused = useGameStore((s) => s.isPaused);
  const setPaused = useGameStore((s) => s.setPaused);
  const phase = useGameStore((s) => s.phase);
  const setPhase = useGameStore((s) => s.setPhase);
  const world = useGameStore((s) => s.world);
  const setWorld = useGameStore((s) => s.setWorld);
  const isLoading = useGameStore((s) => s.isLoading);
  const setLoading = useGameStore((s) => s.setLoading);

  // Set total waves when world loads
  useEffect(() => {
    if (world?.mission?.waves) {
      useGameStore.setState({ totalWaves: world.mission.waves.length });
    }
  }, [world]);

  // Wave manager
  useWaveManager();

  // Initialize game: load mission from AI
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initializeGame = async () => {
      setIsInitializing(true);
      setLoading(true);

      const missionTheme = searchParams.get('mission') || 'Training Grounds';
      const difficulty = searchParams.get('difficulty') || 'medium';
      const theme = searchParams.get('theme') || 'industrial';

      try {
        const res = await fetch('/api/ai/world', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            missionTheme,
            seed: `${missionTheme}-${Date.now()}`,
            playerPrefs: { difficulty, arenaTheme: theme },
          }),
        });

        const data = await res.json();

        if (data.world) {
          setWorld(data.world);
          setPhase('briefing');
        } else if (data.error) {
          console.error('Mission generation error:', data.error);
          if (data.fallbackWorld) {
            setWorld(data.fallbackWorld);
            setPhase('briefing');
          }
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
      } finally {
        setIsInitializing(false);
        setLoading(false);
      }
    };

    initializeGame();
  }, [setWorld, setPhase, setLoading, searchParams]);

  // Handle escape key for pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (phase === 'combat') {
          setPaused(!isPaused);
          if (!isPaused) {
            document.exitPointerLock();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, setPaused, phase]);

  const handleStartCombat = useCallback(() => {
    setPhase('intermission');
    useGameStore.setState({ currentWave: 0 });
  }, [setPhase]);

  if (isLoading || isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a]">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
          <p className="text-lg font-medium text-white">
            {isInitializing ? 'Generating Mission...' : 'Loading Arena...'}
          </p>
          <p className="text-sm text-white/50 mt-2">AI is designing your combat experience</p>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#0a0a1a]">
      <Suspense fallback={null}>
        <GameCanvas />
      </Suspense>

      {/* HUD */}
      <HUD />

      {/* Briefing */}
      {phase === 'briefing' && <MissionBriefing onStart={handleStartCombat} />}

      {/* Pause Menu */}
      {isPaused && phase === 'combat' && <PauseMenu />}

      {/* Victory */}
      {phase === 'victory' && <VictoryScreen />}

      {/* Defeat */}
      {phase === 'defeat' && <DefeatScreen />}
    </main>
  );
}

// ============================================
// Game Page
// ============================================
export default function GamePage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a]">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-4 border-red-500 border-t-transparent animate-spin" />
            <p className="text-lg font-medium text-white">Initializing AI Arena...</p>
          </div>
        </div>
      }
    >
      <GamePageContent />
    </Suspense>
  );
}

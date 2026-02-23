'use client';

import { useEffect, useState } from 'react';
import { useFPSStore } from '@/lib/store/fpsStore';
import { useGameStore } from '@/lib/store/gameStore';
import { Badge } from './badge';
import { Card } from './card';

export function FPSHUD() {
  const health = useFPSStore((s) => s.health);
  const maxHealth = useFPSStore((s) => s.maxHealth);
  const currentAmmo = useFPSStore((s) => s.currentAmmo);
  const reserveAmmo = useFPSStore((s) => s.reserveAmmo);
  const currentWeapon = useFPSStore((s) => s.currentWeapon);
  const isReloading = useFPSStore((s) => s.isReloading);
  const killCount = useFPSStore((s) => s.killCount);
  const currentWave = useFPSStore((s) => s.currentWave);
  const enemyCount = useFPSStore((s) => s.enemies.filter(e => !e.isDead).length);
  const hitMarkerActive = useFPSStore((s) => s.hitMarkerActive);
  const isDead = useFPSStore((s) => s.isDead);
  const respawn = useFPSStore((s) => s.respawn);
  const startWave = useFPSStore((s) => s.startWave);
  const isPaused = useGameStore((s) => s.isPaused);
  const setPaused = useGameStore((s) => s.setPaused);

  const [pointerLocked, setPointerLocked] = useState(false);

  const healthPercent = (health / maxHealth) * 100;

  useEffect(() => {
    const handlePointerLockChange = () => {
      setPointerLocked(document.pointerLockElement !== null);
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        setPaused(!isPaused);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPaused, setPaused]);

  // Start first wave automatically
  useEffect(() => {
    if (currentWave === 0 && !isDead) {
      setTimeout(() => startWave(1), 2000);
    }
  }, [currentWave, isDead, startWave]);

  // Start next wave when all enemies are dead
  useEffect(() => {
    if (currentWave > 0 && enemyCount === 0 && !isDead) {
      setTimeout(() => {
        startWave(currentWave + 1);
      }, 3000);
    }
  }, [enemyCount, currentWave, isDead, startWave]);

  if (isDead) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <Card className="p-8 text-center">
          <h1 className="text-4xl font-bold text-red-500 mb-4">YOU DIED</h1>
          <p className="text-xl mb-2">Wave: {currentWave}</p>
          <p className="text-xl mb-6">Kills: {killCount}</p>
          <button
            onClick={() => respawn()}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-lg"
          >
            RESPAWN
          </button>
        </Card>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <Card className="p-8 text-center">
          <h1 className="text-4xl font-bold mb-6">PAUSED</h1>
          <div className="space-y-4 text-left mb-6">
            <p><strong>WASD</strong> - Move</p>
            <p><strong>Mouse</strong> - Look</p>
            <p><strong>Left Click</strong> - Shoot</p>
            <p><strong>R</strong> - Reload</p>
            <p><strong>Shift</strong> - Sprint</p>
            <p><strong>Space</strong> - Jump</p>
            <p><strong>ESC</strong> - Pause</p>
          </div>
          <button
            onClick={() => setPaused(false)}
            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-bold"
          >
            RESUME
          </button>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Crosshair */}
      <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
        <div className="relative w-8 h-8">
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          {/* Top line */}
          <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-white transform -translate-x-1/2" />
          {/* Bottom line */}
          <div className="absolute bottom-0 left-1/2 w-0.5 h-2 bg-white transform -translate-x-1/2" />
          {/* Left line */}
          <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-white transform -translate-y-1/2" />
          {/* Right line */}
          <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-white transform -translate-y-1/2" />
        </div>
      </div>

      {/* Hit marker */}
      {hitMarkerActive && (
        <div className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center">
          <div className="relative w-12 h-12">
            {/* X shape for hit confirmation */}
            <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
              <div className="text-red-500 text-4xl font-bold">×</div>
            </div>
          </div>
        </div>
      )}

      {/* Health Bar - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-40">
        <Card className="p-4 bg-black/70 border-2 border-white/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-bold text-sm">HEALTH</span>
              <span className="text-white font-bold text-sm">{health}</span>
            </div>
            <div className="w-48 h-6 bg-gray-800 rounded-lg overflow-hidden border-2 border-white/30">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${healthPercent}%`,
                  backgroundColor: healthPercent > 50 ? '#00FF00' : healthPercent > 25 ? '#FFFF00' : '#FF0000',
                }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Ammo Counter - Bottom Right */}
      <div className="fixed bottom-6 right-6 z-40">
        <Card className="p-4 bg-black/70 border-2 border-white/20">
          <div className="text-center">
            <div className="text-white font-bold text-xs mb-1">{currentWeapon.name.toUpperCase()}</div>
            <div className="flex items-end justify-center gap-2">
              <span className={`text-5xl font-bold ${currentAmmo === 0 ? 'text-red-500' : 'text-white'}`}>
                {currentAmmo}
              </span>
              <span className="text-2xl text-white/60 pb-2">/ {reserveAmmo}</span>
            </div>
            {isReloading && (
              <div className="mt-2 text-yellow-400 font-bold text-sm animate-pulse">
                RELOADING...
              </div>
            )}
            {currentAmmo === 0 && !isReloading && (
              <div className="mt-2 text-red-500 font-bold text-sm animate-pulse">
                PRESS R TO RELOAD
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Wave Info - Top Center */}
      <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-40">
        <Card className="p-4 bg-black/70 border-2 border-white/20">
          <div className="text-center space-y-1">
            <div className="text-white font-bold text-xl">WAVE {currentWave}</div>
            <div className="flex gap-4 text-sm">
              <Badge variant="destructive" className="bg-red-500">
                ENEMIES: {enemyCount}
              </Badge>
              <Badge variant="default" className="bg-green-500">
                KILLS: {killCount}
              </Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Pointer Lock Prompt */}
      {!pointerLocked && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 z-40">
          <Card className="p-6 bg-black/80 border-2 border-white/40 text-center">
            <p className="text-white font-bold text-lg mb-2">Click to play</p>
            <p className="text-white/60 text-sm">Press ESC to unlock cursor</p>
          </Card>
        </div>
      )}

      {/* Wave Start Notification */}
      {enemyCount === 0 && currentWave > 0 && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40">
          <Card className="p-8 bg-black/80 border-2 border-yellow-400 text-center">
            <h2 className="text-4xl font-bold text-yellow-400 mb-2">WAVE {currentWave} COMPLETE!</h2>
            <p className="text-white text-xl">Next wave starting...</p>
          </Card>
        </div>
      )}

      {/* Controls hint - Top Left */}
      <div className="fixed top-6 left-6 z-40">
        <Card className="p-3 bg-black/50 border border-white/20 text-xs">
          <div className="text-white/80 space-y-1">
            <div><strong>ESC</strong> - Menu</div>
            <div><strong>R</strong> - Reload</div>
          </div>
        </Card>
      </div>
    </>
  );
}

export default FPSHUD;

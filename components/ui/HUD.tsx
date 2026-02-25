'use client';

import { useEffect, useState, useRef } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';

// ============================================
// Crosshair
// ============================================
function Crosshair() {
  const isReloading = usePlayerStore((s) => s.isReloading);
  const lastFireTime = usePlayerStore((s) => s.lastFireTime);
  const pointerLocked = useGameStore((s) => s.pointerLocked);

  if (!pointerLocked) return null;

  const recentFire = Date.now() - lastFireTime < 100;
  const spreadSize = recentFire ? 18 : 12;
  const color = isReloading ? '#FFAA00' : '#FFFFFF';

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-50">
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: 3,
          height: 3,
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}`,
        }}
      />
      {/* Top */}
      <div
        className="absolute transition-all duration-75"
        style={{
          width: 2,
          height: 10,
          backgroundColor: color,
          top: `calc(50% - ${spreadSize + 10}px)`,
          left: 'calc(50% - 1px)',
          boxShadow: `0 0 3px rgba(0,0,0,0.5)`,
        }}
      />
      {/* Bottom */}
      <div
        className="absolute transition-all duration-75"
        style={{
          width: 2,
          height: 10,
          backgroundColor: color,
          top: `calc(50% + ${spreadSize}px)`,
          left: 'calc(50% - 1px)',
          boxShadow: `0 0 3px rgba(0,0,0,0.5)`,
        }}
      />
      {/* Left */}
      <div
        className="absolute transition-all duration-75"
        style={{
          width: 10,
          height: 2,
          backgroundColor: color,
          top: 'calc(50% - 1px)',
          left: `calc(50% - ${spreadSize + 10}px)`,
          boxShadow: `0 0 3px rgba(0,0,0,0.5)`,
        }}
      />
      {/* Right */}
      <div
        className="absolute transition-all duration-75"
        style={{
          width: 10,
          height: 2,
          backgroundColor: color,
          top: 'calc(50% - 1px)',
          left: `calc(50% + ${spreadSize}px)`,
          boxShadow: `0 0 3px rgba(0,0,0,0.5)`,
        }}
      />
    </div>
  );
}

// ============================================
// Health Bar
// ============================================
function HealthBar() {
  const health = usePlayerStore((s) => s.health);
  const maxHealth = usePlayerStore((s) => s.maxHealth);
  const armor = usePlayerStore((s) => s.armor);
  const maxArmor = usePlayerStore((s) => s.maxArmor);
  const lastDamageTime = useGameStore((s) => s.lastDamageTime);

  const healthPercent = (health / maxHealth) * 100;
  const armorPercent = (armor / maxArmor) * 100;
  const recentDamage = Date.now() - lastDamageTime < 500;

  const healthColor = healthPercent > 60 ? '#00FF44' : healthPercent > 30 ? '#FFAA00' : '#FF3333';

  return (
    <div className={`space-y-1.5 ${recentDamage ? 'animate-pulse' : ''}`}>
      {/* Health */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-red-400 w-4">+</span>
        <div className="flex-1 h-3 bg-black/60 rounded-sm overflow-hidden border border-white/10">
          <div
            className="h-full transition-all duration-200 rounded-sm"
            style={{
              width: `${healthPercent}%`,
              backgroundColor: healthColor,
              boxShadow: `0 0 8px ${healthColor}40`,
            }}
          />
        </div>
        <span className="text-xs font-mono font-bold text-white w-8 text-right">{Math.round(health)}</span>
      </div>

      {/* Armor */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-blue-400 w-4">S</span>
        <div className="flex-1 h-2.5 bg-black/60 rounded-sm overflow-hidden border border-white/10">
          <div
            className="h-full bg-blue-500 transition-all duration-200 rounded-sm"
            style={{
              width: `${armorPercent}%`,
              boxShadow: '0 0 8px #4488FF40',
            }}
          />
        </div>
        <span className="text-xs font-mono font-bold text-blue-300 w-8 text-right">{Math.round(armor)}</span>
      </div>
    </div>
  );
}

// ============================================
// Ammo Display
// ============================================
function AmmoDisplay() {
  const weapons = usePlayerStore((s) => s.weapons);
  const currentWeaponIndex = usePlayerStore((s) => s.currentWeaponIndex);
  const ammo = usePlayerStore((s) => s.ammo);
  const reserveAmmo = usePlayerStore((s) => s.reserveAmmo);
  const isReloading = usePlayerStore((s) => s.isReloading);

  const weapon = weapons[currentWeaponIndex];
  if (!weapon) return null;

  const currentAmmo = ammo[weapon.weaponId] || 0;
  const reserve = reserveAmmo[weapon.weaponId] || 0;
  const isLow = currentAmmo <= weapon.stats.magazineSize * 0.25;

  return (
    <div className="text-right">
      <div className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
        {weapon.name}
      </div>
      <div className="flex items-baseline justify-end gap-1">
        <span
          className={`text-3xl font-mono font-black ${
            isReloading ? 'text-yellow-400 animate-pulse' : isLow ? 'text-red-400' : 'text-white'
          }`}
        >
          {isReloading ? 'R' : currentAmmo}
        </span>
        <span className="text-lg font-mono text-white/40">/</span>
        <span className="text-lg font-mono text-white/60">{reserve}</span>
      </div>

      {/* Weapon slots */}
      <div className="flex gap-1 justify-end mt-1.5">
        {weapons.map((w, i) => (
          <div
            key={w.weaponId}
            className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
              i === currentWeaponIndex
                ? 'border-white/60 bg-white/15 text-white'
                : 'border-white/20 bg-black/30 text-white/40'
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Wave Indicator
// ============================================
function WaveIndicator() {
  const currentWave = useGameStore((s) => s.currentWave);
  const totalWaves = useGameStore((s) => s.totalWaves);
  const enemiesAlive = useGameStore((s) => s.enemiesAlive);
  const phase = useGameStore((s) => s.phase);

  if (phase !== 'combat' && phase !== 'intermission') return null;

  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-3 px-4 py-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-white/50">Wave</div>
          <div className="text-xl font-mono font-black text-white">
            {currentWave}/{totalWaves}
          </div>
        </div>
        <div className="w-px h-8 bg-white/20" />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-red-400/80">Enemies</div>
          <div className="text-xl font-mono font-black text-red-400">{enemiesAlive}</div>
        </div>
      </div>

      {phase === 'intermission' && (
        <div className="mt-2 text-sm font-bold text-yellow-400 animate-pulse">
          WAVE INCOMING...
        </div>
      )}
    </div>
  );
}

// ============================================
// Kill Feed
// ============================================
function KillFeed() {
  const killFeed = useGameStore((s) => s.killFeed);

  return (
    <div className="space-y-1">
      {killFeed.slice(0, 5).map((entry) => (
        <div
          key={`${entry.timestamp}`}
          className="flex items-center gap-2 text-xs bg-black/40 backdrop-blur-sm px-3 py-1 rounded animate-in slide-in-from-right duration-200"
        >
          <span className="font-bold text-cyan-400">{entry.killerName}</span>
          <span className="text-white/40">[{entry.weaponType}]</span>
          <span className="font-bold text-red-400">{entry.victimName}</span>
          {entry.isHeadshot && <span className="text-yellow-400 text-[10px]">HEADSHOT</span>}
        </div>
      ))}
    </div>
  );
}

// ============================================
// Score Display
// ============================================
function ScoreDisplay() {
  const score = usePlayerStore((s) => s.score);
  const kills = usePlayerStore((s) => s.kills);

  return (
    <div className="flex items-center gap-4">
      <div className="text-center">
        <div className="text-[9px] uppercase tracking-wider text-white/50">Score</div>
        <div className="text-lg font-mono font-black text-yellow-400">{score.toLocaleString()}</div>
      </div>
      <div className="text-center">
        <div className="text-[9px] uppercase tracking-wider text-white/50">Kills</div>
        <div className="text-lg font-mono font-black text-white">{kills}</div>
      </div>
    </div>
  );
}

// ============================================
// Hit Markers (center screen feedback)
// ============================================
function HitMarkers() {
  const hitMarkers = useGameStore((s) => s.hitMarkers);

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
      {hitMarkers.map((marker) => {
        const age = Date.now() - marker.timestamp;
        const opacity = Math.max(0, 1 - age / 500);
        const scale = 1 + age * 0.002;

        return (
          <div
            key={marker.id}
            className="absolute"
            style={{
              opacity,
              transform: `scale(${scale})`,
            }}
          >
            {/* X-shaped hit marker */}
            <div
              className="w-6 h-0.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45"
              style={{ backgroundColor: marker.isCritical ? '#FFD700' : '#FFFFFF' }}
            />
            <div
              className="w-6 h-0.5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-45"
              style={{ backgroundColor: marker.isCritical ? '#FFD700' : '#FFFFFF' }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// Damage Indicators (directional)
// ============================================
function DamageIndicators() {
  const damageIndicators = useGameStore((s) => s.damageIndicators);
  const health = usePlayerStore((s) => s.health);
  const maxHealth = usePlayerStore((s) => s.maxHealth);

  const isLowHealth = health / maxHealth < 0.3;

  return (
    <div className="fixed inset-0 pointer-events-none z-30">
      {/* Red screen overlay when taking damage */}
      {damageIndicators.length > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: 'radial-gradient(circle, transparent 40%, rgba(255,0,0,0.3) 100%)',
            opacity: damageIndicators.some((d) => Date.now() - d.timestamp < 300) ? 1 : 0,
          }}
        />
      )}

      {/* Low health overlay */}
      {isLowHealth && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            background: 'radial-gradient(circle, transparent 30%, rgba(255,0,0,0.2) 100%)',
          }}
        />
      )}

      {/* Directional indicators */}
      {damageIndicators.map((indicator) => {
        const age = Date.now() - indicator.timestamp;
        const opacity = Math.max(0, 1 - age / 1500);

        return (
          <div
            key={indicator.id}
            className="absolute top-1/2 left-1/2 w-48 h-48 -translate-x-1/2 -translate-y-1/2"
            style={{
              opacity,
              transform: `translate(-50%, -50%) rotate(${indicator.direction}rad)`,
            }}
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-16"
              style={{
                background: 'linear-gradient(180deg, rgba(255,50,50,0.8) 0%, transparent 100%)',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// FPS Counter
// ============================================
function FPSCounter() {
  const [fps, setFps] = useState(60);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }
      requestAnimationFrame(measureFPS);
    };

    const animId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animId);
  }, []);

  const fpsColor = fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';

  return <div className={`text-[10px] font-mono ${fpsColor} opacity-60`}>{fps} FPS</div>;
}

// ============================================
// Click to Start Overlay
// ============================================
function ClickToStart() {
  const pointerLocked = useGameStore((s) => s.pointerLocked);
  const phase = useGameStore((s) => s.phase);
  const isPaused = useGameStore((s) => s.isPaused);

  if (pointerLocked || phase !== 'combat' || isPaused) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-black/70 backdrop-blur-sm px-8 py-4 rounded-lg border border-white/20 animate-pulse pointer-events-auto cursor-pointer">
        <p className="text-white text-lg font-bold">Click to Play</p>
        <p className="text-white/60 text-xs mt-1 text-center">ESC to pause</p>
      </div>
    </div>
  );
}

// ============================================
// Controls Help
// ============================================
function ControlsHelp() {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <button
        className="text-[10px] text-white/40 hover:text-white/80 transition-colors font-mono"
        onClick={() => setShow(!show)}
      >
        [?] Controls
      </button>
      {show && (
        <div className="absolute bottom-6 left-0 bg-black/80 backdrop-blur-sm p-3 rounded-lg border border-white/10 text-[10px] space-y-1 w-44 animate-in fade-in duration-150">
          <div className="flex justify-between text-white/70">
            <span>Move</span>
            <span className="font-mono text-white/50">WASD</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Look</span>
            <span className="font-mono text-white/50">Mouse</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Shoot</span>
            <span className="font-mono text-white/50">LMB</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Sprint</span>
            <span className="font-mono text-white/50">Shift</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Reload</span>
            <span className="font-mono text-white/50">R</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Switch Gun</span>
            <span className="font-mono text-white/50">1-9 / Scroll</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>Pause</span>
            <span className="font-mono text-white/50">ESC</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Main HUD Component
// ============================================
export function HUD() {
  const isPlaying = useGameStore((s) => s.isPlaying);
  const phase = useGameStore((s) => s.phase);
  const cleanupFeedback = useGameStore((s) => s.cleanupFeedback);

  // Periodically clean up old feedback
  useEffect(() => {
    const interval = setInterval(cleanupFeedback, 200);
    return () => clearInterval(interval);
  }, [cleanupFeedback]);

  if (!isPlaying || phase === 'menu' || phase === 'loading') return null;

  return (
    <div className="hud-overlay fixed inset-0 pointer-events-none z-40">
      {/* Crosshair */}
      <Crosshair />

      {/* Hit markers */}
      <HitMarkers />

      {/* Damage indicators */}
      <DamageIndicators />

      {/* Click to start overlay */}
      <ClickToStart />

      {/* Top center - Wave info */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <WaveIndicator />
      </div>

      {/* Top left - Score */}
      <div className="absolute top-4 left-4 pointer-events-auto">
        <ScoreDisplay />
      </div>

      {/* Top right - Kill feed */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <KillFeed />
      </div>

      {/* Bottom left - Health/Armor */}
      <div className="absolute bottom-4 left-4 w-56 pointer-events-auto">
        <HealthBar />
        <div className="mt-2 flex items-center justify-between">
          <ControlsHelp />
          <FPSCounter />
        </div>
      </div>

      {/* Bottom right - Ammo */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <AmmoDisplay />
      </div>

      {/* Corner accents - tactical style */}
      <div className="absolute top-0 left-0 w-16 h-16 border-l border-t border-white/10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-16 h-16 border-r border-t border-white/10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-16 h-16 border-l border-b border-white/10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-16 h-16 border-r border-b border-white/10 pointer-events-none" />
    </div>
  );
}

export default HUD;

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  TimeOfDay,
  InteractionPrompt,
  GamePhase,
  EnemyInstance,
  EnemyType,
  Projectile,
  KillFeedEntry,
  HitMarker,
  DamageIndicator,
  WaveConfig,
  WorldRecipe,
  DamageEvent,
} from '@/types/game';

// ============================================
// Game Store - Core FPS game state
// ============================================

interface GameState {
  // Game status
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  phase: GamePhase;

  // Time / atmosphere
  timeOfDay: TimeOfDay;
  playTimeSeconds: number;

  // World data
  world: WorldRecipe | null;

  // Wave system
  currentWave: number;
  totalWaves: number;
  waveStartTime: number;
  intermissionEndTime: number;
  missionStartTime: number;

  // Enemies
  enemies: EnemyInstance[];
  enemyTypes: EnemyType[];
  enemiesAlive: number;
  totalEnemiesKilled: number;

  // Projectiles
  projectiles: Projectile[];

  // Combat feedback
  killFeed: KillFeedEntry[];
  hitMarkers: HitMarker[];
  damageIndicators: DamageIndicator[];
  lastDamageTime: number;

  // UI state
  interactionPrompt: InteractionPrompt;
  showScoreboard: boolean;
  pointerLocked: boolean;

  // Actions
  setIsPlaying: (playing: boolean) => void;
  setPaused: (paused: boolean) => void;
  setLoading: (loading: boolean) => void;
  setPhase: (phase: GamePhase) => void;
  setPointerLocked: (locked: boolean) => void;

  setWorld: (world: WorldRecipe) => void;
  setTimeOfDay: (time: TimeOfDay) => void;
  advanceTime: (deltaSeconds: number) => void;

  // Wave management
  startWave: (waveNumber: number) => void;
  endWave: () => void;
  startIntermission: (duration: number) => void;

  // Enemy management
  spawnEnemies: (enemies: EnemyInstance[], types: EnemyType[]) => void;
  updateEnemy: (instanceId: string, updates: Partial<EnemyInstance>) => void;
  damageEnemy: (instanceId: string, damage: number, sourceId: string) => DamageEvent | null;
  killEnemy: (instanceId: string, killerName: string, weaponType: string) => void;
  removeEnemy: (instanceId: string) => void;

  // Projectile management
  addProjectile: (projectile: Projectile) => void;
  removeProjectile: (projectileId: string) => void;
  clearProjectiles: () => void;

  // Combat feedback
  addKillFeedEntry: (entry: KillFeedEntry) => void;
  addHitMarker: (marker: HitMarker) => void;
  addDamageIndicator: (indicator: DamageIndicator) => void;
  cleanupFeedback: () => void;

  // UI
  showInteractionPrompt: (text: string, targetId?: string, targetType?: 'pickup' | 'terminal' | 'door') => void;
  hideInteractionPrompt: () => void;
  toggleScoreboard: () => void;

  reset: () => void;
}

const initialState = {
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  phase: 'menu' as GamePhase,

  timeOfDay: 'day' as TimeOfDay,
  playTimeSeconds: 0,

  world: null as WorldRecipe | null,

  currentWave: 0,
  totalWaves: 0,
  waveStartTime: 0,
  intermissionEndTime: 0,
  missionStartTime: 0,

  enemies: [] as EnemyInstance[],
  enemyTypes: [] as EnemyType[],
  enemiesAlive: 0,
  totalEnemiesKilled: 0,

  projectiles: [] as Projectile[],

  killFeed: [] as KillFeedEntry[],
  hitMarkers: [] as HitMarker[],
  damageIndicators: [] as DamageIndicator[],
  lastDamageTime: 0,

  interactionPrompt: {
    visible: false,
    text: '',
    targetId: undefined,
    targetType: undefined,
  } as InteractionPrompt,

  showScoreboard: false,
  pointerLocked: false,
};

// Time of day phases
const TIME_PHASES: { start: number; end: number; phase: TimeOfDay }[] = [
  { start: 0, end: 360, phase: 'morning' },
  { start: 360, end: 720, phase: 'day' },
  { start: 720, end: 1080, phase: 'evening' },
  { start: 1080, end: 1440, phase: 'night' },
];

function getTimeOfDay(seconds: number): TimeOfDay {
  const normalized = seconds % 1440;
  for (const p of TIME_PHASES) {
    if (normalized >= p.start && normalized < p.end) return p.phase;
  }
  return 'day';
}

export const useGameStore = create<GameState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setIsPlaying: (playing) => set({ isPlaying: playing }),
    setPaused: (paused) => set({ isPaused: paused }),
    setLoading: (loading) => set({ isLoading: loading }),
    setPhase: (phase) => set({ phase }),
    setPointerLocked: (locked) => set({ pointerLocked: locked }),

    setWorld: (world) => set({ world }),
    setTimeOfDay: (time) => set({ timeOfDay: time }),

    advanceTime: (deltaSeconds) => {
      const { playTimeSeconds, isPaused } = get();
      if (isPaused) return;
      const newTime = playTimeSeconds + deltaSeconds;
      set({
        playTimeSeconds: newTime,
        timeOfDay: getTimeOfDay(newTime),
      });
    },

    // Wave management
    startWave: (waveNumber) => {
      set({
        currentWave: waveNumber,
        phase: 'combat',
        waveStartTime: Date.now(),
      });
    },

    endWave: () => {
      const { currentWave, totalWaves } = get();
      if (currentWave >= totalWaves) {
        set({ phase: 'victory' });
      } else {
        set({ phase: 'intermission' });
      }
    },

    startIntermission: (duration) => {
      set({
        phase: 'intermission',
        intermissionEndTime: Date.now() + duration * 1000,
      });
    },

    // Enemy management
    spawnEnemies: (enemies, types) => {
      set((state) => ({
        enemies: [...state.enemies, ...enemies],
        enemyTypes: types.length > 0 ? types : state.enemyTypes,
        enemiesAlive: state.enemiesAlive + enemies.length,
      }));
    },

    updateEnemy: (instanceId, updates) => {
      set((state) => ({
        enemies: state.enemies.map((e) =>
          e.instanceId === instanceId ? { ...e, ...updates } : e
        ),
      }));
    },

    damageEnemy: (instanceId, damage, sourceId) => {
      const state = get();
      const enemy = state.enemies.find((e) => e.instanceId === instanceId);
      if (!enemy || !enemy.isAlive) return null;

      const newHealth = Math.max(0, enemy.health - damage);
      const isKill = newHealth <= 0;

      set((s) => ({
        enemies: s.enemies.map((e) =>
          e.instanceId === instanceId
            ? { ...e, health: newHealth, isAlive: !isKill }
            : e
        ),
        enemiesAlive: isKill ? s.enemiesAlive - 1 : s.enemiesAlive,
        totalEnemiesKilled: isKill ? s.totalEnemiesKilled + 1 : s.totalEnemiesKilled,
      }));

      return {
        targetId: instanceId,
        sourceId,
        damage,
        position: enemy.position,
        isHeadshot: false,
        isCritical: damage > 50,
        timestamp: Date.now(),
      };
    },

    killEnemy: (instanceId, killerName, weaponType) => {
      const state = get();
      const enemy = state.enemies.find((e) => e.instanceId === instanceId);
      if (!enemy) return;

      const enemyType = state.enemyTypes.find((t) => t.enemyTypeId === enemy.typeId);

      const entry: KillFeedEntry = {
        killerId: 'player',
        killerName,
        victimId: instanceId,
        victimName: enemyType?.name || 'Enemy',
        weaponType: weaponType as any,
        isHeadshot: false,
        timestamp: Date.now(),
      };

      set((s) => ({
        killFeed: [entry, ...s.killFeed].slice(0, 8),
      }));
    },

    removeEnemy: (instanceId) => {
      set((state) => ({
        enemies: state.enemies.filter((e) => e.instanceId !== instanceId),
      }));
    },

    // Projectile management
    addProjectile: (projectile) => {
      set((state) => ({
        projectiles: [...state.projectiles, projectile],
      }));
    },

    removeProjectile: (projectileId) => {
      set((state) => ({
        projectiles: state.projectiles.filter((p) => p.projectileId !== projectileId),
      }));
    },

    clearProjectiles: () => set({ projectiles: [] }),

    // Combat feedback
    addKillFeedEntry: (entry) => {
      set((state) => ({
        killFeed: [entry, ...state.killFeed].slice(0, 8),
      }));
    },

    addHitMarker: (marker) => {
      set((state) => ({
        hitMarkers: [...state.hitMarkers, marker],
      }));
    },

    addDamageIndicator: (indicator) => {
      set((state) => ({
        damageIndicators: [...state.damageIndicators, indicator],
        lastDamageTime: Date.now(),
      }));
    },

    cleanupFeedback: () => {
      const now = Date.now();
      set((state) => ({
        killFeed: state.killFeed.filter((e) => now - e.timestamp < 5000),
        hitMarkers: state.hitMarkers.filter((m) => now - m.timestamp < 500),
        damageIndicators: state.damageIndicators.filter((d) => now - d.timestamp < 1500),
      }));
    },

    // UI
    showInteractionPrompt: (text, targetId, targetType) =>
      set({
        interactionPrompt: { visible: true, text, targetId, targetType },
      }),

    hideInteractionPrompt: () =>
      set({
        interactionPrompt: { visible: false, text: '', targetId: undefined, targetType: undefined },
      }),

    toggleScoreboard: () =>
      set((state) => ({ showScoreboard: !state.showScoreboard })),

    reset: () => set(initialState),
  }))
);

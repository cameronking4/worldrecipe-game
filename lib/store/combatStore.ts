import { create } from 'zustand';

export type EnemyVariant = 'sprout' | 'ember' | 'shroom';

export interface CombatEnemy {
  enemyId: string;
  name: string;
  variant: EnemyVariant;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  speed: number;
  alive: boolean;
  lastAttackAt: number;
}

interface CombatState {
  enemies: CombatEnemy[];
  playerHealth: number;
  maxPlayerHealth: number;
  ammoInMag: number;
  magSize: number;
  reserveAmmo: number;
  killCount: number;
  aiDirectorLine: string;
  pointerLocked: boolean;

  initializeEncounter: (seed: string, mapWidth: number, mapHeight: number) => void;
  setEnemyPosition: (enemyId: string, position: [number, number, number]) => void;
  markEnemyAttack: (enemyId: string, timestamp: number) => void;
  damageEnemy: (enemyId: string, amount: number) => { defeated: boolean };
  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;
  consumeAmmo: () => boolean;
  reload: () => void;
  grantAmmo: (amount: number) => void;
  setDirectorLine: (line: string) => void;
  setPointerLocked: (locked: boolean) => void;
  resetCombat: () => void;
}

const makeSeededRandom = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  return () => {
    hash = Math.imul(1664525, hash) + 1013904223;
    return ((hash >>> 0) % 10000) / 10000;
  };
};

const initialCombatState = {
  enemies: [] as CombatEnemy[],
  playerHealth: 100,
  maxPlayerHealth: 100,
  ammoInMag: 24,
  magSize: 24,
  reserveAmmo: 96,
  killCount: 0,
  aiDirectorLine: 'Director AI: Sweep the perimeter and secure ingredients.',
  pointerLocked: false,
};

export const useCombatStore = create<CombatState>((set, get) => ({
  ...initialCombatState,

  initializeEncounter: (seed, mapWidth, mapHeight) => {
    const random = makeSeededRandom(seed || 'worldrecipe-fps');
    const variants: EnemyVariant[] = ['sprout', 'ember', 'shroom'];
    const namesByVariant: Record<EnemyVariant, string[]> = {
      sprout: ['Sprout Sneaker', 'Leaf Raider'],
      ember: ['Pepper Ember', 'Char Hopper'],
      shroom: ['Moss Stalker', 'Cap Bandit'],
    };

    const enemyCount = 7;
    const spawnRadius = Math.max(12, Math.min(mapWidth, mapHeight) * 0.42);

    const enemies: CombatEnemy[] = Array.from({ length: enemyCount }).map((_, idx) => {
      const variant = variants[idx % variants.length];
      const angle = random() * Math.PI * 2;
      const distance = 8 + random() * (spawnRadius - 8);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      return {
        enemyId: `enemy_${idx + 1}`,
        name: namesByVariant[variant][idx % namesByVariant[variant].length],
        variant,
        position: [x, 0.55, z],
        health: 90,
        maxHealth: 90,
        speed: 1.2 + random() * 0.7,
        alive: true,
        lastAttackAt: 0,
      };
    });

    set({
      ...initialCombatState,
      enemies,
      aiDirectorLine: 'Director AI: Hostiles detected. Keep moving and keep cooking.',
    });
  },

  setEnemyPosition: (enemyId, position) => {
    set((state) => ({
      enemies: state.enemies.map((enemy) => (
        enemy.enemyId === enemyId ? { ...enemy, position } : enemy
      )),
    }));
  },

  markEnemyAttack: (enemyId, timestamp) => {
    set((state) => ({
      enemies: state.enemies.map((enemy) => (
        enemy.enemyId === enemyId ? { ...enemy, lastAttackAt: timestamp } : enemy
      )),
    }));
  },

  damageEnemy: (enemyId, amount) => {
    let defeated = false;

    set((state) => ({
      enemies: state.enemies.map((enemy) => {
        if (enemy.enemyId !== enemyId || !enemy.alive) {
          return enemy;
        }

        const nextHealth = Math.max(0, enemy.health - amount);
        const nextAlive = nextHealth > 0;
        if (!nextAlive) {
          defeated = true;
        }

        return {
          ...enemy,
          health: nextHealth,
          alive: nextAlive,
        };
      }),
      killCount: defeated ? state.killCount + 1 : state.killCount,
    }));

    return { defeated };
  },

  damagePlayer: (amount) => {
    set((state) => ({
      playerHealth: Math.max(0, state.playerHealth - amount),
    }));
  },

  healPlayer: (amount) => {
    set((state) => ({
      playerHealth: Math.min(state.maxPlayerHealth, state.playerHealth + amount),
    }));
  },

  consumeAmmo: () => {
    const { ammoInMag } = get();
    if (ammoInMag <= 0) return false;

    set((state) => ({ ammoInMag: state.ammoInMag - 1 }));
    return true;
  },

  reload: () => {
    set((state) => {
      if (state.ammoInMag >= state.magSize || state.reserveAmmo <= 0) {
        return state;
      }

      const needed = state.magSize - state.ammoInMag;
      const refill = Math.min(needed, state.reserveAmmo);

      return {
        ammoInMag: state.ammoInMag + refill,
        reserveAmmo: state.reserveAmmo - refill,
      };
    });
  },

  grantAmmo: (amount) => {
    set((state) => ({
      reserveAmmo: Math.min(300, state.reserveAmmo + Math.max(0, amount)),
    }));
  },

  setDirectorLine: (line) => set({ aiDirectorLine: line }),
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
  resetCombat: () => set(initialCombatState),
}));

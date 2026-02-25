import { create } from 'zustand';

export type CombatEventType = 'enemy_down' | 'player_hit' | 'low_ammo' | 'critical_health' | 'reloaded';

export interface CombatEvent {
  id: number;
  type: CombatEventType;
  timestamp: number;
  payload?: Record<string, number | string>;
}

interface CombatState {
  health: number;
  maxHealth: number;
  ammoInMag: number;
  magSize: number;
  reserveAmmo: number;
  isReloading: boolean;
  fireCooldownMs: number;
  lastShotAt: number;
  kills: number;
  score: number;
  pointerLocked: boolean;
  lastEvent: CombatEvent | null;
  nextEventId: number;
  shoot: () => boolean;
  reload: () => void;
  takeDamage: (amount: number) => void;
  heal: (amount: number) => void;
  addKill: () => void;
  setPointerLocked: (locked: boolean) => void;
  pushEvent: (type: CombatEventType, payload?: Record<string, number | string>) => void;
  resetCombat: () => void;
}

const initialState = {
  health: 100,
  maxHealth: 100,
  ammoInMag: 24,
  magSize: 24,
  reserveAmmo: 120,
  isReloading: false,
  fireCooldownMs: 120,
  lastShotAt: 0,
  kills: 0,
  score: 0,
  pointerLocked: false,
  lastEvent: null as CombatEvent | null,
  nextEventId: 1,
};

export const useCombatStore = create<CombatState>((set, get) => ({
  ...initialState,

  pushEvent: (type, payload) => {
    const id = get().nextEventId;
    set({
      lastEvent: {
        id,
        type,
        timestamp: Date.now(),
        payload,
      },
      nextEventId: id + 1,
    });
  },

  shoot: () => {
    const state = get();
    const now = Date.now();

    if (state.health <= 0 || state.isReloading) return false;
    if (state.ammoInMag <= 0) {
      state.pushEvent('low_ammo', { ammo: 0 });
      return false;
    }
    if (now - state.lastShotAt < state.fireCooldownMs) return false;

    const nextAmmo = state.ammoInMag - 1;
    set({
      ammoInMag: nextAmmo,
      lastShotAt: now,
    });

    if (nextAmmo <= 3) {
      get().pushEvent('low_ammo', { ammo: nextAmmo });
    }

    return true;
  },

  reload: () => {
    const state = get();
    if (state.isReloading || state.ammoInMag >= state.magSize || state.reserveAmmo <= 0 || state.health <= 0) {
      return;
    }

    set({ isReloading: true });

    setTimeout(() => {
      const current = get();
      const needed = current.magSize - current.ammoInMag;
      const reloadAmount = Math.min(needed, current.reserveAmmo);

      set({
        ammoInMag: current.ammoInMag + reloadAmount,
        reserveAmmo: current.reserveAmmo - reloadAmount,
        isReloading: false,
      });

      get().pushEvent('reloaded', { ammo: get().ammoInMag });
    }, 1050);
  },

  takeDamage: (amount) => {
    const state = get();
    const nextHealth = Math.max(0, state.health - amount);
    set({ health: nextHealth });

    if (nextHealth < 30) {
      state.pushEvent('critical_health', { health: nextHealth });
    } else {
      state.pushEvent('player_hit', { health: nextHealth, damage: amount });
    }
  },

  heal: (amount) => {
    const state = get();
    set({ health: Math.min(state.maxHealth, state.health + amount) });
  },

  addKill: () => {
    const state = get();
    const nextKills = state.kills + 1;
    set({
      kills: nextKills,
      score: state.score + 100,
    });
    state.pushEvent('enemy_down', { kills: nextKills, score: state.score + 100 });
  },

  setPointerLocked: (locked) => set({ pointerLocked: locked }),

  resetCombat: () => set(initialState),
}));

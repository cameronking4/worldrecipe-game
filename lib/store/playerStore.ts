import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Weapon, WeaponType } from '@/types/game';

// ============================================
// Player Store - FPS player state
// ============================================

// Default starting pistol
const DEFAULT_PISTOL: Weapon = {
  weaponId: 'weapon_pistol_default',
  name: 'Sidearm P7',
  description: 'Reliable standard-issue pistol',
  type: 'pistol',
  stats: {
    damage: 20,
    fireRate: 4,
    reloadTime: 1.2,
    magazineSize: 12,
    maxAmmo: 120,
    spread: 0.02,
    range: 50,
    projectileSpeed: 80,
    knockback: 2,
  },
  rarity: 'common',
  color: '#8899AA',
};

interface PlayerState {
  // Position and look
  position: [number, number, number];
  rotation: [number, number]; // [yaw, pitch]
  isMoving: boolean;
  isSprinting: boolean;
  moveDirection: { x: number; z: number };

  // Combat
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;

  // Weapons
  weapons: Weapon[];
  currentWeaponIndex: number;
  ammo: Record<string, number>; // weaponId -> magazine ammo
  reserveAmmo: Record<string, number>; // weaponId -> reserve ammo
  isReloading: boolean;
  reloadStartTime: number;
  lastFireTime: number;

  // Stats
  kills: number;
  deaths: number;
  score: number;
  shotsTotal: number;
  shotsHit: number;

  // Actions - Movement
  setPosition: (pos: [number, number, number]) => void;
  setRotation: (rot: [number, number]) => void;
  setMoving: (moving: boolean) => void;
  setSprinting: (sprinting: boolean) => void;
  setMoveDirection: (dir: { x: number; z: number }) => void;

  // Actions - Combat
  takeDamage: (damage: number) => boolean; // returns true if still alive
  heal: (amount: number) => void;
  addArmor: (amount: number) => void;
  die: () => void;
  respawn: (position: [number, number, number]) => void;

  // Actions - Weapons
  addWeapon: (weapon: Weapon) => void;
  switchWeapon: (index: number) => void;
  nextWeapon: () => void;
  prevWeapon: () => void;
  getCurrentWeapon: () => Weapon | null;
  fire: () => boolean; // returns true if fired successfully
  startReload: () => void;
  finishReload: () => void;
  cancelReload: () => void;
  addAmmo: (weaponId: string, amount: number) => void;
  addAmmoForType: (weaponType: WeaponType, amount: number) => void;

  // Actions - Stats
  addKill: (scoreValue: number) => void;
  recordShot: (hit: boolean) => void;
  getAccuracy: () => number;

  // Restore / Reset
  restoreState: (state: Partial<PlayerState>) => void;
  reset: () => void;
}

const initialState = {
  position: [0, 1.6, 0] as [number, number, number],
  rotation: [0, 0] as [number, number],
  isMoving: false,
  isSprinting: false,
  moveDirection: { x: 0, z: 0 },

  health: 100,
  maxHealth: 100,
  armor: 0,
  maxArmor: 100,

  weapons: [DEFAULT_PISTOL] as Weapon[],
  currentWeaponIndex: 0,
  ammo: { [DEFAULT_PISTOL.weaponId]: DEFAULT_PISTOL.stats.magazineSize } as Record<string, number>,
  reserveAmmo: { [DEFAULT_PISTOL.weaponId]: DEFAULT_PISTOL.stats.maxAmmo } as Record<string, number>,
  isReloading: false,
  reloadStartTime: 0,
  lastFireTime: 0,

  kills: 0,
  deaths: 0,
  score: 0,
  shotsTotal: 0,
  shotsHit: 0,
};

export const usePlayerStore = create<PlayerState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // Movement
    setPosition: (pos) => set({ position: pos }),
    setRotation: (rot) => set({ rotation: rot }),
    setMoving: (moving) => set({ isMoving: moving }),
    setSprinting: (sprinting) => set({ isSprinting: sprinting }),
    setMoveDirection: (dir) => set({ moveDirection: dir }),

    // Combat
    takeDamage: (damage) => {
      const { armor, health } = get();
      let remaining = damage;

      // Armor absorbs 60% of damage
      let armorDamage = 0;
      if (armor > 0) {
        armorDamage = Math.min(armor, remaining * 0.6);
        remaining -= armorDamage;
      }

      const newHealth = Math.max(0, health - remaining);
      const newArmor = Math.max(0, armor - armorDamage);

      set({ health: newHealth, armor: newArmor });
      return newHealth > 0;
    },

    heal: (amount) => {
      const { health, maxHealth } = get();
      set({ health: Math.min(maxHealth, health + amount) });
    },

    addArmor: (amount) => {
      const { armor, maxArmor } = get();
      set({ armor: Math.min(maxArmor, armor + amount) });
    },

    die: () => {
      set((state) => ({
        health: 0,
        deaths: state.deaths + 1,
      }));
    },

    respawn: (position) => {
      set({
        position,
        health: get().maxHealth,
        armor: 0,
        isReloading: false,
      });
    },

    // Weapons
    addWeapon: (weapon) => {
      const { weapons, ammo, reserveAmmo } = get();
      const existing = weapons.find((w) => w.weaponId === weapon.weaponId);
      if (existing) {
        // Already have it - add ammo instead
        set({
          reserveAmmo: {
            ...reserveAmmo,
            [weapon.weaponId]: (reserveAmmo[weapon.weaponId] || 0) + weapon.stats.magazineSize,
          },
        });
        return;
      }

      set({
        weapons: [...weapons, weapon],
        ammo: { ...ammo, [weapon.weaponId]: weapon.stats.magazineSize },
        reserveAmmo: { ...reserveAmmo, [weapon.weaponId]: weapon.stats.maxAmmo },
        currentWeaponIndex: weapons.length, // auto-switch
      });
    },

    switchWeapon: (index) => {
      const { weapons, isReloading } = get();
      if (index < 0 || index >= weapons.length) return;
      if (isReloading) {
        set({ isReloading: false, reloadStartTime: 0 });
      }
      set({ currentWeaponIndex: index });
    },

    nextWeapon: () => {
      const { weapons, currentWeaponIndex } = get();
      if (weapons.length <= 1) return;
      const next = (currentWeaponIndex + 1) % weapons.length;
      get().switchWeapon(next);
    },

    prevWeapon: () => {
      const { weapons, currentWeaponIndex } = get();
      if (weapons.length <= 1) return;
      const prev = (currentWeaponIndex - 1 + weapons.length) % weapons.length;
      get().switchWeapon(prev);
    },

    getCurrentWeapon: () => {
      const { weapons, currentWeaponIndex } = get();
      return weapons[currentWeaponIndex] || null;
    },

    fire: () => {
      const { weapons, currentWeaponIndex, ammo, isReloading, lastFireTime } = get();
      const weapon = weapons[currentWeaponIndex];
      if (!weapon || isReloading) return false;

      const currentAmmo = ammo[weapon.weaponId] || 0;
      if (currentAmmo <= 0) {
        // Auto-reload
        get().startReload();
        return false;
      }

      // Check fire rate
      const now = Date.now();
      const fireInterval = 1000 / weapon.stats.fireRate;
      if (now - lastFireTime < fireInterval) return false;

      set({
        ammo: { ...ammo, [weapon.weaponId]: currentAmmo - 1 },
        lastFireTime: now,
      });

      return true;
    },

    startReload: () => {
      const { weapons, currentWeaponIndex, ammo, reserveAmmo, isReloading } = get();
      if (isReloading) return;

      const weapon = weapons[currentWeaponIndex];
      if (!weapon) return;

      const currentAmmo = ammo[weapon.weaponId] || 0;
      const reserve = reserveAmmo[weapon.weaponId] || 0;

      if (currentAmmo >= weapon.stats.magazineSize || reserve <= 0) return;

      set({ isReloading: true, reloadStartTime: Date.now() });
    },

    finishReload: () => {
      const { weapons, currentWeaponIndex, ammo, reserveAmmo } = get();
      const weapon = weapons[currentWeaponIndex];
      if (!weapon) return;

      const currentAmmo = ammo[weapon.weaponId] || 0;
      const reserve = reserveAmmo[weapon.weaponId] || 0;
      const needed = weapon.stats.magazineSize - currentAmmo;
      const toLoad = Math.min(needed, reserve);

      set({
        ammo: { ...ammo, [weapon.weaponId]: currentAmmo + toLoad },
        reserveAmmo: { ...reserveAmmo, [weapon.weaponId]: reserve - toLoad },
        isReloading: false,
        reloadStartTime: 0,
      });
    },

    cancelReload: () => {
      set({ isReloading: false, reloadStartTime: 0 });
    },

    addAmmo: (weaponId, amount) => {
      const { reserveAmmo } = get();
      set({
        reserveAmmo: {
          ...reserveAmmo,
          [weaponId]: (reserveAmmo[weaponId] || 0) + amount,
        },
      });
    },

    addAmmoForType: (weaponType, amount) => {
      const { weapons, reserveAmmo } = get();
      const updates: Record<string, number> = {};
      weapons.forEach((w) => {
        if (w.type === weaponType) {
          updates[w.weaponId] = (reserveAmmo[w.weaponId] || 0) + amount;
        }
      });
      if (Object.keys(updates).length > 0) {
        set({ reserveAmmo: { ...reserveAmmo, ...updates } });
      }
    },

    // Stats
    addKill: (scoreValue) => {
      set((state) => ({
        kills: state.kills + 1,
        score: state.score + scoreValue,
      }));
    },

    recordShot: (hit) => {
      set((state) => ({
        shotsTotal: state.shotsTotal + 1,
        shotsHit: hit ? state.shotsHit + 1 : state.shotsHit,
      }));
    },

    getAccuracy: () => {
      const { shotsTotal, shotsHit } = get();
      if (shotsTotal === 0) return 0;
      return Math.round((shotsHit / shotsTotal) * 100);
    },

    restoreState: (state) => {
      set({ ...state });
    },

    reset: () => set(initialState),
  }))
);

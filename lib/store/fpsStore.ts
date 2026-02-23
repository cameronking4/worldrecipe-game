import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// ============================================
// FPS Store - First-Person Shooter mechanics
// ============================================

export type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'sniper';

export interface Weapon {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  fireRate: number; // shots per second
  magazineSize: number;
  reloadTime: number; // seconds
  recoil: number;
  spread: number; // bullet spread angle
  range: number;
}

export interface Enemy {
  id: string;
  name: string;
  health: number;
  maxHealth: number;
  position: [number, number, number];
  isDead: boolean;
  aiType: 'aggressive' | 'defensive' | 'sneaky' | 'boss';
}

interface FPSState {
  // Player combat stats
  health: number;
  maxHealth: number;
  isDead: boolean;

  // Weapon state
  currentWeapon: Weapon;
  weapons: Weapon[];
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  isShooting: boolean;
  lastShotTime: number;

  // Camera/Look controls
  pitch: number; // vertical rotation (up/down)
  yaw: number; // horizontal rotation (left/right)
  mouseSensitivity: number;

  // Enemies
  enemies: Enemy[];
  enemyCount: number;
  killCount: number;

  // Wave system
  currentWave: number;
  waveActive: boolean;

  // Combat effects
  muzzleFlashActive: boolean;
  hitMarkerActive: boolean;

  // Actions
  setHealth: (health: number) => void;
  takeDamage: (damage: number) => void;
  heal: (amount: number) => void;
  die: () => void;
  respawn: () => void;

  // Weapon actions
  switchWeapon: (weaponId: string) => void;
  shoot: () => boolean;
  reload: () => void;
  finishReload: () => void;
  addAmmo: (amount: number) => void;

  // Look actions
  updateLook: (deltaX: number, deltaY: number) => void;
  setPitch: (pitch: number) => void;
  setYaw: (yaw: number) => void;

  // Enemy actions
  addEnemy: (enemy: Enemy) => void;
  removeEnemy: (enemyId: string) => void;
  damageEnemy: (enemyId: string, damage: number) => void;
  updateEnemyPosition: (enemyId: string, position: [number, number, number]) => void;
  clearEnemies: () => void;

  // Wave actions
  startWave: (waveNumber: number) => void;
  endWave: () => void;

  // Combat effects
  showMuzzleFlash: () => void;
  showHitMarker: () => void;

  reset: () => void;
}

// Weapon definitions
const WEAPONS: Record<WeaponType, Weapon> = {
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    type: 'pistol',
    damage: 25,
    fireRate: 3,
    magazineSize: 12,
    reloadTime: 1.5,
    recoil: 0.05,
    spread: 0.02,
    range: 50,
  },
  rifle: {
    id: 'rifle',
    name: 'Assault Rifle',
    type: 'rifle',
    damage: 30,
    fireRate: 8,
    magazineSize: 30,
    reloadTime: 2.5,
    recoil: 0.03,
    spread: 0.015,
    range: 75,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Shotgun',
    type: 'shotgun',
    damage: 15, // per pellet, 8 pellets
    fireRate: 1.2,
    magazineSize: 8,
    reloadTime: 3.0,
    recoil: 0.15,
    spread: 0.1,
    range: 25,
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Rifle',
    type: 'sniper',
    damage: 100,
    fireRate: 0.8,
    magazineSize: 5,
    reloadTime: 3.5,
    recoil: 0.2,
    spread: 0.005,
    range: 150,
  },
};

const initialState = {
  health: 100,
  maxHealth: 100,
  isDead: false,

  currentWeapon: WEAPONS.pistol,
  weapons: [WEAPONS.pistol, WEAPONS.rifle, WEAPONS.shotgun],
  currentAmmo: 12,
  reserveAmmo: 120,
  isReloading: false,
  isShooting: false,
  lastShotTime: 0,

  pitch: 0,
  yaw: 0,
  mouseSensitivity: 0.002,

  enemies: [] as Enemy[],
  enemyCount: 0,
  killCount: 0,

  currentWave: 0,
  waveActive: false,

  muzzleFlashActive: false,
  hitMarkerActive: false,
};

export const useFPSStore = create<FPSState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setHealth: (health) => set({ health: Math.min(health, get().maxHealth) }),

    takeDamage: (damage) => {
      const { health, isDead } = get();
      if (isDead) return;

      const newHealth = Math.max(0, health - damage);
      set({ health: newHealth });

      if (newHealth <= 0) {
        get().die();
      }
    },

    heal: (amount) => {
      const { health, maxHealth, isDead } = get();
      if (isDead) return;

      set({ health: Math.min(maxHealth, health + amount) });
    },

    die: () => {
      set({ isDead: true, health: 0 });
    },

    respawn: () => {
      set({
        health: initialState.maxHealth,
        isDead: false,
        currentAmmo: initialState.currentAmmo,
        reserveAmmo: initialState.reserveAmmo,
      });
    },

    switchWeapon: (weaponId) => {
      const { weapons, isReloading } = get();
      if (isReloading) return;

      const weapon = weapons.find(w => w.id === weaponId);
      if (!weapon) return;

      set({
        currentWeapon: weapon,
        currentAmmo: weapon.magazineSize,
      });
    },

    shoot: () => {
      const { currentAmmo, isReloading, currentWeapon, lastShotTime, isShooting } = get();
      const now = Date.now();
      const timeSinceLastShot = (now - lastShotTime) / 1000;
      const minTimeBetweenShots = 1 / currentWeapon.fireRate;

      if (isReloading || currentAmmo <= 0 || timeSinceLastShot < minTimeBetweenShots) {
        return false;
      }

      set({
        currentAmmo: currentAmmo - 1,
        isShooting: true,
        lastShotTime: now,
      });

      get().showMuzzleFlash();

      // Auto-stop shooting animation after short delay
      setTimeout(() => set({ isShooting: false }), 100);

      // Auto-reload if empty
      if (currentAmmo - 1 <= 0) {
        setTimeout(() => get().reload(), 200);
      }

      return true;
    },

    reload: () => {
      const { isReloading, reserveAmmo, currentWeapon, currentAmmo } = get();
      if (isReloading || reserveAmmo <= 0 || currentAmmo === currentWeapon.magazineSize) {
        return;
      }

      set({ isReloading: true });

      setTimeout(() => {
        get().finishReload();
      }, currentWeapon.reloadTime * 1000);
    },

    finishReload: () => {
      const { reserveAmmo, currentWeapon, currentAmmo } = get();
      const ammoNeeded = currentWeapon.magazineSize - currentAmmo;
      const ammoToReload = Math.min(ammoNeeded, reserveAmmo);

      set({
        currentAmmo: currentAmmo + ammoToReload,
        reserveAmmo: reserveAmmo - ammoToReload,
        isReloading: false,
      });
    },

    addAmmo: (amount) => {
      set((state) => ({
        reserveAmmo: state.reserveAmmo + amount,
      }));
    },

    updateLook: (deltaX, deltaY) => {
      const { pitch, yaw, mouseSensitivity } = get();

      const newYaw = yaw + deltaX * mouseSensitivity;
      const newPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch + deltaY * mouseSensitivity));

      set({ pitch: newPitch, yaw: newYaw });
    },

    setPitch: (pitch) => set({ pitch }),
    setYaw: (yaw) => set({ yaw }),

    addEnemy: (enemy) => {
      set((state) => ({
        enemies: [...state.enemies, enemy],
        enemyCount: state.enemyCount + 1,
      }));
    },

    removeEnemy: (enemyId) => {
      set((state) => ({
        enemies: state.enemies.filter(e => e.id !== enemyId),
      }));
    },

    damageEnemy: (enemyId, damage) => {
      const { enemies } = get();
      const enemy = enemies.find(e => e.id === enemyId);
      if (!enemy || enemy.isDead) return;

      const newHealth = Math.max(0, enemy.health - damage);
      const updatedEnemy = { ...enemy, health: newHealth, isDead: newHealth <= 0 };

      set({
        enemies: enemies.map(e => e.id === enemyId ? updatedEnemy : e),
      });

      if (updatedEnemy.isDead) {
        set((state) => ({ killCount: state.killCount + 1 }));
        get().showHitMarker();

        // Remove dead enemy after delay
        setTimeout(() => {
          get().removeEnemy(enemyId);
        }, 3000);
      } else {
        get().showHitMarker();
      }
    },

    updateEnemyPosition: (enemyId, position) => {
      set((state) => ({
        enemies: state.enemies.map(e =>
          e.id === enemyId ? { ...e, position } : e
        ),
      }));
    },

    clearEnemies: () => {
      set({ enemies: [], enemyCount: 0 });
    },

    startWave: (waveNumber) => {
      set({
        currentWave: waveNumber,
        waveActive: true,
      });
    },

    endWave: () => {
      set({ waveActive: false });
    },

    showMuzzleFlash: () => {
      set({ muzzleFlashActive: true });
      setTimeout(() => set({ muzzleFlashActive: false }), 50);
    },

    showHitMarker: () => {
      set({ hitMarkerActive: true });
      setTimeout(() => set({ hitMarkerActive: false }), 100);
    },

    reset: () => set(initialState),
  }))
);

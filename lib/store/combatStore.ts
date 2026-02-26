import { create } from 'zustand';

interface CombatEnemy {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  persona: string;
}

interface CombatState {
  enemies: CombatEnemy[];
  initializedRegionId: string | null;
  playerHealth: number;
  maxPlayerHealth: number;
  ammoInClip: number;
  clipSize: number;
  reserveAmmo: number;
  score: number;
  kills: number;
  radioMessage: string;
  radioSpeaker: string;
  lastDamageAt: number;
  muzzleFlashUntil: number;

  initializeRegion: (regionId: string, seed: string, mapWidth: number, mapHeight: number) => void;
  tickEnemies: (playerPosition: [number, number, number], delta: number, nowMs: number) => void;
  shoot: (cameraOrigin: [number, number, number], cameraDirection: [number, number, number], nowMs: number) => { hit: boolean; killed: boolean; enemyId?: string };
  reload: () => void;
  setRadioMessage: (speaker: string, message: string) => void;
  clearRadioMessage: () => void;
  resetForDeath: () => void;
}

function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  if (hash === 0) hash = 1;
  return () => {
    hash = Math.sin(hash) * 10000;
    const v = hash - Math.floor(hash);
    return Number.isFinite(v) ? v : 0.5;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeEnemy(id: string, x: number, z: number, random: () => number): CombatEnemy {
  const speed = 1.8 + random() * 1.4;
  const maxHp = 80 + Math.floor(random() * 40);
  const personas = ['Spice Wisp', 'Broth Phantom', 'Smoke Gremlin', 'Rogue Aroma'];
  return {
    id,
    position: [x, 0.8, z],
    velocity: [0, 0, 0],
    hp: maxHp,
    maxHp,
    radius: 0.6,
    speed,
    persona: personas[Math.floor(random() * personas.length)] || 'Taste Spirit',
  };
}

function raySphereHit(
  origin: [number, number, number],
  direction: [number, number, number],
  center: [number, number, number],
  radius: number,
): number | null {
  const ox = origin[0] - center[0];
  const oy = origin[1] - center[1];
  const oz = origin[2] - center[2];

  const b = ox * direction[0] + oy * direction[1] + oz * direction[2];
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const discriminant = b * b - c;

  if (discriminant < 0) return null;

  const t = -b - Math.sqrt(discriminant);
  if (t > 0 && t < 120) return t;
  return null;
}

export const useCombatStore = create<CombatState>((set, get) => ({
  enemies: [],
  initializedRegionId: null,
  playerHealth: 100,
  maxPlayerHealth: 100,
  ammoInClip: 30,
  clipSize: 30,
  reserveAmmo: 180,
  score: 0,
  kills: 0,
  radioMessage: '',
  radioSpeaker: '',
  lastDamageAt: 0,
  muzzleFlashUntil: 0,

  initializeRegion: (regionId, seed, mapWidth, mapHeight) => {
    const random = seededRandom(`${seed}-${regionId}-fps`);
    const enemyCount = clamp(Math.floor((mapWidth + mapHeight) / 25), 6, 12);
    const enemies: CombatEnemy[] = [];

    for (let i = 0; i < enemyCount; i++) {
      const side = Math.floor(random() * 4);
      const xEdge = mapWidth / 2 - 3;
      const zEdge = mapHeight / 2 - 3;
      let x = (random() * 2 - 1) * xEdge;
      let z = (random() * 2 - 1) * zEdge;

      if (side === 0) x = -xEdge;
      if (side === 1) x = xEdge;
      if (side === 2) z = -zEdge;
      if (side === 3) z = zEdge;

      enemies.push(makeEnemy(`enemy_${i}`, x, z, random));
    }

    set({
      initializedRegionId: regionId,
      enemies,
      playerHealth: 100,
      ammoInClip: 30,
      reserveAmmo: 180,
      score: 0,
      kills: 0,
      radioMessage: 'Combat zone live. Clear rogue taste spirits and keep gathering.',
      radioSpeaker: 'Kitchen Ops',
    });
  },

  tickEnemies: (playerPosition, delta, nowMs) => {
    const { enemies, playerHealth } = get();
    if (enemies.length === 0) return;

    let didDamage = false;
    const updated = enemies.map((enemy) => {
      const dx = playerPosition[0] - enemy.position[0];
      const dz = playerPosition[2] - enemy.position[2];
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;

      const dirX = dx / dist;
      const dirZ = dz / dist;
      const moveScale = Math.min(delta, 0.05) * enemy.speed;

      const nextX = enemy.position[0] + dirX * moveScale;
      const nextZ = enemy.position[2] + dirZ * moveScale;

      if (dist < 1.6) {
        didDamage = true;
      }

      return {
        ...enemy,
        position: [nextX, enemy.position[1], nextZ] as [number, number, number],
        velocity: [dirX * enemy.speed, 0, dirZ * enemy.speed] as [number, number, number],
      };
    });

    const { lastDamageAt } = get();
    if (didDamage && nowMs - lastDamageAt > 550) {
      set({
        enemies: updated,
        playerHealth: Math.max(0, playerHealth - 7),
        lastDamageAt: nowMs,
      });
      return;
    }

    set({ enemies: updated });
  },

  shoot: (cameraOrigin, cameraDirection, nowMs) => {
    const { enemies, ammoInClip, reserveAmmo, kills, score } = get();

    if (ammoInClip <= 0) {
      return { hit: false, killed: false };
    }

    const normalizedDirLength = Math.sqrt(
      cameraDirection[0] * cameraDirection[0] +
      cameraDirection[1] * cameraDirection[1] +
      cameraDirection[2] * cameraDirection[2],
    ) || 1;

    const direction: [number, number, number] = [
      cameraDirection[0] / normalizedDirLength,
      cameraDirection[1] / normalizedDirLength,
      cameraDirection[2] / normalizedDirLength,
    ];

    let targetIndex = -1;
    let closestT = Infinity;

    enemies.forEach((enemy, index) => {
      const t = raySphereHit(cameraOrigin, direction, enemy.position, enemy.radius);
      if (t !== null && t < closestT) {
        closestT = t;
        targetIndex = index;
      }
    });

    if (targetIndex === -1) {
      set({ ammoInClip: ammoInClip - 1, muzzleFlashUntil: nowMs + 60 });
      return { hit: false, killed: false };
    }

    const random = seededRandom(`${Date.now()}-${targetIndex}`);
    const updated = [...enemies];
    const enemy = updated[targetIndex];
    const damage = 34 + Math.floor(random() * 12);
    const nextHp = enemy.hp - damage;

    if (nextHp <= 0) {
      const killBonus = 120;
      const totalKills = kills + 1;
      const x = (random() * 2 - 1) * 20;
      const z = (random() * 2 - 1) * 20;
      updated[targetIndex] = makeEnemy(enemy.id, x, z, random);

      set({
        enemies: updated,
        ammoInClip: ammoInClip - 1,
        reserveAmmo: reserveAmmo,
        kills: totalKills,
        score: score + killBonus,
        muzzleFlashUntil: nowMs + 60,
      });

      return { hit: true, killed: true, enemyId: enemy.id };
    }

    updated[targetIndex] = {
      ...enemy,
      hp: nextHp,
    };

    set({
      enemies: updated,
      ammoInClip: ammoInClip - 1,
      muzzleFlashUntil: nowMs + 60,
    });

    return { hit: true, killed: false, enemyId: enemy.id };
  },

  reload: () => {
    const { ammoInClip, clipSize, reserveAmmo } = get();
    if (ammoInClip >= clipSize || reserveAmmo <= 0) return;

    const needed = clipSize - ammoInClip;
    const toLoad = Math.min(needed, reserveAmmo);

    set({
      ammoInClip: ammoInClip + toLoad,
      reserveAmmo: reserveAmmo - toLoad,
    });
  },

  setRadioMessage: (speaker, message) => {
    set({ radioSpeaker: speaker, radioMessage: message });
  },

  clearRadioMessage: () => {
    set({ radioSpeaker: '', radioMessage: '' });
  },

  resetForDeath: () => {
    set({
      playerHealth: 100,
      ammoInClip: 30,
      reserveAmmo: 180,
      score: 0,
      kills: 0,
      radioSpeaker: 'Kitchen Ops',
      radioMessage: 'Respawn complete. Stay sharp.',
    });
  },
}));

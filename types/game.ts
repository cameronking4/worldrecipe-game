// ============================================
// AI Arena FPS - Core Game Types
// ============================================

// Time of day cycle (affects lighting/atmosphere)
export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

// ============================================
// Weapon System
// ============================================

export type WeaponType = 'pistol' | 'rifle' | 'shotgun' | 'sniper' | 'plasma' | 'launcher';

export interface WeaponStats {
  damage: number;
  fireRate: number; // shots per second
  reloadTime: number; // seconds
  magazineSize: number;
  maxAmmo: number;
  spread: number; // accuracy (0 = perfect, 1 = very inaccurate)
  range: number;
  projectileSpeed: number;
  knockback: number;
}

export interface Weapon {
  weaponId: string;
  name: string;
  description: string;
  type: WeaponType;
  stats: WeaponStats;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
  color: string; // hex color for weapon glow/theme
}

// ============================================
// Enemy System
// ============================================

export type EnemyBehavior = 'rusher' | 'sniper' | 'flanker' | 'tank' | 'bomber' | 'support';

export interface EnemyType {
  enemyTypeId: string;
  name: string;
  description: string;
  behavior: EnemyBehavior;
  health: number;
  speed: number;
  damage: number;
  attackRange: number;
  attackCooldown: number; // seconds between attacks
  color: string; // hex color for enemy theme
  scale: number; // size multiplier
  scoreValue: number;
  taunts: string[]; // AI-generated taunts
}

export interface EnemyInstance {
  instanceId: string;
  typeId: string;
  position: [number, number, number];
  rotation: number;
  health: number;
  maxHealth: number;
  isAlive: boolean;
  lastAttackTime: number;
  targetPosition?: [number, number, number];
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee' | 'stunned';
}

// ============================================
// Wave System
// ============================================

export interface WaveConfig {
  waveNumber: number;
  enemies: { enemyTypeId: string; count: number; delay: number }[];
  spawnPoints: [number, number, number][];
  bonusObjective?: string;
  difficultyMultiplier: number;
  intermissionDuration: number; // seconds between waves
}

// ============================================
// Arena / Map
// ============================================

export type ArenaTheme = 'industrial' | 'ruins' | 'neon_city' | 'frozen' | 'volcanic' | 'forest' | 'space_station';

export interface CoverObject {
  position: [number, number, number];
  size: [number, number, number];
  type: 'wall' | 'crate' | 'pillar' | 'barrier';
  destructible: boolean;
  health?: number;
}

export interface ArenaSpec {
  arenaId: string;
  name: string;
  description: string;
  theme: ArenaTheme;
  width: number;
  height: number;
  playerSpawn: [number, number, number];
  enemySpawnPoints: [number, number, number][];
  coverObjects: CoverObject[];
  pickupLocations: { position: [number, number, number]; type: 'health' | 'ammo' | 'weapon' }[];
  palette: ArenaPalette;
  ambientDescription: string; // AI-generated atmosphere text
}

export interface ArenaPalette {
  ground: string;
  walls: string;
  accent: string;
  sky: string;
  fog: string;
  emissive: string;
}

// ============================================
// Mission / Campaign
// ============================================

export interface Mission {
  missionId: string;
  name: string;
  briefing: string; // AI-generated mission briefing
  difficulty: 'easy' | 'medium' | 'hard' | 'nightmare';
  arena: ArenaSpec;
  waves: WaveConfig[];
  enemyTypes: EnemyType[];
  availableWeapons: Weapon[];
  storyline: string; // AI-generated narrative
  completionMessage: string;
  rewards: { type: 'weapon' | 'score_multiplier' | 'title'; value: string }[];
}

// ============================================
// Player State
// ============================================

export interface PlayerState {
  position: [number, number, number];
  rotation: [number, number]; // [yaw, pitch]
  velocity: [number, number, number];
}

export interface PlayerCombatState {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  currentWeaponIndex: number;
  weapons: Weapon[];
  ammo: Record<string, number>; // weaponId -> current magazine ammo
  reserveAmmo: Record<string, number>; // weaponId -> reserve ammo
  isReloading: boolean;
  reloadStartTime: number;
  lastFireTime: number;
  kills: number;
  deaths: number;
  score: number;
  damageDealt: number;
  accuracy: { shots: number; hits: number };
}

// ============================================
// Projectile
// ============================================

export interface Projectile {
  projectileId: string;
  position: [number, number, number];
  direction: [number, number, number];
  speed: number;
  damage: number;
  ownerId: 'player' | string; // 'player' or enemyInstanceId
  weaponType: WeaponType;
  createdAt: number;
  maxLifetime: number; // seconds
}

// ============================================
// Pickup Items
// ============================================

export interface Pickup {
  pickupId: string;
  type: 'health' | 'ammo' | 'armor' | 'weapon';
  position: [number, number, number];
  value: number;
  weaponId?: string; // if type is 'weapon'
  isCollected: boolean;
  respawnTime?: number;
}

// ============================================
// Damage / Hit
// ============================================

export interface DamageEvent {
  targetId: string;
  sourceId: string;
  damage: number;
  position: [number, number, number];
  isHeadshot: boolean;
  isCritical: boolean;
  timestamp: number;
}

export interface KillFeedEntry {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weaponType: WeaponType;
  isHeadshot: boolean;
  timestamp: number;
}

// ============================================
// Game State
// ============================================

export type GamePhase = 'menu' | 'loading' | 'briefing' | 'combat' | 'intermission' | 'victory' | 'defeat';

export interface GameState {
  phase: GamePhase;
  currentWave: number;
  totalWaves: number;
  enemiesAlive: number;
  enemiesKilledThisWave: number;
  totalEnemiesKilled: number;
  waveStartTime: number;
  intermissionEndTime: number;
  missionStartTime: number;
  isPaused: boolean;
}

// ============================================
// AI-Generated World (kept from original, adapted)
// ============================================

export interface WorldRecipe {
  worldId: string;
  seed: string;
  mission: Mission;
  colorSystem: {
    uiTokens: Record<string, string>;
    environmentTokens: Record<string, string>;
  };
}

// ============================================
// Dialogue (AI enemy taunts / ally comms)
// ============================================

export interface DialogueNode {
  nodeId: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  tags?: string[];
}

export interface DialogueChoice {
  text: string;
  nextNodeId?: string;
  effect?: {
    type: 'relationship' | 'quest' | 'trade' | 'hint';
    value: string | number;
  };
}

export interface DialogueState {
  active: boolean;
  currentNpcId?: string;
  currentNode?: DialogueNode;
  history: DialogueNode[];
}

// ============================================
// Interaction Prompt
// ============================================

export interface InteractionPrompt {
  visible: boolean;
  text: string;
  targetId?: string;
  targetType?: 'pickup' | 'terminal' | 'door';
}

// ============================================
// UI State
// ============================================

export interface HitMarker {
  id: string;
  position: [number, number]; // screen position
  isHeadshot: boolean;
  isCritical: boolean;
  damage: number;
  timestamp: number;
}

export interface DamageIndicator {
  id: string;
  direction: number; // angle in radians
  timestamp: number;
}

// ============================================
// Game Save
// ============================================

export interface GameSave {
  saveId: string;
  worldId: string;
  playerPosition: [number, number, number];
  health: number;
  armor: number;
  weapons: Weapon[];
  ammo: Record<string, number>;
  reserveAmmo: Record<string, number>;
  currentWave: number;
  score: number;
  kills: number;
  playTimeSeconds: number;
  createdAt: Date;
  updatedAt: Date;
}

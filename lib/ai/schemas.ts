import { z } from 'zod';

// ============================================
// AI Arena FPS - Zod Schemas for AI Generation
// ============================================

export const difficultySchema = z.enum(['easy', 'medium', 'hard', 'nightmare']);

// ============================================
// Weapon Schema
// ============================================

export const weaponStatsSchema = z.object({
  damage: z.number().min(5).max(200),
  fireRate: z.number().min(0.5).max(20),
  reloadTime: z.number().min(0.5).max(5),
  magazineSize: z.number().int().min(1).max(100),
  maxAmmo: z.number().int().min(10).max(500),
  spread: z.number().min(0).max(1),
  range: z.number().min(5).max(200),
  projectileSpeed: z.number().min(20).max(200),
  knockback: z.number().min(0).max(20),
});

export const weaponSchema = z.object({
  weaponId: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['pistol', 'rifle', 'shotgun', 'sniper', 'plasma', 'launcher']),
  stats: weaponStatsSchema,
  rarity: z.enum(['common', 'uncommon', 'rare', 'legendary']),
  color: z.string().describe('Hex color for weapon glow'),
});

// ============================================
// Enemy Schema
// ============================================

export const enemyTypeSchema = z.object({
  enemyTypeId: z.string(),
  name: z.string(),
  description: z.string(),
  behavior: z.enum(['rusher', 'sniper', 'flanker', 'tank', 'bomber', 'support']),
  health: z.number().min(10).max(1000),
  speed: z.number().min(1).max(15),
  damage: z.number().min(5).max(100),
  attackRange: z.number().min(1).max(50),
  attackCooldown: z.number().min(0.3).max(5),
  color: z.string().describe('Hex color for enemy theme'),
  scale: z.number().min(0.5).max(3),
  scoreValue: z.number().int().min(10).max(1000),
  taunts: z.array(z.string()).min(1).max(5).describe('Lines the enemy says during combat'),
});

// ============================================
// Wave Schema
// ============================================

export const waveConfigSchema = z.object({
  waveNumber: z.number().int().min(1),
  enemies: z.array(z.object({
    enemyTypeId: z.string(),
    count: z.number().int().min(1).max(20),
    delay: z.number().min(0).max(10).describe('Seconds delay before spawning this group'),
  })).min(1).max(5),
  spawnPoints: z.array(z.tuple([z.number(), z.number(), z.number()])).min(1).max(8),
  bonusObjective: z.string().optional().describe('Optional bonus challenge for this wave'),
  difficultyMultiplier: z.number().min(0.5).max(3),
  intermissionDuration: z.number().min(3).max(15),
});

// ============================================
// Arena Schema
// ============================================

export const coverObjectSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  size: z.tuple([z.number(), z.number(), z.number()]),
  type: z.enum(['wall', 'crate', 'pillar', 'barrier']),
  destructible: z.boolean(),
  health: z.number().optional(),
});

export const arenaPaletteSchema = z.object({
  ground: z.string(),
  walls: z.string(),
  accent: z.string(),
  sky: z.string(),
  fog: z.string(),
  emissive: z.string(),
});

export const arenaSpecSchema = z.object({
  arenaId: z.string(),
  name: z.string(),
  description: z.string(),
  theme: z.enum(['industrial', 'ruins', 'neon_city', 'frozen', 'volcanic', 'forest', 'space_station']),
  width: z.number().min(30).max(100).default(50),
  height: z.number().min(30).max(100).default(50),
  playerSpawn: z.tuple([z.number(), z.number(), z.number()]),
  enemySpawnPoints: z.array(z.tuple([z.number(), z.number(), z.number()])).min(2).max(8),
  coverObjects: z.array(coverObjectSchema).min(3).max(20),
  pickupLocations: z.array(z.object({
    position: z.tuple([z.number(), z.number(), z.number()]),
    type: z.enum(['health', 'ammo', 'weapon']),
  })).min(2).max(8),
  palette: arenaPaletteSchema,
  ambientDescription: z.string(),
});

// ============================================
// Mission Schema (main generated object)
// ============================================

export const missionSchema = z.object({
  missionId: z.string(),
  name: z.string(),
  briefing: z.string().describe('AI-generated mission briefing, 2-3 sentences'),
  difficulty: difficultySchema,
  arena: arenaSpecSchema,
  waves: z.array(waveConfigSchema).min(3).max(10),
  enemyTypes: z.array(enemyTypeSchema).min(2).max(8),
  availableWeapons: z.array(weaponSchema).min(2).max(5),
  storyline: z.string().describe('Brief narrative context for the mission'),
  completionMessage: z.string().describe('Message shown when mission is complete'),
  rewards: z.array(z.object({
    type: z.enum(['weapon', 'score_multiplier', 'title']),
    value: z.string(),
  })).default([]),
});

// ============================================
// World Recipe (wraps mission)
// ============================================

export const worldRecipeSchema = z.object({
  worldId: z.string(),
  seed: z.string(),
  mission: missionSchema,
  colorSystem: z.object({
    uiTokens: z.record(z.string(), z.string()).default({}),
    environmentTokens: z.record(z.string(), z.string()).default({}),
  }),
});

// ============================================
// Dialogue / Taunt Schema
// ============================================

export const dialogueTurnSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  emotion: z.enum(['neutral', 'aggressive', 'mocking', 'fearful', 'confident', 'desperate']).optional(),
  choices: z.array(z.object({
    text: z.string(),
    effect: z.object({
      type: z.enum(['relationship', 'quest_accept', 'quest_progress', 'trade', 'hint', 'farewell']),
      value: z.union([z.string(), z.number()]).optional(),
    }).optional(),
  })).optional(),
  tags: z.array(z.string()).optional(),
});

// ============================================
// Type Exports
// ============================================

export type Difficulty = z.infer<typeof difficultySchema>;
export type WeaponStats = z.infer<typeof weaponStatsSchema>;
export type Weapon = z.infer<typeof weaponSchema>;
export type EnemyType = z.infer<typeof enemyTypeSchema>;
export type WaveConfig = z.infer<typeof waveConfigSchema>;
export type CoverObject = z.infer<typeof coverObjectSchema>;
export type ArenaPalette = z.infer<typeof arenaPaletteSchema>;
export type ArenaSpec = z.infer<typeof arenaSpecSchema>;
export type Mission = z.infer<typeof missionSchema>;
export type WorldRecipe = z.infer<typeof worldRecipeSchema>;
export type DialogueTurn = z.infer<typeof dialogueTurnSchema>;

import { z } from 'zod';

// ============================================
// World Recipe - Zod Schemas for AI Generation
// ============================================

// Time of day enum
export const timeOfDaySchema = z.enum(['morning', 'day', 'evening', 'night']);

// Rarity enum
export const raritySchema = z.enum(['common', 'uncommon', 'rare', 'legendary']);

// Difficulty enum
export const difficultySchema = z.enum(['easy', 'medium', 'hard']);

// ============================================
// Item Schemas
// ============================================

export const itemSchema = z.object({
  itemId: z.string().describe('Unique identifier for the item'),
  name: z.string().describe('Display name of the item'),
  description: z.string().describe('Brief description of the item'),
  category: z.enum(['ingredient', 'tool', 'souvenir', 'clothing', 'decor']),
  icon: z.string().optional().describe('Emoji or icon identifier'),
  rarity: raritySchema,
});

export const itemStackSchema = z.object({
  item: itemSchema,
  quantity: z.number().int().positive(),
});

// ============================================
// Ingredient Schemas
// ============================================

export const ingredientNodeSchema = z.object({
  ingredientId: z.string().describe('Unique identifier'),
  name: z.string().describe('Name of the ingredient'),
  category: z.string().describe('Category like vegetable, protein, spice'),
  regionId: z.string().describe('Which region this ingredient is found in'),
  gatherMethod: z.enum(['pickup', 'harvest', 'fish', 'trade', 'craft', 'gather', 'forage']),
});

export const dependencyEdgeSchema = z.object({
  from: z.string().describe('Source ingredient or quest ID'),
  to: z.string().describe('Target ingredient or quest ID'),
  type: z.enum(['requires', 'unlocks', 'substitute']),
});

export const ingredientGraphSchema = z.object({
  ingredients: z.array(ingredientNodeSchema).min(3).max(30),
  dependencies: z.array(dependencyEdgeSchema).default([]),
});

// ============================================
// NPC Schemas
// ============================================

export const npcPersonalitySchema = z.object({
  archetype: z.string().describe('Character archetype like Mentor, Trickster, Sage'),
  traits: z.array(z.string()).min(2).max(5).describe('Personality traits'),
  speakingStyle: z.string().describe('How they talk - formal, casual, poetic, etc'),
  likes: z.array(z.string()).min(1).max(3),
  dislikes: z.array(z.string()).min(1).max(3),
});

export const npcVisualSchema = z.object({
  paletteOverrides: z.record(z.string(), z.string()).optional(),
  outfitTags: z.array(z.string()).describe('Tags describing clothing style'),
  accessoryTags: z.array(z.string()).describe('Tags for accessories'),
});

export const scheduleEntrySchema = z.object({
  timeOfDay: timeOfDaySchema,
  locationId: z.string().describe('POI ID where NPC will be'),
  activity: z.string().describe('What they are doing'),
});

export const npcSchema = z.object({
  npcId: z.string().describe('Unique identifier'),
  name: z.string().describe('NPC name - culturally appropriate but fictional'),
  speciesStyle: z.string().describe('Visual style - cozy animal or person style'),
  personality: npcPersonalitySchema,
  role: z.object({
    job: z.string().describe('Their profession'),
    services: z.array(z.string()).describe('What services they offer'),
  }),
  schedule: z.array(scheduleEntrySchema).min(1).max(6),
  relationship: z.object({
    startingLevel: z.number().int().min(0).max(5).default(1),
    maxLevel: z.number().int().min(3).max(10).default(5),
    levelRewards: z.array(z.string()).describe('What unlocks at each level'),
  }),
  questHooks: z.array(z.string()).default([]).describe('Quest arc IDs this NPC is involved in'),
  visual: npcVisualSchema.optional(),
});

// ============================================
// Dialogue Schemas
// ============================================

export const dialogueChoiceSchema = z.object({
  text: z.string().describe('The choice text shown to player'),
  nextNodeId: z.string().optional().describe('ID of next dialogue node'),
  effect: z.object({
    type: z.enum(['relationship', 'quest', 'trade', 'hint']),
    value: z.union([z.string(), z.number()]),
  }).optional(),
});

export const dialogueNodeSchema = z.object({
  nodeId: z.string(),
  speaker: z.string().describe('NPC name or "player"'),
  text: z.string().describe('The dialogue text'),
  choices: z.array(dialogueChoiceSchema).optional(),
  tags: z.array(z.string()).optional().describe('Tags like quest_offer, farewell'),
});

export const dialoguePackSchema = z.object({
  greeting: z.array(dialogueNodeSchema).min(1).max(3),
  questOffer: z.array(dialogueNodeSchema).optional(),
  questProgress: z.array(dialogueNodeSchema).optional(),
  relationshipEvents: z.array(dialogueNodeSchema).optional(),
  general: z.array(dialogueNodeSchema).min(2).max(5),
});

// ============================================
// Quest Schemas
// ============================================

export const objectiveTypeSchema = z.enum(['gather', 'deliver', 'talk', 'craft', 'cook-step']);

export const questObjectiveSchema = z.object({
  objectiveId: z.string(),
  type: objectiveTypeSchema,
  description: z.string().describe('Human readable objective'),
  target: z.string().describe('Item ID, NPC ID, or step ID'),
  quantity: z.number().int().optional().default(1),
  completed: z.boolean().default(false),
});

export const questChapterSchema = z.object({
  questId: z.string(),
  title: z.string().describe('Quest title'),
  description: z.string().describe('Quest description'),
  giverNpcId: z.string().describe('NPC who gives this quest'),
  objectives: z.array(questObjectiveSchema).min(1).max(5),
  rewards: z.array(itemStackSchema).default([]),
  nextQuestId: z.string().nullish().describe('Next quest in chain'),
});

export const questArcSchema = z.object({
  arcId: z.string(),
  title: z.string().describe('Arc title like "The Secret Spice"'),
  chapters: z.array(questChapterSchema).min(1).max(5),
  unlocksCookingStepId: z.string().optional(),
});

// ============================================
// Cooking Schemas
// ============================================

export const cookingStepSchema = z.object({
  stepId: z.string(),
  name: z.string().describe('Step name like "Prepare Broth"'),
  description: z.string().describe('What this step involves'),
  technique: z.string().describe('Cooking technique used'),
  requiredIngredients: z.array(z.object({
    ingredientId: z.string(),
    quantity: z.number().int().positive(),
    substitutes: z.array(z.string()).optional(),
  })),
  miniGameType: z.enum(['stir', 'chop', 'toast', 'none']).optional(),
  unlocked: z.boolean().default(false),
  completed: z.boolean().default(false),
});

export const dishSchema = z.object({
  name: z.string().describe('Name of the dish'),
  tagline: z.string().describe('Catchy tagline'),
  inspirations: z.array(z.string()).min(1).max(3).describe('Cultural inspirations'),
  dietaryTags: z.array(z.string()).describe('Tags like vegetarian, gluten-free'),
  difficulty: difficultySchema,
  storyHook: z.string().describe('Narrative hook for why we are cooking this'),
});

// ============================================
// Map and Region Schemas
// ============================================

export const portalTypeSchema = z.enum([
  'farm', 'grocery_store', 'kitchen', 'foraging_grounds', 'exotic_garden'
]);

export const poiTypeSchema = z.enum([
  'market', 'dock', 'shrine', 'farm', 'kitchen_hut', 'npc_home', 'gathering_spot', 'portal'
]);

// Position as object instead of tuple (OpenAI structured outputs don't support tuples)
export const positionSchema = z.object({
  x: z.number().describe('X coordinate'),
  y: z.number().describe('Y coordinate'),
});

export const poiSchema = z.object({
  poiId: z.string(),
  type: poiTypeSchema,
  name: z.string().describe('Name of the location'),
  position: positionSchema.describe('Grid position'),
  interactRadius: z.number().positive().default(2),
  // Portal-specific fields
  portalType: portalTypeSchema.optional().describe('Type of portal if this is a portal POI'),
  destinationBoardId: z.string().optional().describe('ID of portal board this portal leads to'),
  requiredIngredients: z.array(z.string()).optional().describe('Required ingredients for kitchen portal'),
  isReturnPortal: z.boolean().optional().describe('True if this is a return portal in a portal board'),
});

export const sizeSchema = z.object({
  width: z.number().describe('Width'),
  height: z.number().describe('Height'),
});

export const mapSpecSchema = z.object({
  grid: z.object({
    width: z.number().int().min(10).max(100).default(40),
    height: z.number().int().min(10).max(100).default(40),
    cellSize: z.number().positive().default(1),
  }),
  terrain: z.object({
    waterBodies: z.array(z.object({
      position: positionSchema,
      size: sizeSchema,
    })).default([]),
    elevationHints: z.array(z.object({
      position: positionSchema,
      height: z.number(),
    })).default([]),
    paths: z.array(z.object({
      from: positionSchema,
      to: positionSchema,
    })).default([]),
  }),
  pois: z.array(poiSchema).min(1).max(15).optional(),
  spawnPoints: z.object({
    player: positionSchema,
    npcSpawns: z.array(z.object({
      npcId: z.string(),
      position: positionSchema,
    })),
  }).optional(),
  decorRules: z.object({
    density: z.number().min(0).max(1).describe('0-1 density of decorations'),
    propThemes: z.array(z.string()).describe('Themes like forest, coastal, urban'),
  }).optional(),
});

export const paletteSchema = z.object({
  primary: z.string().describe('Primary color hex'),
  secondary: z.string().describe('Secondary color hex'),
  accent: z.string().describe('Accent color hex'),
  ground: z.string().describe('Ground/terrain color hex'),
  foliage: z.string().describe('Foliage/plant color hex'),
  sky: z.string().describe('Sky color hex'),
  uiBg: z.string().describe('UI background color hex'),
  uiText: z.string().describe('UI text color hex'),
});

export const regionInspirationSchema = z.object({
  countryOrArea: z.string().describe('Fictionalized country/area inspiration'),
  notes: z.string().describe('Design notes'),
  avoidStereotypesChecklist: z.array(z.string()).describe('Things to avoid'),
});

export const regionSpecSchema = z.object({
  regionId: z.string(),
  name: z.string().describe('Region name'),
  inspiration: regionInspirationSchema,
  biomes: z.array(z.string()).min(1).max(5).describe('Biome types'),
  palette: paletteSchema,
  mapSpec: mapSpecSchema,
  // Allow POIs at region level too (AI sometimes generates them here)
  pois: z.array(poiSchema).optional(),
  spawnPoints: z.object({
    player: positionSchema,
    npcSpawns: z.array(z.object({
      npcId: z.string(),
      position: positionSchema,
    })),
  }).optional(),
  decorRules: z.object({
    density: z.number().min(0).max(1),
    propThemes: z.array(z.string()),
  }).optional(),
});

// ============================================
// Portal Board Schema
// ============================================

export const portalBoardSchema = z.object({
  boardId: z.string().describe('Unique portal board identifier'),
  portalType: portalTypeSchema,
  name: z.string().describe('Name of the portal location'),
  description: z.string().describe('Description of what this portal offers'),
  mapSpec: mapSpecSchema,
  npc: npcSchema,
  ingredients: z.array(ingredientNodeSchema).min(1).max(10).describe('Ingredients available in this portal'),
  spawnPoint: positionSchema,
  palette: paletteSchema,
});

// ============================================
// World Recipe - Main Schema
// ============================================

export const worldRecipeSchema = z.object({
  worldId: z.string().describe('Unique world identifier'),
  seed: z.string().describe('Generation seed for reproducibility'),
  dish: dishSchema,
  regions: z.array(regionSpecSchema).min(1).max(5),
  ingredientGraph: ingredientGraphSchema,
  questArcs: z.array(questArcSchema).min(1).max(10),
  npcRoster: z.array(npcSchema).min(2).max(30),
  portalBoards: z.array(portalBoardSchema).min(0).max(10).optional().describe('Portal boards accessible from hub'),
  colorSystem: z.object({
    uiTokens: z.record(z.string(), z.string()).default({}),
    environmentTokens: z.record(z.string(), z.string()).default({}),
  }),
  startingInventory: z.array(itemStackSchema).default([]),
});

// ============================================
// Dialogue Turn Schema (for streaming responses)
// ============================================

export const dialogueTurnSchema = z.object({
  speaker: z.string(),
  text: z.string(),
  emotion: z.enum(['neutral', 'happy', 'sad', 'excited', 'thoughtful', 'worried']).optional(),
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
// Quest Resolution Schema
// ============================================

export const questResolutionSchema = z.object({
  questId: z.string(),
  success: z.boolean(),
  message: z.string(),
  stateUpdates: z.array(z.object({
    type: z.enum(['objective_complete', 'quest_complete', 'unlock_step', 'reward']),
    targetId: z.string(),
    value: z.any().optional(),
  })),
  nextQuestId: z.string().optional(),
});

export const combatDirectorBeatSchema = z.object({
  line: z.string().describe('Short tactical line from AI director'),
  mood: z.enum(['urgent', 'steady', 'celebratory']),
  suggestedObjective: z.string().optional(),
});

// ============================================
// Type Exports
// ============================================

export type TimeOfDay = z.infer<typeof timeOfDaySchema>;
export type Rarity = z.infer<typeof raritySchema>;
export type Difficulty = z.infer<typeof difficultySchema>;
export type Item = z.infer<typeof itemSchema>;
export type ItemStack = z.infer<typeof itemStackSchema>;
export type IngredientNode = z.infer<typeof ingredientNodeSchema>;
export type DependencyEdge = z.infer<typeof dependencyEdgeSchema>;
export type IngredientGraph = z.infer<typeof ingredientGraphSchema>;
export type NPCPersonality = z.infer<typeof npcPersonalitySchema>;
export type NPCVisual = z.infer<typeof npcVisualSchema>;
export type ScheduleEntry = z.infer<typeof scheduleEntrySchema>;
export type NPC = z.infer<typeof npcSchema>;
export type DialogueChoice = z.infer<typeof dialogueChoiceSchema>;
export type DialogueNode = z.infer<typeof dialogueNodeSchema>;
export type DialoguePack = z.infer<typeof dialoguePackSchema>;
export type ObjectiveType = z.infer<typeof objectiveTypeSchema>;
export type QuestObjective = z.infer<typeof questObjectiveSchema>;
export type QuestChapter = z.infer<typeof questChapterSchema>;
export type QuestArc = z.infer<typeof questArcSchema>;
export type CookingStep = z.infer<typeof cookingStepSchema>;
export type Dish = z.infer<typeof dishSchema>;
export type PortalType = z.infer<typeof portalTypeSchema>;
export type POIType = z.infer<typeof poiTypeSchema>;
export type POI = z.infer<typeof poiSchema>;
export type MapSpec = z.infer<typeof mapSpecSchema>;
export type Palette = z.infer<typeof paletteSchema>;
export type RegionInspiration = z.infer<typeof regionInspirationSchema>;
export type RegionSpec = z.infer<typeof regionSpecSchema>;
export type PortalBoard = z.infer<typeof portalBoardSchema>;
export type WorldRecipe = z.infer<typeof worldRecipeSchema>;
export type DialogueTurn = z.infer<typeof dialogueTurnSchema>;
export type QuestResolution = z.infer<typeof questResolutionSchema>;
export type CombatDirectorBeat = z.infer<typeof combatDirectorBeatSchema>;

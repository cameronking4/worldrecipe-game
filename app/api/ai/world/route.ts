import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { worldRecipeSchema } from '@/lib/ai/schemas';
import { COZY_WORLD_SYSTEM_PROMPT, buildWorldGenerationPrompt } from '@/lib/ai/prompts';
import { db } from '@/lib/db/client';
import { worlds, aiGenerations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================
// World Generation API Endpoint
// ============================================

export const maxDuration = 60; // Allow up to 60 seconds for generation

interface WorldGenerationRequest {
  seed?: string;
  dishPrompt: string;
  playerPrefs?: {
    difficulty?: 'easy' | 'medium' | 'hard';
    regions?: number;
    dietaryRestrictions?: string[];
  };
}

// Hash input for cache key
function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export async function POST(request: Request) {
  try {
    const body: WorldGenerationRequest = await request.json();
    
    if (!body.dishPrompt) {
      return NextResponse.json(
        { error: 'dishPrompt is required' },
        { status: 400 }
      );
    }
    
    // Generate or use provided seed
    const seed = body.seed || uuidv4();
    const worldId = uuidv4();
    
    // Create cache key from input
    const cacheKey = hashInput(JSON.stringify({
      dishPrompt: body.dishPrompt,
      seed,
      playerPrefs: body.playerPrefs,
    }));
    
    // Check cache first (skip if database unavailable)
    try {
      const cached = await db.query.aiGenerations.findFirst({
        where: eq(aiGenerations.inputHash, cacheKey),
      });
      
      if (cached) {
        const cachedWorld = JSON.parse(cached.outputJson);
        // Update worldId to be unique even for cached results
        cachedWorld.worldId = worldId;
        
        // Store world in database (skip if fails)
        try {
          await db.insert(worlds).values({
            worldId,
            seed,
            dishName: cachedWorld.dish.name,
            modelVersion: 'cached',
            promptVersion: '1.0',
            worldJson: JSON.stringify(cachedWorld),
          });
        } catch (dbError) {
          console.warn('Failed to store cached world in database:', dbError);
        }
        
        return NextResponse.json({
          worldId,
          world: cachedWorld,
          cached: true,
        });
      }
    } catch (dbError) {
      // Database unavailable - continue without cache
      console.warn('Database unavailable, skipping cache check:', dbError);
    }
    
    // Build the prompt
    const prompt = buildWorldGenerationPrompt(
      body.dishPrompt,
      seed,
      body.playerPrefs
    );
    
    // Generate with AI Gateway
    let world, usage;
    try {
      const result = await generateObject({
        model: gateway('openai/gpt-4o'),
        schema: worldRecipeSchema,
        system: COZY_WORLD_SYSTEM_PROMPT,
        prompt,
        temperature: 0.7,
      });
      world = result.object;
      usage = result.usage;
    } catch (schemaError: any) {
      // If schema validation fails, log and use fallback
      console.error('Schema validation failed:', schemaError);
      if (process.env.NODE_ENV === 'development') {
        const fallbackWorld = createFallbackWorld();
        return NextResponse.json({
          worldId: fallbackWorld.worldId,
          world: fallbackWorld,
          fallback: true,
          error: 'Schema validation failed - using fallback world',
          schemaErrors: schemaError.cause?.issues || [],
        });
      }
      throw schemaError; // Re-throw in production
    }
    
    // Set the worldId and seed
    world.worldId = worldId;
    world.seed = seed;
    
    // Validate referential integrity
    const validationErrors = validateWorldRecipe(world);
    if (validationErrors.length > 0) {
      console.warn('World validation warnings:', validationErrors);
      // Auto-fix common issues
      world.questArcs = fixQuestReferences(world);
    }
    
    // Store in database (skip if database unavailable)
    try {
      await db.insert(worlds).values({
        worldId,
        seed,
        dishName: world.dish.name,
        modelVersion: 'gpt-4o',
        promptVersion: '1.0',
        worldJson: JSON.stringify(world),
      });
      
      // Cache the generation
      await db.insert(aiGenerations).values({
        generationId: uuidv4(),
        worldId,
        generationType: 'world',
        inputHash: cacheKey,
        outputJson: JSON.stringify(world),
        modelUsed: 'gpt-4o',
        tokensUsed: usage?.totalTokens,
      });
    } catch (dbError) {
      // Database unavailable - continue without persistence
      console.warn('Database unavailable, skipping world storage:', dbError);
    }
    
    return NextResponse.json({
      worldId,
      world,
      cached: false,
      usage: {
        totalTokens: usage?.totalTokens,
      },
    });
  } catch (error) {
    console.error('World generation error:', error);
    
    // Return a fallback world for development
    if (process.env.NODE_ENV === 'development') {
      const fallbackWorld = createFallbackWorld();
      return NextResponse.json({
        worldId: fallbackWorld.worldId,
        world: fallbackWorld,
        fallback: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to generate world', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve existing world
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('worldId');
    
    if (!worldId) {
      // Return list of all worlds
      const allWorlds = await db.query.worlds.findMany({
        columns: {
          worldId: true,
          dishName: true,
          seed: true,
          createdAt: true,
        },
        orderBy: (worlds, { desc }) => [desc(worlds.createdAt)],
        limit: 10,
      });
      
      return NextResponse.json({ worlds: allWorlds });
    }
    
    // Return specific world
    const world = await db.query.worlds.findFirst({
      where: eq(worlds.worldId, worldId),
    });
    
    if (!world) {
      return NextResponse.json(
        { error: 'World not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      worldId: world.worldId,
      world: JSON.parse(world.worldJson),
    });
  } catch (error) {
    console.error('World retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve world' },
      { status: 500 }
    );
  }
}

// ============================================
// Validation Helpers
// ============================================

function validateWorldRecipe(world: any): string[] {
  const errors: string[] = [];
  const npcIds = new Set(world.npcRoster.map((n: any) => n.npcId));
  const regionIds = new Set(world.regions.map((r: any) => r.regionId));
  const ingredientIds = new Set(world.ingredientGraph.ingredients.map((i: any) => i.ingredientId));
  
  // Check quest givers exist
  for (const arc of world.questArcs) {
    for (const chapter of arc.chapters) {
      if (!npcIds.has(chapter.giverNpcId)) {
        errors.push(`Quest ${chapter.questId} references non-existent NPC: ${chapter.giverNpcId}`);
      }
    }
  }
  
  // Check NPC schedules reference valid POIs (POIs can be at region or mapSpec level)
  for (const npc of world.npcRoster) {
    for (const schedule of npc.schedule) {
      const validPoi = world.regions.some((r: any) => {
        const regionPois = r.pois || [];
        const mapSpecPois = r.mapSpec?.pois || [];
        const allPois = [...regionPois, ...mapSpecPois];
        return allPois.some((p: any) => p.poiId === schedule.locationId);
      });
      if (!validPoi) {
        errors.push(`NPC ${npc.npcId} schedule references invalid POI: ${schedule.locationId}`);
      }
    }
  }
  
  // Check ingredient regions exist
  for (const ingredient of world.ingredientGraph.ingredients) {
    if (!regionIds.has(ingredient.regionId)) {
      errors.push(`Ingredient ${ingredient.ingredientId} references non-existent region: ${ingredient.regionId}`);
    }
  }
  
  return errors;
}

function fixQuestReferences(world: any): any[] {
  const npcIds = new Set(world.npcRoster.map((n: any) => n.npcId));
  const firstNpcId = world.npcRoster[0]?.npcId || 'npc_default';
  
  return world.questArcs.map((arc: any) => ({
    ...arc,
    chapters: arc.chapters.map((chapter: any) => ({
      ...chapter,
      giverNpcId: npcIds.has(chapter.giverNpcId) ? chapter.giverNpcId : firstNpcId,
    })),
  }));
}

// ============================================
// Portal Board Generation Helper
// ============================================

function createPortalBoards(worldId: string, ingredients: any[], npcRoster: any[]): any[] {
  const portalTypes: Array<{ type: string; name: string; description: string; ingredientFilter: (i: any) => boolean }> = [
    {
      type: 'farm',
      name: 'Sunny Farm',
      description: 'A peaceful farm with fresh vegetables and grains',
      ingredientFilter: (i) => i.category === 'vegetable' || i.category === 'grain' || i.gatherMethod === 'harvest',
    },
    {
      type: 'grocery_store',
      name: 'Village Market',
      description: 'A bustling market with packaged goods and trade items',
      ingredientFilter: (i) => i.gatherMethod === 'trade' || i.category === 'grain',
    },
    {
      type: 'foraging_grounds',
      name: 'Wild Foraging Grounds',
      description: 'A natural area rich with wild mushrooms and herbs',
      ingredientFilter: (i) => i.gatherMethod === 'forage' || i.gatherMethod === 'pickup' || i.category === 'spice',
    },
    {
      type: 'exotic_garden',
      name: 'Exotic Garden',
      description: 'A mystical garden with rare spices and special ingredients',
      ingredientFilter: (i) => i.category === 'spice' || i.rarity === 'rare' || i.rarity === 'legendary',
    },
    {
      type: 'kitchen',
      name: 'Master Kitchen',
      description: 'The ultimate cooking station - unlock when you have all ingredients',
      ingredientFilter: () => false, // Kitchen has no ingredients, it's for cooking
    },
  ];
  
  const portalBoards = portalTypes.map((portalInfo, index) => {
    const boardId = `portal_${portalInfo.type}_${worldId}`;
    
    // Filter ingredients for this portal
    const portalIngredients = portalInfo.type === 'kitchen' 
      ? [] 
      : ingredients.filter(portalInfo.ingredientFilter).slice(0, 5);
    
    // Create NPC for this portal (reuse existing NPCs or create simple ones)
    const portalNpc = npcRoster[index % npcRoster.length] || {
      npcId: `npc_portal_${portalInfo.type}`,
      name: portalInfo.type === 'farm' ? 'Farmer' : portalInfo.type === 'grocery_store' ? 'Merchant' : 'Guide',
      speciesStyle: 'cozy animal',
      personality: {
        archetype: 'Helper',
        traits: ['friendly', 'helpful'],
        speakingStyle: 'casual',
        likes: ['helping', 'sharing'],
        dislikes: ['trouble'],
      },
      role: {
        job: portalInfo.type === 'farm' ? 'Farmer' : portalInfo.type === 'grocery_store' ? 'Merchant' : 'Guide',
        services: ['ingredient help', 'tips'],
      },
      schedule: [{ timeOfDay: 'day' as const, locationId: boardId, activity: 'working' }],
      relationship: { startingLevel: 0, maxLevel: 5, levelRewards: [] },
      questHooks: [],
      visual: { outfitTags: [], accessoryTags: [] },
    };
    
    return {
      boardId,
      portalType: portalInfo.type,
      name: portalInfo.name,
      description: portalInfo.description,
      mapSpec: {
        grid: { width: 40, height: 40, cellSize: 1 },
        terrain: {
          waterBodies: [],
          elevationHints: [],
          paths: [],
        },
        pois: [
          {
            poiId: `return_portal_${boardId}`,
            type: 'portal' as const,
            name: 'Return to Hub',
            position: { x: 5, y: 5 },
            interactRadius: 2,
            isReturnPortal: true,
          },
        ],
        spawnPoints: {
          player: { x: 20, y: 20 },
          npcSpawns: [{ npcId: portalNpc.npcId, position: { x: 20, y: 25 } }],
        },
        decorRules: { density: 0.3, propThemes: [portalInfo.type] },
      },
      npc: portalNpc,
      ingredients: portalIngredients,
      spawnPoint: { x: 20, y: 20 },
      palette: {
        primary: portalInfo.type === 'farm' ? '#90EE90' : portalInfo.type === 'grocery_store' ? '#FFD700' : '#9370DB',
        secondary: '#B6D0E2',
        accent: '#FF6B6B',
        ground: '#C4A484',
        foliage: '#4A7C59',
        sky: '#87CEEB',
        uiBg: '#1a1a2e',
        uiText: '#ffffff',
      },
    };
  });
  
  return portalBoards;
}

// ============================================
// Fallback World for Development
// ============================================

function createFallbackWorld() {
  const worldId = uuidv4();
  
  const ingredients = [
    { ingredientId: 'ing_noodles', name: 'Fresh Noodles', category: 'grain', regionId: 'region_harbor', gatherMethod: 'trade' as const },
    { ingredientId: 'ing_pork', name: 'Chashu Pork', category: 'protein', regionId: 'region_harbor', gatherMethod: 'trade' as const },
    { ingredientId: 'ing_egg', name: 'Soft-Boiled Egg', category: 'protein', regionId: 'region_harbor', gatherMethod: 'pickup' as const },
    { ingredientId: 'ing_egg_2', name: 'Farm Egg', category: 'protein', regionId: 'region_harbor', gatherMethod: 'pickup' as const },
    { ingredientId: 'ing_seaweed', name: 'Nori Seaweed', category: 'vegetable', regionId: 'region_harbor', gatherMethod: 'harvest' as const },
    { ingredientId: 'ing_seaweed_2', name: 'Dried Seaweed', category: 'vegetable', regionId: 'region_harbor', gatherMethod: 'harvest' as const },
    { ingredientId: 'ing_scallion', name: 'Fresh Scallions', category: 'vegetable', regionId: 'region_harbor', gatherMethod: 'harvest' as const },
    { ingredientId: 'ing_garlic', name: 'Wild Garlic', category: 'spice', regionId: 'region_harbor', gatherMethod: 'pickup' as const },
    { ingredientId: 'ing_ginger', name: 'Fresh Ginger', category: 'spice', regionId: 'region_harbor', gatherMethod: 'harvest' as const },
    { ingredientId: 'ing_mushroom', name: 'Shiitake Mushroom', category: 'vegetable', regionId: 'region_harbor', gatherMethod: 'pickup' as const },
    { ingredientId: 'ing_bamboo', name: 'Bamboo Shoot', category: 'vegetable', regionId: 'region_harbor', gatherMethod: 'harvest' as const },
    { ingredientId: 'ing_broth', name: 'Pork Bone Broth', category: 'liquid', regionId: 'region_harbor', gatherMethod: 'craft' as const },
  ];
  
  const npcRoster = [
    {
      npcId: 'npc_chef_hana',
      name: 'Chef Hana',
      speciesStyle: 'Friendly human chef',
      personality: {
        archetype: 'Mentor',
        traits: ['patient', 'passionate', 'encouraging'],
        speakingStyle: 'Warm and nurturing, uses cooking metaphors',
        likes: ['sharing recipes', 'fresh ingredients', 'eager students'],
        dislikes: ['food waste', 'impatience'],
      },
      role: {
        job: 'Head Chef',
        services: ['cooking lessons', 'recipe hints', 'ingredient trades'],
      },
      schedule: [
        { timeOfDay: 'morning' as const, locationId: 'poi_market', activity: 'Selecting fresh ingredients' },
        { timeOfDay: 'day' as const, locationId: 'poi_kitchen', activity: 'Teaching cooking' },
        { timeOfDay: 'evening' as const, locationId: 'poi_kitchen', activity: 'Preparing dinner' },
      ],
      relationship: {
        startingLevel: 1,
        maxLevel: 10,
        levelRewards: ['Basic recipes', 'Advanced techniques', 'Secret family recipe'],
      },
      questHooks: ['arc_first_broth'],
      visual: {
        outfitTags: ['chef_coat', 'apron'],
        accessoryTags: ['chef_hat', 'ladle'],
      },
    },
    {
      npcId: 'npc_fisher_kai',
      name: 'Kai',
      speciesStyle: 'Weathered fisherman',
      personality: {
        archetype: 'Provider',
        traits: ['hardy', 'quiet', 'generous'],
        speakingStyle: 'Few words but meaningful, knows the sea',
        likes: ['early mornings', 'the ocean', 'good stories'],
        dislikes: ['storms', 'wastefulness'],
      },
      role: {
        job: 'Fisherman',
        services: ['fresh fish trades', 'fishing tips', 'boat rides'],
      },
      schedule: [
        { timeOfDay: 'morning' as const, locationId: 'poi_dock', activity: 'Preparing nets' },
        { timeOfDay: 'day' as const, locationId: 'poi_dock', activity: 'Selling catch' },
        { timeOfDay: 'evening' as const, locationId: 'poi_market', activity: 'Enjoying dinner' },
      ],
      relationship: {
        startingLevel: 0,
        maxLevel: 8,
        levelRewards: ['Fishing lessons', 'Best fishing spots', 'Family boat access'],
      },
      questHooks: [],
      visual: {
        outfitTags: ['raincoat', 'boots'],
        accessoryTags: ['fishing_hat', 'net'],
      },
    },
    {
      npcId: 'npc_merchant_mina',
      name: 'Mina',
      speciesStyle: 'Traveling spice merchant',
      personality: {
        archetype: 'Trader',
        traits: ['curious', 'sharp', 'friendly'],
        speakingStyle: 'Quick and lively, always has a tip to share',
        likes: ['rare spices', 'fair deals', 'market gossip'],
        dislikes: ['haggling without respect', 'stale ingredients'],
      },
      role: {
        job: 'Merchant',
        services: ['ingredient trades', 'market rumors', 'flavor advice'],
      },
      schedule: [
        { timeOfDay: 'morning' as const, locationId: 'poi_market', activity: 'Setting up spice stall' },
        { timeOfDay: 'day' as const, locationId: 'poi_market', activity: 'Trading ingredients and stories' },
        { timeOfDay: 'evening' as const, locationId: 'poi_kitchen', activity: 'Delivering special orders' },
      ],
      relationship: {
        startingLevel: 0,
        maxLevel: 9,
        levelRewards: ['Discounted trades', 'Rare spice leads', 'Merchant network access'],
      },
      questHooks: [],
      visual: {
        outfitTags: ['vest', 'trader_sash'],
        accessoryTags: ['coin_pouch', 'spice_crate'],
      },
    },
  ];
  
  const portalBoards = createPortalBoards(worldId, ingredients, npcRoster);
  
  // Create portal POIs in hub
  const portalPois = portalBoards.map((pb, index) => {
    const angle = (index / portalBoards.length) * Math.PI * 2;
    const distance = 15;
    const x = 20 + Math.cos(angle) * distance;
    const y = 20 + Math.sin(angle) * distance;
    
    return {
      poiId: `portal_poi_${pb.portalType}`,
      type: 'portal' as const,
      name: pb.name,
      position: { x, y },
      interactRadius: 3,
      portalType: pb.portalType,
      destinationBoardId: pb.boardId,
      requiredIngredients: pb.portalType === 'kitchen' ? ingredients.map(i => i.ingredientId) : undefined,
    };
  });
  
  return {
    worldId,
    seed: 'fallback-seed',
    dish: {
      name: 'Simple Ramen',
      tagline: 'A warm bowl of comfort',
      inspirations: ['Japanese cuisine', 'Street food culture'],
      dietaryTags: ['contains gluten'],
      difficulty: 'medium' as const,
      storyHook: 'Master the art of the perfect broth on your culinary journey.',
    },
    regions: [
      {
        regionId: 'region_harbor',
        name: 'Misty Harbor',
        inspiration: {
          countryOrArea: 'Coastal fishing village',
          notes: 'A peaceful port town known for fresh seafood',
          avoidStereotypesChecklist: ['Avoid generic Asian stereotypes'],
        },
        biomes: ['coastal', 'temperate'],
        palette: {
          primary: '#5B8FB9',
          secondary: '#B6D0E2',
          accent: '#FF6B6B',
          ground: '#C4A484',
          foliage: '#4A7C59',
          sky: '#87CEEB',
          uiBg: '#1a1a2e',
          uiText: '#ffffff',
        },
        mapSpec: {
          grid: { width: 40, height: 40, cellSize: 1 },
          terrain: {
            waterBodies: [{ position: { x: 35, y: 20 }, size: { width: 10, height: 15 } }],
            elevationHints: [{ position: { x: 5, y: 5 }, height: 2 }],
            paths: [
              { from: { x: 20, y: 20 }, to: { x: 30, y: 20 } },
              { from: { x: 20, y: 20 }, to: { x: 10, y: 15 } },
            ],
          },
          pois: [
            { poiId: 'poi_market', type: 'market' as const, name: 'Harbor Market', position: { x: 10, y: 15 }, interactRadius: 3 },
            { poiId: 'poi_dock', type: 'dock' as const, name: 'Fish Dock', position: { x: 30, y: 20 }, interactRadius: 3 },
            { poiId: 'poi_kitchen', type: 'kitchen_hut' as const, name: 'Seaside Kitchen', position: { x: 20, y: 25 }, interactRadius: 3 },
            ...portalPois,
          ],
          spawnPoints: {
            player: { x: 20, y: 20 },
            npcSpawns: [
              { npcId: 'npc_chef_hana', position: { x: 20, y: 25 } },
              { npcId: 'npc_fisher_kai', position: { x: 30, y: 20 } },
              { npcId: 'npc_merchant_mina', position: { x: 10, y: 15 } },
            ],
          },
          decorRules: { density: 0.3, propThemes: ['coastal', 'fishing'] },
        },
      },
    ],
    ingredientGraph: {
      ingredients,
      dependencies: [
        { from: 'ing_pork', to: 'ing_broth', type: 'requires' as const },
      ],
    },
    questArcs: [
      {
        arcId: 'arc_first_broth',
        title: 'The Foundation',
        chapters: [
          {
            questId: 'quest_meet_chef',
            title: 'Meet the Chef',
            description: 'Find Chef Hana at the Seaside Kitchen',
            giverNpcId: 'npc_chef_hana',
            objectives: [
              { objectiveId: 'obj_talk_hana', type: 'talk' as const, description: 'Talk to Chef Hana', target: 'npc_chef_hana', quantity: 1, completed: false },
            ],
            rewards: [],
            nextQuestId: 'quest_gather_basics',
          },
          {
            questId: 'quest_gather_basics',
            title: 'Gathering the Basics',
            description: 'Collect the essential ingredients for your first broth',
            giverNpcId: 'npc_chef_hana',
            objectives: [
              { objectiveId: 'obj_get_noodles', type: 'gather' as const, description: 'Acquire fresh noodles', target: 'ing_noodles', quantity: 1, completed: false },
              { objectiveId: 'obj_get_egg', type: 'gather' as const, description: 'Find a fresh egg', target: 'ing_egg', quantity: 2, completed: false },
            ],
            rewards: [
              {
                item: {
                  itemId: 'item_chopsticks',
                  name: 'Wooden Chopsticks',
                  description: 'A pair of handcrafted chopsticks',
                  category: 'tool' as const,
                  icon: '🥢',
                  rarity: 'common' as const,
                },
                quantity: 1,
              },
            ],
          },
        ],
        unlocksCookingStepId: 'step_prepare_broth',
      },
    ],
    npcRoster,
    portalBoards,
    colorSystem: {
      uiTokens: {
        primary: '#FF6B6B',
        secondary: '#4ECDC4',
        accent: '#FFE66D',
        background: '#1a1a2e',
        text: '#ffffff',
      },
      environmentTokens: {
        skyDay: '#87CEEB',
        skyEvening: '#FF7F50',
        ground: '#4A7C59',
        water: '#5B8FB9',
      },
    },
    startingInventory: [],
  };
}

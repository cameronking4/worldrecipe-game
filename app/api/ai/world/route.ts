import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { v4 as uuidv4 } from 'uuid';
import { missionSchema } from '@/lib/ai/schemas';
import { FPS_WORLD_SYSTEM_PROMPT, buildMissionGenerationPrompt } from '@/lib/ai/prompts';
import { db as _db } from '@/lib/db/client';
import { worlds, aiGenerations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Cast db to any to avoid type issues with safe wrapper
const db = _db as any;
import crypto from 'crypto';

// ============================================
// Mission Generation API Endpoint
// ============================================

export const maxDuration = 60;

interface MissionGenerationRequest {
  seed?: string;
  missionTheme: string;
  playerPrefs?: {
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare';
    waveCount?: number;
    arenaTheme?: string;
  };
}

function hashInput(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
}

export async function POST(request: Request) {
  try {
    const body: MissionGenerationRequest = await request.json();

    if (!body.missionTheme) {
      return NextResponse.json({ error: 'missionTheme is required' }, { status: 400 });
    }

    const seed = body.seed || uuidv4();
    const worldId = uuidv4();

    const cacheKey = hashInput(JSON.stringify({
      missionTheme: body.missionTheme,
      seed,
      playerPrefs: body.playerPrefs,
    }));

    // Check cache
    try {
      const cached = await db.query.aiGenerations.findFirst({
        where: eq(aiGenerations.inputHash, cacheKey),
      });

      if (cached) {
        const cachedMission = JSON.parse(cached.outputJson);
        const world = {
          worldId,
          seed,
          mission: cachedMission,
          colorSystem: {
            uiTokens: cachedMission.arena?.palette || {},
            environmentTokens: {},
          },
        };

        try {
          await db.insert(worlds).values({
            worldId,
            seed,
            dishName: cachedMission.name || 'Mission',
            modelVersion: 'cached',
            promptVersion: '2.0',
            worldJson: JSON.stringify(world),
          });
        } catch (dbError) {
          console.warn('Failed to store cached world:', dbError);
        }

        return NextResponse.json({ worldId, world, cached: true });
      }
    } catch (dbError) {
      console.warn('Database unavailable:', dbError);
    }

    // Generate with AI
    const prompt = buildMissionGenerationPrompt(
      body.missionTheme,
      seed,
      body.playerPrefs
    );

    let mission, usage;
    try {
      const result = await generateObject({
        model: gateway('openai/gpt-4o'),
        schema: missionSchema,
        system: FPS_WORLD_SYSTEM_PROMPT,
        prompt,
        temperature: 0.7,
      });
      mission = result.object;
      usage = result.usage;
    } catch (schemaError: any) {
      console.error('Schema validation failed:', schemaError);
      const fallbackWorld = createFallbackWorld();
      return NextResponse.json({
        worldId: fallbackWorld.worldId,
        world: fallbackWorld,
        fallback: true,
        error: 'Schema validation failed - using fallback mission',
      });
    }

    const world = {
      worldId,
      seed,
      mission,
      colorSystem: {
        uiTokens: mission.arena?.palette || {},
        environmentTokens: {},
      },
    };

    // Store in database
    try {
      await db.insert(worlds).values({
        worldId,
        seed,
        dishName: mission.name,
        modelVersion: 'gpt-4o',
        promptVersion: '2.0',
        worldJson: JSON.stringify(world),
      });

      await db.insert(aiGenerations).values({
        generationId: uuidv4(),
        worldId,
        generationType: 'mission',
        inputHash: cacheKey,
        outputJson: JSON.stringify(mission),
        modelUsed: 'gpt-4o',
        tokensUsed: usage?.totalTokens,
      });
    } catch (dbError) {
      console.warn('Database unavailable:', dbError);
    }

    return NextResponse.json({
      worldId,
      world,
      cached: false,
      usage: { totalTokens: usage?.totalTokens },
    });
  } catch (error) {
    console.error('Mission generation error:', error);

    const fallbackWorld = createFallbackWorld();
    return NextResponse.json({
      worldId: fallbackWorld.worldId,
      world: fallbackWorld,
      fallback: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const worldId = searchParams.get('worldId');

    if (!worldId) {
      const allWorlds = await db.query.worlds.findMany({
        columns: { worldId: true, dishName: true, seed: true, createdAt: true },
        orderBy: (w: any, { desc }: any) => [desc(w.createdAt)],
        limit: 10,
      });
      return NextResponse.json({ worlds: allWorlds });
    }

    const world = await db.query.worlds.findFirst({
      where: eq(worlds.worldId, worldId),
    });

    if (!world) {
      return NextResponse.json({ error: 'World not found' }, { status: 404 });
    }

    return NextResponse.json({ worldId: world.worldId, world: JSON.parse(world.worldJson) });
  } catch (error) {
    console.error('World retrieval error:', error);
    return NextResponse.json({ error: 'Failed to retrieve world' }, { status: 500 });
  }
}

// ============================================
// Fallback World
// ============================================

function createFallbackWorld() {
  const worldId = uuidv4();

  return {
    worldId,
    seed: 'fallback-seed',
    mission: {
      missionId: 'mission_default',
      name: 'Training Grounds',
      briefing: 'Welcome to the Training Grounds, soldier. Enemy AI constructs have been detected in the area. Clear all waves to complete the mission.',
      difficulty: 'medium' as const,
      arena: {
        arenaId: 'arena_training',
        name: 'Training Arena',
        description: 'A standard combat arena for testing your skills',
        theme: 'industrial' as const,
        width: 50,
        height: 50,
        playerSpawn: [0, 1, 0] as [number, number, number],
        enemySpawnPoints: [
          [-20, 1, -20] as [number, number, number],
          [20, 1, -20] as [number, number, number],
          [-20, 1, 20] as [number, number, number],
          [20, 1, 20] as [number, number, number],
          [0, 1, -22] as [number, number, number],
          [0, 1, 22] as [number, number, number],
        ],
        coverObjects: [
          { position: [-8, 0.75, -5] as [number, number, number], size: [2, 1.5, 1] as [number, number, number], type: 'crate' as const, destructible: false },
          { position: [8, 0.75, -5] as [number, number, number], size: [2, 1.5, 1] as [number, number, number], type: 'crate' as const, destructible: false },
          { position: [-5, 1, 5] as [number, number, number], size: [1, 2, 3] as [number, number, number], type: 'wall' as const, destructible: false },
          { position: [5, 1, 5] as [number, number, number], size: [1, 2, 3] as [number, number, number], type: 'wall' as const, destructible: false },
          { position: [0, 1.5, -10] as [number, number, number], size: [1, 3, 1] as [number, number, number], type: 'pillar' as const, destructible: false },
          { position: [-12, 0.6, 0] as [number, number, number], size: [3, 1.2, 1.5] as [number, number, number], type: 'barrier' as const, destructible: false },
          { position: [12, 0.6, 0] as [number, number, number], size: [3, 1.2, 1.5] as [number, number, number], type: 'barrier' as const, destructible: false },
          { position: [0, 0.75, 8] as [number, number, number], size: [4, 1.5, 1] as [number, number, number], type: 'wall' as const, destructible: false },
        ],
        pickupLocations: [
          { position: [-10, 0.5, -10] as [number, number, number], type: 'health' as const },
          { position: [10, 0.5, 10] as [number, number, number], type: 'ammo' as const },
          { position: [-10, 0.5, 10] as [number, number, number], type: 'health' as const },
          { position: [10, 0.5, -10] as [number, number, number], type: 'ammo' as const },
        ],
        palette: {
          ground: '#3a3a4a',
          walls: '#2a2a3a',
          accent: '#FF4444',
          sky: '#1a1a2a',
          fog: '#222233',
          emissive: '#FF6644',
        },
        ambientDescription: 'A dimly lit industrial arena with metallic walls and scattered crates for cover.',
      },
      waves: [
        {
          waveNumber: 1,
          enemies: [{ enemyTypeId: 'enemy_drone', count: 3, delay: 0 }],
          spawnPoints: [[-20, 1, -20], [20, 1, -20], [0, 1, -22]] as [number, number, number][],
          difficultyMultiplier: 1.0,
          intermissionDuration: 8,
        },
        {
          waveNumber: 2,
          enemies: [
            { enemyTypeId: 'enemy_drone', count: 3, delay: 0 },
            { enemyTypeId: 'enemy_heavy', count: 1, delay: 3 },
          ],
          spawnPoints: [[-20, 1, -20], [20, 1, 20], [-20, 1, 20], [20, 1, -20]] as [number, number, number][],
          difficultyMultiplier: 1.2,
          intermissionDuration: 8,
        },
        {
          waveNumber: 3,
          enemies: [
            { enemyTypeId: 'enemy_scout', count: 4, delay: 0 },
            { enemyTypeId: 'enemy_drone', count: 2, delay: 2 },
          ],
          spawnPoints: [[-20, 1, -20], [20, 1, -20], [-20, 1, 20], [20, 1, 20]] as [number, number, number][],
          difficultyMultiplier: 1.4,
          intermissionDuration: 8,
        },
        {
          waveNumber: 4,
          enemies: [
            { enemyTypeId: 'enemy_drone', count: 3, delay: 0 },
            { enemyTypeId: 'enemy_heavy', count: 2, delay: 2 },
            { enemyTypeId: 'enemy_scout', count: 2, delay: 4 },
          ],
          spawnPoints: [[-20, 1, -20], [20, 1, -20], [-20, 1, 20], [20, 1, 20], [0, 1, -22], [0, 1, 22]] as [number, number, number][],
          difficultyMultiplier: 1.6,
          intermissionDuration: 10,
        },
        {
          waveNumber: 5,
          enemies: [
            { enemyTypeId: 'enemy_elite', count: 1, delay: 0 },
            { enemyTypeId: 'enemy_heavy', count: 2, delay: 2 },
            { enemyTypeId: 'enemy_drone', count: 4, delay: 3 },
            { enemyTypeId: 'enemy_scout', count: 3, delay: 4 },
          ],
          spawnPoints: [[-20, 1, -20], [20, 1, -20], [-20, 1, 20], [20, 1, 20], [0, 1, -22], [0, 1, 22]] as [number, number, number][],
          bonusObjective: 'Defeat the Elite without taking damage',
          difficultyMultiplier: 2.0,
          intermissionDuration: 5,
        },
      ],
      enemyTypes: [
        {
          enemyTypeId: 'enemy_drone',
          name: 'Combat Drone',
          description: 'Standard combat unit with balanced stats',
          behavior: 'rusher' as const,
          health: 60,
          speed: 4,
          damage: 10,
          attackRange: 8,
          attackCooldown: 1.5,
          color: '#FF4444',
          scale: 1.0,
          scoreValue: 100,
          taunts: ['TARGET ACQUIRED.', 'INITIATING COMBAT PROTOCOL.', 'YOU CANNOT ESCAPE.'],
        },
        {
          enemyTypeId: 'enemy_scout',
          name: 'Recon Scout',
          description: 'Fast and agile, flanks from the sides',
          behavior: 'flanker' as const,
          health: 40,
          speed: 7,
          damage: 8,
          attackRange: 6,
          attackCooldown: 1.0,
          color: '#44FF44',
          scale: 0.8,
          scoreValue: 150,
          taunts: ['CATCH ME IF YOU CAN!', 'TOO SLOW, HUMAN.', 'FLANKING INITIATED.'],
        },
        {
          enemyTypeId: 'enemy_heavy',
          name: 'Heavy Sentinel',
          description: 'Slow but heavily armored tank unit',
          behavior: 'tank' as const,
          health: 200,
          speed: 2,
          damage: 20,
          attackRange: 10,
          attackCooldown: 2.5,
          color: '#4444FF',
          scale: 1.5,
          scoreValue: 250,
          taunts: ['I AM INDESTRUCTIBLE.', 'YOUR WEAPONS ARE INADEQUATE.', 'PREPARE FOR ANNIHILATION.'],
        },
        {
          enemyTypeId: 'enemy_elite',
          name: 'Elite Commander',
          description: 'Boss-class enemy with high stats and sniper behavior',
          behavior: 'sniper' as const,
          health: 400,
          speed: 3,
          damage: 30,
          attackRange: 20,
          attackCooldown: 2.0,
          color: '#FF44FF',
          scale: 1.8,
          scoreValue: 500,
          taunts: ['I AM THE FINAL PROTOCOL.', 'YOUR DEFEAT WAS CALCULATED.', 'WITNESS TRUE AI SUPREMACY.'],
        },
      ],
      availableWeapons: [
        {
          weaponId: 'weapon_pistol_default',
          name: 'Sidearm P7',
          description: 'Reliable standard-issue pistol',
          type: 'pistol' as const,
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
          rarity: 'common' as const,
          color: '#8899AA',
        },
        {
          weaponId: 'weapon_rifle_ar1',
          name: 'Pulse Rifle AR-1',
          description: 'Full-auto assault rifle with moderate damage',
          type: 'rifle' as const,
          stats: {
            damage: 15,
            fireRate: 8,
            reloadTime: 1.8,
            magazineSize: 30,
            maxAmmo: 180,
            spread: 0.04,
            range: 60,
            projectileSpeed: 100,
            knockback: 3,
          },
          rarity: 'uncommon' as const,
          color: '#44AAFF',
        },
        {
          weaponId: 'weapon_shotgun_sg2',
          name: 'Scatter Cannon SG-2',
          description: 'Devastating at close range',
          type: 'shotgun' as const,
          stats: {
            damage: 60,
            fireRate: 1.2,
            reloadTime: 2.5,
            magazineSize: 6,
            maxAmmo: 36,
            spread: 0.15,
            range: 15,
            projectileSpeed: 60,
            knockback: 10,
          },
          rarity: 'uncommon' as const,
          color: '#FFAA44',
        },
      ],
      storyline: 'Rogue AI constructs have taken over the training facility. As the last human operative, you must clear the arena wave by wave to regain control.',
      completionMessage: 'Mission accomplished! The training facility has been secured. Your performance has been recorded.',
      rewards: [
        { type: 'title' as const, value: 'Arena Champion' },
        { type: 'score_multiplier' as const, value: '1.5x' },
      ],
    },
    colorSystem: {
      uiTokens: {
        primary: '#FF4444',
        secondary: '#44AAFF',
        accent: '#FFAA44',
        background: '#1a1a2a',
        text: '#ffffff',
      },
      environmentTokens: {
        sky: '#1a1a2a',
        fog: '#222233',
        ground: '#3a3a4a',
      },
    },
  };
}

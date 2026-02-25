import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db as _db } from '@/lib/db/client';
import { saves, worlds } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const db = _db as any;

// ============================================
// Save Game API
// ============================================

export async function POST(request: Request) {
  try {
    // Check if request has a body
    const text = await request.text();
    if (!text || text.length === 0) {
      console.warn('Save request received with empty body');
      return NextResponse.json(
        { error: 'Request body is empty' },
        { status: 400 }
      );
    }
    
    let body;
    try {
      body = JSON.parse(text);
    } catch (parseError) {
      console.error('Failed to parse save body:', text.substring(0, 100));
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }
    
    const {
      saveId,
      worldId,
      slotNumber = 1,
      playerName = 'Chef',
      currentRegionId,
      playerPosition,
      playerRotation = 0,
      dayNumber = 1,
      timeOfDay = 'morning',
      playTimeSeconds = 0,
      gameTimeSeconds = 0,
      inventory = [],
      completedQuests,
      completedQuestIds = [],
      activeQuests = [],
      npcRelationships = {},
      completedCookingSteps = [],
      collectedItemIds = [],
      npcConversationMemory = {},
      stamina = 100,
    } = body;
    
    // Use completedQuestIds if provided, otherwise fall back to completedQuests
    const finalCompletedQuestIds = completedQuestIds.length > 0 ? completedQuestIds : (completedQuests || []);
    
    // Verify world exists (skip if database unavailable)
    let world;
    try {
      world = await db.query.worlds.findFirst({
        where: eq(worlds.worldId, worldId),
      });
    } catch (dbError) {
      // Database unavailable - continue without verification
      console.warn('Database unavailable, skipping world verification:', dbError);
      world = null;
    }
    
    // If database is unavailable, return success but don't persist
    if (!world && process.env.VERCEL) {
      return NextResponse.json({
        success: true,
        saveId: saveId || uuidv4(),
        message: 'Save skipped (database unavailable in serverless environment)',
      });
    }
    
    if (!world) {
      return NextResponse.json(
        { error: 'World not found' },
        { status: 404 }
      );
    }
    
    const newSaveId = saveId || uuidv4();
    const now = new Date();
    
    // Check if save exists (update) or create new
    const existingSave = saveId 
      ? await db.query.saves.findFirst({ where: eq(saves.saveId, saveId) })
      : null;
    
    const saveData = {
      currentRegionId: currentRegionId || world.worldId,
      playerPositionX: Math.round((playerPosition?.[0] || 0) * 100),
      playerPositionY: Math.round((playerPosition?.[1] || 50) * 100),
      playerPositionZ: Math.round((playerPosition?.[2] || 0) * 100),
      playerRotation: Math.round((playerRotation || 0) * 100),
      dayNumber,
      timeOfDay,
      playTimeSeconds: Math.round(playTimeSeconds),
      gameTimeSeconds: Math.round(gameTimeSeconds),
      inventoryJson: JSON.stringify(inventory),
      completedQuestsJson: JSON.stringify(finalCompletedQuestIds),
      activeQuestsJson: JSON.stringify(activeQuests),
      npcRelationshipsJson: JSON.stringify(npcRelationships),
      completedCookingStepsJson: JSON.stringify(completedCookingSteps),
      collectedItemIdsJson: JSON.stringify(collectedItemIds),
      npcConversationMemoryJson: JSON.stringify(npcConversationMemory),
      stamina,
      updatedAt: now,
    };
    
    try {
      if (existingSave) {
        // Update existing save
        await db.update(saves)
          .set(saveData)
          .where(eq(saves.saveId, saveId));
        
        return NextResponse.json({
          saveId,
          message: 'Save updated successfully',
          timestamp: now.toISOString(),
        });
      } else {
        // Create new save
        await db.insert(saves).values({
          saveId: newSaveId,
          worldId,
          slotNumber,
          playerName,
          ...saveData,
        });
        
        return NextResponse.json({
          saveId: newSaveId,
          message: 'Save created successfully',
          timestamp: now.toISOString(),
        });
      }
    } catch (dbError) {
      // Database unavailable - return success but don't persist
      console.warn('Database unavailable, save not persisted:', dbError);
      return NextResponse.json({
        saveId: newSaveId,
        message: 'Save skipped (database unavailable)',
        timestamp: now.toISOString(),
      });
    }
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json(
      { error: 'Failed to save game', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

// ============================================
// Load Save API
// ============================================

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get('saveId');
    const worldId = searchParams.get('worldId');
    
    if (saveId) {
      // Load specific save
      const save = await db.query.saves.findFirst({
        where: eq(saves.saveId, saveId),
      });
      
      if (!save) {
        return NextResponse.json(
          { error: 'Save not found' },
          { status: 404 }
        );
      }
      
      // Get the associated world
      const world = await db.query.worlds.findFirst({
        where: eq(worlds.worldId, save.worldId),
      });
      
      // Parse JSON fields safely
      const parseJson = (json: string, defaultValue: any) => {
        try {
          return JSON.parse(json);
        } catch {
          return defaultValue;
        }
      };
      
      return NextResponse.json({
        save: {
          saveId: save.saveId,
          worldId: save.worldId,
          slotNumber: save.slotNumber,
          playerName: save.playerName,
          currentRegionId: save.currentRegionId,
          playerPosition: [
            save.playerPositionX / 100,
            save.playerPositionY / 100,
            save.playerPositionZ / 100,
          ],
          playerRotation: (save.playerRotation || 0) / 100,
          dayNumber: save.dayNumber,
          timeOfDay: save.timeOfDay,
          playTimeSeconds: save.playTimeSeconds,
          gameTimeSeconds: save.gameTimeSeconds || 0,
          inventory: parseJson(save.inventoryJson, []),
          completedQuestIds: parseJson(save.completedQuestsJson, []),
          activeQuests: parseJson(save.activeQuestsJson, []),
          npcRelationships: parseJson(save.npcRelationshipsJson, {}),
          completedCookingSteps: parseJson(save.completedCookingStepsJson, []),
          collectedItemIds: parseJson(save.collectedItemIdsJson || '[]', []),
          npcConversationMemory: parseJson(save.npcConversationMemoryJson || '{}', {}),
          stamina: save.stamina || 100,
          updatedAt: save.updatedAt,
        },
        world: world ? JSON.parse(world.worldJson) : null,
      });
    }
    
    if (worldId) {
      // List saves for a world
      const worldSaves = await db.query.saves.findMany({
        where: eq(saves.worldId, worldId),
        orderBy: (s: any, { desc }: any) => [desc(s.updatedAt)],
      });
      
      return NextResponse.json({
        saves: worldSaves.map((save: any) => ({
          saveId: save.saveId,
          slotNumber: save.slotNumber,
          playerName: save.playerName,
          dayNumber: save.dayNumber,
          playTimeSeconds: save.playTimeSeconds,
          updatedAt: save.updatedAt,
        })),
      });
    }
    
    // List all recent saves
    const recentSaves = await db.query.saves.findMany({
      orderBy: (s: any, { desc }: any) => [desc(s.updatedAt)],
      limit: 10,
    });
    
    return NextResponse.json({
      saves: recentSaves.map((save: any) => ({
        saveId: save.saveId,
        worldId: save.worldId,
        slotNumber: save.slotNumber,
        playerName: save.playerName,
        dayNumber: save.dayNumber,
        playTimeSeconds: save.playTimeSeconds,
        updatedAt: save.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Load error:', error);
    return NextResponse.json(
      { error: 'Failed to load saves' },
      { status: 500 }
    );
  }
}

// ============================================
// Delete Save API
// ============================================

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const saveId = searchParams.get('saveId');
    
    if (!saveId) {
      return NextResponse.json(
        { error: 'saveId is required' },
        { status: 400 }
      );
    }
    
    await db.delete(saves).where(eq(saves.saveId, saveId));
    
    return NextResponse.json({
      message: 'Save deleted successfully',
    });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete save' },
      { status: 500 }
    );
  }
}


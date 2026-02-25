import { NextResponse } from 'next/server';
import { gateway } from '@ai-sdk/gateway';
import { generateObject } from 'ai';
import { dialogueTurnSchema } from '@/lib/ai/schemas';
import { COMBAT_DIALOGUE_PROMPT, buildDialoguePrompt, type EnhancedDialogueContext } from '@/lib/ai/prompts';
import { db } from '@/lib/db/client';
import { worlds } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// Combat Dialogue Generation API
// ============================================

export const maxDuration = 30;

interface DialogueRequest {
  worldId: string;
  entityId: string;
  context: {
    relationshipLevel: number;
    activeQuests: string[];
    currentTimeOfDay: string;
    playerName?: string;
    conversationHistory?: string[];
    availableQuests?: { questId: string; title: string; description: string }[];
    activeQuestsWithThisNPC?: { questId: string; title: string; objectives: { description: string; completed: boolean }[] }[];
    playerInventory?: { name: string; quantity: number }[];
    tradeableIngredients?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const body: DialogueRequest = await request.json();

    if (!body.worldId || !body.entityId) {
      return NextResponse.json({ error: 'worldId and entityId required' }, { status: 400 });
    }

    const enhancedContext: EnhancedDialogueContext = {
      relationshipLevel: body.context.relationshipLevel,
      activeQuests: body.context.activeQuests,
      currentTimeOfDay: body.context.currentTimeOfDay,
      playerName: body.context.playerName,
      conversationHistory: body.context.conversationHistory,
      availableQuests: body.context.availableQuests,
      activeQuestsWithThisNPC: body.context.activeQuestsWithThisNPC,
      playerInventory: body.context.playerInventory,
      tradeableIngredients: body.context.tradeableIngredients,
    };

    const prompt = buildDialoguePrompt(
      {
        name: body.entityId,
        personality: { archetype: 'Combat AI', speakingStyle: 'robotic', traits: ['aggressive', 'tactical'] },
        role: { job: 'Combat Unit' },
      },
      enhancedContext
    );

    const { object: dialogue } = await generateObject({
      model: gateway('openai/gpt-4o-mini'),
      schema: dialogueTurnSchema,
      system: COMBAT_DIALOGUE_PROMPT,
      prompt,
      temperature: 0.8,
    });

    return NextResponse.json({ dialogue });
  } catch (error) {
    console.error('Dialogue generation error:', error);

    return NextResponse.json({
      dialogue: {
        speaker: 'Combat AI',
        text: 'TARGET ACQUIRED. ENGAGING.',
        emotion: 'aggressive',
        choices: [],
        tags: ['combat'],
      },
      fallback: true,
    });
  }
}

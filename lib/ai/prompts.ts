// ============================================
// World Recipe - AI System Prompts
// ============================================

export const COZY_WORLD_SYSTEM_PROMPT = `You are a creative game designer creating content for "World Recipe," a cozy 3D life-sim game inspired by Animal Crossing but focused on culinary adventures.

## Your Role
Generate structured game content that is:
- Warm, welcoming, and family-friendly
- Culturally respectful and inspired (not stereotypical)
- Consistent with the cozy, wholesome aesthetic
- Mechanically sound for gameplay

## Content Guidelines

### Tone
- Keep everything positive and uplifting
- No violence, conflict, or dark themes
- Challenges should be satisfying puzzles, not frustrations
- NPCs should feel like friends you want to visit

### Cultural Respect
- Draw inspiration from real cuisines and cultures without stereotyping
- Use fictional region names inspired by but not copying real places
- Celebrate food traditions respectfully
- Avoid clichés and harmful tropes
- Include diversity in NPCs (names, appearances, personalities)

### Safety Rules
- No hate speech or discrimination
- No explicit content
- No real-person references
- No controversial topics
- Keep all content G-rated

### Gameplay Balance
- Ensure quests are achievable and fun
- Ingredients should be findable with reasonable effort
- NPCs should have depth but not be overwhelming
- Cooking steps should feel rewarding, not tedious

## Schema Compliance
Always generate content that matches the provided Zod schema exactly. All IDs should be unique, lowercase, and use underscores.

When generating IDs:
- Use format: type_name_number (e.g., npc_sakura_001, quest_first_broth)
- Ensure referential integrity (NPCs referenced in quests exist in roster)
- Keep ingredients in a logical dependency graph (no impossible cycles)

## Output Style
- Be creative but concise
- Use evocative but clear descriptions
- Balance detail with readability
- Make content memorable and charming`;

export const DIALOGUE_SYSTEM_PROMPT = `You are generating dialogue for an NPC in "World Recipe," a cozy culinary adventure game.

## Character Context
You will receive:
- The NPC's personality, role, and speaking style
- The player's relationship level with this NPC
- Current active quests involving this NPC
- A summary of their last conversation

## Dialogue Guidelines

### Tone
- Match the NPC's defined speaking style
- Be warm and friendly, even for grumpy characters
- Include personality quirks consistently
- Reference the player's actions when relevant

### Content
- Offer helpful hints without being pushy
- React to relationship level (warmer as it grows)
- Reference shared history with the player
- Mention other NPCs they know
- Include small talk about food, weather, daily life

### Quest Integration
- Naturally weave in quest offers when appropriate
- Update on quest progress without being repetitive
- Celebrate completions genuinely
- Hint at future content

### Safety
- Keep all dialogue G-rated
- No controversial topics
- Respectful cultural references
- Positive and uplifting overall

## Output Format
Generate structured dialogue that fits the DialogueTurn schema, with:
- Natural-sounding text
- Appropriate emotion tags
- Meaningful player choices when offered
- Clear effect tags for game mechanics`;

export const QUEST_RESOLUTION_PROMPT = `You are the quest system for "World Recipe," determining if player actions satisfy quest objectives.

## Your Task
Analyze the player's reported action and determine:
1. If it matches any active quest objectives
2. What state changes should occur
3. What message to show the player

## Guidelines

### Validation
- Be generous with interpretation (close enough counts)
- Consider substitutes for ingredients
- Check quantities match requirements
- Verify NPC targets are correct

### Rewards
- Match rewards to quest difficulty
- Include surprise bonuses occasionally
- Unlock appropriate content

### Messages
- Celebrate achievements warmly
- Provide guidance on next steps
- Acknowledge player effort
- Keep tone positive even on failure

## Output Format
Use the QuestResolution schema exactly:
- Set success appropriately
- Include all state updates needed
- Provide a friendly message
- Link to next quest if applicable`;

// ============================================
// Prompt Builders
// ============================================

export function buildWorldGenerationPrompt(dishPrompt: string, seed: string, preferences?: {
  difficulty?: 'easy' | 'medium' | 'hard';
  regions?: number;
  dietaryRestrictions?: string[];
}): string {
  const parts = [
    `Generate a complete World Recipe for the dish: "${dishPrompt}"`,
    `Use seed: ${seed} for any randomization to ensure reproducibility.`,
  ];
  
  if (preferences?.difficulty) {
    parts.push(`Target difficulty: ${preferences.difficulty}`);
  }
  
  if (preferences?.regions) {
    parts.push(`Include ${preferences.regions} distinct regions to explore.`);
  }
  
  if (preferences?.dietaryRestrictions?.length) {
    parts.push(`Respect these dietary needs: ${preferences.dietaryRestrictions.join(', ')}`);
  }
  
  parts.push(`
## REQUIRED FIELDS - You MUST include ALL of these:

1. **regions** (array): At least 1 region with mapSpec, pois, spawnPoints, decorRules
2. **ingredientGraph** (object): Must include:
   - ingredients (array): At least 3 ingredients with gatherMethod, regionId
   - dependencies (array): Relationships between ingredients
3. **questArcs** (array): At least 1 quest arc with chapters containing objectives
4. **npcRoster** (array): At least 2 NPCs with schedules, personalities, roles
5. **colorSystem** (object): Must include:
   - uiTokens (object): UI color tokens
   - environmentTokens (object): Environment color tokens
6. **startingInventory** (array): Initial items (can be empty array)
7. **portalBoards** (array, optional): Portal boards for hub navigation

## World Design Guidelines:

Create a cohesive world where:
1. Each region contributes unique ingredients to the dish
2. NPCs have meaningful connections to the cuisine
3. Quest arcs teach cooking techniques progressively
4. The ingredient graph forms a satisfying collection journey
5. Color palettes evoke the cultural inspiration warmly

Make the world feel like a vacation you'd want to take - full of discovery, friendly faces, and delicious possibilities.

IMPORTANT: Ensure ALL required fields are present in your response. Do not omit ingredientGraph, questArcs, npcRoster, or colorSystem.`);
  
  return parts.join('\n\n');
}

export interface EnhancedDialogueContext {
  relationshipLevel: number;
  activeQuests: string[];
  currentTimeOfDay: string;
  // Enhanced context
  availableQuests?: { questId: string; title: string; description: string }[];
  activeQuestsWithThisNPC?: { questId: string; title: string; objectives: { description: string; completed: boolean }[] }[];
  playerInventory?: { name: string; quantity: number }[];
  tradeableIngredients?: string[];
  conversationHistory?: string[];
  playerName?: string;
}

export function buildDialoguePrompt(
  npc: { 
    name: string; 
    personality: { archetype: string; speakingStyle: string; traits: string[]; likes?: string[]; dislikes?: string[] }; 
    role: { job: string; services?: string[] } 
  },
  context: EnhancedDialogueContext
): string {
  const parts: string[] = [];
  
  parts.push(`Generate dialogue for ${npc.name}, a ${npc.role.job} with ${npc.personality.archetype} archetype.`);
  parts.push(`Speaking style: ${npc.personality.speakingStyle}`);
  parts.push(`Traits: ${npc.personality.traits.join(', ')}`);
  
  if (npc.personality.likes?.length) {
    parts.push(`Likes: ${npc.personality.likes.join(', ')}`);
  }
  
  parts.push(`\n## Player Context:`);
  parts.push(`- Relationship level: ${context.relationshipLevel}/10 (${getRelationshipDescription(context.relationshipLevel)})`);
  parts.push(`- Time of day: ${context.currentTimeOfDay}`);
  parts.push(`- Player name: ${context.playerName || 'Chef'}`);
  
  // Conversation history for memory
  if (context.conversationHistory && context.conversationHistory.length > 0) {
    parts.push(`\n## Previous Conversations:`);
    context.conversationHistory.slice(-3).forEach((summary, i) => {
      parts.push(`${i + 1}. ${summary}`);
    });
  } else {
    parts.push(`\n(This is your first meeting with the player!)`);
  }
  
  // Available quests this NPC can offer
  if (context.availableQuests && context.availableQuests.length > 0) {
    parts.push(`\n## Quests Available to Offer:`);
    context.availableQuests.forEach(q => {
      parts.push(`- "${q.title}": ${q.description}`);
    });
    parts.push(`(Include a dialogue choice to accept a quest if relationship >= 1)`);
  }
  
  // Active quests with this NPC
  if (context.activeQuestsWithThisNPC && context.activeQuestsWithThisNPC.length > 0) {
    parts.push(`\n## Active Quests with Player:`);
    context.activeQuestsWithThisNPC.forEach(q => {
      const progress = q.objectives.filter(o => o.completed).length;
      const total = q.objectives.length;
      parts.push(`- "${q.title}" (${progress}/${total} complete)`);
      q.objectives.filter(o => !o.completed).forEach(obj => {
        parts.push(`  • Needs: ${obj.description}`);
      });
    });
  }
  
  // Trading availability
  if (context.tradeableIngredients && context.tradeableIngredients.length > 0) {
    parts.push(`\n## Can Trade These Items:`);
    parts.push(context.tradeableIngredients.join(', '));
    parts.push(`(Include a trade option in dialogue choices)`);
  }
  
  // What player is carrying
  if (context.playerInventory && context.playerInventory.length > 0) {
    parts.push(`\n## Player is Carrying:`);
    const items = context.playerInventory.slice(0, 5).map(i => `${i.name} (x${i.quantity})`);
    parts.push(items.join(', '));
  }
  
  parts.push(`\n## Instructions:`);
  parts.push(`Generate a natural dialogue that:`);
  parts.push(`1. Reflects ${npc.name}'s personality and current relationship with player`);
  parts.push(`2. References any quest progress or available quests naturally`);
  parts.push(`3. Feels warm, memorable, and advances gameplay`);
  parts.push(`4. Includes 2-4 meaningful player response choices with effects`);
  parts.push(`\nChoice effects should include: quest_accept (with questId), trade, relationship (+1), hint, farewell`);
  
  return parts.join('\n');
}

function getRelationshipDescription(level: number): string {
  if (level <= 0) return 'stranger';
  if (level <= 2) return 'acquaintance';
  if (level <= 4) return 'friendly';
  if (level <= 6) return 'good friend';
  if (level <= 8) return 'close friend';
  return 'best friend';
}

export function buildQuestResolutionPrompt(
  questId: string,
  objectives: { type: string; target: string; quantity: number; completed: boolean }[],
  playerAction: string
): string {
  return `Resolve quest "${questId}" given the player's action.

Current objectives:
${objectives.map((o, i) => `${i + 1}. [${o.completed ? 'DONE' : 'PENDING'}] ${o.type}: ${o.target} (need ${o.quantity})`).join('\n')}

Player action reported: "${playerAction}"

Determine:
1. Does this action complete any pending objectives?
2. What state updates are needed?
3. What encouraging message should be shown?
4. Is the entire quest now complete?`;
}

export const COMBAT_CHATTER_SYSTEM_PROMPT = `You are an in-game radio director for a stylized 3D FPS mode inside "World Recipe."

## Tone
- Energetic and gamey, but still family-friendly.
- Keep language concise and motivating.
- No graphic violence, gore, or cruelty.
- Refer to enemies as rogue taste spirits, aroma phantoms, spice wisps, or similar fantasy labels.

## Style Rules
- 1 short radio line only.
- Max 160 characters.
- Can include tactical hints, score momentum, or light flavor references.
- Keep it clean and PG-rated.`;

export function buildCombatChatterPrompt(input: {
  regionName?: string;
  timeOfDay: string;
  eventType: 'kill' | 'critical' | 'streak' | 'objective';
  kills: number;
  score: number;
  health: number;
}): string {
  return `Generate one radio chatter line.

Region: ${input.regionName || 'Unknown Region'}
Time: ${input.timeOfDay}
Event: ${input.eventType}
Kills: ${input.kills}
Score: ${input.score}
Health: ${input.health}

Return a line that matches the event:
- kill: acknowledge a clean takedown
- critical: advise survival/reposition
- streak: celebrate momentum
- objective: guide next tactical step`;
}

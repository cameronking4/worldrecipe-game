// ============================================
// AI Arena FPS - System Prompts
// ============================================

export const FPS_WORLD_SYSTEM_PROMPT = `You are a creative game designer creating content for "AI Arena," a stylish 3D first-person shooter with AI-generated missions, enemies, and weapons.

## Your Role
Generate structured game content that is:
- Action-packed, exciting, and engaging
- Creative with unique enemy designs and behaviors
- Balanced for fun gameplay (not frustrating, not too easy)
- Visually distinctive with bold color themes

## Content Guidelines

### Tone
- High-energy, cinematic action
- Enemies are robots/AI constructs (no human-on-human violence)
- Keep it T-rated: sci-fi combat, no gore or realistic violence
- Think "Tron meets Halo" aesthetic

### Enemy Design
- Each enemy type should have a distinct personality through their taunts
- Enemies are AI constructs/robots with glowing features
- Behaviors should create varied combat encounters
- Taunts should be witty, robotic, or dramatic (never offensive)

### Arena Design
- Arenas should have interesting geometry for cover-based combat
- Include elevation changes and choke points
- Place cover strategically to encourage movement
- Spawn points should be spread around the arena perimeter

### Weapon Design
- Each weapon should feel unique and serve a different combat role
- Stats should be balanced (high damage = low fire rate, etc.)
- Names should be creative and sci-fi themed
- Colors should be vibrant and distinct

### Wave Design
- Waves should escalate in difficulty
- Mix enemy types for varied encounters
- Early waves teach mechanics, later waves challenge mastery
- Include bonus objectives for replayability

## Schema Compliance
Always generate content that matches the provided Zod schema exactly. All IDs should be unique, lowercase, use underscores.

Ensure:
- Enemy types referenced in waves exist in enemyTypes array
- Spawn points are within arena bounds
- Cover objects don't overlap
- Weapons are balanced relative to each other`;

export const COMBAT_DIALOGUE_PROMPT = `You are generating combat dialogue for an AI Arena FPS game.

## Context
Generate dialogue for AI-controlled entities. These are robotic/AI constructs, not humans.

## Guidelines
- Keep it witty and engaging
- Vary between taunting, tactical callouts, and dramatic declarations
- Never use offensive language or slurs
- Reference the player's performance when relevant
- Short and punchy (1-2 sentences max)

## Output Format
Use the DialogueTurn schema with appropriate emotion tags.`;

// ============================================
// Prompt Builders
// ============================================

export function buildMissionGenerationPrompt(
  missionTheme: string,
  seed: string,
  preferences?: {
    difficulty?: 'easy' | 'medium' | 'hard' | 'nightmare';
    waveCount?: number;
    arenaTheme?: string;
  }
): string {
  const parts = [
    `Generate a complete FPS mission for the theme: "${missionTheme}"`,
    `Use seed: ${seed} for any randomization.`,
  ];

  if (preferences?.difficulty) {
    parts.push(`Target difficulty: ${preferences.difficulty}`);
  }

  if (preferences?.waveCount) {
    parts.push(`Include ${preferences.waveCount} waves.`);
  }

  if (preferences?.arenaTheme) {
    parts.push(`Arena theme: ${preferences.arenaTheme}`);
  }

  parts.push(`
## REQUIRED FIELDS:

1. **missionId**: Unique string ID
2. **name**: Catchy mission name
3. **briefing**: 2-3 sentence mission briefing
4. **difficulty**: ${preferences?.difficulty || 'medium'}
5. **arena**: Complete arena spec with:
   - Name, description, theme
   - Dimensions (width/height, 50x50 default)
   - Player spawn point (center area, ground level y=0 or y=1)
   - 4-6 enemy spawn points (around perimeter)
   - 8-15 cover objects (walls, crates, pillars, barriers)
   - 4-6 pickup locations (health, ammo)
   - Color palette
6. **waves**: ${preferences?.waveCount || '5'} progressive waves with:
   - Increasing difficulty multiplier (1.0 to 2.0+)
   - Mixed enemy type compositions
   - Spawn point references
   - Intermission duration (5-10 seconds)
7. **enemyTypes**: 3-5 distinct enemy types with:
   - Unique behaviors (rusher, sniper, flanker, tank, bomber, support)
   - Appropriate stats for behavior
   - 2-3 combat taunts each
   - Distinct colors
8. **availableWeapons**: 3-4 weapons with:
   - Different types (pistol always included + 2-3 others)
   - Balanced stats
   - Cool sci-fi names
   - Distinct colors

## Arena Layout Guidelines:
- Cover objects positions should be in range [-24, 24] for x and z
- Cover heights (y component of size) between 1 and 3
- Player spawn near center (0, 1, 0)
- Enemy spawns near walls (x or z around 20-22)
- Pickup locations spread around the map

## Balance Guidelines by Difficulty:
- Easy: 3-4 waves, 2-3 enemies per wave, enemies have low HP/damage
- Medium: 5 waves, 3-5 enemies per wave, moderate stats
- Hard: 6-8 waves, 5-8 enemies per wave, high stats
- Nightmare: 8-10 waves, 8-12 enemies per wave, extreme stats

Make the mission feel epic and memorable!`);

  return parts.join('\n\n');
}

export interface EnhancedDialogueContext {
  relationshipLevel: number;
  activeQuests: string[];
  currentTimeOfDay: string;
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
    role: { job: string; services?: string[] };
  },
  context: EnhancedDialogueContext
): string {
  return `Generate combat dialogue for ${npc.name}, a ${npc.role.job}.
Speaking style: ${npc.personality.speakingStyle}
Traits: ${npc.personality.traits.join(', ')}
Context: Wave combat, player relationship level ${context.relationshipLevel}/10
Generate a short, punchy line with 2-3 response choices.`;
}

export function buildQuestResolutionPrompt(
  questId: string,
  objectives: { type: string; target: string; quantity: number; completed: boolean }[],
  playerAction: string
): string {
  return `Evaluate mission progress for "${questId}":
Objectives: ${objectives.map((o, i) => `${i + 1}. [${o.completed ? 'DONE' : 'PENDING'}] ${o.type}: ${o.target}`).join(', ')}
Player action: "${playerAction}"
Determine completion status.`;
}

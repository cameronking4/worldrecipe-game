import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// ============================================
// World Recipe - Database Schema (SQLite)
// ============================================

// Worlds table - stores generated WorldRecipe objects
export const worlds = sqliteTable('worlds', {
  worldId: text('world_id').primaryKey(),
  seed: text('seed').notNull(),
  dishName: text('dish_name').notNull(),
  modelVersion: text('model_version'),
  promptVersion: text('prompt_version'),
  worldJson: text('world_json').notNull(), // Full WorldRecipe JSON
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Saves table - stores player progress
export const saves = sqliteTable('saves', {
  saveId: text('save_id').primaryKey(),
  worldId: text('world_id')
    .notNull()
    .references(() => worlds.worldId, { onDelete: 'cascade' }),
  slotNumber: integer('slot_number').notNull().default(1),
  playerName: text('player_name').default('Chef'),
  
  // Player position and state
  currentRegionId: text('current_region_id').notNull(),
  playerPositionX: integer('player_position_x').notNull().default(0),
  playerPositionY: integer('player_position_y').notNull().default(0),
  playerPositionZ: integer('player_position_z').notNull().default(0),
  
  // Game time
  dayNumber: integer('day_number').notNull().default(1),
  timeOfDay: text('time_of_day').notNull().default('morning'),
  playTimeSeconds: integer('play_time_seconds').notNull().default(0),
  
  // Progress data as JSON
  inventoryJson: text('inventory_json').notNull().default('[]'),
  completedQuestsJson: text('completed_quests_json').notNull().default('[]'),
  activeQuestsJson: text('active_quests_json').notNull().default('[]'),
  npcRelationshipsJson: text('npc_relationships_json').notNull().default('{}'),
  completedCookingStepsJson: text('completed_cooking_steps_json').notNull().default('[]'),
  collectedItemIdsJson: text('collected_item_ids_json').notNull().default('[]'),
  npcConversationMemoryJson: text('npc_conversation_memory_json').notNull().default('{}'),
  
  // Player stats
  stamina: integer('stamina').notNull().default(100),
  playerRotation: integer('player_rotation').notNull().default(0),
  gameTimeSeconds: integer('game_time_seconds').notNull().default(0),
  
  // Timestamps
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Events table - for telemetry and debugging
export const events = sqliteTable('events', {
  eventId: integer('event_id').primaryKey({ autoIncrement: true }),
  worldId: text('world_id').references(() => worlds.worldId),
  saveId: text('save_id').references(() => saves.saveId),
  eventType: text('event_type').notNull(),
  payloadJson: text('payload_json'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// AI Generation cache table
export const aiGenerations = sqliteTable('ai_generations', {
  generationId: text('generation_id').primaryKey(),
  worldId: text('world_id').references(() => worlds.worldId),
  generationType: text('generation_type').notNull(), // 'world', 'region', 'dialogue', 'quest'
  inputHash: text('input_hash').notNull(), // Hash of input for cache lookup
  outputJson: text('output_json').notNull(),
  modelUsed: text('model_used'),
  tokensUsed: integer('tokens_used'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
}, (table) => ({
  inputHashIdx: index('ai_generations_input_hash_idx').on(table.inputHash),
}));

// Type exports for Drizzle
export type World = typeof worlds.$inferSelect;
export type NewWorld = typeof worlds.$inferInsert;
export type Save = typeof saves.$inferSelect;
export type NewSave = typeof saves.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type AIGeneration = typeof aiGenerations.$inferSelect;
export type NewAIGeneration = typeof aiGenerations.$inferInsert;


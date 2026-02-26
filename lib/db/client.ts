import { drizzle } from 'drizzle-orm/better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// ============================================
// Database Client Setup
// ============================================

let sqlite: Database.Database | null = null;
type DbClient = BetterSQLite3Database<typeof schema>;
let db: DbClient | null = null;

// Try to initialize SQLite database
// Will fail gracefully in serverless environments (Vercel, etc.)
try {
  sqlite = new Database('worldrecipe.db');
  sqlite.pragma('journal_mode = WAL');
  db = drizzle(sqlite, { schema });
} catch (error) {
  // Database unavailable (common in serverless environments)
  console.warn('SQLite database unavailable:', error instanceof Error ? error.message : error);
  console.warn('Continuing without database (caching and persistence disabled)');
  sqlite = null;
  db = null;
}

// Create a safe database wrapper that handles missing database gracefully
const safeDb = {
  query: db?.query || {
    worlds: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    aiGenerations: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    saves: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    events: {
      findFirst: async () => null,
      findMany: async () => [],
    },
  },
  insert: db?.insert || (() => ({
    values: async () => ({}),
  })),
  update: db?.update || (() => ({
    set: () => ({
      where: async () => ({}),
    }),
  })),
  delete: db?.delete || (() => ({
    where: async () => ({}),
  })),
};

// Export the safe database wrapper as the default db
export { safeDb as db };

// Export schema for use in queries
export { schema };

// Helper function to close the database connection
export function closeDatabase() {
  if (sqlite) {
    sqlite.close();
  }
}

// Helper to check if database is connected
export function isDatabaseConnected(): boolean {
  if (!sqlite || !db) return false;
  try {
    sqlite.pragma('table_info(worlds)');
    return true;
  } catch {
    return false;
  }
}

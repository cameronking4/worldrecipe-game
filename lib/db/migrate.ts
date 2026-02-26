import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Run migrations
console.log('Running migrations...');
const sqlite = new Database('worldrecipe.db');
const migrationDb = drizzle(sqlite, { schema });
migrate(migrationDb, { migrationsFolder: './drizzle' });
sqlite.close();
console.log('Migrations completed!');

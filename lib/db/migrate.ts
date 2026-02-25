import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { db } from './client';

// Run migrations
console.log('Running migrations...');
migrate(db as any, { migrationsFolder: './drizzle' });
console.log('Migrations completed!');


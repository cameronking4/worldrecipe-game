# World Recipe

A cozy 3D life-sim prototype where each run generates a dish-themed world with NPCs, quests, ingredients, and cooking steps.

## What it does
- Generates a world from a dish prompt using AI.
- Renders a playable 3D scene with React Three Fiber.
- Supports NPC dialogue and quest resolution via API routes.
- Persists worlds and save slots to local SQLite when available.
- Falls back gracefully in environments where SQLite is unavailable.

## Tech stack
- Next.js 16 (App Router)
- React 19 + TypeScript
- Three.js + React Three Fiber + Drei + Rapier
- Zustand for client state
- Vercel AI SDK + AI Gateway
- Drizzle ORM + better-sqlite3 (SQLite)

## Project structure
```text
app/
  page.tsx                     # Main menu
  game/page.tsx                # Game runtime shell
  api/ai/world/route.ts        # World generation + retrieval
  api/ai/npc/dialogue/route.ts # NPC dialogue generation
  api/ai/quests/resolve/route.ts # Quest resolution
  api/save/route.ts            # Save/load endpoints

components/game/               # 3D scene and controllers
components/ui/                 # HUD, panels, dialogs, toasts
lib/ai/                        # Prompt + schema definitions
lib/db/                        # Drizzle schema/client/migrations
lib/store/                     # Zustand stores
types/game.ts                  # Core game types
```

## Prerequisites
- Node.js 20+
- npm (or pnpm)

## Setup
1. Install dependencies:
```bash
npm install
```

2. Create `.env.local`:
```bash
AI_GATEWAY_API_KEY=your_key_here
```

3. Run DB migrations:
```bash
npm run db:migrate
```

4. Start development server:
```bash
npm run dev
```

Open `http://localhost:3000`.

## Available scripts
- `npm run dev` - Start dev server
- `npm run build` - Production build
- `npm run start` - Run production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Drizzle migration files
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema directly to SQLite
- `npm run db:studio` - Open Drizzle Studio

## Gameplay flow
1. Select a dish on the home screen.
2. `POST /api/ai/world` generates world data.
3. Game loads into `/game` and attempts to restore latest save.
4. Autosave periodically writes to `POST /api/save`.

## API summary
- `POST /api/ai/world` - Generate a world (`dishPrompt` required)
- `GET /api/ai/world?worldId=...` - Fetch one world
- `GET /api/ai/world` - List recent worlds
- `POST /api/ai/npc/dialogue` - Generate NPC dialogue
- `POST /api/ai/quests/resolve` - Resolve a quest action
- `POST /api/save` - Create/update save
- `GET /api/save?saveId=...` - Load save
- `GET /api/save?worldId=...` - List saves for world

## Controls
- `WASD` - Move
- `E` - Interact
- `Esc` - Pause menu

## Notes
- Local persistence uses `worldrecipe.db` in the project root.
- In serverless environments where SQLite is unavailable, APIs return graceful fallback responses so playtesting can continue.

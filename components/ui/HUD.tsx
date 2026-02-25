'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useWorldStore } from '@/lib/store/worldStore';
import { usePortalStore } from '@/lib/store/portalStore';
import { useCombatStore } from '@/lib/store/combatStore';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { normalizePosition, type Position } from '@/types/game';

// Helper to get position as tuple for backward compatibility
function getPos(pos: Position): [number, number] {
  return normalizePosition(pos);
}

// ============================================
// Animated Number Display
// ============================================
function AnimatedNumber({ value, duration = 500 }: { value: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  
  useEffect(() => {
    const startValue = displayValue;
    const diff = value - startValue;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + diff * eased));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);
  
  return <>{displayValue}</>;
}

// ============================================
// Time Display Component - Enhanced
// ============================================
function TimeDisplay() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const dayNumber = useGameStore((s) => s.dayNumber);
  
  const timeConfig = {
    morning: { icon: '🌅', label: 'Morning', gradient: 'from-amber-400 to-orange-300' },
    day: { icon: '☀️', label: 'Daytime', gradient: 'from-sky-400 to-blue-300' },
    evening: { icon: '🌆', label: 'Evening', gradient: 'from-orange-500 to-red-400' },
    night: { icon: '🌙', label: 'Night', gradient: 'from-indigo-600 to-purple-500' },
  };
  
  const config = timeConfig[timeOfDay];
  
  return (
    <Card className={`hud-card px-4 py-2.5 bg-gradient-to-r ${config.gradient} border-0 shadow-lg`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl animate-pulse-slow drop-shadow-lg">{config.icon}</span>
        <div>
          <p className="text-sm font-bold text-white drop-shadow-sm">{config.label}</p>
          <p className="text-xs text-white/80 font-medium">Day {dayNumber}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Region Display
// ============================================
function RegionDisplay() {
  const region = useWorldStore((s) => s.currentRegion);
  const world = useWorldStore((s) => s.world);
  const isInPortal = usePortalStore((s) => s.isInPortal);
  const portalBoard = usePortalStore((s) => s.getCurrentPortalBoard());
  
  if (!world) return null;
  
  // Show portal name if in portal, otherwise show region
  const displayName = isInPortal && portalBoard 
    ? portalBoard.name 
    : region?.name || 'Unknown';
  
  const displayDescription = isInPortal && portalBoard
    ? portalBoard.description
    : region?.inspiration.countryOrArea || '';
  
  const icon = isInPortal ? '🌀' : '🗺️';
  
  return (
    <Card className="hud-card px-4 py-2 bg-card/95 backdrop-blur-md border-primary/20 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-xs font-bold text-foreground">{displayName}</p>
          <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
            {displayDescription}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Enhanced Mini Map Component
// ============================================

// Seeded random for consistent spawn positions on minimap
function seededRandom(seed: string) {
  let hash = 0;
  if (!seed || seed.length === 0) seed = 'default-seed';
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  if (hash === 0) hash = 1;
  return function() {
    hash = Math.sin(hash) * 10000;
    const result = hash - Math.floor(hash);
    return Number.isFinite(result) ? result : 0.5;
  };
}

function MiniMap() {
  const [showLegend, setShowLegend] = useState(false);
  const position = usePlayerStore((s) => s.position);
  const rotation = usePlayerStore((s) => s.rotation);
  const collectedItemIds = usePlayerStore((s) => s.collectedItemIds);
  const region = useWorldStore((s) => s.currentRegion);
  const world = useWorldStore((s) => s.world);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  
  // POIs can be at region level or mapSpec level (AI may generate either)
  const pois = region ? [...(region.pois || []), ...(region.mapSpec?.pois || [])] : [];
  const npcs = world?.npcRoster || [];
  const ingredients = world?.ingredientGraph.ingredients || [];
  const mapWidth = region?.mapSpec?.grid?.width || 50;
  const mapHeight = region?.mapSpec?.grid?.height || 50;
  const mapSize = Math.max(mapWidth, mapHeight);
  
  // Calculate ingredient positions (same logic as Interactable)
  const ingredientPositions = ingredients
    .filter(i => 
      i.regionId === region?.regionId &&
      (i.gatherMethod === 'pickup' || i.gatherMethod === 'harvest') &&
      !collectedItemIds.includes(i.ingredientId)
    )
    .map((ingredient, index) => {
      const random = seededRandom((world?.seed || 'seed') + ingredient.ingredientId + index);
      const angle = random() * Math.PI * 2;
      const distance = 8 + random() * (mapSize / 2 - 10);
      let x = Math.cos(angle) * distance;
      let z = Math.sin(angle) * distance;
      x = Math.max(-mapWidth / 2 + 3, Math.min(mapWidth / 2 - 3, x));
      z = Math.max(-mapHeight / 2 + 3, Math.min(mapHeight / 2 - 3, z));
      return { ingredient, x, z };
    });
  
  // Get NPC positions based on schedule with offsets to prevent overlap
  const npcPositions = npcs.map(npc => {
    // Generate a consistent offset for this NPC based on their ID
    const npcHash = npc.npcId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetAngle = (npcHash % 8) * (Math.PI / 4);
    const offsetDistance = 1.5 + (npcHash % 3) * 0.5;
    const offsetX = Math.cos(offsetAngle) * offsetDistance;
    const offsetZ = Math.sin(offsetAngle) * offsetDistance;
    
    const schedule = npc.schedule.find(s => s.timeOfDay === timeOfDay) || npc.schedule[0];
    const scheduleLocation = schedule?.locationId || '';
    
    // Try direct POI match
    let poi = pois.find(p => p.poiId === scheduleLocation);
    
    // Try fuzzy match if direct match fails
    if (!poi) {
      poi = pois.find(p => 
        p.name.toLowerCase().includes(scheduleLocation.toLowerCase()) ||
        p.type === scheduleLocation ||
        scheduleLocation.includes(p.poiId)
      );
    }
    
    if (poi) {
      const [px, py] = getPos(poi.position);
      return {
        npc,
        x: px + offsetX,
        y: py + offsetZ,
      };
    }
    
    // Fallback: spread NPCs around based on hash
    const fallbackAngle = (npcHash % 12) * (Math.PI / 6);
    const fallbackDistance = 8 + (npcHash % 10);
    return {
      npc,
      x: Math.cos(fallbackAngle) * fallbackDistance,
      y: Math.sin(fallbackAngle) * fallbackDistance,
    };
  });
  
  // poiIcons kept for potential future use
  // const poiIcons: Record<string, string> = {
  //   market: '🏪',
  //   kitchen_hut: '🏠',
  //   dock: '⚓',
  //   shrine: '⛩️',
  //   farm: '🌾',
  //   npc_home: '🏡',
  //   gathering_spot: '🌿',
  //   portal: '🌀',
  // };
  
  const poiColors: Record<string, string> = {
    market: 'bg-yellow-400',
    kitchen_hut: 'bg-red-400',
    dock: 'bg-blue-400',
    shrine: 'bg-pink-400',
    farm: 'bg-green-400',
    npc_home: 'bg-orange-400',
    gathering_spot: 'bg-lime-400',
    portal: 'bg-purple-500',
  };
  
  const portalTypeColors: Record<string, string> = {
    farm: 'bg-green-500',
    grocery_store: 'bg-yellow-500',
    kitchen: 'bg-red-500',
    foraging_grounds: 'bg-amber-600',
    exotic_garden: 'bg-purple-500',
  };
  
  const ingredientColors: Record<string, string> = {
    vegetable: 'bg-green-400',
    protein: 'bg-red-400',
    grain: 'bg-amber-400',
    spice: 'bg-orange-400',
    liquid: 'bg-blue-400',
  };
  
  // Get trade ingredients and their NPC locations
  const tradeIngredients = ingredients
    .filter(i => 
      i.regionId === region?.regionId &&
      i.gatherMethod === 'trade'
    )
    .map(ingredient => {
      // Find an NPC who might trade this item (market or shop NPCs)
      const tradingNpc = npcs.find(npc => 
        npc.role.services.some(s => 
          s.toLowerCase().includes('trade') || 
          s.toLowerCase().includes('sell') ||
          s.toLowerCase().includes('shop')
        )
      );
      const npcPos = tradingNpc ? npcPositions.find(p => p.npc.npcId === tradingNpc.npcId) : null;
      return { ingredient, npcPos };
    })
    .filter(item => item.npcPos);
  
  return (
    <Card 
      className="hud-card w-40 h-40 bg-card/95 backdrop-blur-md border-primary/20 overflow-hidden shadow-xl cursor-pointer"
      onClick={() => setShowLegend(!showLegend)}
    >
      <div className="relative w-full h-full">
        {/* Map background with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/80 to-emerald-800/60" />
        
        {/* Grid lines */}
        <div className="absolute inset-1 grid grid-cols-8 grid-rows-8">
          {Array.from({ length: 64 }).map((_, i) => (
            <div key={i} className="border border-emerald-600/15" />
          ))}
        </div>
        
        {/* Ingredient indicators (small dots) */}
        {ingredientPositions.map(({ ingredient, x, z }) => {
          const mapX = 50 + (x / mapSize) * 80;
          const mapY = 50 + (z / mapSize) * 80;
          
          return (
            <div
              key={ingredient.ingredientId}
              className={`absolute w-1.5 h-1.5 ${ingredientColors[ingredient.category] || 'bg-purple-400'} rounded-full transform -translate-x-1/2 -translate-y-1/2 opacity-70 animate-pulse`}
              style={{
                left: `${Math.max(5, Math.min(95, mapX))}%`,
                top: `${Math.max(5, Math.min(95, mapY))}%`,
              }}
              title={ingredient.name}
            />
          );
        })}
        
        {/* POI indicators */}
        {pois.map((poi) => {
          const [px, py] = getPos(poi.position);
          const x = 50 + (px / mapSize) * 80;
          const y = 50 + (py / mapSize) * 80;
          
          // Portal POIs get special styling
          const isPortal = poi.type === 'portal';
          const portalColor = isPortal && poi.portalType 
            ? portalTypeColors[poi.portalType] || 'bg-purple-500'
            : poiColors[poi.type] || 'bg-purple-400';
          
          return (
            <div
              key={poi.poiId}
              className={`absolute ${isPortal ? 'w-3 h-3' : 'w-2.5 h-2.5'} ${portalColor} ${isPortal ? 'rounded-full animate-pulse' : 'rounded-sm'} transform -translate-x-1/2 -translate-y-1/2 opacity-90 border-2 ${isPortal ? 'border-white' : 'border-white/30'}`}
              style={{
                left: `${Math.max(8, Math.min(92, x))}%`,
                top: `${Math.max(8, Math.min(92, y))}%`,
              }}
              title={poi.name}
            />
          );
        })}
        
        {/* NPC indicators */}
        {npcPositions.map(({ npc, x, y }) => {
          const mapX = 50 + (x / mapSize) * 80;
          const mapY = 50 + (y / mapSize) * 80;
          const canTrade = npc.role.services.some(s => 
            s.toLowerCase().includes('trade') || 
            s.toLowerCase().includes('sell') ||
            s.toLowerCase().includes('shop')
          );
          
          return (
            <div
              key={npc.npcId}
              className={`absolute w-2 h-2 ${canTrade ? 'bg-yellow-400' : 'bg-fuchsia-400'} rounded-full transform -translate-x-1/2 -translate-y-1/2 border border-white/50 shadow-sm ${canTrade ? 'ring-1 ring-yellow-300' : ''}`}
              style={{
                left: `${Math.max(8, Math.min(92, mapX))}%`,
                top: `${Math.max(8, Math.min(92, mapY))}%`,
              }}
              title={`${npc.name}${canTrade ? ' (Trader)' : ''}`}
            />
          );
        })}
        
        {/* Trade ingredient indicators near NPCs */}
        {tradeIngredients.map(({ ingredient, npcPos }) => {
          if (!npcPos) return null;
          const mapX = 50 + ((npcPos.x + 1.5) / mapSize) * 80;
          const mapY = 50 + ((npcPos.y - 1) / mapSize) * 80;
          
          return (
            <div
              key={`trade-${ingredient.ingredientId}`}
              className="absolute w-1.5 h-1.5 bg-yellow-300 rounded transform -translate-x-1/2 -translate-y-1/2 opacity-80 border border-yellow-500"
              style={{
                left: `${Math.max(5, Math.min(95, mapX))}%`,
                top: `${Math.max(5, Math.min(95, mapY))}%`,
              }}
              title={`${ingredient.name} (Trade)`}
            />
          );
        })}
        
        {/* Player indicator with direction */}
        <div
          className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-100 z-10"
          style={{
            left: `${50 + (position[0] / mapSize) * 80}%`,
            top: `${50 + (position[2] / mapSize) * 80}%`,
          }}
        >
          {/* Direction indicator */}
          <div 
            className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[10px] border-l-transparent border-r-transparent border-b-cyan-400 absolute -top-2 left-1/2 drop-shadow-glow"
            style={{ transform: `translateX(-50%) rotate(${-rotation}rad)` }}
          />
          {/* Player dot */}
          <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full shadow-glow-cyan border-2 border-white" />
        </div>
        
        {/* Compass */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[9px] font-bold text-cyan-300 drop-shadow">
          N
        </div>
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[7px] text-cyan-300/50">
          S
        </div>
        <div className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[7px] text-cyan-300/50">
          W
        </div>
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[7px] text-cyan-300/50">
          E
        </div>
        
        {/* Frame decoration */}
        <div className="absolute inset-0 border-2 border-cyan-500/30 rounded-lg pointer-events-none" />
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400 rounded-tr-lg" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400 rounded-bl-lg" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400 rounded-br-lg" />
        
        {/* Legend overlay */}
        {showLegend && (
          <div className="absolute inset-0 bg-black/90 p-2 text-[8px] space-y-1 animate-in fade-in duration-150 overflow-y-auto">
            <div className="font-bold text-white text-[9px] mb-1">Map Legend</div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-cyan-400 rounded-full border border-white" />
              <span className="text-white/80">You</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-fuchsia-400 rounded-full" />
              <span className="text-white/80">NPCs</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-full ring-1 ring-yellow-300" />
              <span className="text-white/80">Traders</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-400 rounded-sm" />
              <span className="text-white/80">Locations</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
              <span className="text-white/80">Pick up</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-yellow-300 rounded border border-yellow-500" />
              <span className="text-white/80">Trade items</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 bg-purple-500 rounded-full animate-pulse border-2 border-white" />
              <span className="text-white/80">Portals</span>
            </div>
            <div className="text-white/40 mt-1 text-[7px]">Click to close</div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// Enhanced Stamina Bar
// ============================================
function StaminaBar() {
  const stamina = usePlayerStore((s) => s.stamina);
  const maxStamina = usePlayerStore((s) => s.maxStamina);
  const percentage = (stamina / maxStamina) * 100;
  
  const getColor = () => {
    if (percentage > 60) return 'bg-emerald-500';
    if (percentage > 30) return 'bg-yellow-500';
    return 'bg-red-500 animate-pulse';
  };
  
  return (
    <Card className="hud-card px-3 py-2.5 bg-card/95 backdrop-blur-md border-primary/20 w-44 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">⚡</span>
        <div className="flex-1">
          <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden shadow-inner">
            <div 
              className={`h-full ${getColor()} transition-all duration-300 rounded-full shadow-sm`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 text-right">
            {Math.round(stamina)}/{maxStamina}
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Dish Progress Tracker
// ============================================
function DishProgress() {
  const world = useWorldStore((s) => s.world);
  const completedSteps = usePlayerStore((s) => s.completedCookingSteps);
  
  if (!world) return null;
  
  const totalArcs = world.questArcs.length;
  const completedArcs = world.questArcs.filter(
    arc => arc.unlocksCookingStepId && completedSteps.includes(arc.unlocksCookingStepId)
  ).length;
  
  const percentage = totalArcs > 0 ? (completedArcs / totalArcs) * 100 : 0;
  
  return (
    <Card className="hud-card px-3 py-2.5 bg-gradient-to-r from-amber-900/90 to-orange-900/90 border-amber-500/30 w-44 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-lg">🍳</span>
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-amber-200 truncate">{world.dish.name}</p>
          <div className="h-1.5 bg-amber-950/50 rounded-full overflow-hidden mt-1">
            <div 
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500 rounded-full"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-[9px] text-amber-300/70 mt-0.5">
            {completedArcs}/{totalArcs} steps complete
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Quest Tracker - Enhanced with Guidance
// ============================================
function QuestTracker() {
  const activeQuests = usePlayerStore((s) => s.activeQuests);
  const world = useWorldStore((s) => s.world);
  
  // Helper to get guidance for an objective
  const getObjectiveGuidance = (objective: { type: string; target: string; quantity?: number; completed: boolean }) => {
    if (objective.completed) return null;
    
    const objectiveIcons: Record<string, string> = {
      gather: '🌿',
      talk: '💬',
      deliver: '📦',
      craft: '🔨',
      'cook-step': '🍳',
    };
    
    switch (objective.type) {
      case 'gather': {
        // Check if ingredient is trade-only
        const ingredient = world?.ingredientGraph.ingredients.find(i => i.ingredientId === objective.target);
        if (ingredient?.gatherMethod === 'trade') {
          return { icon: '🔄', hint: 'Trade with an NPC' };
        }
        return { icon: objectiveIcons.gather, hint: 'Explore the map' };
      }
      case 'talk': {
        const npc = world?.npcRoster.find(n => n.npcId === objective.target);
        return { icon: objectiveIcons.talk, hint: npc ? `Find ${npc.name}` : 'Find the NPC' };
      }
      case 'deliver': {
        return { icon: objectiveIcons.deliver, hint: 'Return to quest giver' };
      }
      case 'craft':
        return { icon: objectiveIcons.craft, hint: 'Use cooking station' };
      case 'cook-step':
        return { icon: objectiveIcons['cook-step'], hint: 'Press C to cook' };
      default:
        return null;
    }
  };
  
  if (activeQuests.length === 0) {
    return (
      <Card className="hud-card px-4 py-3 bg-card/90 backdrop-blur-md border-muted/30 max-w-xs shadow-lg">
        <div className="text-center py-2">
          <span className="text-2xl mb-2 block">📜</span>
          <p className="text-xs text-muted-foreground">No active quests</p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            🗣️ Talk to NPCs (pink dots on map) to find quests!
          </p>
        </div>
      </Card>
    );
  }
  
  const currentQuest = activeQuests[0];
  const completedObjectives = currentQuest.objectives.filter((o) => o.completed).length;
  const totalObjectives = currentQuest.objectives.length;
  const progress = (completedObjectives / totalObjectives) * 100;
  const nextObjective = currentQuest.objectives.find(o => !o.completed);
  
  return (
    <Card className="hud-card px-4 py-3 bg-card/95 backdrop-blur-md border-primary/20 max-w-xs shadow-lg animate-in slide-in-from-right">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">📜</span>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Quest</span>
          </div>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
            {completedObjectives}/{totalObjectives}
          </Badge>
        </div>
        
        {/* Progress bar */}
        <div className="h-1 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        <p className="text-sm font-semibold text-foreground">{currentQuest.title}</p>
        
        {/* Current objective hint */}
        {nextObjective && (
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-lg p-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-400">💡</span>
              <span className="text-amber-200 font-medium">
                {getObjectiveGuidance(nextObjective)?.hint || 'Complete the objective'}
              </span>
            </div>
          </div>
        )}
        
        <div className="space-y-1.5 max-h-28 overflow-y-auto">
          {currentQuest.objectives.map((objective) => {
            const guidance = getObjectiveGuidance(objective);
            return (
              <div
                key={objective.objectiveId}
                className={`text-xs flex items-start gap-2 p-1.5 rounded transition-all ${
                  objective.completed 
                    ? 'text-muted-foreground bg-muted/30 line-through opacity-60' 
                    : 'text-foreground bg-primary/10'
                }`}
              >
                <span className={`mt-0.5 ${objective.completed ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                  {objective.completed ? '✓' : guidance?.icon || '○'}
                </span>
                <span className="flex-1">{objective.description}</span>
              </div>
            );
          })}
        </div>
        
        {/* All complete? */}
        {completedObjectives === totalObjectives && (
          <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-2 text-xs text-center">
            <span className="text-emerald-300">✨ Return to quest giver to complete!</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// Portal Status Component
// ============================================
function PortalStatus() {
  const world = useWorldStore((s) => s.world);
  const isInPortal = usePortalStore((s) => s.isInPortal);
  const canAccessPortal = usePortalStore((s) => s.canAccessPortal);
  
  if (!world || isInPortal) return null; // Don't show in portal, only in hub
  
  const region = useWorldStore.getState().currentRegion;
  if (!region) return null;
  
  const allPois = [...(region.pois || []), ...(region.mapSpec?.pois || [])];
  const portalPois = allPois.filter(p => p.type === 'portal');
  
  if (portalPois.length === 0) return null;
  
  const portalIcons: Record<string, string> = {
    farm: '🌾',
    grocery_store: '🏪',
    kitchen: '🍳',
    foraging_grounds: '🌿',
    exotic_garden: '🌺',
  };
  
  return (
    <Card className="hud-card px-3 py-2 bg-card/90 backdrop-blur-md border-muted/30 max-w-xs shadow-lg mt-2">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🌀</span>
        <span className="text-xs font-bold text-foreground">Portals</span>
      </div>
      <div className="space-y-1.5">
        {portalPois.map((poi) => {
          if (!poi.portalType) return null;
          const accessible = canAccessPortal(poi);
          const icon = portalIcons[poi.portalType] || '🌀';
          
          return (
            <div
              key={poi.poiId}
              className={`text-xs flex items-center gap-2 p-1.5 rounded transition-all ${
                accessible 
                  ? 'text-foreground bg-primary/10' 
                  : 'text-muted-foreground bg-muted/30 opacity-60'
              }`}
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1">{poi.name}</span>
              {poi.portalType === 'kitchen' && !accessible && (
                <span className="text-[10px] text-amber-400">🔒</span>
              )}
            </div>
          );
        })}
        {portalPois.some(p => p.portalType === 'kitchen' && !canAccessPortal(p)) && (
          <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t border-border/30">
            💡 Collect all ingredients to unlock kitchen!
          </div>
        )}
      </div>
    </Card>
  );
}

// ============================================
// Interaction Prompt - Enhanced
// ============================================
function InteractionPrompt() {
  const prompt = useGameStore((s) => s.interactionPrompt);
  
  if (!prompt.visible) return null;
  
  return (
    <div className="fixed bottom-32 left-1/2 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-200 z-50">
      <Card className="px-6 py-3 bg-card/98 backdrop-blur-md border-primary shadow-2xl shadow-primary/20">
        <div className="flex items-center gap-4">
          <div className="relative">
            <kbd className="px-3 py-1.5 text-sm font-bold font-mono bg-primary text-primary-foreground rounded-lg shadow-lg animate-bounce-subtle">
              E
            </kbd>
            <div className="absolute inset-0 bg-primary rounded-lg blur-md opacity-50 -z-10" />
          </div>
          <span className="text-sm font-semibold text-foreground">{prompt.text}</span>
        </div>
      </Card>
    </div>
  );
}

// ============================================
// Quick Action Buttons - Enhanced
// ============================================
function QuickActions() {
  const toggleJournal = useGameStore((s) => s.toggleJournal);
  const toggleInventory = useGameStore((s) => s.toggleInventory);
  const toggleCooking = useGameStore((s) => s.toggleCooking);
  const inventory = usePlayerStore((s) => s.inventory);
  
  const itemCount = inventory.reduce((acc, stack) => acc + stack.quantity, 0);
  
  return (
    <Card className="hud-card bg-card/95 backdrop-blur-md border-primary/20 p-1.5 shadow-lg">
      <div className="flex gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleInventory}
          className="w-11 h-11 p-0 relative hover:bg-primary/20 hover:scale-105 transition-all"
          title="Inventory (I)"
        >
          <span className="text-xl">🎒</span>
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg">
              {itemCount}
            </span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleJournal}
          className="w-11 h-11 p-0 hover:bg-primary/20 hover:scale-105 transition-all"
          title="Journal (J)"
        >
          <span className="text-xl">📔</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleCooking}
          className="w-11 h-11 p-0 hover:bg-primary/20 hover:scale-105 transition-all"
          title="Cooking (C)"
        >
          <span className="text-xl">🍳</span>
        </Button>
      </div>
    </Card>
  );
}

// ============================================
// Controls Help - Enhanced
// ============================================
function ControlsHelp() {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <Card 
      className="hud-card px-3 py-2 bg-card/90 backdrop-blur-md border-muted/30 cursor-pointer transition-all hover:bg-card/95 shadow-lg"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="text-sm">🎮</span>
        <span className="font-medium">Controls</span>
        <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
      </div>
      
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Move</span>
            <div className="flex gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">WASD</kbd>
              <span className="text-muted-foreground">/</span>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">↑↓←→</kbd>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Look</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Mouse</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Shoot</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">LMB</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Reload</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">R</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sprint</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Shift</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Jump</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Space</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Interact</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">E</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Pause</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">ESC</kbd>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Quick Menu</span>
            <div className="flex gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">I</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">J</kbd>
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">C</kbd>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================
// Getting Started Tip for New Players
// ============================================
function GettingStartedTip() {
  const [dismissed, setDismissed] = useState(false);
  const activeQuests = usePlayerStore((s) => s.activeQuests);
  const inventory = usePlayerStore((s) => s.inventory);
  const collectedItemIds = usePlayerStore((s) => s.collectedItemIds);
  
  // Only show if player is truly new (no quests, no items, nothing collected)
  const isNewPlayer = activeQuests.length === 0 && inventory.length === 0 && collectedItemIds.length === 0;
  
  if (!isNewPlayer || dismissed) return null;
  
  return (
    <Card className="hud-card px-4 py-3 bg-gradient-to-br from-amber-900/95 to-orange-900/95 border-amber-500/40 max-w-sm shadow-xl animate-in fade-in slide-in-from-top duration-500">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-bounce">👋</span>
            <h3 className="font-bold text-amber-200">Getting Started</h3>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 w-6 p-0 text-amber-300 hover:text-white hover:bg-amber-800/50"
            onClick={() => setDismissed(true)}
          >
            ✕
          </Button>
        </div>
        
        <div className="space-y-2 text-xs text-amber-100">
          <div className="flex items-start gap-2">
            <span className="text-amber-400">1.</span>
            <span><strong>Click screen</strong> to lock cursor, then aim with mouse</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400">2.</span>
            <span><strong>Hold lanes</strong> against spice wisps with left click and R to reload</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400">3.</span>
            <span><strong>Collect ingredients</strong> and interact with NPCs using E</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-amber-400">4.</span>
            <span><strong>Use AI radio cues</strong> for real-time tactical hints</span>
          </div>
        </div>
        
        <div className="text-[10px] text-amber-300/70 pt-1 border-t border-amber-500/30">
          💡 Check the mini-map (top-right) to find NPCs and ingredients!
        </div>
      </div>
    </Card>
  );
}

// ============================================
// FPS Counter (Development)
// ============================================
function FPSCounter() {
  const [fps, setFps] = useState(60);
  
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    
    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      
      if (currentTime - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    const animId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animId);
  }, []);
  
  const fpsColor = fps >= 50 ? 'text-emerald-400' : fps >= 30 ? 'text-yellow-400' : 'text-red-400';
  
  return (
    <div className={`text-[10px] font-mono ${fpsColor} opacity-60`}>
      {fps} FPS
    </div>
  );
}

// ============================================
// FPS Crosshair + Combat HUD
// ============================================
function Crosshair() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
      <div className="relative w-8 h-8">
        <div className="absolute left-1/2 top-0 h-2 w-0.5 -translate-x-1/2 bg-white/90" />
        <div className="absolute left-1/2 bottom-0 h-2 w-0.5 -translate-x-1/2 bg-white/90" />
        <div className="absolute top-1/2 left-0 w-2 h-0.5 -translate-y-1/2 bg-white/90" />
        <div className="absolute top-1/2 right-0 w-2 h-0.5 -translate-y-1/2 bg-white/90" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300/90 bg-cyan-200/30" />
      </div>
    </div>
  );
}

function CombatPanel() {
  const health = useCombatStore((s) => s.health);
  const maxHealth = useCombatStore((s) => s.maxHealth);
  const ammoInMag = useCombatStore((s) => s.ammoInMag);
  const reserveAmmo = useCombatStore((s) => s.reserveAmmo);
  const kills = useCombatStore((s) => s.kills);
  const score = useCombatStore((s) => s.score);
  const pointerLocked = useCombatStore((s) => s.pointerLocked);
  const isReloading = useCombatStore((s) => s.isReloading);
  const resetCombat = useCombatStore((s) => s.resetCombat);

  const healthPercent = Math.max(0, Math.min(100, (health / maxHealth) * 100));

  return (
    <Card className="hud-card w-60 bg-card/95 backdrop-blur-md border-primary/20 p-3 shadow-xl">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">FPS Ops</span>
          <span className={pointerLocked ? 'text-emerald-400' : 'text-amber-300'}>
            {pointerLocked ? 'LOCKED' : 'CLICK TO LOCK'}
          </span>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Health</span>
            <span>{Math.round(health)}/{maxHealth}</span>
          </div>
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${health > 35 ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`}
              style={{ width: `${healthPercent}%` }}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-cyan-200">Ammo {ammoInMag}</span>
          <span className="text-muted-foreground">/{reserveAmmo}</span>
          {isReloading && <span className="text-[11px] text-amber-300">Reloading...</span>}
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Kills: {kills}</span>
          <span>Score: {score}</span>
        </div>
        {health <= 0 && (
          <Button className="w-full h-8 text-xs" onClick={resetCombat}>
            Redeploy
          </Button>
        )}
      </div>
    </Card>
  );
}

function CombatRadio() {
  const [line, setLine] = useState('Radio online. Engage spice wisps and hold the lane.');
  const [mood, setMood] = useState<'calm' | 'urgent' | 'hype'>('calm');

  const lastEvent = useCombatStore((s) => s.lastEvent);
  const health = useCombatStore((s) => s.health);
  const ammoInMag = useCombatStore((s) => s.ammoInMag);
  const kills = useCombatStore((s) => s.kills);
  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);

  const lastRequestAtRef = useRef(0);

  useEffect(() => {
    if (!lastEvent) return;
    const now = Date.now();
    if (now - lastRequestAtRef.current < 3500 && lastEvent.type !== 'critical_health') return;
    lastRequestAtRef.current = now;

    let aborted = false;

    const run = async () => {
      try {
        const response = await fetch('/api/ai/combat/chatter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: lastEvent.type,
            context: {
              dishName: world?.dish.name,
              regionName: region?.name,
              kills,
              health,
              ammo: ammoInMag,
            },
          }),
        });

        const data = await response.json();
        if (!aborted && data?.line) {
          setLine(data.line);
          setMood(data.mood || 'calm');
        }
      } catch {
        if (!aborted) {
          setLine('Comms unstable. Stay mobile and control distance.');
          setMood('urgent');
        }
      }
    };

    run();

    return () => {
      aborted = true;
    };
  }, [ammoInMag, health, kills, lastEvent, region?.name, world?.dish.name]);

  const moodStyle =
    mood === 'hype'
      ? 'border-cyan-400/40 text-cyan-200'
      : mood === 'urgent'
        ? 'border-red-400/40 text-red-200'
        : 'border-emerald-400/40 text-emerald-200';

  return (
    <Card className={`hud-card max-w-xl px-4 py-2 bg-card/90 backdrop-blur-md ${moodStyle}`}>
      <p className="text-xs font-medium tracking-wide">AI RADIO</p>
      <p className="text-sm">{line}</p>
    </Card>
  );
}

// ============================================
// Main HUD Component
// ============================================
export function HUD() {
  const isPlaying = useGameStore((s) => s.isPlaying);
  
  if (!isPlaying) return null;
  
  return (
    <div className="hud-overlay fixed inset-0 pointer-events-none z-40">
      {/* Top Left - Time, Region, Stamina, Dish Progress */}
      <div className="absolute top-4 left-4 space-y-2.5 pointer-events-auto">
        <TimeDisplay />
        <RegionDisplay />
        <StaminaBar />
        <DishProgress />
      </div>
      
      {/* Top Right - Mini Map */}
      <div className="absolute top-4 right-4 pointer-events-auto">
        <MiniMap />
        <div className="mt-1 text-right">
          <FPSCounter />
        </div>
      </div>
      
      {/* Right Side - Quest Tracker & Portal Status */}
      <div className="absolute top-48 right-4 pointer-events-auto space-y-2">
        <QuestTracker />
        <PortalStatus />
      </div>
      
      {/* Center Top - Getting Started Tip for New Players */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <GettingStartedTip />
      </div>

      {/* Upper Center - AI Combat Radio */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 pointer-events-none">
        <CombatRadio />
      </div>
      
      {/* Bottom Left - Quick Actions & Controls */}
      <div className="absolute bottom-4 left-4 space-y-2 pointer-events-auto">
        <QuickActions />
        <ControlsHelp />
      </div>

      {/* Bottom Right - FPS Combat Stats */}
      <div className="absolute bottom-4 right-4 pointer-events-auto">
        <CombatPanel />
      </div>
      
      {/* Center Bottom - Interaction Prompt */}
      <InteractionPrompt />

      {/* Center - FPS Crosshair */}
      <Crosshair />
      
      {/* Decorative corner accents */}
      <div className="absolute top-0 left-0 w-32 h-32 border-l-2 border-t-2 border-primary/20 pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-32 border-r-2 border-t-2 border-primary/20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 border-l-2 border-b-2 border-primary/20 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-32 h-32 border-r-2 border-b-2 border-primary/20 pointer-events-none" />
    </div>
  );
}

export default HUD;

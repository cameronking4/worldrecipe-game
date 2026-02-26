'use client';

import { Suspense, useEffect, useCallback, useRef, useMemo } from 'react';
import { normalizePosition } from '@/types/game';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { 
  Stars,
  Float,
  Sparkles,
} from '@react-three/drei';
import { 
  EffectComposer, 
  Bloom, 
  Vignette, 
  ChromaticAberration,
  DepthOfField,
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerController } from './PlayerController';
import { VoxelTerrain } from './VoxelTerrain';
import { NPCManager } from './NPCController';
import { InteractableManager } from './Interactable';
import { PortalBoard } from './PortalBoard';
import { EnemyManager } from './EnemyController';
import { useGameStore } from '@/lib/store/gameStore';
import { useWorldStore } from '@/lib/store/worldStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import { usePortalStore } from '@/lib/store/portalStore';

// ============================================
// Post-Processing Effects
// ============================================

function PostProcessingEffects() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  
  const bloomIntensity = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return 0.4;
      case 'day': return 0.3;
      case 'evening': return 0.6;
      case 'night': return 0.8;
      default: return 0.4;
    }
  }, [timeOfDay]);
  
  return (
    <EffectComposer multisampling={4}>
      <SMAA />
      <Bloom 
        intensity={bloomIntensity}
        luminanceThreshold={0.6}
        luminanceSmoothing={0.9}
        mipmapBlur
        radius={0.8}
      />
      <Vignette 
        offset={0.3} 
        darkness={timeOfDay === 'night' ? 0.7 : 0.4} 
        eskil={false}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(0.0005, 0.0005)}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

// ============================================
// Atmospheric Effects
// ============================================

function AtmosphericEffects() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const region = useWorldStore((s) => s.currentRegion);
  
  const fogColor = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return '#FFE4C4';
      case 'day': return '#87CEEB';
      case 'evening': return '#FF8C69';
      case 'night': return '#1a1a2e';
      default: return '#87CEEB';
    }
  }, [timeOfDay]);
  
  return (
    <>
      {/* Ambient particles */}
      <Sparkles 
        count={100}
        scale={40}
        size={2}
        speed={0.3}
        opacity={timeOfDay === 'night' ? 0.8 : 0.3}
        color={timeOfDay === 'night' ? '#FFD700' : '#FFFFFF'}
      />
      
      {/* Floating dust particles */}
      <Float speed={0.5} rotationIntensity={0} floatIntensity={0.5}>
        <Sparkles 
          count={50}
          scale={20}
          size={1}
          speed={0.1}
          opacity={0.2}
          color="#FFF8DC"
        />
      </Float>
      
      {/* Stars at night */}
      {timeOfDay === 'night' && (
        <Stars 
          radius={100} 
          depth={50} 
          count={5000} 
          factor={4} 
          saturation={0.5}
          fade
          speed={0.5}
        />
      )}
      
      {/* Decorative floating clouds during day */}
      {(timeOfDay === 'day' || timeOfDay === 'morning') && (
        <Float speed={0.5} rotationIntensity={0} floatIntensity={1}>
          <group position={[-15, 25, -20]}>
            <mesh>
              <sphereGeometry args={[3, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.6} />
            </mesh>
            <mesh position={[2, 0.5, 0]}>
              <sphereGeometry args={[2, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.5} />
            </mesh>
            <mesh position={[-2, 0.3, 0.5]}>
              <sphereGeometry args={[2.5, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.55} />
            </mesh>
          </group>
          <group position={[20, 22, -15]}>
            <mesh>
              <sphereGeometry args={[2.5, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.5} />
            </mesh>
            <mesh position={[1.5, 0.3, 0]}>
              <sphereGeometry args={[1.8, 8, 8]} />
              <meshStandardMaterial color="#FFFFFF" transparent opacity={0.45} />
            </mesh>
          </group>
        </Float>
      )}
      
      {/* Subtle fog - far enough to not cause ground flickering */}
      <fog attach="fog" args={[fogColor, 50, 120]} />
    </>
  );
}

// ============================================
// Enhanced Lighting Setup
// ============================================

function EnhancedLighting() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const region = useWorldStore((s) => s.currentRegion);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  
  const lightSettings = useMemo(() => ({
    morning: { 
      intensity: 1.2, 
      color: '#FFF5E6', 
      ambient: 0.5,
      sunPosition: [15, 8, 10],
      shadowIntensity: 0.3
    },
    day: { 
      intensity: 1.5, 
      color: '#FFFFFF', 
      ambient: 0.6,
      sunPosition: [10, 20, 10],
      shadowIntensity: 0.2
    },
    evening: { 
      intensity: 0.9, 
      color: '#FFB366', 
      ambient: 0.4,
      sunPosition: [-15, 5, 10],
      shadowIntensity: 0.4
    },
    night: { 
      intensity: 0.3, 
      color: '#6B8DD6', 
      ambient: 0.2,
      sunPosition: [-10, -5, 10],
      shadowIntensity: 0.5
    },
  }), []);
  
  const settings = lightSettings[timeOfDay];
  const skyColor = region?.palette.sky || '#87CEEB';
  const groundColor = region?.palette.ground || '#4a7c59';
  
  useFrame((state) => {
    if (sunRef.current) {
      // Subtle sun movement
      const time = state.clock.elapsedTime * 0.02;
      sunRef.current.position.x = settings.sunPosition[0] + Math.sin(time) * 2;
      sunRef.current.position.y = settings.sunPosition[1] + Math.cos(time) * 0.5;
    }
  });
  
  return (
    <>
      {/* Ambient base light */}
      <ambientLight intensity={settings.ambient} color="#FFF8DC" />
      
      {/* Main sun/moon light */}
      <directionalLight
        ref={sunRef}
        position={settings.sunPosition as [number, number, number]}
        intensity={settings.intensity}
        color={settings.color}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-camera-far={100}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
      
      {/* Sky hemisphere light */}
      <hemisphereLight
        color={skyColor}
        groundColor={groundColor}
        intensity={0.4}
      />
      
      {/* Rim light for depth */}
      <directionalLight
        position={[-10, 5, -10]}
        intensity={0.3}
        color="#87CEEB"
      />
      
      {/* Fill light */}
      <pointLight
        position={[0, 10, 0]}
        intensity={0.2}
        color="#FFF8DC"
        distance={50}
      />
    </>
  );
}

// ============================================
// Board Boundaries / Guardrails
// ============================================

function BoardBoundaries({ width = 50, height = 50 }: { width?: number; height?: number }) {
  const wallHeight = 3;
  const wallThickness = 1;
  
  // Invisible collision walls + visual edge decoration
  return (
    <group>
      {/* North Wall */}
      <RigidBody type="fixed" colliders={false} position={[0, wallHeight / 2, -height / 2]}>
        <CuboidCollider args={[width / 2 + wallThickness, wallHeight, wallThickness / 2]} />
      </RigidBody>
      
      {/* South Wall */}
      <RigidBody type="fixed" colliders={false} position={[0, wallHeight / 2, height / 2]}>
        <CuboidCollider args={[width / 2 + wallThickness, wallHeight, wallThickness / 2]} />
      </RigidBody>
      
      {/* East Wall */}
      <RigidBody type="fixed" colliders={false} position={[width / 2, wallHeight / 2, 0]}>
        <CuboidCollider args={[wallThickness / 2, wallHeight, height / 2 + wallThickness]} />
      </RigidBody>
      
      {/* West Wall */}
      <RigidBody type="fixed" colliders={false} position={[-width / 2, wallHeight / 2, 0]}>
        <CuboidCollider args={[wallThickness / 2, wallHeight, height / 2 + wallThickness]} />
      </RigidBody>
      
      {/* Visual border decoration - glowing edge posts (every 5th post for performance) */}
      {Array.from({ length: 10 }).map((_, i) => {
        const positions = [
          [-width / 2 + (i * width / 9), 0, -height / 2],
          [-width / 2 + (i * width / 9), 0, height / 2],
          [-width / 2, 0, -height / 2 + (i * height / 9)],
          [width / 2, 0, -height / 2 + (i * height / 9)],
        ];
        
        return positions.map((pos, j) => (
          <group key={`post-${i}-${j}`} position={pos as [number, number, number]}>
            {/* Base stone - elevated */}
            <mesh castShadow position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.25, 0.35, 0.4, 6]} />
              <meshStandardMaterial color="#5a5a6a" roughness={0.9} />
            </mesh>
            {/* Glowing crystal */}
            <mesh position={[0, 0.55, 0]}>
              <octahedronGeometry args={[0.12, 0]} />
              <meshStandardMaterial 
                color="#FFD700" 
                emissive="#FFD700" 
                emissiveIntensity={0.6}
                roughness={0.2}
                metalness={0.8}
              />
            </mesh>
            {/* Point light for glow effect - only every other */}
            {i % 3 === 0 && (
              <pointLight 
                position={[0, 0.55, 0]} 
                color="#FFD700" 
                intensity={0.4} 
                distance={4}
              />
            )}
          </group>
        ));
      })}
      
      {/* Decorative corner pillars */}
      {[
        [-width / 2, 0, -height / 2],
        [width / 2, 0, -height / 2],
        [-width / 2, 0, height / 2],
        [width / 2, 0, height / 2],
      ].map((pos, i) => (
        <group key={`corner-${i}`} position={pos as [number, number, number]}>
          <mesh castShadow position={[0, 1, 0]}>
            <boxGeometry args={[0.8, 2, 0.8]} />
            <meshStandardMaterial color="#4a4a5a" roughness={0.8} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <sphereGeometry args={[0.4, 8, 8]} />
            <meshStandardMaterial 
              color="#FF6B6B" 
              emissive="#FF6B6B" 
              emissiveIntensity={0.8}
              roughness={0.3}
            />
          </mesh>
          <pointLight 
            position={[0, 2.2, 0]} 
            color="#FF6B6B" 
            intensity={1} 
            distance={8}
          />
        </group>
      ))}
    </group>
  );
}

// ============================================
// Enhanced Ground with gradient & details
// ============================================

function EnhancedGround({ width = 50, height = 50 }: { width?: number; height?: number }) {
  const region = useWorldStore((s) => s.currentRegion);
  const groundColor = region?.palette.ground || '#4a7c59';
  
  return (
    <group>
      {/* Main ground - single solid surface to prevent z-fighting */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider 
          args={[width / 2 + 2, 1, height / 2 + 2]} 
          position={[0, -1, 0]} 
        />
        
        {/* Main ground box instead of plane to prevent flickering */}
        <mesh receiveShadow castShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[width, 0.5, height]} />
          <meshStandardMaterial 
            color={groundColor}
            roughness={0.85}
            metalness={0.05}
          />
        </mesh>
      </RigidBody>
      
      {/* Board frame - outer edge decoration */}
      <mesh receiveShadow position={[0, -0.5, 0]}>
        <boxGeometry args={[width + 2, 0.5, height + 2]} />
        <meshStandardMaterial 
          color="#3d3d4d"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      
      {/* Base platform */}
      <mesh receiveShadow position={[0, -0.8, 0]}>
        <boxGeometry args={[width + 4, 0.3, height + 4]} />
        <meshStandardMaterial 
          color="#2d2d3d"
          roughness={0.95}
        />
      </mesh>
    </group>
  );
}

// ============================================
// Fallback Ground with physics
// ============================================

function FallbackGround() {
  return (
    <>
      <EnhancedGround width={50} height={50} />
      <BoardBoundaries width={50} height={50} />
      
      {/* Some basic decorations for the fallback world */}
      {[
        [-8, -6], [-5, -8], [7, -7],
        [-9, 3], [8, 5], [-6, 8],
        [5, -4], [-4, 5], [9, -2],
      ].map(([x, z], i) => (
        <group key={`tree-${i}`} position={[x, 0, z]}>
          {/* Trunk */}
          <mesh castShadow position={[0, 0.5, 0]}>
            <boxGeometry args={[0.4, 1, 0.4]} />
            <meshStandardMaterial color="#8B4513" roughness={0.9} />
          </mesh>
          {/* Foliage */}
          <mesh castShadow position={[0, 1.5, 0]}>
            <boxGeometry args={[1.2, 0.8, 1.2]} />
            <meshStandardMaterial color="#228B22" roughness={0.8} />
          </mesh>
          <mesh castShadow position={[0, 2.1, 0]}>
            <boxGeometry args={[0.9, 0.6, 0.9]} />
            <meshStandardMaterial color="#2E8B2E" roughness={0.8} />
          </mesh>
        </group>
      ))}
    </>
  );
}

// ============================================
// World Content
// ============================================

function WorldContent() {
  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);
  const isInPortal = usePortalStore((s) => s.isInPortal);
  const enterPortal = usePortalStore((s) => s.enterPortal);
  const returnToHub = usePortalStore((s) => s.returnToHub);
  const canAccessPortal = usePortalStore((s) => s.canAccessPortal);
  const startDialogue = useGameStore((s) => s.startDialogue);
  const addItem = usePlayerStore((s) => s.addItem);
  const collectedItemIds = usePlayerStore((s) => s.collectedItemIds);
  const checkAndUpdateTalkObjectives = usePlayerStore((s) => s.checkAndUpdateTalkObjectives);
  const showInteractionPrompt = useGameStore((s) => s.showInteractionPrompt);
  const hideInteractionPrompt = useGameStore((s) => s.hideInteractionPrompt);
  
  const handleNPCInteract = useCallback((npcId: string) => {
    const npc = world?.npcRoster.find((n) => n.npcId === npcId);
    if (!npc) return;
    
    // Check and update talk objectives
    checkAndUpdateTalkObjectives(npcId);
    
    startDialogue(npcId, {
      nodeId: 'start',
      speaker: npc.name,
      text: '',
      choices: [],
    });
  }, [world, startDialogue, checkAndUpdateTalkObjectives]);
  
  const handleIngredientPickup = useCallback((ingredientId: string) => {
    const ingredient = world?.ingredientGraph.ingredients.find(
      (i) => i.ingredientId === ingredientId
    );
    
    if (ingredient) {
      addItem({
        itemId: ingredientId,
        name: ingredient.name,
        description: `A ${ingredient.category} from ${ingredient.regionId}`,
        category: 'ingredient',
        rarity: 'common',
      });
    }
  }, [world, addItem]);
  
  const handlePortalInteract = useCallback(async (poi: any) => {
    if (poi.type !== 'portal') return;
    
    // Check if it's a return portal
    if (poi.isReturnPortal) {
      await returnToHub();
      return;
    }
    
    // Check access
    if (!canAccessPortal(poi)) {
      showInteractionPrompt(
        poi.portalType === 'kitchen' 
          ? 'Collect all ingredients to unlock the kitchen!' 
          : 'Cannot access this portal',
        poi.poiId,
        'poi'
      );
      return;
    }
    
    // Enter portal
    await enterPortal(poi);
  }, [enterPortal, returnToHub, canAccessPortal, showInteractionPrompt]);
  
  // If in portal, render portal board
  if (isInPortal) {
    const portalBoard = usePortalStore.getState().getCurrentPortalBoard();
    if (!portalBoard || !world) {
      return <FallbackGround />;
    }
    
    const mapWidth = portalBoard.mapSpec.grid.width;
    const mapHeight = portalBoard.mapSpec.grid.height;
    
    return (
      <>
        {/* Enhanced ground */}
        <EnhancedGround width={mapWidth} height={mapHeight} />
        
        {/* Guardrails */}
        <BoardBoundaries width={mapWidth} height={mapHeight} />
        
        {/* Portal board content */}
        <PortalBoard 
          onNPCInteract={handleNPCInteract}
          onIngredientPickup={handleIngredientPickup}
        />
        
        {/* Portal interaction handler */}
        <PortalInteractionHandler onPortalInteract={handlePortalInteract} />
      </>
    );
  }
  
  // Get map dimensions
  const mapWidth = region?.mapSpec?.grid?.width || 50;
  const mapHeight = region?.mapSpec?.grid?.height || 50;
  
  // Show fallback ground while loading
  if (!world || !region) {
    return <FallbackGround />;
  }
  
  // POIs can be at region level or mapSpec level (AI may generate either)
  const allPois = [...(region.pois || []), ...(region.mapSpec?.pois || [])];
  
  return (
    <>
      {/* Enhanced ground */}
      <EnhancedGround width={mapWidth} height={mapHeight} />
      
      {/* Guardrails */}
      <BoardBoundaries width={mapWidth} height={mapHeight} />
      
      {/* Terrain decorations */}
      <VoxelTerrain region={region} seed={world.seed} />

      {/* FPS Enemies instead of NPCs */}
      <EnemyManager />

      {/* Keep some interactables as ammo/health pickups */}
      <InteractableManager
        ingredients={world.ingredientGraph.ingredients}
        regionId={region.regionId}
        seed={world.seed}
        onIngredientPickup={handleIngredientPickup}
        collectedItemIds={collectedItemIds}
        mapWidth={mapWidth}
        mapHeight={mapHeight}
      />
      
      {/* Portal interaction handler */}
      <PortalInteractionHandler onPortalInteract={handlePortalInteract} />
    </>
  );
}

// ============================================
// Portal Interaction Handler
// ============================================

function PortalInteractionHandler({ onPortalInteract }: { onPortalInteract: (poi: any) => void }) {
  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);
  const isInPortal = usePortalStore((s) => s.isInPortal);
  const portalBoard = usePortalStore((s) => s.getCurrentPortalBoard());
  const playerPosition = usePlayerStore((s) => s.position);
  const showInteractionPrompt = useGameStore((s) => s.showInteractionPrompt);
  const hideInteractionPrompt = useGameStore((s) => s.hideInteractionPrompt);
  const canAccessPortal = usePortalStore((s) => s.canAccessPortal);
  
  useEffect(() => {
    let currentPoi: any = null;
    let handleKeyDown: ((e: KeyboardEvent) => void) | null = null;
    
    const checkPortalProximity = () => {
      if (!world) {
        hideInteractionPrompt();
        return;
      }
      
      // Get POIs based on current location
      let pois: any[] = [];
      if (isInPortal && portalBoard) {
        pois = portalBoard.mapSpec.pois || [];
      } else if (region) {
        pois = [...(region.pois || []), ...(region.mapSpec?.pois || [])];
      }
      
      // Find portal POIs
      const portalPois = pois.filter(p => p.type === 'portal');
      
      // Check distance to each portal
      let foundNearby = false;
      for (const poi of portalPois) {
        const [poiX, poiZ] = normalizePosition(poi.position);
        const distance = Math.sqrt(
          Math.pow(playerPosition[0] - poiX, 2) + 
          Math.pow(playerPosition[2] - poiZ, 2)
        );
        
        if (distance < poi.interactRadius) {
          foundNearby = true;
          currentPoi = poi;
          const accessible = canAccessPortal(poi);
          const promptText = poi.isReturnPortal 
            ? 'Return to Hub (E)'
            : accessible 
              ? `Enter ${poi.name} (E)`
              : poi.portalType === 'kitchen'
                ? 'Kitchen Locked - Collect all ingredients!'
                : 'Cannot access portal';
          
          showInteractionPrompt(promptText, poi.poiId, 'poi');
          
          // Remove old handler if exists
          if (handleKeyDown) {
            window.removeEventListener('keydown', handleKeyDown);
          }
          
          // Add new keyboard handler
          handleKeyDown = (e: KeyboardEvent) => {
            if ((e.code === 'KeyE' || e.code === 'Space') && accessible && currentPoi) {
              onPortalInteract(currentPoi);
            }
          };
          
          window.addEventListener('keydown', handleKeyDown);
          break;
        }
      }
      
      if (!foundNearby) {
        hideInteractionPrompt();
        if (handleKeyDown) {
          window.removeEventListener('keydown', handleKeyDown);
          handleKeyDown = null;
        }
        currentPoi = null;
      }
    };
    
    const interval = setInterval(checkPortalProximity, 100);
    checkPortalProximity(); // Initial check
    
    return () => {
      clearInterval(interval);
      if (handleKeyDown) {
        window.removeEventListener('keydown', handleKeyDown);
      }
      hideInteractionPrompt();
    };
  }, [world, region, isInPortal, portalBoard, playerPosition, showInteractionPrompt, hideInteractionPrompt, canAccessPortal, onPortalInteract]);
  
  return null;
}

// ============================================
// Scene Content with Physics
// ============================================

function SceneContent() {
  return (
    <>
      <EnhancedLighting />
      <AtmosphericEffects />
      
      <Physics 
        gravity={[0, -25, 0]} 
        debug={false}
        timeStep={1/60}
        interpolate={true}
        colliders={false}
      >
        <WorldContent />
        <PlayerController />
      </Physics>
      
      <PostProcessingEffects />
    </>
  );
}

// ============================================
// Loading Fallback
// ============================================

function LoadingFallback() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });
  
  return (
    <group>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#FF6B6B" wireframe />
      </mesh>
      <ambientLight intensity={0.5} />
    </group>
  );
}

// ============================================
// Main Game Canvas
// ============================================

export function GameCanvas() {
  const setIsPlaying = useGameStore((s) => s.setIsPlaying);
  const region = useWorldStore((s) => s.currentRegion);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    setIsPlaying(true);
    
    if (containerRef.current) {
      containerRef.current.focus();
    }
    
    return () => setIsPlaying(false);
  }, [setIsPlaying]);
  
  // Dynamic sky color based on time of day
  const skyColor = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return '#FFE4C4';
      case 'day': return '#87CEEB';
      case 'evening': return '#FF8C69';
      case 'night': return '#0a0a1a';
      default: return region?.palette.sky || '#87CEEB';
    }
  }, [timeOfDay, region?.palette.sky]);
  
  return (
    <div 
      ref={containerRef}
      className="game-canvas" 
      tabIndex={0}
      style={{ outline: 'none' }}
      onKeyDown={(e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
        }
      }}
    >
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true, // Prevents z-fighting
          precision: 'highp',
        }}
        camera={{
          near: 0.1,
          far: 200,
          fov: 75, // Wider FOV for FPS
          position: [0, 1.6, 0], // Eye level
        }}
        onCreated={(state) => {
          state.gl.setClearColor(skyColor);
          state.gl.shadowMap.enabled = true;
          state.gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <color attach="background" args={[skyColor]} />
        <Suspense fallback={<LoadingFallback />}>
          <SceneContent />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default GameCanvas;

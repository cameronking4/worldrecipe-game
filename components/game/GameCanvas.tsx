'use client';

import { Suspense, useRef, useMemo, useCallback, useEffect } from 'react';
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
  ToneMapping,
  SMAA,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { PlayerController } from './PlayerController';
import { EnemyManager } from './EnemyController';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import type { CoverObject, ArenaSpec, ArenaPalette } from '@/types/game';

// ============================================
// Post-Processing Effects
// ============================================

function PostProcessingEffects() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const lastDamageTime = useGameStore((s) => s.lastDamageTime);

  const bloomIntensity = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return 0.4;
      case 'day': return 0.3;
      case 'evening': return 0.6;
      case 'night': return 0.8;
      default: return 0.4;
    }
  }, [timeOfDay]);

  // Red vignette when taking damage
  const recentDamage = Date.now() - lastDamageTime < 500;
  const darknessVal = recentDamage ? 0.8 : (timeOfDay === 'night' ? 0.6 : 0.35);

  return (
    <EffectComposer multisampling={4}>
      <SMAA />
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.9}
        mipmapBlur
        radius={0.8}
      />
      <Vignette
        offset={0.2}
        darkness={darknessVal}
        eskil={false}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(recentDamage ? 0.003 : 0.0005, recentDamage ? 0.003 : 0.0005)}
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

  const fogColor = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return '#334455';
      case 'day': return '#445566';
      case 'evening': return '#443322';
      case 'night': return '#0a0a1a';
      default: return '#334455';
    }
  }, [timeOfDay]);

  return (
    <>
      {/* Ambient dust particles */}
      <Sparkles
        count={80}
        scale={50}
        size={1.5}
        speed={0.2}
        opacity={timeOfDay === 'night' ? 0.5 : 0.2}
        color={timeOfDay === 'night' ? '#4488FF' : '#AABBCC'}
      />

      {/* Stars at night */}
      {timeOfDay === 'night' && (
        <Stars
          radius={100}
          depth={50}
          count={3000}
          factor={4}
          saturation={0.3}
          fade
          speed={0.3}
        />
      )}

      <fog attach="fog" args={[fogColor, 30, 100]} />
    </>
  );
}

// ============================================
// Enhanced Lighting
// ============================================

function ArenaLighting() {
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const sunRef = useRef<THREE.DirectionalLight>(null);

  const lightSettings = useMemo(() => ({
    morning: {
      intensity: 1.0,
      color: '#FFF5E6',
      ambient: 0.4,
      sunPosition: [15, 12, 10] as [number, number, number],
    },
    day: {
      intensity: 1.3,
      color: '#FFFFFF',
      ambient: 0.5,
      sunPosition: [10, 20, 10] as [number, number, number],
    },
    evening: {
      intensity: 0.7,
      color: '#FFB366',
      ambient: 0.3,
      sunPosition: [-15, 8, 10] as [number, number, number],
    },
    night: {
      intensity: 0.25,
      color: '#6B8DD6',
      ambient: 0.15,
      sunPosition: [-10, 5, 10] as [number, number, number],
    },
  }), []);

  const settings = lightSettings[timeOfDay];

  return (
    <>
      <ambientLight intensity={settings.ambient} color="#C8D8E8" />
      <directionalLight
        ref={sunRef}
        position={settings.sunPosition}
        intensity={settings.intensity}
        color={settings.color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      />
      <hemisphereLight color="#88AACC" groundColor="#334455" intensity={0.3} />
      <directionalLight position={[-10, 5, -10]} intensity={0.15} color="#6688AA" />
    </>
  );
}

// ============================================
// Arena Ground
// ============================================

function ArenaGround({ width = 50, height = 50, color = '#3a3a4a' }: { width?: number; height?: number; color?: string }) {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2, 0.5, height / 2]} position={[0, -0.5, 0]} />
        <mesh receiveShadow castShadow position={[0, -0.25, 0]}>
          <boxGeometry args={[width, 0.5, height]} />
          <meshStandardMaterial color={color} roughness={0.9} metalness={0.1} />
        </mesh>
      </RigidBody>

      {/* Grid markings on floor */}
      <group position={[0, 0.01, 0]}>
        {Array.from({ length: 11 }).map((_, i) => {
          const pos = -25 + i * 5;
          return (
            <group key={`grid-${i}`}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[pos, 0, 0]}>
                <planeGeometry args={[0.02, height]} />
                <meshBasicMaterial color="#555" transparent opacity={0.3} />
              </mesh>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, pos]}>
                <planeGeometry args={[width, 0.02]} />
                <meshBasicMaterial color="#555" transparent opacity={0.3} />
              </mesh>
            </group>
          );
        })}
      </group>
    </group>
  );
}

// ============================================
// Arena Walls
// ============================================

function ArenaWalls({ width = 50, height = 50, wallColor = '#2a2a3a' }: { width?: number; height?: number; wallColor?: string }) {
  const wallH = 5;

  return (
    <group>
      {/* North */}
      <RigidBody type="fixed" colliders={false} position={[0, wallH / 2, -height / 2]}>
        <CuboidCollider args={[width / 2 + 1, wallH, 0.5]} />
        <mesh castShadow>
          <boxGeometry args={[width + 2, wallH, 1]} />
          <meshStandardMaterial color={wallColor} roughness={0.8} metalness={0.2} />
        </mesh>
      </RigidBody>
      {/* South */}
      <RigidBody type="fixed" colliders={false} position={[0, wallH / 2, height / 2]}>
        <CuboidCollider args={[width / 2 + 1, wallH, 0.5]} />
        <mesh castShadow>
          <boxGeometry args={[width + 2, wallH, 1]} />
          <meshStandardMaterial color={wallColor} roughness={0.8} metalness={0.2} />
        </mesh>
      </RigidBody>
      {/* East */}
      <RigidBody type="fixed" colliders={false} position={[width / 2, wallH / 2, 0]}>
        <CuboidCollider args={[0.5, wallH, height / 2 + 1]} />
        <mesh castShadow>
          <boxGeometry args={[1, wallH, height + 2]} />
          <meshStandardMaterial color={wallColor} roughness={0.8} metalness={0.2} />
        </mesh>
      </RigidBody>
      {/* West */}
      <RigidBody type="fixed" colliders={false} position={[-width / 2, wallH / 2, 0]}>
        <CuboidCollider args={[0.5, wallH, height / 2 + 1]} />
        <mesh castShadow>
          <boxGeometry args={[1, wallH, height + 2]} />
          <meshStandardMaterial color={wallColor} roughness={0.8} metalness={0.2} />
        </mesh>
      </RigidBody>
    </group>
  );
}

// ============================================
// Cover Objects
// ============================================

function CoverBlock({ position, size, type }: CoverObject) {
  const color = type === 'crate' ? '#8B6914' : type === 'pillar' ? '#555566' : '#4a4a5a';

  return (
    <RigidBody type="fixed" position={position} colliders="cuboid">
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={type === 'crate' ? 0.8 : 0.5}
          metalness={type === 'pillar' ? 0.3 : 0.1}
        />
      </mesh>
      {/* Top edge accent */}
      <mesh position={[0, size[1] / 2 + 0.02, 0]}>
        <boxGeometry args={[size[0] + 0.04, 0.04, size[2] + 0.04]} />
        <meshStandardMaterial color="#667" roughness={0.3} metalness={0.5} />
      </mesh>
    </RigidBody>
  );
}

function ArenaCovers() {
  const world = useGameStore((s) => s.world);
  const covers = world?.mission?.arena?.coverObjects || [];

  // Default covers if none from AI
  const defaultCovers: CoverObject[] = useMemo(() => [
    { position: [-8, 0.75, -5], size: [2, 1.5, 1], type: 'crate', destructible: false },
    { position: [8, 0.75, -5], size: [2, 1.5, 1], type: 'crate', destructible: false },
    { position: [-5, 1, 5], size: [1, 2, 3], type: 'wall', destructible: false },
    { position: [5, 1, 5], size: [1, 2, 3], type: 'wall', destructible: false },
    { position: [0, 1.5, -10], size: [1, 3, 1], type: 'pillar', destructible: false },
    { position: [-12, 0.6, 0], size: [3, 1.2, 1.5], type: 'barrier', destructible: false },
    { position: [12, 0.6, 0], size: [3, 1.2, 1.5], type: 'barrier', destructible: false },
    { position: [0, 0.75, 8], size: [4, 1.5, 1], type: 'wall', destructible: false },
    { position: [-15, 1, -12], size: [1, 2, 2], type: 'crate', destructible: false },
    { position: [15, 1, -12], size: [1, 2, 2], type: 'crate', destructible: false },
    { position: [-10, 1, 10], size: [2, 2, 1], type: 'wall', destructible: false },
    { position: [10, 1, 10], size: [2, 2, 1], type: 'wall', destructible: false },
    { position: [0, 1.5, 0], size: [1.5, 3, 1.5], type: 'pillar', destructible: false },
    { position: [-18, 0.75, -8], size: [1.5, 1.5, 1.5], type: 'crate', destructible: false },
    { position: [18, 0.75, 8], size: [1.5, 1.5, 1.5], type: 'crate', destructible: false },
  ], []);

  const allCovers = covers.length > 0 ? covers : defaultCovers;

  return (
    <group>
      {allCovers.map((cover, i) => (
        <CoverBlock key={`cover-${i}`} {...cover} />
      ))}
    </group>
  );
}

// ============================================
// Pickup Items
// ============================================

function PickupItems() {
  const meshRefs = useRef<(THREE.Group | null)[]>([]);

  const pickups = useMemo(() => [
    { pos: [-10, 0.5, -10] as [number, number, number], type: 'health', color: '#00FF44' },
    { pos: [10, 0.5, 10] as [number, number, number], type: 'ammo', color: '#FFAA00' },
    { pos: [-10, 0.5, 10] as [number, number, number], type: 'health', color: '#00FF44' },
    { pos: [10, 0.5, -10] as [number, number, number], type: 'ammo', color: '#FFAA00' },
    { pos: [0, 0.5, -15] as [number, number, number], type: 'armor', color: '#4488FF' },
    { pos: [0, 0.5, 15] as [number, number, number], type: 'armor', color: '#4488FF' },
  ], []);

  const playerPos = usePlayerStore((s) => s.position);
  const heal = usePlayerStore((s) => s.heal);
  const addArmor = usePlayerStore((s) => s.addArmor);
  const addAmmoForType = usePlayerStore((s) => s.addAmmoForType);
  const collectedRef = useRef<Set<number>>(new Set());
  const respawnTimers = useRef<Record<number, number>>({});

  useFrame((state) => {
    // Animate pickups
    pickups.forEach((pickup, i) => {
      const ref = meshRefs.current[i];
      if (!ref) return;

      if (collectedRef.current.has(i)) {
        ref.visible = false;
        // Check respawn
        const respawnTime = respawnTimers.current[i];
        if (respawnTime && Date.now() > respawnTime) {
          collectedRef.current.delete(i);
          delete respawnTimers.current[i];
          ref.visible = true;
        }
        return;
      }

      ref.visible = true;
      ref.rotation.y = state.clock.elapsedTime * 2;
      ref.position.y = pickup.pos[1] + Math.sin(state.clock.elapsedTime * 3 + i) * 0.15;

      // Check player proximity
      const dx = playerPos[0] - pickup.pos[0];
      const dz = playerPos[2] - pickup.pos[2];
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < 1.5) {
        // Collect
        collectedRef.current.add(i);
        respawnTimers.current[i] = Date.now() + 15000; // 15s respawn

        switch (pickup.type) {
          case 'health':
            heal(25);
            break;
          case 'ammo':
            addAmmoForType('pistol', 24);
            addAmmoForType('rifle', 30);
            addAmmoForType('shotgun', 8);
            break;
          case 'armor':
            addArmor(25);
            break;
        }
      }
    });
  });

  return (
    <group>
      {pickups.map((pickup, i) => (
        <group
          key={`pickup-${i}`}
          ref={(el) => { meshRefs.current[i] = el; }}
          position={pickup.pos}
        >
          {/* Pickup shape */}
          <mesh castShadow>
            {pickup.type === 'health' ? (
              <octahedronGeometry args={[0.3, 0]} />
            ) : pickup.type === 'armor' ? (
              <boxGeometry args={[0.4, 0.4, 0.4]} />
            ) : (
              <dodecahedronGeometry args={[0.25, 0]} />
            )}
            <meshStandardMaterial
              color={pickup.color}
              emissive={pickup.color}
              emissiveIntensity={0.8}
              roughness={0.2}
              metalness={0.6}
            />
          </mesh>
          {/* Glow ring */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
            <ringGeometry args={[0.3, 0.5, 16]} />
            <meshBasicMaterial color={pickup.color} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={pickup.color} intensity={0.5} distance={4} />
        </group>
      ))}
    </group>
  );
}

// ============================================
// Pointer Lock Manager
// ============================================

function PointerLockManager() {
  const { gl } = useThree();
  const setPointerLocked = useGameStore((s) => s.setPointerLocked);
  const phase = useGameStore((s) => s.phase);
  const isPaused = useGameStore((s) => s.isPaused);

  useEffect(() => {
    const canvas = gl.domElement;

    const handleClick = () => {
      if (phase === 'combat' && !isPaused && !document.pointerLockElement) {
        canvas.requestPointerLock();
      }
    };

    const handleLockChange = () => {
      setPointerLocked(!!document.pointerLockElement);
    };

    canvas.addEventListener('click', handleClick);
    document.addEventListener('pointerlockchange', handleLockChange);

    return () => {
      canvas.removeEventListener('click', handleClick);
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, [gl, phase, isPaused, setPointerLocked]);

  // Release pointer lock when paused
  useEffect(() => {
    if (isPaused && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [isPaused]);

  return null;
}

// ============================================
// Scene Content
// ============================================

function SceneContent() {
  return (
    <>
      <ArenaLighting />
      <AtmosphericEffects />

      <Physics
        gravity={[0, -20, 0]}
        debug={false}
        timeStep={1 / 60}
        interpolate={true}
        colliders={false}
      >
        <ArenaGround />
        <ArenaWalls />
        <ArenaCovers />
        <PlayerController />
        <EnemyManager />
        <PickupItems />
      </Physics>

      <PointerLockManager />
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
        <meshStandardMaterial color="#FF4444" wireframe />
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
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsPlaying(true);
    if (containerRef.current) {
      containerRef.current.focus();
    }
    return () => setIsPlaying(false);
  }, [setIsPlaying]);

  const skyColor = useMemo(() => {
    switch (timeOfDay) {
      case 'morning': return '#334455';
      case 'day': return '#445566';
      case 'evening': return '#443322';
      case 'night': return '#0a0a1a';
      default: return '#334455';
    }
  }, [timeOfDay]);

  return (
    <div
      ref={containerRef}
      className="game-canvas"
      tabIndex={0}
      style={{ outline: 'none', cursor: 'crosshair' }}
    >
      <Canvas
        shadows="soft"
        dpr={[1, 2]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          powerPreference: 'high-performance',
          logarithmicDepthBuffer: true,
          precision: 'highp',
        }}
        camera={{
          near: 0.1,
          far: 200,
          fov: 75,
          position: [0, 2, 5],
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

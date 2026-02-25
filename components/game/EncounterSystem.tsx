'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useWorldStore } from '@/lib/store/worldStore';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useNotificationStore } from '@/lib/store/notificationStore';

interface EnemyArchetype {
  enemyId: string;
  name: string;
  taunt: string;
  colorHex: string;
  speed: number;
  health: number;
  size: number;
}

interface EncounterConfig {
  encounterName: string;
  mood: string;
  objectiveHint: string;
  threatLevel: number;
  enemies: EnemyArchetype[];
}

interface LiveEnemy {
  id: string;
  enemyId: string;
  name: string;
  taunt: string;
  colorHex: string;
  speed: number;
  maxHealth: number;
  health: number;
  size: number;
  position: THREE.Vector3;
  lastAttackAt: number;
}

function createWave(archetypes: EnemyArchetype[], mapWidth: number, mapHeight: number, threatLevel: number): LiveEnemy[] {
  if (archetypes.length === 0) return [];
  const waveCount = Math.min(10, 4 + threatLevel * 2);
  const radius = Math.max(8, Math.min(mapWidth, mapHeight) * 0.35);
  const wave: LiveEnemy[] = [];

  for (let i = 0; i < waveCount; i++) {
    const arch = archetypes[i % archetypes.length];
    const angle = (i / waveCount) * Math.PI * 2;
    const jitter = Math.sin(i * 3.17) * 2;
    wave.push({
      id: `${arch.enemyId}-${i}`,
      enemyId: arch.enemyId,
      name: arch.name,
      taunt: arch.taunt,
      colorHex: arch.colorHex,
      speed: arch.speed,
      maxHealth: arch.health,
      health: arch.health,
      size: arch.size,
      position: new THREE.Vector3(
        Math.cos(angle) * (radius + jitter),
        0.55,
        Math.sin(angle) * (radius - jitter)
      ),
      lastAttackAt: 0,
    });
  }

  return wave;
}

function EnemyVisual({ enemy }: { enemy: LiveEnemy }) {
  const hpPct = Math.max(0, enemy.health / enemy.maxHealth);

  return (
    <group position={enemy.position}>
      <RoundedBox args={[0.8 * enemy.size, 1.1 * enemy.size, 0.7 * enemy.size]} radius={0.12} smoothness={4} castShadow>
        <meshStandardMaterial color={enemy.colorHex} roughness={0.6} metalness={0.15} />
      </RoundedBox>
      <mesh position={[-0.12 * enemy.size, 0.2 * enemy.size, 0.36 * enemy.size]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0.12 * enemy.size, 0.2 * enemy.size, 0.36 * enemy.size]}>
        <boxGeometry args={[0.08, 0.08, 0.02]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
      <mesh position={[0, 1.02 * enemy.size, 0]}>
        <boxGeometry args={[0.65 * enemy.size * hpPct, 0.05, 0.05]} />
        <meshStandardMaterial color={hpPct > 0.4 ? '#22c55e' : '#ef4444'} emissive={hpPct > 0.4 ? '#22c55e' : '#ef4444'} emissiveIntensity={0.5} />
      </mesh>
      <Text position={[0, 1.25 * enemy.size, 0]} fontSize={0.14} color="#ffffff" outlineWidth={0.01} outlineColor="#000000">
        {enemy.name}
      </Text>
    </group>
  );
}

export function EncounterSystem() {
  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const playerPosition = usePlayerStore((s) => s.position);
  const takeDamage = usePlayerStore((s) => s.takeDamage);
  const registerKill = usePlayerStore((s) => s.registerKill);
  const addReserveAmmo = usePlayerStore((s) => s.addReserveAmmo);
  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const showInfo = useNotificationStore((s) => s.showInfo);

  const [encounter, setEncounter] = useState<EncounterConfig | null>(null);
  const [enemies, setEnemies] = useState<LiveEnemy[]>([]);
  const enemiesRef = useRef<LiveEnemy[]>([]);
  const mapWidth = region?.mapSpec?.grid?.width || 50;
  const mapHeight = region?.mapSpec?.grid?.height || 50;

  const encounterKey = useMemo(() => {
    if (!world || !region) return null;
    return `${world.worldId}:${region.regionId}:${timeOfDay}`;
  }, [world, region, timeOfDay]);

  useEffect(() => {
    enemiesRef.current = enemies;
  }, [enemies]);

  useEffect(() => {
    if (!world || !region || !encounterKey) return;
    let ignore = false;

    const run = async () => {
      try {
        const res = await fetch('/api/ai/encounter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dishName: world.dish.name,
            regionName: region.name,
            regionInspiration: region.inspiration.countryOrArea,
            timeOfDay,
          }),
        });
        const data = await res.json();
        if (ignore || !data?.encounter?.enemies?.length) return;

        const nextEncounter = data.encounter as EncounterConfig;
        setEncounter(nextEncounter);
        setEnemies(createWave(nextEncounter.enemies, mapWidth, mapHeight, nextEncounter.threatLevel));
        showInfo(`⚔️ ${nextEncounter.encounterName}`, nextEncounter.objectiveHint);
      } catch (error) {
        console.error('Encounter fetch failed:', error);
      }
    };

    run();
    return () => {
      ignore = true;
    };
  }, [encounterKey, world, region, timeOfDay, mapWidth, mapHeight, showInfo]);

  const handleShot = useCallback((event: Event) => {
    const custom = event as CustomEvent<{ origin: [number, number, number]; direction: [number, number, number] }>;
    const detail = custom.detail;
    if (!detail || enemiesRef.current.length === 0) return;

    const ray = new THREE.Ray(
      new THREE.Vector3(detail.origin[0], detail.origin[1], detail.origin[2]),
      new THREE.Vector3(detail.direction[0], detail.direction[1], detail.direction[2]).normalize()
    );

    let hitId: string | null = null;
    let nearest = Number.POSITIVE_INFINITY;

    for (const enemy of enemiesRef.current) {
      const radius = 0.6 * enemy.size;
      const toCenter = new THREE.Vector3().subVectors(enemy.position, ray.origin);
      const projection = toCenter.dot(ray.direction);
      if (projection < 0 || projection > 80) continue;
      const closest = new THREE.Vector3().copy(ray.origin).addScaledVector(ray.direction, projection);
      const dist = closest.distanceTo(enemy.position);
      if (dist <= radius && projection < nearest) {
        nearest = projection;
        hitId = enemy.id;
      }
    }

    if (!hitId) return;

    setEnemies((prev) => {
      const updated: LiveEnemy[] = [];
      for (const enemy of prev) {
        if (enemy.id !== hitId) {
          updated.push(enemy);
          continue;
        }

        const nextHp = enemy.health - 34;
        if (nextHp <= 0) {
          registerKill();
          addReserveAmmo(6);
          continue;
        }

        updated.push({ ...enemy, health: nextHp });
      }
      return updated;
    });
  }, [registerKill, addReserveAmmo]);

  useEffect(() => {
    window.addEventListener('fps-shoot', handleShot as EventListener);
    return () => window.removeEventListener('fps-shoot', handleShot as EventListener);
  }, [handleShot]);

  useFrame((state, delta) => {
    if (isPaused || dialogueActive || enemiesRef.current.length === 0) return;
    const now = state.clock.elapsedTime;
    const px = playerPosition[0];
    const pz = playerPosition[2];
    const threat = encounter?.threatLevel || 2;

    setEnemies((prev) => prev.map((enemy, idx) => {
      const toPlayer = new THREE.Vector3(px - enemy.position.x, 0, pz - enemy.position.z);
      const dist = toPlayer.length();
      if (dist > 0.001) {
        toPlayer.normalize();
      }

      const strafe = Math.sin(now * 1.7 + idx) * 0.45;
      const side = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).multiplyScalar(strafe);
      const movement = toPlayer.multiplyScalar(enemy.speed * delta).add(side.multiplyScalar(delta));
      enemy.position.add(movement);

      if (dist < 1.6 && now - enemy.lastAttackAt > 0.85) {
        enemy.lastAttackAt = now;
        takeDamage(4 + threat * 1.5);
      }

      return { ...enemy };
    }));
  });

  if (!encounter || enemies.length === 0) return null;

  return (
    <group>
      {enemies.map((enemy) => (
        <EnemyVisual key={enemy.id} enemy={enemy} />
      ))}
    </group>
  );
}

export default EncounterSystem;

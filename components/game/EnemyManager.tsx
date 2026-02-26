'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBox, Sparkles } from '@react-three/drei';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useCombatStore, type CombatEnemy } from '@/lib/store/combatStore';
import { useWorldStore } from '@/lib/store/worldStore';

interface EnemyManagerProps {
  regionId: string;
  mapWidth: number;
  mapHeight: number;
  seed: string;
}

async function requestCombatBeat(
  payload: {
    event: 'spawn' | 'kill' | 'low_health';
    regionId: string;
    dishName?: string;
    killCount: number;
    playerHealth: number;
    activeQuestTitles: string[];
  },
  setDirectorLine: (line: string) => void
) {
  try {
    const response = await fetch('/api/ai/combat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.line) {
        setDirectorLine(data.line);
      }
    }
  } catch {
    // No-op in gameplay.
  }
}

function EnemyVisual({ enemy }: { enemy: CombatEnemy }) {
  const colorMap = {
    sprout: '#5fd17d',
    ember: '#ff7a5c',
    shroom: '#8f79ff',
  } as const;

  const emissiveMap = {
    sprout: '#2d8f4c',
    ember: '#ff4f22',
    shroom: '#5a44cc',
  } as const;

  const color = colorMap[enemy.variant];
  const emissive = emissiveMap[enemy.variant];

  return (
    <group>
      <RoundedBox args={[0.7, 0.6, 0.5]} radius={0.08} smoothness={4} castShadow position={[0, 0.4, 0]}>
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.45} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.23, 10, 10]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[-0.1, 0.96, 0.2]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.1, 0.96, 0.2]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <Sparkles count={8} scale={[1.3, 0.8, 1.3]} size={1.3} speed={0.5} color={color} opacity={0.4} />
    </group>
  );
}

function EnemyActor({ enemy, mapWidth, mapHeight }: { enemy: CombatEnemy; mapWidth: number; mapHeight: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const initialPhase = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < enemy.enemyId.length; i += 1) {
      hash = ((hash << 5) - hash + enemy.enemyId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 628) / 100;
  }, [enemy.enemyId]);
  const bobRef = useRef(initialPhase);
  const syncTimer = useRef(0);

  const playerPos = usePlayerStore((s) => s.position);
  const damagePlayer = useCombatStore((s) => s.damagePlayer);
  const setEnemyPosition = useCombatStore((s) => s.setEnemyPosition);
  const markEnemyAttack = useCombatStore((s) => s.markEnemyAttack);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.set(enemy.position[0], enemy.position[1], enemy.position[2]);
    }
  }, [enemy.position]);

  useFrame((_, delta) => {
    if (!groupRef.current || !enemy.alive) return;

    const maxDelta = Math.min(0.06, delta);
    const playerVector = new THREE.Vector3(playerPos[0], 0.55, playerPos[2]);
    const direction = playerVector.clone().sub(groupRef.current.position);
    const distance = direction.length();

    if (distance > 0.001) {
      direction.normalize();
    }

    bobRef.current += maxDelta * 4;

    if (distance > 1.6) {
      const stride = enemy.speed * maxDelta;
      groupRef.current.position.addScaledVector(direction, stride);
      groupRef.current.position.x = THREE.MathUtils.clamp(groupRef.current.position.x, -mapWidth / 2 + 1, mapWidth / 2 - 1);
      groupRef.current.position.z = THREE.MathUtils.clamp(groupRef.current.position.z, -mapHeight / 2 + 1, mapHeight / 2 - 1);
    } else {
      const now = performance.now();
      if (now - enemy.lastAttackAt > 1200) {
        damagePlayer(7);
        markEnemyAttack(enemy.enemyId, now);
      }
    }

    groupRef.current.position.y = 0.55 + Math.sin(bobRef.current) * 0.08;
    groupRef.current.lookAt(playerPos[0], 0.7, playerPos[2]);

    syncTimer.current += maxDelta;
    if (syncTimer.current > 0.08) {
      syncTimer.current = 0;
      setEnemyPosition(enemy.enemyId, [
        groupRef.current.position.x,
        groupRef.current.position.y,
        groupRef.current.position.z,
      ]);
    }
  });

  if (!enemy.alive) return null;

  return (
    <group ref={groupRef}>
      <EnemyVisual enemy={enemy} />
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.55, 20]} />
        <meshBasicMaterial color="#ff4f4f" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export function EnemyManager({ regionId, mapWidth, mapHeight, seed }: EnemyManagerProps) {
  const enemies = useCombatStore((s) => s.enemies);
  const playerHealth = useCombatStore((s) => s.playerHealth);
  const killCount = useCombatStore((s) => s.killCount);
  const initializeEncounter = useCombatStore((s) => s.initializeEncounter);
  const setDirectorLine = useCombatStore((s) => s.setDirectorLine);
  const world = useWorldStore((s) => s.world);
  const activeQuests = usePlayerStore((s) => s.activeQuests);

  const encounterSeed = useMemo(() => `${seed}-${regionId}`, [seed, regionId]);
  const activeQuestTitles = activeQuests.map((q) => q.title).slice(0, 3);
  const dishName = world?.dish.name;

  useEffect(() => {
    initializeEncounter(encounterSeed, mapWidth, mapHeight);
    requestCombatBeat({
      event: 'spawn',
      regionId,
      dishName,
      killCount: useCombatStore.getState().killCount,
      playerHealth: useCombatStore.getState().playerHealth,
      activeQuestTitles,
    }, setDirectorLine);
  }, [activeQuestTitles, dishName, encounterSeed, initializeEncounter, mapHeight, mapWidth, regionId, setDirectorLine]);

  const lastKillNotified = useRef(0);
  const lowHealthNotified = useRef(false);

  useEffect(() => {
    if (killCount > lastKillNotified.current) {
      lastKillNotified.current = killCount;
      requestCombatBeat({
        event: 'kill',
        regionId,
        dishName,
        killCount: useCombatStore.getState().killCount,
        playerHealth: useCombatStore.getState().playerHealth,
        activeQuestTitles,
      }, setDirectorLine);
    }
  }, [activeQuestTitles, dishName, killCount, regionId, setDirectorLine]);

  useEffect(() => {
    if (playerHealth <= 35 && !lowHealthNotified.current) {
      lowHealthNotified.current = true;
      requestCombatBeat({
        event: 'low_health',
        regionId,
        dishName,
        killCount: useCombatStore.getState().killCount,
        playerHealth: useCombatStore.getState().playerHealth,
        activeQuestTitles,
      }, setDirectorLine);
    }

    if (playerHealth > 55) {
      lowHealthNotified.current = false;
    }
  }, [activeQuestTitles, dishName, playerHealth, regionId, setDirectorLine]);

  return (
    <group>
      {enemies.map((enemy) => (
        <EnemyActor key={enemy.enemyId} enemy={enemy} mapWidth={mapWidth} mapHeight={mapHeight} />
      ))}
    </group>
  );
}

export default EnemyManager;

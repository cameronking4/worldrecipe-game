'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { onShoot, type ShootEvent } from '@/lib/game/fpsBus';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useWorldStore } from '@/lib/store/worldStore';
import { usePortalStore } from '@/lib/store/portalStore';
import { useCombatStore } from '@/lib/store/combatStore';

function seededRandom(seed: string) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return () => {
    hash += hash << 13;
    hash ^= hash >>> 7;
    hash += hash << 3;
    hash ^= hash >>> 17;
    hash += hash << 5;
    return ((hash >>> 0) % 10000) / 10000;
  };
}

function raySphereDistance(event: ShootEvent, center: THREE.Vector3, radius: number) {
  const oc = event.origin.clone().sub(center);
  const b = 2 * oc.dot(event.direction);
  const c = oc.dot(oc) - radius * radius;
  const discriminant = b * b - 4 * c;

  if (discriminant < 0) return null;
  const sq = Math.sqrt(discriminant);
  const tNear = (-b - sq) / 2;
  const tFar = (-b + sq) / 2;

  if (tNear > 0) return tNear;
  if (tFar > 0) return tFar;
  return null;
}

export interface EnemyAgentHandle {
  getHitDistance: (event: ShootEvent) => number | null;
  applyDamage: (amount: number) => boolean;
}

interface EnemyAgentProps {
  spawn: THREE.Vector3;
  mapWidth: number;
  mapHeight: number;
}

const EnemyAgent = forwardRef<EnemyAgentHandle, EnemyAgentProps>(function EnemyAgent(
  { spawn, mapWidth, mapHeight },
  ref
) {
  const groupRef = useRef<THREE.Group>(null);
  const hpRef = useRef(90);
  const aliveRef = useRef(true);
  const nextRespawnAt = useRef(0);
  const lastAttackAt = useRef(0);
  const yPhase = useRef((Math.abs(spawn.x * 0.73 + spawn.z * 0.27) % 1) * Math.PI * 2);

  const [alive, setAlive] = useState(true);
  const [hp, setHp] = useState(90);

  const playerPosition = usePlayerStore((s) => s.position);
  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const addKill = useCombatStore((s) => s.addKill);
  const takeDamage = useCombatStore((s) => s.takeDamage);

  const respawnAtRandomEdge = () => {
    if (!groupRef.current) return;

    const edge = Math.floor(Math.random() * 4);
    const halfW = mapWidth / 2 - 3;
    const halfH = mapHeight / 2 - 3;

    let x = 0;
    let z = 0;

    if (edge === 0) {
      x = -halfW;
      z = (Math.random() * 2 - 1) * halfH;
    } else if (edge === 1) {
      x = halfW;
      z = (Math.random() * 2 - 1) * halfH;
    } else if (edge === 2) {
      x = (Math.random() * 2 - 1) * halfW;
      z = -halfH;
    } else {
      x = (Math.random() * 2 - 1) * halfW;
      z = halfH;
    }

    groupRef.current.position.set(x, 0.6, z);
  };

  useImperativeHandle(ref, () => ({
    getHitDistance: (event) => {
      if (!aliveRef.current || !groupRef.current) return null;
      return raySphereDistance(event, groupRef.current.position, 0.8);
    },
    applyDamage: (amount) => {
      if (!aliveRef.current) return false;

      const nextHp = hpRef.current - amount;
      hpRef.current = nextHp;
      setHp(Math.max(0, nextHp));

      if (nextHp <= 0) {
        aliveRef.current = false;
        setAlive(false);
        nextRespawnAt.current = performance.now() + 5500;
        addKill();
        return true;
      }

      return false;
    },
  }), [addKill]);

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(spawn);
  }, [spawn]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const now = state.clock.elapsedTime * 1000;
    if (!aliveRef.current) {
      if (now >= nextRespawnAt.current) {
        aliveRef.current = true;
        setAlive(true);
        hpRef.current = 90;
        setHp(90);
        respawnAtRandomEdge();
      }
      return;
    }

    if (isPaused || dialogueActive) return;

    const player = new THREE.Vector3(playerPosition[0], 0.6, playerPosition[2]);
    const current = groupRef.current.position;
    const toPlayer = player.sub(current);
    const distance = toPlayer.length();

    if (distance > 0.05) {
      toPlayer.normalize();
    }

    const speed = distance < 4 ? 2.2 : 1.4;
    if (distance > 1.2) {
      current.x += toPlayer.x * speed * delta;
      current.z += toPlayer.z * speed * delta;
      current.x = THREE.MathUtils.clamp(current.x, -mapWidth / 2 + 1.5, mapWidth / 2 - 1.5);
      current.z = THREE.MathUtils.clamp(current.z, -mapHeight / 2 + 1.5, mapHeight / 2 - 1.5);
    }

    current.y = 0.55 + Math.sin(state.clock.elapsedTime * 3 + yPhase.current) * 0.08;
    groupRef.current.lookAt(playerPosition[0], current.y, playerPosition[2]);

    if (distance < 1.45 && now - lastAttackAt.current > 950) {
      lastAttackAt.current = now;
      takeDamage(8 + Math.floor(Math.random() * 3));
    }
  });

  if (!alive) return null;

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <dodecahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#f97316" roughness={0.5} metalness={0.2} emissive="#7c2d12" emissiveIntensity={0.35} />
      </mesh>

      <mesh position={[0, 0, 0.6]}>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={1.2} />
      </mesh>

      <mesh position={[-0.25, -0.08, 0.55]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color="#fef08a" emissive="#fde047" emissiveIntensity={1} />
      </mesh>

      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[0.9, 0.08, 0.08]} />
        <meshBasicMaterial color="#3f1d0a" />
      </mesh>
      <mesh position={[0, 0.95, 0.001]}>
        <boxGeometry args={[0.9 * (hp / 90), 0.08, 0.06]} />
        <meshBasicMaterial color={hp > 35 ? '#34d399' : '#f87171'} />
      </mesh>

      <Text
        position={[0, 1.35, 0]}
        fontSize={0.16}
        color="#fff7ed"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#1f2937"
      >
        Spice Wisp
      </Text>
    </group>
  );
});

export function EnemyManager() {
  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);
  const isInPortal = usePortalStore((s) => s.isInPortal);
  const portalBoard = usePortalStore((s) => s.getCurrentPortalBoard());

  const mapWidth = isInPortal ? portalBoard?.mapSpec.grid.width || 40 : region?.mapSpec.grid.width || 50;
  const mapHeight = isInPortal ? portalBoard?.mapSpec.grid.height || 40 : region?.mapSpec.grid.height || 50;

  const seeds = useMemo(() => {
    const seed = `${world?.seed || 'fps'}-${isInPortal ? portalBoard?.boardId || 'portal' : region?.regionId || 'hub'}`;
    const random = seededRandom(seed);
    const count = Math.min(12, Math.max(6, Math.floor((mapWidth * mapHeight) / 280)));

    return Array.from({ length: count }).map((_, i) => {
      const x = (random() * 2 - 1) * (mapWidth / 2 - 4);
      const z = (random() * 2 - 1) * (mapHeight / 2 - 4);
      return {
        id: `enemy_${i}`,
        spawn: new THREE.Vector3(x, 0.6, z),
      };
    });
  }, [isInPortal, mapHeight, mapWidth, portalBoard?.boardId, region?.regionId, world?.seed]);

  const agentRefs = useRef<Array<EnemyAgentHandle | null>>([]);

  useEffect(() => {
    const unsubscribe = onShoot((event) => {
      let bestIndex = -1;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < agentRefs.current.length; i++) {
        const handle = agentRefs.current[i];
        if (!handle) continue;

        const hitDistance = handle.getHitDistance(event);
        if (hitDistance !== null && hitDistance < bestDistance) {
          bestDistance = hitDistance;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        agentRefs.current[bestIndex]?.applyDamage(40);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <group>
      {seeds.map((enemy, i) => (
        <EnemyAgent
          key={enemy.id}
          ref={(node) => {
            agentRefs.current[i] = node;
          }}
          spawn={enemy.spawn}
          mapWidth={mapWidth}
          mapHeight={mapHeight}
        />
      ))}
    </group>
  );
}

export default EnemyManager;

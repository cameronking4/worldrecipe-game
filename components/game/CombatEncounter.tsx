'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useCombatStore } from '@/lib/store/combatStore';

function EnemyUnit({
  position,
  hp,
  maxHp,
  persona,
}: {
  position: [number, number, number];
  hp: number;
  maxHp: number;
  persona: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const hpPercent = Math.max(0, Math.min(1, hp / maxHp));

  useFrame((state) => {
    if (!groupRef.current) return;
    const bob = Math.sin(state.clock.elapsedTime * 2.4 + position[0]) * 0.08;
    groupRef.current.position.y = position[1] + bob;
    groupRef.current.rotation.y += 0.01;
  });

  const primaryColor = useMemo(() => {
    if (persona.includes('Spice')) return '#f97316';
    if (persona.includes('Broth')) return '#38bdf8';
    if (persona.includes('Smoke')) return '#a78bfa';
    return '#f43f5e';
  }, [persona]);

  return (
    <group ref={groupRef} position={position}>
      <RoundedBox args={[0.8, 0.8, 0.8]} radius={0.18} smoothness={4} castShadow>
        <meshStandardMaterial color={primaryColor} roughness={0.4} metalness={0.2} emissive={primaryColor} emissiveIntensity={0.35} />
      </RoundedBox>

      <mesh position={[0, 0.15, 0.35]}>
        <boxGeometry args={[0.16, 0.16, 0.08]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.24, -0.05, 0.2]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[-0.24, -0.05, 0.2]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.9, 0.08, 0.08]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[-0.45 + 0.9 * hpPercent * 0.5, 0.7, 0.05]}>
        <boxGeometry args={[0.9 * hpPercent, 0.07, 0.05]} />
        <meshStandardMaterial color={hpPercent > 0.4 ? '#22c55e' : '#ef4444'} emissive={hpPercent > 0.4 ? '#22c55e' : '#ef4444'} emissiveIntensity={0.4} />
      </mesh>

      <Sparkles count={8} scale={[1.5, 1.2, 1.5]} size={1.5} speed={1.4} opacity={0.45} color={primaryColor} />
    </group>
  );
}

export function CombatEncounter() {
  const playerPosition = usePlayerStore((s) => s.position);
  const enemies = useCombatStore((s) => s.enemies);
  const tickEnemies = useCombatStore((s) => s.tickEnemies);

  useFrame((state, delta) => {
    tickEnemies(playerPosition, delta, performance.now());
  });

  return (
    <group>
      {enemies.map((enemy) => (
        <EnemyUnit
          key={enemy.id}
          position={enemy.position}
          hp={enemy.hp}
          maxHp={enemy.maxHp}
          persona={enemy.persona}
        />
      ))}
    </group>
  );
}

export default CombatEncounter;

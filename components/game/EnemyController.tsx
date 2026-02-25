'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';
import type { EnemyInstance, EnemyType } from '@/types/game';

// ============================================
// Single Enemy Visual
// ============================================
function EnemyVisual({
  instance,
  enemyType,
}: {
  instance: EnemyInstance;
  enemyType: EnemyType;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Group>(null);
  const hurtFlash = useRef(0);
  const prevHealth = useRef(instance.health);
  const bobOffset = useRef(Math.random() * Math.PI * 2);

  const playerPosition = usePlayerStore((s) => s.position);
  const updateEnemy = useGameStore((s) => s.updateEnemy);

  const baseColor = useMemo(() => new THREE.Color(enemyType.color), [enemyType.color]);
  const emissiveColor = useMemo(() => new THREE.Color(enemyType.color).multiplyScalar(0.3), [enemyType.color]);
  const scale = enemyType.scale;

  // Enemy AI behavior
  useFrame((state, delta) => {
    if (!groupRef.current || !instance.isAlive) return;

    // Damage flash
    if (instance.health < prevHealth.current) {
      hurtFlash.current = 1;
    }
    prevHealth.current = instance.health;
    hurtFlash.current = Math.max(0, hurtFlash.current - delta * 5);

    // Bobbing animation
    if (meshRef.current) {
      bobOffset.current += delta * 3;
      meshRef.current.position.y = Math.sin(bobOffset.current) * 0.05;
    }

    // Face player
    const enemyPos = new THREE.Vector3(...instance.position);
    const playerPos = new THREE.Vector3(...playerPosition);
    const direction = playerPos.clone().sub(enemyPos);
    direction.y = 0;

    if (direction.length() > 0.1) {
      const angle = Math.atan2(direction.x, direction.z);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        angle,
        delta * 5
      );
    }

    // AI movement based on behavior
    const distToPlayer = direction.length();
    let targetX = instance.position[0];
    let targetZ = instance.position[2];

    switch (enemyType.behavior) {
      case 'rusher':
        // Rush toward player
        if (distToPlayer > enemyType.attackRange * 0.8) {
          const moveDir = direction.normalize();
          targetX += moveDir.x * enemyType.speed * delta;
          targetZ += moveDir.z * enemyType.speed * delta;
        }
        break;
      case 'sniper':
        // Keep distance
        if (distToPlayer < enemyType.attackRange * 0.5) {
          const moveDir = direction.normalize();
          targetX -= moveDir.x * enemyType.speed * delta * 0.5;
          targetZ -= moveDir.z * enemyType.speed * delta * 0.5;
        } else if (distToPlayer > enemyType.attackRange) {
          const moveDir = direction.normalize();
          targetX += moveDir.x * enemyType.speed * delta * 0.3;
          targetZ += moveDir.z * enemyType.speed * delta * 0.3;
        }
        break;
      case 'flanker':
        // Circle around player
        const perpAngle = Math.atan2(direction.x, direction.z) + Math.PI / 2;
        const circleSpeed = enemyType.speed * 0.7;
        targetX += Math.sin(perpAngle) * circleSpeed * delta;
        targetZ += Math.cos(perpAngle) * circleSpeed * delta;
        if (distToPlayer > enemyType.attackRange) {
          const moveDir = direction.normalize();
          targetX += moveDir.x * enemyType.speed * delta * 0.5;
          targetZ += moveDir.z * enemyType.speed * delta * 0.5;
        }
        break;
      case 'tank':
        // Slow but steady advance
        if (distToPlayer > enemyType.attackRange * 0.6) {
          const moveDir = direction.normalize();
          targetX += moveDir.x * enemyType.speed * delta;
          targetZ += moveDir.z * enemyType.speed * delta;
        }
        break;
      default:
        // Generic chase
        if (distToPlayer > enemyType.attackRange * 0.7) {
          const moveDir = direction.normalize();
          targetX += moveDir.x * enemyType.speed * delta;
          targetZ += moveDir.z * enemyType.speed * delta;
        }
    }

    // Clamp to arena bounds
    targetX = Math.max(-24, Math.min(24, targetX));
    targetZ = Math.max(-24, Math.min(24, targetZ));

    // Update position
    updateEnemy(instance.instanceId, {
      position: [targetX, instance.position[1], targetZ],
      state: distToPlayer <= enemyType.attackRange ? 'attack' : 'chase',
    });

    groupRef.current.position.set(targetX, instance.position[1], targetZ);

    // Attack player when in range
    if (distToPlayer <= enemyType.attackRange && instance.state === 'attack') {
      const now = Date.now();
      if (now - instance.lastAttackTime > enemyType.attackCooldown * 1000) {
        // Damage player
        const playerStore = usePlayerStore.getState();
        playerStore.takeDamage(enemyType.damage);
        updateEnemy(instance.instanceId, { lastAttackTime: now });

        // Add damage indicator
        const gameStore = useGameStore.getState();
        gameStore.addDamageIndicator({
          id: `dmg_${now}`,
          direction: Math.atan2(
            instance.position[0] - playerPosition[0],
            instance.position[2] - playerPosition[2]
          ),
          timestamp: now,
        });
      }
    }
  });

  if (!instance.isAlive) return null;

  const healthPercent = instance.health / instance.maxHealth;
  const flashColor = hurtFlash.current > 0 ? '#FF0000' : undefined;

  // Different visual based on enemy behavior
  const renderBody = () => {
    switch (enemyType.behavior) {
      case 'tank':
        return (
          <group ref={meshRef}>
            {/* Heavy body */}
            <RoundedBox args={[0.9 * scale, 1.2 * scale, 0.8 * scale]} radius={0.1} smoothness={4} castShadow>
              <meshStandardMaterial
                color={flashColor || baseColor}
                roughness={0.4}
                metalness={0.6}
                emissive={emissiveColor}
                emissiveIntensity={0.3}
              />
            </RoundedBox>
            {/* Shoulder pads */}
            <RoundedBox args={[1.2 * scale, 0.3 * scale, 0.5 * scale]} radius={0.05} position={[0, 0.5 * scale, 0]} castShadow>
              <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
            </RoundedBox>
            {/* Head */}
            <mesh position={[0, 0.8 * scale, 0]} castShadow>
              <boxGeometry args={[0.4 * scale, 0.4 * scale, 0.4 * scale]} />
              <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Eye visor */}
            <mesh position={[0, 0.82 * scale, 0.21 * scale]}>
              <boxGeometry args={[0.35 * scale, 0.08 * scale, 0.02]} />
              <meshStandardMaterial color={enemyType.color} emissive={enemyType.color} emissiveIntensity={2} />
            </mesh>
          </group>
        );
      case 'sniper':
        return (
          <group ref={meshRef}>
            {/* Slim body */}
            <RoundedBox args={[0.4 * scale, 1.4 * scale, 0.35 * scale]} radius={0.08} smoothness={4} castShadow>
              <meshStandardMaterial
                color={flashColor || baseColor}
                roughness={0.3}
                metalness={0.7}
                emissive={emissiveColor}
                emissiveIntensity={0.3}
              />
            </RoundedBox>
            {/* Head with scope eye */}
            <mesh position={[0, 0.9 * scale, 0]} castShadow>
              <boxGeometry args={[0.3 * scale, 0.35 * scale, 0.3 * scale]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Scope eye */}
            <mesh position={[0, 0.92 * scale, 0.16 * scale]}>
              <sphereGeometry args={[0.06 * scale, 8, 8]} />
              <meshStandardMaterial color={enemyType.color} emissive={enemyType.color} emissiveIntensity={3} />
            </mesh>
          </group>
        );
      default:
        // Generic enemy (rusher, flanker, bomber, support)
        return (
          <group ref={meshRef}>
            {/* Body */}
            <RoundedBox args={[0.6 * scale, 1.0 * scale, 0.5 * scale]} radius={0.1} smoothness={4} castShadow>
              <meshStandardMaterial
                color={flashColor || baseColor}
                roughness={0.4}
                metalness={0.5}
                emissive={emissiveColor}
                emissiveIntensity={0.3}
              />
            </RoundedBox>
            {/* Head */}
            <mesh position={[0, 0.7 * scale, 0]} castShadow>
              <boxGeometry args={[0.35 * scale, 0.35 * scale, 0.35 * scale]} />
              <meshStandardMaterial color="#333" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.08 * scale, 0.72 * scale, 0.18 * scale]}>
              <boxGeometry args={[0.06 * scale, 0.06 * scale, 0.02]} />
              <meshStandardMaterial color={enemyType.color} emissive={enemyType.color} emissiveIntensity={2} />
            </mesh>
            <mesh position={[0.08 * scale, 0.72 * scale, 0.18 * scale]}>
              <boxGeometry args={[0.06 * scale, 0.06 * scale, 0.02]} />
              <meshStandardMaterial color={enemyType.color} emissive={enemyType.color} emissiveIntensity={2} />
            </mesh>
            {/* Arms */}
            <mesh position={[-0.4 * scale, 0.1 * scale, 0]} castShadow>
              <boxGeometry args={[0.15 * scale, 0.6 * scale, 0.15 * scale]} />
              <meshStandardMaterial color={flashColor || baseColor} roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0.4 * scale, 0.1 * scale, 0]} castShadow>
              <boxGeometry args={[0.15 * scale, 0.6 * scale, 0.15 * scale]} />
              <meshStandardMaterial color={flashColor || baseColor} roughness={0.5} metalness={0.4} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.15 * scale, -0.55 * scale, 0]} castShadow>
              <boxGeometry args={[0.18 * scale, 0.4 * scale, 0.18 * scale]} />
              <meshStandardMaterial color="#333" roughness={0.7} />
            </mesh>
            <mesh position={[0.15 * scale, -0.55 * scale, 0]} castShadow>
              <boxGeometry args={[0.18 * scale, 0.4 * scale, 0.18 * scale]} />
              <meshStandardMaterial color="#333" roughness={0.7} />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group ref={groupRef} position={instance.position}>
      {renderBody()}

      {/* Health bar */}
      {healthPercent < 1 && (
        <Billboard position={[0, 1.5 * scale, 0]} follow lockX={false} lockY={false} lockZ={false}>
          {/* Background */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[0.8, 0.08]} />
            <meshBasicMaterial color="#111" transparent opacity={0.7} />
          </mesh>
          {/* Health fill */}
          <mesh position={[(healthPercent - 1) * 0.38, 0, 0]}>
            <planeGeometry args={[0.76 * healthPercent, 0.06]} />
            <meshBasicMaterial
              color={healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000'}
            />
          </mesh>
        </Billboard>
      )}

      {/* Enemy glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.4 * scale, 0.5 * scale, 16]} />
        <meshBasicMaterial
          color={enemyType.color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Point light for enemy glow */}
      <pointLight
        position={[0, 0.5 * scale, 0]}
        color={enemyType.color}
        intensity={0.5}
        distance={4}
      />
    </group>
  );
}

// ============================================
// Enemy Manager - Renders all enemies
// ============================================
export function EnemyManager() {
  const enemies = useGameStore((s) => s.enemies);
  const enemyTypes = useGameStore((s) => s.enemyTypes);

  const typeMap = useMemo(() => {
    const map = new Map<string, EnemyType>();
    enemyTypes.forEach((t) => map.set(t.enemyTypeId, t));
    return map;
  }, [enemyTypes]);

  return (
    <group>
      {enemies
        .filter((e) => e.isAlive)
        .map((enemy) => {
          const enemyType = typeMap.get(enemy.typeId);
          if (!enemyType) return null;

          return (
            <EnemyVisual
              key={enemy.instanceId}
              instance={enemy}
              enemyType={enemyType}
            />
          );
        })}
    </group>
  );
}

export default EnemyManager;

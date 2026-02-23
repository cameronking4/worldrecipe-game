'use client';

import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox, Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useFPSStore, type Enemy } from '@/lib/store/fpsStore';
import { usePlayerStore } from '@/lib/store/playerStore';

// ============================================
// Voxel Enemy Visual
// ============================================
interface EnemyVisualProps {
  enemy: Enemy;
  isMoving: boolean;
  isDying: boolean;
}

function VoxelEnemy({ enemy, isMoving, isDying }: EnemyVisualProps) {
  const meshRef = useRef<THREE.Group>(null);
  const bobOffset = useRef(0);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    if (isDying) {
      // Death animation - fall and fade
      meshRef.current.rotation.x += delta * 3;
      meshRef.current.position.y -= delta * 2;
      return;
    }

    // Bobbing animation when moving
    if (isMoving) {
      bobOffset.current += delta * 8;
      meshRef.current.position.y = Math.sin(bobOffset.current) * 0.05;
    } else {
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        0,
        delta * 5
      );

      // Idle breathing
      const breathe = Math.sin(state.clock.elapsedTime * 2) * 0.02;
      meshRef.current.scale.y = 1 + breathe;
    }
  });

  // Color based on AI type
  const getColorByType = () => {
    switch (enemy.aiType) {
      case 'aggressive': return '#FF4444';
      case 'defensive': return '#4444FF';
      case 'sneaky': return '#44FF44';
      case 'boss': return '#FF00FF';
      default: return '#FF4444';
    }
  };

  const enemyColor = getColorByType();
  const healthPercent = enemy.health / enemy.maxHealth;

  return (
    <group ref={meshRef} userData={{ enemyId: enemy.id }}>
      {/* Body */}
      <RoundedBox
        args={[0.6, 0.8, 0.5]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.4, 0]}
        castShadow
        userData={{ enemyId: enemy.id }}
      >
        <meshStandardMaterial
          color={enemyColor}
          roughness={0.7}
          metalness={0.2}
          transparent={isDying}
          opacity={isDying ? 0.5 : 1}
        />
      </RoundedBox>

      {/* Head */}
      <RoundedBox
        args={[0.5, 0.5, 0.45]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.95, 0]}
        castShadow
        userData={{ enemyId: enemy.id }}
      >
        <meshStandardMaterial
          color={enemyColor}
          roughness={0.6}
          transparent={isDying}
          opacity={isDying ? 0.5 : 1}
        />
      </RoundedBox>

      {/* Eyes - glowing */}
      <mesh position={[-0.12, 1.0, 0.22]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial
          color="#FF0000"
          emissive="#FF0000"
          emissiveIntensity={0.8}
        />
      </mesh>
      <mesh position={[0.12, 1.0, 0.22]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial
          color="#FF0000"
          emissive="#FF0000"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Arms */}
      <RoundedBox
        args={[0.2, 0.5, 0.2]}
        radius={0.04}
        smoothness={4}
        position={[-0.45, 0.35, 0]}
        castShadow
      >
        <meshStandardMaterial color={enemyColor} roughness={0.7} />
      </RoundedBox>
      <RoundedBox
        args={[0.2, 0.5, 0.2]}
        radius={0.04}
        smoothness={4}
        position={[0.45, 0.35, 0]}
        castShadow
      >
        <meshStandardMaterial color={enemyColor} roughness={0.7} />
      </RoundedBox>

      {/* Legs */}
      <RoundedBox
        args={[0.22, 0.35, 0.22]}
        radius={0.04}
        smoothness={4}
        position={[-0.15, -0.05, 0]}
        castShadow
      >
        <meshStandardMaterial color={enemyColor} roughness={0.8} />
      </RoundedBox>
      <RoundedBox
        args={[0.22, 0.35, 0.22]}
        radius={0.04}
        smoothness={4}
        position={[0.15, -0.05, 0]}
        castShadow
      >
        <meshStandardMaterial color={enemyColor} roughness={0.8} />
      </RoundedBox>

      {/* Health bar above head */}
      {!isDying && (
        <Billboard position={[0, 1.5, 0]} follow={true} lockX={false} lockY={false} lockZ={false}>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[0.6, 0.08]} />
            <meshBasicMaterial color="#333333" />
          </mesh>
          <mesh position={[-(0.6 * (1 - healthPercent)) / 2, 0, 0.01]}>
            <planeGeometry args={[0.6 * healthPercent, 0.06]} />
            <meshBasicMaterial
              color={healthPercent > 0.5 ? '#00FF00' : healthPercent > 0.25 ? '#FFFF00' : '#FF0000'}
            />
          </mesh>
        </Billboard>
      )}

      {/* Enemy name tag */}
      {!isDying && enemy.aiType === 'boss' && (
        <Billboard position={[0, 1.8, 0]} follow={true}>
          <Text
            fontSize={0.15}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            {enemy.name}
          </Text>
        </Billboard>
      )}

      {/* Glowing effect around enemy */}
      <pointLight
        position={[0, 0.5, 0]}
        color={enemyColor}
        intensity={0.5}
        distance={2}
      />
    </group>
  );
}

// ============================================
// Individual Enemy Controller
// ============================================
interface EnemyControllerProps {
  enemy: Enemy;
}

export function EnemyInstance({ enemy }: EnemyControllerProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const enemyGroupRef = useRef<THREE.Group>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isDying, setIsDying] = useState(false);

  const playerPosition = usePlayerStore((s) => s.position);
  const updateEnemyPosition = useFPSStore((s) => s.updateEnemyPosition);
  const damageEnemy = useFPSStore((s) => s.damageEnemy);
  const takeDamage = useFPSStore((s) => s.takeDamage);

  // AI behavior state
  const attackCooldown = useRef(0);
  const lastPosition = useRef(enemy.position);

  useEffect(() => {
    if (enemy.isDead && !isDying) {
      setIsDying(true);
    }
  }, [enemy.isDead, isDying]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || enemy.isDead) return;

    attackCooldown.current = Math.max(0, attackCooldown.current - delta);

    // Get player position
    const playerPos = new THREE.Vector3(...playerPosition);
    const enemyPos = new THREE.Vector3(...enemy.position);

    // Calculate distance to player
    const distanceToPlayer = playerPos.distanceTo(enemyPos);

    // AI Behavior based on type
    const moveSpeed = enemy.aiType === 'sneaky' ? 3 : enemy.aiType === 'aggressive' ? 5 : 2;
    const attackRange = enemy.aiType === 'boss' ? 3 : 2;
    const attackDamage = enemy.aiType === 'boss' ? 20 : enemy.aiType === 'aggressive' ? 15 : 10;
    const aggroRange = enemy.aiType === 'defensive' ? 10 : enemy.aiType === 'sneaky' ? 15 : 20;

    // Only move if player is in range
    if (distanceToPlayer < aggroRange && distanceToPlayer > attackRange) {
      // Move towards player
      const direction = new THREE.Vector3()
        .subVectors(playerPos, enemyPos)
        .normalize();

      try {
        const currentVel = rigidBodyRef.current.linvel();
        rigidBodyRef.current.setLinvel(
          {
            x: direction.x * moveSpeed,
            y: currentVel.y,
            z: direction.z * moveSpeed,
          },
          true
        );

        setIsMoving(true);

        // Face player
        if (enemyGroupRef.current) {
          const angle = Math.atan2(direction.x, direction.z);
          enemyGroupRef.current.rotation.y = angle;
        }
      } catch (e) {
        console.debug('Enemy physics error:', e);
      }
    } else {
      setIsMoving(false);

      // Stop moving
      try {
        const currentVel = rigidBodyRef.current.linvel();
        rigidBodyRef.current.setLinvel(
          {
            x: 0,
            y: currentVel.y,
            z: 0,
          },
          true
        );
      } catch (e) {
        console.debug('Enemy physics error:', e);
      }
    }

    // Attack if in range
    if (distanceToPlayer < attackRange && attackCooldown.current <= 0) {
      takeDamage(attackDamage);
      attackCooldown.current = 1.5; // Attack every 1.5 seconds
    }

    // Update position in store
    try {
      const position = rigidBodyRef.current.translation();
      if (position && Number.isFinite(position.x)) {
        updateEnemyPosition(enemy.id, [position.x, position.y, position.z]);
        lastPosition.current = [position.x, position.y, position.z];
      }
    } catch (e) {
      console.debug('Position update error:', e);
    }
  });

  // Don't render if dying for too long
  if (isDying && enemy.isDead) {
    return null;
  }

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={enemy.position}
      enabledRotations={[false, false, false]}
      linearDamping={5}
      colliders={false}
      mass={1}
    >
      <CapsuleCollider args={[0.4, 0.3]} />
      <group ref={enemyGroupRef}>
        <VoxelEnemy enemy={enemy} isMoving={isMoving} isDying={isDying} />
      </group>
    </RigidBody>
  );
}

// ============================================
// Enemy Manager - Spawns and manages all enemies
// ============================================
export function EnemyManager() {
  const enemies = useFPSStore((s) => s.enemies);
  const addEnemy = useFPSStore((s) => s.addEnemy);
  const currentWave = useFPSStore((s) => s.currentWave);
  const waveActive = useFPSStore((s) => s.waveActive);
  const enemyCount = useFPSStore((s) => s.enemyCount);

  // Spawn enemies for waves
  useEffect(() => {
    if (!waveActive || enemyCount >= currentWave * 5) return;

    const spawnEnemy = (type: Enemy['aiType'], index: number) => {
      // Random spawn position around the map
      const angle = (index / (currentWave * 5)) * Math.PI * 2;
      const distance = 20 + Math.random() * 10;
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;

      const enemy: Enemy = {
        id: `enemy_${Date.now()}_${index}`,
        name: type === 'boss' ? 'BOSS' : `Enemy ${index + 1}`,
        health: type === 'boss' ? 500 : type === 'aggressive' ? 100 : 75,
        maxHealth: type === 'boss' ? 500 : type === 'aggressive' ? 100 : 75,
        position: [x, 1, z],
        isDead: false,
        aiType: type,
      };

      addEnemy(enemy);
    };

    // Spawn wave enemies
    const enemiesNeeded = currentWave * 5 - enemyCount;
    for (let i = 0; i < enemiesNeeded; i++) {
      setTimeout(() => {
        // Boss on every 5th wave
        if (currentWave % 5 === 0 && i === enemiesNeeded - 1) {
          spawnEnemy('boss', i);
        } else {
          // Random enemy types
          const types: Enemy['aiType'][] = ['aggressive', 'defensive', 'sneaky'];
          const type = types[Math.floor(Math.random() * types.length)];
          spawnEnemy(type, i);
        }
      }, i * 500); // Stagger spawning
    }
  }, [waveActive, currentWave, enemyCount, addEnemy]);

  return (
    <>
      {enemies.map((enemy) => (
        <EnemyInstance key={enemy.id} enemy={enemy} />
      ))}
    </>
  );
}

export default EnemyManager;

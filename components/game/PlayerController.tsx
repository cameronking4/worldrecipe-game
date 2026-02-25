'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';

// ============================================
// Keyboard Input
// ============================================
const useKeyboard = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    reload: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true;
          break;
        case 'Space':
          keysRef.current.jump = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.sprint = true;
          break;
        case 'KeyR':
          keysRef.current.reload = true;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keysRef.current.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false;
          break;
        case 'Space':
          keysRef.current.jump = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          keysRef.current.sprint = false;
          break;
        case 'KeyR':
          keysRef.current.reload = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    window.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, []);

  return keysRef;
};

// ============================================
// Mouse Look (pointer lock)
// ============================================
const useMouseLook = () => {
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const sensitivity = 0.002;

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        yawRef.current -= e.movementX * sensitivity;
        pitchRef.current = Math.max(
          -Math.PI / 2 + 0.1,
          Math.min(Math.PI / 2 - 0.1, pitchRef.current - e.movementY * sensitivity)
        );
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return { yawRef, pitchRef };
};

// ============================================
// Shooting System
// ============================================
const useShooting = () => {
  const isFiringRef = useRef(false);

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && document.pointerLockElement) {
        isFiringRef.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isFiringRef.current = false;
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return isFiringRef;
};

// ============================================
// Weapon Switching
// ============================================
const useWeaponSwitch = () => {
  const nextWeapon = usePlayerStore((s) => s.nextWeapon);
  const prevWeapon = usePlayerStore((s) => s.prevWeapon);
  const switchWeapon = usePlayerStore((s) => s.switchWeapon);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!document.pointerLockElement) return;
      e.preventDefault();
      if (e.deltaY > 0) nextWeapon();
      else prevWeapon();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!document.pointerLockElement) return;
      const num = parseInt(e.key);
      if (num >= 1 && num <= 9) {
        switchWeapon(num - 1);
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [nextWeapon, prevWeapon, switchWeapon]);
};

// ============================================
// First Person Weapon View
// ============================================
function WeaponViewModel() {
  const meshRef = useRef<THREE.Group>(null);
  const bobOffset = useRef(0);
  const recoilOffset = useRef(0);
  const currentWeaponIndex = usePlayerStore((s) => s.currentWeaponIndex);
  const weapons = usePlayerStore((s) => s.weapons);
  const isReloading = usePlayerStore((s) => s.isReloading);
  const isMoving = usePlayerStore((s) => s.isMoving);
  const isSprinting = usePlayerStore((s) => s.isSprinting);
  const lastFireTime = usePlayerStore((s) => s.lastFireTime);
  const weapon = weapons[currentWeaponIndex];

  useFrame((state, delta) => {
    if (!meshRef.current || !weapon) return;

    // Weapon bob when moving
    if (isMoving) {
      const bobSpeed = isSprinting ? 14 : 8;
      const bobAmount = isSprinting ? 0.04 : 0.02;
      bobOffset.current += delta * bobSpeed;
      meshRef.current.position.y = -0.35 + Math.sin(bobOffset.current) * bobAmount;
      meshRef.current.position.x = 0.25 + Math.cos(bobOffset.current * 0.5) * bobAmount * 0.5;
    } else {
      // Idle sway
      const swayAmount = 0.003;
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        -0.35 + Math.sin(state.clock.elapsedTime * 1.5) * swayAmount,
        delta * 5
      );
      meshRef.current.position.x = THREE.MathUtils.lerp(
        meshRef.current.position.x,
        0.25 + Math.cos(state.clock.elapsedTime * 1.2) * swayAmount,
        delta * 5
      );
    }

    // Recoil
    const timeSinceFire = (Date.now() - lastFireTime) / 1000;
    if (timeSinceFire < 0.15) {
      recoilOffset.current = THREE.MathUtils.lerp(
        recoilOffset.current,
        -0.06,
        delta * 30
      );
    } else {
      recoilOffset.current = THREE.MathUtils.lerp(recoilOffset.current, 0, delta * 8);
    }
    meshRef.current.position.z = -0.5 + recoilOffset.current;

    // Reload animation
    if (isReloading) {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        -0.5,
        delta * 5
      );
    } else {
      meshRef.current.rotation.x = THREE.MathUtils.lerp(
        meshRef.current.rotation.x,
        0,
        delta * 8
      );
    }
  });

  if (!weapon) return null;

  // Different weapon shapes based on type
  const getWeaponGeometry = () => {
    switch (weapon.type) {
      case 'pistol':
        return (
          <group>
            {/* Barrel */}
            <mesh position={[0, 0, -0.15]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.3]} />
              <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Body */}
            <mesh position={[0, -0.04, 0]} castShadow>
              <boxGeometry args={[0.08, 0.08, 0.18]} />
              <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Grip */}
            <mesh position={[0, -0.12, 0.04]} rotation={[0.2, 0, 0]} castShadow>
              <boxGeometry args={[0.07, 0.12, 0.06]} />
              <meshStandardMaterial color="#222" roughness={0.8} />
            </mesh>
            {/* Accent */}
            <mesh position={[0, 0.01, -0.2]}>
              <boxGeometry args={[0.03, 0.03, 0.05]} />
              <meshStandardMaterial color={weapon.color} emissive={weapon.color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      case 'rifle':
        return (
          <group>
            {/* Barrel */}
            <mesh position={[0, 0, -0.3]} castShadow>
              <boxGeometry args={[0.05, 0.05, 0.5]} />
              <meshStandardMaterial color="#3a3a3a" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Body */}
            <mesh position={[0, -0.02, 0]} castShadow>
              <boxGeometry args={[0.08, 0.1, 0.35]} />
              <meshStandardMaterial color="#2a2a2a" metalness={0.6} roughness={0.4} />
            </mesh>
            {/* Stock */}
            <mesh position={[0, -0.02, 0.22]} castShadow>
              <boxGeometry args={[0.06, 0.08, 0.15]} />
              <meshStandardMaterial color="#444" roughness={0.7} />
            </mesh>
            {/* Magazine */}
            <mesh position={[0, -0.1, -0.02]} castShadow>
              <boxGeometry args={[0.05, 0.1, 0.08]} />
              <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} />
            </mesh>
            {/* Accent strip */}
            <mesh position={[0, 0.035, -0.1]}>
              <boxGeometry args={[0.09, 0.01, 0.2]} />
              <meshStandardMaterial color={weapon.color} emissive={weapon.color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        );
      case 'shotgun':
        return (
          <group>
            {/* Double barrel */}
            <mesh position={[-0.025, 0, -0.25]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
              <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[0.025, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.45, 8]} />
              <meshStandardMaterial color="#555" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Body */}
            <mesh position={[0, -0.04, 0.02]} castShadow>
              <boxGeometry args={[0.1, 0.08, 0.25]} />
              <meshStandardMaterial color="#3d2b1f" roughness={0.8} />
            </mesh>
            {/* Pump */}
            <mesh position={[0, -0.01, -0.1]} castShadow>
              <boxGeometry args={[0.08, 0.06, 0.1]} />
              <meshStandardMaterial color="#2a2a2a" roughness={0.6} />
            </mesh>
          </group>
        );
      case 'plasma':
        return (
          <group>
            {/* Energy core */}
            <mesh position={[0, 0, -0.15]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial
                color={weapon.color}
                emissive={weapon.color}
                emissiveIntensity={1.5}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Barrel */}
            <mesh position={[0, 0, -0.25]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.25]} />
              <meshStandardMaterial color="#2a2a3a" metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Body */}
            <mesh position={[0, -0.03, 0]} castShadow>
              <boxGeometry args={[0.1, 0.1, 0.2]} />
              <meshStandardMaterial color="#1a1a2a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Glow accents */}
            <mesh position={[0, 0.03, -0.05]}>
              <boxGeometry args={[0.11, 0.01, 0.15]} />
              <meshStandardMaterial color={weapon.color} emissive={weapon.color} emissiveIntensity={0.8} />
            </mesh>
          </group>
        );
      default:
        return (
          <group>
            <mesh position={[0, 0, -0.15]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.3]} />
              <meshStandardMaterial color="#444" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, -0.04, 0]} castShadow>
              <boxGeometry args={[0.08, 0.08, 0.18]} />
              <meshStandardMaterial color="#333" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        );
    }
  };

  return (
    <group ref={meshRef} position={[0.25, -0.35, -0.5]}>
      {getWeaponGeometry()}
    </group>
  );
}

// ============================================
// Muzzle Flash Effect
// ============================================
function MuzzleFlash() {
  const meshRef = useRef<THREE.Mesh>(null);
  const lastFireTime = usePlayerStore((s) => s.lastFireTime);
  const weapons = usePlayerStore((s) => s.weapons);
  const currentWeaponIndex = usePlayerStore((s) => s.currentWeaponIndex);
  const weapon = weapons[currentWeaponIndex];

  useFrame(() => {
    if (!meshRef.current) return;
    const timeSinceFire = (Date.now() - lastFireTime) / 1000;
    meshRef.current.visible = timeSinceFire < 0.05;
    if (meshRef.current.visible) {
      meshRef.current.scale.setScalar(0.5 + Math.random() * 0.5);
      meshRef.current.rotation.z = Math.random() * Math.PI * 2;
    }
  });

  const color = weapon?.color || '#FFAA00';

  return (
    <mesh ref={meshRef} position={[0.25, -0.33, -0.85]} visible={false}>
      <planeGeometry args={[0.15, 0.15]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ============================================
// Main Player Controller (FPS)
// ============================================
export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const keysRef = useKeyboard();
  const { yawRef, pitchRef } = useMouseLook();
  const isFiringRef = useShooting();
  useWeaponSwitch();

  const { camera } = useThree();

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const setSprinting = usePlayerStore((s) => s.setSprinting);
  const fire = usePlayerStore((s) => s.fire);
  const startReload = usePlayerStore((s) => s.startReload);
  const finishReload = usePlayerStore((s) => s.finishReload);
  const isReloading = usePlayerStore((s) => s.isReloading);
  const reloadStartTime = usePlayerStore((s) => s.reloadStartTime);
  const getCurrentWeapon = usePlayerStore((s) => s.getCurrentWeapon);
  const recordShot = usePlayerStore((s) => s.recordShot);
  const isMoving = usePlayerStore((s) => s.isMoving);
  const isPaused = useGameStore((s) => s.isPaused);
  const phase = useGameStore((s) => s.phase);
  const advanceTime = useGameStore((s) => s.advanceTime);
  const enemies = useGameStore((s) => s.enemies);
  const damageEnemy = useGameStore((s) => s.damageEnemy);
  const killEnemy = useGameStore((s) => s.killEnemy);
  const addHitMarker = useGameStore((s) => s.addHitMarker);
  const addKill = usePlayerStore((s) => s.addKill);

  const baseMoveSpeed = 7;
  const sprintMultiplier = 1.6;
  const playerHeight = 1.6;

  // Track previous reload key state
  const prevReloadRef = useRef(false);

  // Raycaster for shooting
  const raycaster = useRef(new THREE.Raycaster());
  const shootDirection = useRef(new THREE.Vector3());

  // Handle shooting
  const handleShoot = useCallback(() => {
    const weapon = getCurrentWeapon();
    if (!weapon) return;

    const fired = fire();
    if (!fired) return;

    // Cast ray from camera center
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyQuaternion(camera.quaternion);

    // Add weapon spread
    const spread = weapon.stats.spread;
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    shootDirection.current.copy(dir);

    // Check hits against enemies
    let hitEnemy = false;
    const camPos = camera.position.clone();

    // Simple ray-sphere intersection for enemies
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;

      const enemyPos = new THREE.Vector3(...enemy.position);
      const enemyType = useGameStore.getState().enemyTypes.find(t => t.enemyTypeId === enemy.typeId);
      const enemyRadius = (enemyType?.scale || 1) * 0.6;

      // Ray-sphere intersection
      const toEnemy = enemyPos.clone().sub(camPos);
      const tca = toEnemy.dot(dir);
      if (tca < 0) continue; // Behind camera

      const d2 = toEnemy.lengthSq() - tca * tca;
      const r2 = enemyRadius * enemyRadius;
      if (d2 > r2) continue; // Missed

      const dist = toEnemy.length();
      if (dist > weapon.stats.range) continue; // Out of range

      // Hit!
      hitEnemy = true;
      const dmgEvent = damageEnemy(enemy.instanceId, weapon.stats.damage, 'player');
      if (dmgEvent) {
        addHitMarker({
          id: `hit_${Date.now()}`,
          position: [0, 0],
          isHeadshot: false,
          isCritical: dmgEvent.isCritical,
          damage: weapon.stats.damage,
          timestamp: Date.now(),
        });

        // Check if kill
        const updatedEnemy = useGameStore.getState().enemies.find(e => e.instanceId === enemy.instanceId);
        if (updatedEnemy && !updatedEnemy.isAlive) {
          const scoreValue = enemyType?.scoreValue || 100;
          addKill(scoreValue);
          killEnemy(enemy.instanceId, 'Player', weapon.type);
        }
      }
      recordShot(true);
      break; // Only hit first enemy in path
    }

    if (!hitEnemy) {
      recordShot(false);
    }
  }, [camera, enemies, fire, getCurrentWeapon, damageEnemy, addHitMarker, killEnemy, addKill, recordShot]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.1) {
      delta = 0.016;
    }

    const canMove = !isPaused && phase === 'combat';

    if (!isPaused) {
      advanceTime(delta);
    }

    // Check reload key
    const keys = keysRef.current;
    if (keys.reload && !prevReloadRef.current && canMove) {
      startReload();
    }
    prevReloadRef.current = keys.reload;

    // Auto-finish reload
    if (isReloading && reloadStartTime > 0) {
      const weapon = getCurrentWeapon();
      if (weapon && Date.now() - reloadStartTime > weapon.stats.reloadTime * 1000) {
        finishReload();
      }
    }

    // Shooting
    if (isFiringRef.current && canMove) {
      handleShoot();
    }

    // Update camera rotation from mouse look
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);

    // Movement
    let moveX = 0;
    let moveZ = 0;

    if (canMove) {
      if (keys.forward) moveZ -= 1;
      if (keys.backward) moveZ += 1;
      if (keys.left) moveX -= 1;
      if (keys.right) moveX += 1;
    }

    // Normalize diagonal movement
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    // Apply movement relative to camera yaw
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);
    const right = new THREE.Vector3(1, 0, 0);
    right.applyAxisAngle(new THREE.Vector3(0, 1, 0), yawRef.current);

    const isSprinting = keys.sprint && canMove && length > 0;
    const currentSpeed = baseMoveSpeed * (isSprinting ? sprintMultiplier : 1);

    const moveDir = new THREE.Vector3();
    moveDir.addScaledVector(forward, -moveZ);
    moveDir.addScaledVector(right, moveX);
    moveDir.normalize();

    try {
      const currentVel = rigidBodyRef.current.linvel();
      if (currentVel && Number.isFinite(currentVel.y)) {
        rigidBodyRef.current.setLinvel(
          {
            x: moveDir.x * currentSpeed * length,
            y: currentVel.y,
            z: moveDir.z * currentSpeed * length,
          },
          true
        );
      }

      const position = rigidBodyRef.current.translation();
      if (
        position &&
        Number.isFinite(position.x) &&
        Number.isFinite(position.y) &&
        Number.isFinite(position.z)
      ) {
        // Set camera position at player head height
        camera.position.set(position.x, position.y + playerHeight * 0.5, position.z);
        setPosition([position.x, position.y, position.z]);
      }
    } catch {
      return;
    }

    // Update movement state
    const moving = length > 0;
    if (moving !== isMoving) setMoving(moving);
    setSprinting(isSprinting);
    setRotation([yawRef.current, pitchRef.current]);
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={[0, 2, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={8}
        angularDamping={8}
        colliders={false}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.3]} position={[0, 0.8, 0]} />
      </RigidBody>

      {/* Weapon view model (attached to camera) */}
      <group>
        <WeaponViewModel />
        <MuzzleFlash />
      </group>
    </>
  );
}

export default PlayerController;

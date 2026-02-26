'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useFPSStore } from '@/lib/store/fpsStore';

// ============================================
// FPS Input Handler - Keyboard + Mouse
// ============================================
const useFPSControls = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    reload: false,
  });

  const shoot = useFPSStore((s) => s.shoot);
  const reload = useFPSStore((s) => s.reload);
  const updateLook = useFPSStore((s) => s.updateLook);
  const isDead = useFPSStore((s) => s.isDead);
  const damageEnemy = useFPSStore((s) => s.damageEnemy);
  const enemies = useFPSStore((s) => s.enemies);
  const currentWeapon = useFPSStore((s) => s.currentWeapon);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDead) return;

      const code = e.code;

      if (code === 'KeyW') keysRef.current.forward = true;
      if (code === 'KeyS') keysRef.current.backward = true;
      if (code === 'KeyA') keysRef.current.left = true;
      if (code === 'KeyD') keysRef.current.right = true;
      if (code === 'Space') {
        e.preventDefault();
        keysRef.current.jump = true;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = true;
      if (code === 'KeyR') {
        e.preventDefault();
        reload();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;

      if (code === 'KeyW') keysRef.current.forward = false;
      if (code === 'KeyS') keysRef.current.backward = false;
      if (code === 'KeyA') keysRef.current.left = false;
      if (code === 'KeyD') keysRef.current.right = false;
      if (code === 'Space') keysRef.current.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = false;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (isDead) return;

      if (e.button === 0) { // Left click
        const didShoot = shoot();
        if (didShoot) {
          // Perform raycasting to detect hit
          performShootRaycast();
        }
      }
    };

    const performShootRaycast = () => {
      // This will be called from useFrame in the actual component
      // We'll handle raycasting in the main controller
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isDead || document.pointerLockElement === null) return;

      updateLook(e.movementX, e.movementY);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [shoot, reload, updateLook, isDead]);

  return keysRef;
};

// ============================================
// Voxel Weapon Visual
// ============================================
function VoxelWeapon() {
  const weaponRef = useRef<THREE.Group>(null);
  const currentWeapon = useFPSStore((s) => s.currentWeapon);
  const isShooting = useFPSStore((s) => s.isShooting);
  const isReloading = useFPSStore((s) => s.isReloading);
  const muzzleFlashActive = useFPSStore((s) => s.muzzleFlashActive);
  const currentAmmo = useFPSStore((s) => s.currentAmmo);

  useFrame((state, delta) => {
    if (!weaponRef.current) return;

    // Weapon bob animation when moving
    const time = state.clock.elapsedTime;
    weaponRef.current.position.y = -0.3 + Math.sin(time * 4) * 0.02;
    weaponRef.current.position.x = 0.3 + Math.cos(time * 4) * 0.01;

    // Recoil animation
    if (isShooting) {
      weaponRef.current.position.z += 0.1;
      weaponRef.current.rotation.x += currentWeapon.recoil;
    } else {
      // Smooth return to original position
      weaponRef.current.position.z = THREE.MathUtils.lerp(weaponRef.current.position.z, 0.5, delta * 10);
      weaponRef.current.rotation.x = THREE.MathUtils.lerp(weaponRef.current.rotation.x, 0, delta * 10);
    }

    // Reload animation
    if (isReloading) {
      const reloadAnim = Math.sin(time * 5);
      weaponRef.current.rotation.z = reloadAnim * 0.5;
      weaponRef.current.position.y = -0.5 + Math.abs(reloadAnim) * 0.2;
    } else {
      weaponRef.current.rotation.z = THREE.MathUtils.lerp(weaponRef.current.rotation.z, 0, delta * 10);
    }
  });

  // Different weapon models based on type
  const getWeaponModel = () => {
    switch (currentWeapon.type) {
      case 'pistol':
        return (
          <>
            {/* Grip */}
            <mesh position={[0, -0.15, 0]} castShadow>
              <boxGeometry args={[0.08, 0.25, 0.12]} />
              <meshStandardMaterial color="#2C2C2C" roughness={0.8} metalness={0.5} />
            </mesh>
            {/* Slide */}
            <mesh position={[0, 0.05, 0]} castShadow>
              <boxGeometry args={[0.08, 0.1, 0.3]} />
              <meshStandardMaterial color="#3A3A3A" roughness={0.6} metalness={0.7} />
            </mesh>
            {/* Barrel */}
            <mesh position={[0, 0.05, -0.2]} castShadow>
              <boxGeometry args={[0.05, 0.05, 0.1]} />
              <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.9} />
            </mesh>
          </>
        );
      case 'rifle':
        return (
          <>
            {/* Stock */}
            <mesh position={[0, -0.05, 0.3]} castShadow>
              <boxGeometry args={[0.1, 0.15, 0.3]} />
              <meshStandardMaterial color="#8B4513" roughness={0.9} />
            </mesh>
            {/* Body */}
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[0.12, 0.12, 0.6]} />
              <meshStandardMaterial color="#2C2C2C" roughness={0.7} metalness={0.6} />
            </mesh>
            {/* Barrel */}
            <mesh position={[0, 0.02, -0.4]} castShadow>
              <boxGeometry args={[0.06, 0.06, 0.3]} />
              <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.9} />
            </mesh>
            {/* Magazine */}
            <mesh position={[0, -0.1, -0.1]} castShadow>
              <boxGeometry args={[0.08, 0.15, 0.12]} />
              <meshStandardMaterial color="#3A3A3A" roughness={0.8} />
            </mesh>
          </>
        );
      case 'shotgun':
        return (
          <>
            {/* Stock */}
            <mesh position={[0, -0.05, 0.35]} castShadow>
              <boxGeometry args={[0.12, 0.18, 0.35]} />
              <meshStandardMaterial color="#8B4513" roughness={0.9} />
            </mesh>
            {/* Body */}
            <mesh position={[0, 0, 0]} castShadow>
              <boxGeometry args={[0.14, 0.14, 0.5]} />
              <meshStandardMaterial color="#2C2C2C" roughness={0.8} metalness={0.5} />
            </mesh>
            {/* Barrel (wider) */}
            <mesh position={[0, 0.03, -0.45]} castShadow>
              <boxGeometry args={[0.1, 0.1, 0.4]} />
              <meshStandardMaterial color="#1A1A1A" roughness={0.4} metalness={0.9} />
            </mesh>
            {/* Pump */}
            <mesh position={[0, -0.05, -0.15]} castShadow>
              <boxGeometry args={[0.12, 0.08, 0.15]} />
              <meshStandardMaterial color="#654321" roughness={0.9} />
            </mesh>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <group ref={weaponRef} position={[0.3, -0.3, 0.5]}>
      {getWeaponModel()}

      {/* Muzzle flash */}
      {muzzleFlashActive && (
        <pointLight
          position={[0, 0.05, -0.5]}
          color="#FFA500"
          intensity={5}
          distance={5}
        />
      )}

      {/* Ammo indicator on weapon */}
      {currentAmmo === 0 && !isReloading && (
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color="#FF0000" emissive="#FF0000" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}

// ============================================
// First-Person Camera
// ============================================
function FPSCamera({ targetPosition }: { targetPosition: THREE.Vector3 }) {
  const { camera } = useThree();
  const pitch = useFPSStore((s) => s.pitch);
  const yaw = useFPSStore((s) => s.yaw);

  useFrame(() => {
    // Position camera at eye level
    const eyeHeight = 1.6;
    camera.position.set(
      targetPosition.x,
      targetPosition.y + eyeHeight,
      targetPosition.z
    );

    // Apply pitch and yaw rotation
    camera.rotation.order = 'YXZ';
    camera.rotation.x = pitch;
    camera.rotation.y = yaw;
  });

  return null;
}

// ============================================
// Shooting Raycast System
// ============================================
function ShootingSystem() {
  const { camera, scene } = useThree();
  const isShooting = useFPSStore((s) => s.isShooting);
  const currentWeapon = useFPSStore((s) => s.currentWeapon);
  const damageEnemy = useFPSStore((s) => s.damageEnemy);
  const enemies = useFPSStore((s) => s.enemies);
  const lastShotTime = useRef(0);

  useFrame(() => {
    if (!isShooting) return;

    const now = Date.now();
    if (now - lastShotTime.current < 50) return; // Prevent duplicate shots
    lastShotTime.current = now;

    // Create raycaster from camera center
    const raycaster = new THREE.Raycaster();
    const center = new THREE.Vector2(0, 0); // Screen center
    raycaster.setFromCamera(center, camera);

    // Check intersection with all scene objects
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
      // Find if we hit an enemy
      for (const intersect of intersects) {
        // Check if this object belongs to an enemy
        let object = intersect.object;
        while (object.parent) {
          // Check if object name or userData contains enemy id
          const enemyId = object.userData?.enemyId;
          if (enemyId) {
            // Calculate damage with distance falloff
            const distance = intersect.distance;
            let damage = currentWeapon.damage;

            if (distance > currentWeapon.range) {
              continue; // Out of range
            }

            // Distance falloff
            const falloff = 1 - (distance / currentWeapon.range) * 0.5;
            damage *= falloff;

            // Shotgun fires multiple pellets
            if (currentWeapon.type === 'shotgun') {
              damage *= 8; // 8 pellets
            }

            damageEnemy(enemyId, Math.floor(damage));
            return; // Only hit one enemy per shot
          }
          object = object.parent;
        }
      }
    }
  });

  return null;
}

// ============================================
// Main FPS Player Controller
// ============================================
export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const keysRef = useFPSControls();

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const isPaused = useGameStore((s) => s.isPaused);
  const yaw = useFPSStore((s) => s.yaw);
  const isDead = useFPSStore((s) => s.isDead);

  // Movement settings
  const baseMoveSpeed = 8;
  const sprintMultiplier = 1.6;
  const jumpForce = 8;

  const currentPosition = useRef(new THREE.Vector3(0, 1, 0));
  const isGrounded = useRef(false);

  // Request pointer lock on mount
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.addEventListener('click', () => {
        canvas.requestPointerLock();
      });
    }
  }, []);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || isPaused || isDead) return;

    const keys = keysRef.current;
    const isSprinting = keys.sprint;

    // Calculate movement direction based on camera yaw
    let moveX = 0;
    let moveZ = 0;

    if (keys.forward) moveZ -= 1;
    if (keys.backward) moveZ += 1;
    if (keys.left) moveX -= 1;
    if (keys.right) moveX += 1;

    // Normalize diagonal movement
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    // Rotate movement direction based on camera yaw
    const rotatedX = moveX * Math.cos(yaw) - moveZ * Math.sin(yaw);
    const rotatedZ = moveX * Math.sin(yaw) + moveZ * Math.cos(yaw);

    // Apply movement speed
    const currentSpeed = baseMoveSpeed * (isSprinting ? sprintMultiplier : 1);

    try {
      const currentVel = rigidBodyRef.current.linvel();

      // Apply movement
      rigidBodyRef.current.setLinvel(
        {
          x: rotatedX * currentSpeed,
          y: currentVel.y, // Preserve vertical velocity
          z: rotatedZ * currentSpeed,
        },
        true
      );

      // Jump
      if (keys.jump && isGrounded.current) {
        rigidBodyRef.current.setLinvel(
          {
            x: currentVel.x,
            y: jumpForce,
            z: currentVel.z,
          },
          true
        );
        isGrounded.current = false;
      }

      // Update position
      const position = rigidBodyRef.current.translation();
      if (position && Number.isFinite(position.x)) {
        currentPosition.current.set(position.x, position.y, position.z);
        setPosition([position.x, position.y, position.z]);
      }

      // Check if grounded (simple check)
      if (Math.abs(currentVel.y) < 0.1) {
        isGrounded.current = true;
      }

      // Update moving state
      const moving = length > 0;
      setMoving(moving);

    } catch (e) {
      console.debug('Physics not ready:', e);
    }
  });

  return (
    <>
      <FPSCamera targetPosition={currentPosition.current} />
      <ShootingSystem />

      <RigidBody
        ref={rigidBodyRef}
        position={[0, 2, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={8}
        colliders={false}
        mass={1}
      >
        <CapsuleCollider args={[0.5, 0.5]} />

        {/* Invisible player body (we don't see it in first person) */}
        {/* But we keep it for physics collisions */}
      </RigidBody>

      {/* Weapon visible in first-person view */}
      {!isDead && <VoxelWeapon />}
    </>
  );
}

export default PlayerController;

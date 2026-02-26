'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import { RoundedBox, Trail, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';

// ============================================
// Input Handler - Keyboard state using ref for real-time access
// ============================================
const useKeyboard = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    interact: false,
    sprint: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key;
      
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) ||
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
        e.preventDefault();
      }
      
      // Forward (W or ArrowUp)
      if (code === 'KeyW' || code === 'ArrowUp' || key === 'ArrowUp' || key === 'w' || key === 'W') {
        keysRef.current.forward = true;
      }
      // Backward (S or ArrowDown)
      if (code === 'KeyS' || code === 'ArrowDown' || key === 'ArrowDown' || key === 's' || key === 'S') {
        keysRef.current.backward = true;
      }
      // Left (A or ArrowLeft)
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'ArrowLeft' || key === 'a' || key === 'A') {
        keysRef.current.left = true;
      }
      // Right (D or ArrowRight)
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'ArrowRight' || key === 'd' || key === 'D') {
        keysRef.current.right = true;
      }
      // Interact (E or Space)
      if (code === 'KeyE' || code === 'Space' || key === 'e' || key === 'E' || key === ' ') {
        keysRef.current.interact = true;
      }
      // Sprint (Shift)
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        keysRef.current.sprint = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      const key = e.key;
      
      if (code === 'KeyW' || code === 'ArrowUp' || key === 'ArrowUp' || key === 'w' || key === 'W') {
        keysRef.current.forward = false;
      }
      if (code === 'KeyS' || code === 'ArrowDown' || key === 'ArrowDown' || key === 's' || key === 'S') {
        keysRef.current.backward = false;
      }
      if (code === 'KeyA' || code === 'ArrowLeft' || key === 'ArrowLeft' || key === 'a' || key === 'A') {
        keysRef.current.left = false;
      }
      if (code === 'KeyD' || code === 'ArrowRight' || key === 'ArrowRight' || key === 'd' || key === 'D') {
        keysRef.current.right = false;
      }
      if (code === 'KeyE' || code === 'Space' || key === 'e' || key === 'E' || key === ' ') {
        keysRef.current.interact = false;
      }
      if (code === 'ShiftLeft' || code === 'ShiftRight') {
        keysRef.current.sprint = false;
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
// Enhanced Player Visual - Better character model
// ============================================
function PlayerVisual({ isMoving, isSprinting }: { isMoving: boolean; isSprinting: boolean }) {
  const meshRef = useRef<THREE.Group>(null);
  const bobOffset = useRef(0);
  const armLeftRef = useRef<THREE.Group>(null);
  const armRightRef = useRef<THREE.Group>(null);
  const legLeftRef = useRef<THREE.Group>(null);
  const legRightRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const bobSpeed = isSprinting ? 15 : 10;
    const bobAmount = isSprinting ? 0.08 : 0.05;
    
    // Bobbing animation when moving
    if (isMoving) {
      bobOffset.current += delta * bobSpeed;
      meshRef.current.position.y = Math.sin(bobOffset.current) * bobAmount;
      
      // Arm swing
      if (armLeftRef.current && armRightRef.current) {
        const armSwing = Math.sin(bobOffset.current) * 0.4;
        armLeftRef.current.rotation.x = armSwing;
        armRightRef.current.rotation.x = -armSwing;
      }
      
      // Leg swing
      if (legLeftRef.current && legRightRef.current) {
        const legSwing = Math.sin(bobOffset.current) * 0.3;
        legLeftRef.current.rotation.x = -legSwing;
        legRightRef.current.rotation.x = legSwing;
      }
    } else {
      meshRef.current.position.y = THREE.MathUtils.lerp(
        meshRef.current.position.y,
        0,
        delta * 5
      );
      
      // Idle breathing animation
      const breathe = Math.sin(state.clock.elapsedTime * 2) * 0.02;
      meshRef.current.scale.y = 1 + breathe;
      
      // Reset arm/leg positions
      if (armLeftRef.current) armLeftRef.current.rotation.x = THREE.MathUtils.lerp(armLeftRef.current.rotation.x, 0, delta * 5);
      if (armRightRef.current) armRightRef.current.rotation.x = THREE.MathUtils.lerp(armRightRef.current.rotation.x, 0, delta * 5);
      if (legLeftRef.current) legLeftRef.current.rotation.x = THREE.MathUtils.lerp(legLeftRef.current.rotation.x, 0, delta * 5);
      if (legRightRef.current) legRightRef.current.rotation.x = THREE.MathUtils.lerp(legRightRef.current.rotation.x, 0, delta * 5);
    }
  });
  
  return (
    <group ref={meshRef}>
      {/* Body */}
      <RoundedBox
        args={[0.55, 0.75, 0.45]}
        radius={0.12}
        smoothness={4}
        position={[0, 0.4, 0]}
        castShadow
      >
        <meshStandardMaterial 
          color="#FF6B6B" 
          roughness={0.6}
          metalness={0.1}
        />
      </RoundedBox>
      
      {/* Apron detail */}
      <RoundedBox
        args={[0.5, 0.5, 0.1]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.35, 0.22]}
        castShadow
      >
        <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </RoundedBox>
      
      {/* Head */}
      <RoundedBox
        args={[0.45, 0.45, 0.4]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.98, 0]}
        castShadow
      >
        <meshStandardMaterial color="#FFE4C9" roughness={0.5} />
      </RoundedBox>
      
      {/* Eyes */}
      <mesh position={[-0.12, 1.02, 0.18]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.06]} />
        <meshStandardMaterial color="#2D2D2D" />
      </mesh>
      <mesh position={[0.12, 1.02, 0.18]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.06]} />
        <meshStandardMaterial color="#2D2D2D" />
      </mesh>
      
      {/* Eye highlights */}
      <mesh position={[-0.1, 1.04, 0.2]}>
        <boxGeometry args={[0.03, 0.03, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.14, 1.04, 0.2]}>
        <boxGeometry args={[0.03, 0.03, 0.02]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Rosy cheeks */}
      <mesh position={[-0.18, 0.95, 0.15]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#FFB6C1" transparent opacity={0.6} />
      </mesh>
      <mesh position={[0.18, 0.95, 0.15]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#FFB6C1" transparent opacity={0.6} />
      </mesh>
      
      {/* Smile */}
      <mesh position={[0, 0.9, 0.19]}>
        <boxGeometry args={[0.12, 0.03, 0.02]} />
        <meshStandardMaterial color="#C67B5C" />
      </mesh>
      
      {/* Chef's Hat (toque) */}
      <RoundedBox
        args={[0.4, 0.35, 0.35]}
        radius={0.06}
        smoothness={4}
        position={[0, 1.35, 0]}
        castShadow
      >
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.58, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.2, 0.2, 8]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
      </mesh>
      {/* Hat band */}
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.05, 8]} />
        <meshStandardMaterial color="#FFD700" roughness={0.3} metalness={0.5} />
      </mesh>
      
      {/* Arms */}
      <group ref={armLeftRef} position={[-0.38, 0.45, 0]}>
        <RoundedBox
          args={[0.18, 0.45, 0.18]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.1, 0]}
          castShadow
        >
          <meshStandardMaterial color="#FFE4C9" roughness={0.5} />
        </RoundedBox>
      </group>
      <group ref={armRightRef} position={[0.38, 0.45, 0]}>
        <RoundedBox
          args={[0.18, 0.45, 0.18]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.1, 0]}
          castShadow
        >
          <meshStandardMaterial color="#FFE4C9" roughness={0.5} />
        </RoundedBox>
      </group>
      
      {/* Legs */}
      <group ref={legLeftRef} position={[-0.14, 0, 0]}>
        <RoundedBox
          args={[0.2, 0.3, 0.2]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.1, 0]}
          castShadow
        >
          <meshStandardMaterial color="#4A4A4A" roughness={0.7} />
        </RoundedBox>
        {/* Shoe */}
        <mesh position={[0, -0.25, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.1, 0.25]} />
          <meshStandardMaterial color="#8B4513" roughness={0.8} />
        </mesh>
      </group>
      <group ref={legRightRef} position={[0.14, 0, 0]}>
        <RoundedBox
          args={[0.2, 0.3, 0.2]}
          radius={0.04}
          smoothness={4}
          position={[0, -0.1, 0]}
          castShadow
        >
          <meshStandardMaterial color="#4A4A4A" roughness={0.7} />
        </RoundedBox>
        {/* Shoe */}
        <mesh position={[0, -0.25, 0.05]} castShadow>
          <boxGeometry args={[0.2, 0.1, 0.25]} />
          <meshStandardMaterial color="#8B4513" roughness={0.8} />
        </mesh>
      </group>
      
      {/* Movement particles when sprinting */}
      {isSprinting && (
        <Sparkles 
          count={15}
          scale={[1, 0.5, 1]}
          size={1.5}
          speed={2}
          opacity={0.6}
          color="#FFD700"
          position={[0, 0.2, -0.3]}
        />
      )}
      
      {/* Ambient sparkles around player - always visible */}
      <Sparkles 
        count={8}
        scale={[1.5, 2, 1.5]}
        size={0.8}
        speed={0.3}
        opacity={0.4}
        color="#FFFFFF"
        position={[0, 1, 0]}
      />
      
      {/* Player halo/glow ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.5, 0.6, 16]} />
        <meshBasicMaterial 
          color="#FFD700" 
          transparent 
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ============================================
// Camera Follow Logic - MUCH CLOSER & SMOOTHER
// ============================================
function useCameraFollow(targetPosition: THREE.Vector3, isMoving: boolean) {
  const { camera } = useThree();
  
  // MUCH CLOSER camera offset for immersive feel
  const baseOffset = useMemo(() => new THREE.Vector3(4, 5, 4), []);
  const cameraOffset = useRef(baseOffset.clone());
  const smoothPosition = useRef(new THREE.Vector3());
  const lookAtTarget = useRef(new THREE.Vector3());
  const shakeOffset = useRef(new THREE.Vector3());
  
  useEffect(() => {
    // Initialize camera position
    smoothPosition.current.copy(targetPosition).add(baseOffset);
    camera.position.copy(smoothPosition.current);
  }, [camera, targetPosition, baseOffset]);
  
  useFrame((state, delta) => {
    // Clamp delta to prevent huge jumps
    const clampedDelta = Math.min(delta, 0.1);
    
    // Dynamic camera offset - slightly closer when moving
    const dynamicOffset = baseOffset.clone();
    if (isMoving) {
      dynamicOffset.multiplyScalar(0.95);
    }
    
    // Subtle camera shake when moving
    if (isMoving) {
      shakeOffset.current.set(
        Math.sin(state.clock.elapsedTime * 15) * 0.02,
        Math.sin(state.clock.elapsedTime * 20) * 0.01,
        Math.cos(state.clock.elapsedTime * 15) * 0.02
      );
    } else {
      shakeOffset.current.lerp(new THREE.Vector3(), clampedDelta * 5);
    }
    
    // Target camera position
    const targetCamPos = targetPosition.clone()
      .add(dynamicOffset)
      .add(shakeOffset.current);
    
    // Very smooth camera movement
    smoothPosition.current.lerp(targetCamPos, clampedDelta * 4);
    camera.position.copy(smoothPosition.current);
    
    // Smooth look-at with slight lead
    const lookAhead = isMoving ? 0.5 : 0;
    const targetLookAt = targetPosition.clone();
    targetLookAt.y += 0.8; // Look at character's head level
    
    lookAtTarget.current.lerp(targetLookAt, clampedDelta * 6);
    camera.lookAt(lookAtTarget.current);
  });
}

// ============================================
// Main Player Controller
// ============================================
export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const playerGroupRef = useRef<THREE.Group>(null);
  const keysRef = useKeyboard();
  
  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const isMoving = usePlayerStore((s) => s.isMoving);
  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const advanceTime = useGameStore((s) => s.advanceTime);
  
  // Movement settings - INCREASED for better feel
  const baseMoveSpeed = 6;
  const sprintMultiplier = 1.6;
  const rotationSpeed = 10;
  
  // Current position for camera follow
  const currentPosition = useRef(new THREE.Vector3(0, 0.5, 0));
  const isSprinting = useRef(false);
  
  // Camera follow
  useCameraFollow(currentPosition.current, isMoving);
  
  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;
    
    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.1) {
      delta = 0.016;
    }
    
    const canMove = !isPaused && !dialogueActive;
    
    if (!isPaused) {
      advanceTime(delta);
    }
    
    const keys = keysRef.current;
    isSprinting.current = keys.sprint && canMove;
    
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
    
    // Calculate speed
    const currentSpeed = baseMoveSpeed * (isSprinting.current ? sprintMultiplier : 1);
    
    try {
      const currentVel = rigidBodyRef.current.linvel();
      if (currentVel && Number.isFinite(currentVel.y)) {
        rigidBodyRef.current.setLinvel(
          {
            x: moveX * currentSpeed,
            y: currentVel.y,
            z: moveZ * currentSpeed,
          },
          true
        );
      }
      
      const position = rigidBodyRef.current.translation();
      if (position && Number.isFinite(position.x) && Number.isFinite(position.y) && Number.isFinite(position.z)) {
        currentPosition.current.set(position.x, position.y, position.z);
        setPosition([position.x, position.y, position.z]);
      }
    } catch (e) {
      console.debug('Physics not ready:', e);
      return;
    }
    
    // Update moving state
    const moving = length > 0;
    if (moving !== isMoving) {
      setMoving(moving);
    }
    
    // Rotate player to face movement direction
    if (length > 0 && playerGroupRef.current) {
      const targetRotation = Math.atan2(moveX, moveZ);
      const currentRotation = playerGroupRef.current.rotation.y;
      
      let rotationDiff = targetRotation - currentRotation;
      
      while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
      while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
      
      playerGroupRef.current.rotation.y += rotationDiff * delta * rotationSpeed;
      setRotation(playerGroupRef.current.rotation.y);
    }
  });
  
  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[0, 1, 0]}
      enabledRotations={[false, false, false]}
      linearDamping={6}
      angularDamping={6}
      colliders={false}
      mass={1}
    >
      <CapsuleCollider args={[0.35, 0.3]} position={[0, 0.65, 0]} />
      <group ref={playerGroupRef}>
        <PlayerVisual isMoving={isMoving} isSprinting={isSprinting.current} />
        
        {/* Player indicator light */}
        <pointLight 
          position={[0, 1.8, 0]} 
          color="#FFD700" 
          intensity={0.3} 
          distance={3}
        />
      </group>
    </RigidBody>
  );
}

export default PlayerController;

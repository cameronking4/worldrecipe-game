'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useWorldStore } from '@/lib/store/worldStore';
import { useCombatStore } from '@/lib/store/combatStore';
import { useNotificationStore } from '@/lib/store/notificationStore';

const useKeyboard = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
    reload: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = true;
      if (code === 'KeyR') keysRef.current.reload = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = false;
      if (code === 'KeyR') keysRef.current.reload = false;
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

function FirstPersonViewModel() {
  const weaponRef = useRef<THREE.Group>(null);
  const muzzleRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const isMoving = usePlayerStore((s) => s.isMoving);
  const muzzleFlashUntil = useCombatStore((s) => s.muzzleFlashUntil);

  useFrame((state) => {
    if (!weaponRef.current) return;

    const bob = isMoving ? Math.sin(state.clock.elapsedTime * 9) * 0.02 : 0;
    const recoil = performance.now() < muzzleFlashUntil ? 0.05 : 0;

    weaponRef.current.position.copy(camera.position);
    weaponRef.current.quaternion.copy(camera.quaternion);
    weaponRef.current.translateX(0.22);
    weaponRef.current.translateY(-0.18 + bob);
    weaponRef.current.translateZ(-0.35 - recoil);

    if (muzzleRef.current) {
      muzzleRef.current.visible = performance.now() < muzzleFlashUntil;
    }
  });

  return (
    <group ref={weaponRef}>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.12, 0.7]} />
        <meshStandardMaterial color="#3b3f51" roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.06, -0.12]} castShadow>
        <boxGeometry args={[0.1, 0.05, 0.28]} />
        <meshStandardMaterial color="#6366f1" roughness={0.5} metalness={0.3} emissive="#6366f1" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, -0.08, 0.16]} castShadow rotation={[0.4, 0, 0]}>
        <boxGeometry args={[0.09, 0.18, 0.12]} />
        <meshStandardMaterial color="#1f2937" roughness={0.8} />
      </mesh>
      <mesh ref={muzzleRef} position={[0, 0, -0.4]} visible={false}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={1.4} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const keysRef = useKeyboard();
  const { camera, gl } = useThree();

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const isMoving = usePlayerStore((s) => s.isMoving);
  const consumeStamina = usePlayerStore((s) => s.useStamina);
  const restoreStamina = usePlayerStore((s) => s.restoreStamina);

  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const advanceTime = useGameStore((s) => s.advanceTime);
  const timeOfDay = useGameStore((s) => s.timeOfDay);

  const world = useWorldStore((s) => s.world);
  const region = useWorldStore((s) => s.currentRegion);

  const playerHealth = useCombatStore((s) => s.playerHealth);
  const shoot = useCombatStore((s) => s.shoot);
  const reload = useCombatStore((s) => s.reload);
  const setRadioMessage = useCombatStore((s) => s.setRadioMessage);
  const resetForDeath = useCombatStore((s) => s.resetForDeath);
  const kills = useCombatStore((s) => s.kills);
  const score = useCombatStore((s) => s.score);

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const pointerLockedRef = useRef(false);
  const lastShotAtRef = useRef(0);
  const lastAIChatterAtRef = useRef(0);

  const moveSpeed = 7.8;
  const sprintMultiplier = 1.5;

  const canControl = useMemo(() => !isPaused && !dialogueActive, [isPaused, dialogueActive]);

  useEffect(() => {
    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === gl.domElement;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!pointerLockedRef.current || !canControl) return;

      yawRef.current -= event.movementX * 0.0026;
      pitchRef.current -= event.movementY * 0.0022;
      pitchRef.current = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, pitchRef.current));
    };

    const onMouseDown = async (event: MouseEvent) => {
      if (!canControl) return;

      if (!pointerLockedRef.current) {
        gl.domElement.requestPointerLock();
        return;
      }

      if (event.button !== 0) return;

      const now = performance.now();
      if (now - lastShotAtRef.current < 110) return;
      lastShotAtRef.current = now;

      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const result = shoot(
        [camera.position.x, camera.position.y, camera.position.z],
        [direction.x, direction.y, direction.z],
        now,
      );

      if (result.killed && world && region && now - lastAIChatterAtRef.current > 8000) {
        lastAIChatterAtRef.current = now;
        try {
          const response = await fetch('/api/ai/combat/chatter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              worldId: world.worldId,
              regionId: region.regionId,
              timeOfDay,
              playerState: {
                kills: kills + 1,
                score: score + 120,
                health: playerHealth,
              },
              eventType: 'kill',
            }),
          });

          const data = await response.json();
          if (data?.line) {
            setRadioMessage(data.speaker || 'Kitchen Ops', data.line);
          }
        } catch {
          setRadioMessage('Kitchen Ops', 'Confirmed hit. Keep pushing forward.');
        }
      }
    };

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'KeyR') {
        reload();
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, canControl, gl.domElement, kills, playerHealth, region, reload, score, setRadioMessage, shoot, timeOfDay, world]);

  useEffect(() => {
    if (!canControl && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [canControl]);

  useEffect(() => {
    if (playerHealth > 0) return;

    useNotificationStore.getState().showError('You were overwhelmed', 'Respawning at base position.');
    resetForDeath();
    if (rigidBodyRef.current) {
      rigidBodyRef.current.setTranslation({ x: 0, y: 1, z: 0 }, true);
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    setRadioMessage('Kitchen Ops', 'Respawn complete. Re-engage targets and stay mobile.');
  }, [playerHealth, resetForDeath, setRadioMessage]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const step = Number.isFinite(delta) ? Math.min(delta, 0.05) : 0.016;

    if (!isPaused) {
      advanceTime(step);
    }

    const currentPosition = rigidBodyRef.current.translation();
    const currentVel = rigidBodyRef.current.linvel();
    if (!currentPosition || !currentVel) return;

    camera.position.set(currentPosition.x, currentPosition.y + 0.52, currentPosition.z);
    camera.rotation.set(pitchRef.current, yawRef.current, 0, 'YXZ');

    const keys = keysRef.current;
    let moveX = 0;
    let moveZ = 0;

    if (canControl) {
      if (keys.forward) moveZ += 1;
      if (keys.backward) moveZ -= 1;
      if (keys.right) moveX += 1;
      if (keys.left) moveX -= 1;
    }

    const inputLength = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const moving = inputLength > 0;

    let normalizedX = 0;
    let normalizedZ = 0;
    if (moving) {
      normalizedX = moveX / inputLength;
      normalizedZ = moveZ / inputLength;
    }

    const forwardX = -Math.sin(yawRef.current);
    const forwardZ = -Math.cos(yawRef.current);
    const rightX = Math.cos(yawRef.current);
    const rightZ = -Math.sin(yawRef.current);

    let worldMoveX = rightX * normalizedX + forwardX * normalizedZ;
    let worldMoveZ = rightZ * normalizedX + forwardZ * normalizedZ;

    const worldMoveLength = Math.sqrt(worldMoveX * worldMoveX + worldMoveZ * worldMoveZ);
    if (worldMoveLength > 0) {
      worldMoveX /= worldMoveLength;
      worldMoveZ /= worldMoveLength;
    }

    const wantsSprint = moving && keys.sprint && canControl;
    const canSprint = wantsSprint ? consumeStamina(step * 8) : false;
    if (!wantsSprint) {
      restoreStamina(step * 10);
    }

    const speed = moveSpeed * (canSprint ? sprintMultiplier : 1);

    rigidBodyRef.current.setLinvel(
      {
        x: worldMoveX * speed,
        y: currentVel.y,
        z: worldMoveZ * speed,
      },
      true,
    );

    setPosition([currentPosition.x, currentPosition.y, currentPosition.z]);
    setRotation(yawRef.current);

    if (moving !== isMoving) {
      setMoving(moving);
    }

    if (playerHealth < 35 && performance.now() - lastAIChatterAtRef.current > 12000) {
      lastAIChatterAtRef.current = performance.now();
      setRadioMessage('Kitchen Ops', 'Critical health. Break line of sight and recover.');
    }
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={[0, 1, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={7}
        angularDamping={8}
        colliders={false}
        mass={1}
      >
        <CapsuleCollider args={[0.45, 0.34]} position={[0, 0.5, 0]} />
      </RigidBody>
      <FirstPersonViewModel />
    </>
  );
}

export default PlayerController;

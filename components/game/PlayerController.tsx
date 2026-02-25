'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useNotificationStore } from '@/lib/store/notificationStore';

const PLAYER_EYE_HEIGHT = 1.45;

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
    const onDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyR'].includes(code)) {
        e.preventDefault();
      }
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = true;
      if (code === 'KeyR') keysRef.current.reload = true;
    };

    const onUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = false;
      if (code === 'KeyR') keysRef.current.reload = false;
    };

    window.addEventListener('keydown', onDown, { capture: true });
    window.addEventListener('keyup', onUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', onDown, { capture: true });
      window.removeEventListener('keyup', onUp, { capture: true });
    };
  }, []);

  return keysRef;
};

export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const pointerLockedRef = useRef(false);

  const { camera, gl } = useThree();
  const keysRef = useKeyboard();

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const isMoving = usePlayerStore((s) => s.isMoving);
  const health = usePlayerStore((s) => s.health);
  const shoot = usePlayerStore((s) => s.shoot);
  const reload = usePlayerStore((s) => s.reload);
  const resetCombat = usePlayerStore((s) => s.resetCombat);
  const restoreStamina = usePlayerStore((s) => s.restoreStamina);
  const spendStamina = usePlayerStore((s) => s.useStamina);

  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const showJournal = useGameStore((s) => s.showJournal);
  const showInventory = useGameStore((s) => s.showInventory);
  const showCooking = useGameStore((s) => s.showCooking);
  const advanceTime = useGameStore((s) => s.advanceTime);

  const showInfo = useNotificationStore((s) => s.showInfo);
  const showError = useNotificationStore((s) => s.showError);

  const inputBlocked = isPaused || dialogueActive || showJournal || showInventory || showCooking;

  const moveForward = useMemo(() => new THREE.Vector3(), []);
  const moveRight = useMemo(() => new THREE.Vector3(), []);
  const moveDirection = useMemo(() => new THREE.Vector3(), []);
  const shootDirection = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onPointerLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === gl.domElement;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLockedRef.current || inputBlocked) return;
      yawRef.current -= e.movementX * 0.002;
      pitchRef.current -= e.movementY * 0.002;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.35, 1.35);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      if (!pointerLockedRef.current) {
        gl.domElement.requestPointerLock();
        return;
      }

      if (inputBlocked) return;

      const fired = shoot();
      if (!fired) {
        const didReload = reload();
        if (didReload) {
          showInfo('Reloaded', 'Magazine topped up.');
        }
        return;
      }

      camera.getWorldDirection(shootDirection);
      window.dispatchEvent(new CustomEvent('fps-shoot', {
        detail: {
          origin: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
          direction: [shootDirection.x, shootDirection.y, shootDirection.z] as [number, number, number],
        },
      }));
    };

    const onContextMenu = (e: MouseEvent) => {
      if (pointerLockedRef.current) {
        e.preventDefault();
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
    };
  }, [gl, camera, inputBlocked, shoot, reload, showInfo, shootDirection]);

  useEffect(() => {
    if (inputBlocked && pointerLockedRef.current) {
      document.exitPointerLock();
    }
  }, [inputBlocked]);

  useEffect(() => {
    if (health > 0) return;
    showError('You were overwhelmed!', 'Respawning at camp with full health.');
    resetCombat();
    if (rigidBodyRef.current) {
      rigidBodyRef.current.setTranslation({ x: 0, y: 1, z: 0 }, true);
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
    }
    setPosition([0, 1, 0]);
  }, [health, resetCombat, setPosition, showError]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;
    if (!Number.isFinite(delta) || delta <= 0 || delta > 0.1) delta = 0.016;

    if (!isPaused) {
      advanceTime(delta);
    }

    const canMove = !inputBlocked && pointerLockedRef.current;
    const keys = keysRef.current;

    if (keys.reload && canMove) {
      const didReload = reload();
      if (didReload) {
        keys.reload = false;
      }
    }

    moveForward.set(Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    moveRight.set(Math.cos(yawRef.current), 0, Math.sin(yawRef.current));
    moveDirection.set(0, 0, 0);

    if (canMove) {
      if (keys.forward) moveDirection.add(moveForward);
      if (keys.backward) moveDirection.sub(moveForward);
      if (keys.right) moveDirection.add(moveRight);
      if (keys.left) moveDirection.sub(moveRight);
    }

    const isTryingToSprint = keys.sprint && moveDirection.lengthSq() > 0;
    const isSprinting = isTryingToSprint && spendStamina(delta * 16);
    if (!isTryingToSprint || !isSprinting) {
      restoreStamina(delta * 12);
    }

    if (moveDirection.lengthSq() > 0) {
      moveDirection.normalize();
    }

    const moveSpeed = isSprinting ? 8.2 : 5.3;

    const currentVel = rigidBodyRef.current.linvel();
    rigidBodyRef.current.setLinvel(
      {
        x: canMove ? moveDirection.x * moveSpeed : 0,
        y: currentVel.y,
        z: canMove ? moveDirection.z * moveSpeed : 0,
      },
      true
    );

    const pos = rigidBodyRef.current.translation();
    setPosition([pos.x, pos.y, pos.z]);
    setRotation(yawRef.current);

    const moving = canMove && moveDirection.lengthSq() > 0;
    if (moving !== isMoving) {
      setMoving(moving);
    }

    const activeCamera = _.camera as THREE.PerspectiveCamera;
    activeCamera.rotation.order = 'YXZ';
    activeCamera.rotation.y = yawRef.current;
    activeCamera.rotation.x = pitchRef.current;
    activeCamera.position.set(pos.x, pos.y + PLAYER_EYE_HEIGHT, pos.z);
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[0, 1, 0]}
      enabledRotations={[false, false, false]}
      linearDamping={7}
      angularDamping={6}
      colliders={false}
      mass={1}
    >
      <CapsuleCollider args={[0.45, 0.3]} position={[0, 0.72, 0]} />
    </RigidBody>
  );
}

export default PlayerController;

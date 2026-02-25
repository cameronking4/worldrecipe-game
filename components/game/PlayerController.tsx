'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useCombatStore } from '@/lib/store/combatStore';
import { emitShoot } from '@/lib/game/fpsBus';

const useKeyboard = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
  });

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'Space') keysRef.current.jump = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = true;
    };

    const onUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'Space') keysRef.current.jump = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = false;
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
  const keysRef = useKeyboard();
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera);
  const gl = useThree((state) => state.gl);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const setMoveDirection = usePlayerStore((s) => s.setMoveDirection);
  const consumeStamina = usePlayerStore((s) => s.useStamina);
  const restoreStamina = usePlayerStore((s) => s.restoreStamina);

  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const advanceTime = useGameStore((s) => s.advanceTime);

  const shoot = useCombatStore((s) => s.shoot);
  const reload = useCombatStore((s) => s.reload);
  const setPointerLocked = useCombatStore((s) => s.setPointerLocked);
  const health = useCombatStore((s) => s.health);

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const bobTime = useRef(0);

  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const moveDir = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      if (document.pointerLockElement !== canvas && !isPaused && !dialogueActive && health > 0) {
        canvas.requestPointerLock();
      }
    };

    const onPointerLockChange = () => {
      setPointerLocked(document.pointerLockElement === canvas);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yawRef.current -= e.movementX * 0.0023;
      pitchRef.current -= e.movementY * 0.0018;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.2, 1.2);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement !== canvas) return;
      if (isPaused || dialogueActive || health <= 0) return;

      const cam = cameraRef.current;
      if (shoot() && cam) {
        const origin = cam.position.clone();
        const direction = new THREE.Vector3();
        cam.getWorldDirection(direction);
        emitShoot({ origin, direction: direction.normalize(), timestamp: Date.now() });
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR') {
        reload();
      }
    };

    const onContext = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        e.preventDefault();
      }
    };

    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onPointerLockChange);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('contextmenu', onContext);

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('contextmenu', onContext);
    };
  }, [camera, dialogueActive, gl.domElement, health, isPaused, reload, setPointerLocked, shoot]);

  useEffect(() => {
    if ((isPaused || dialogueActive || health <= 0) && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock();
    }
  }, [dialogueActive, gl.domElement, health, isPaused]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const safeDelta = !Number.isFinite(delta) || delta <= 0 || delta > 0.1 ? 0.016 : delta;
    const canMove = !isPaused && !dialogueActive && health > 0;

    if (!isPaused) {
      advanceTime(safeDelta);
    }

    const rb = rigidBodyRef.current;
    const currentVelocity = rb.linvel();
    const currentPos = rb.translation();

    const inputForward = (keysRef.current.forward ? 1 : 0) - (keysRef.current.backward ? 1 : 0);
    const inputRight = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0);

    forward.set(Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    right.set(Math.cos(yawRef.current), 0, Math.sin(yawRef.current));

    moveDir.set(0, 0, 0);
    moveDir.addScaledVector(forward, inputForward);
    moveDir.addScaledVector(right, inputRight);

    const moving = moveDir.lengthSq() > 0.001;
    if (moving) moveDir.normalize();

    const sprinting = keysRef.current.sprint && moving && canMove && consumeStamina(25 * safeDelta);
    if (!sprinting) {
      restoreStamina(12 * safeDelta);
    }

    const moveSpeed = sprinting ? 8.6 : 6.2;
    const targetX = canMove ? moveDir.x * moveSpeed : 0;
    const targetZ = canMove ? moveDir.z * moveSpeed : 0;

    const grounded = currentPos.y <= 1.05 && Math.abs(currentVelocity.y) < 0.35;
    const jumpVelocity = keysRef.current.jump && grounded && canMove ? 8.5 : currentVelocity.y;

    rb.setLinvel({ x: targetX, y: jumpVelocity, z: targetZ }, true);

    setMoving(moving && canMove);
    setMoveDirection({ x: moveDir.x, z: moveDir.z });
    setPosition([currentPos.x, currentPos.y, currentPos.z]);
    setRotation(yawRef.current);

    bobTime.current = moving ? bobTime.current + safeDelta * (sprinting ? 11 : 7) : 0;
    const bobOffset = moving ? Math.sin(bobTime.current) * 0.045 : 0;

    const cam = cameraRef.current;
    if (cam) {
      cam.position.set(currentPos.x, currentPos.y + 0.65 + bobOffset, currentPos.z);
      cam.rotation.order = 'YXZ';
      cam.rotation.y = yawRef.current;
      cam.rotation.x = pitchRef.current;
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      position={[0, 1, 0]}
      enabledRotations={[false, false, false]}
      linearDamping={5}
      angularDamping={5}
      colliders={false}
      mass={1}
    >
      <CapsuleCollider args={[0.42, 0.32]} position={[0, 0.62, 0]} />
      {/* First-person rig intentionally has no visible character mesh */}
    </RigidBody>
  );
}

export default PlayerController;

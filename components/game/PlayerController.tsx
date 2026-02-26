'use client';

import { useRef, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import { useCombatStore } from '@/lib/store/combatStore';

const useKeyboard = () => {
  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) {
        e.preventDefault();
      }

      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = true;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') keysRef.current.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') keysRef.current.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') keysRef.current.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') keysRef.current.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') keysRef.current.sprint = false;
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, []);

  return keysRef;
};

function WeaponViewModel({ recoilRef }: { recoilRef: MutableRefObject<number> }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    recoilRef.current = THREE.MathUtils.lerp(recoilRef.current, 0, Math.min(1, delta * 12));

    const weaponOffset = new THREE.Vector3(0.26, -0.24, -0.54);
    weaponOffset.applyQuaternion(camera.quaternion);

    groupRef.current.position.copy(camera.position).add(weaponOffset);
    groupRef.current.quaternion.copy(camera.quaternion);
    groupRef.current.rotation.x += recoilRef.current;
  });

  return (
    <group ref={groupRef}>
      <mesh castShadow>
        <boxGeometry args={[0.15, 0.16, 0.66]} />
        <meshStandardMaterial color="#f6f1e4" metalness={0.2} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.08, -0.1]} castShadow>
        <boxGeometry args={[0.09, 0.08, 0.22]} />
        <meshStandardMaterial color="#c45a44" roughness={0.45} />
      </mesh>
      <mesh position={[0, -0.08, 0.1]} castShadow>
        <boxGeometry args={[0.1, 0.1, 0.18]} />
        <meshStandardMaterial color="#6f4b3e" roughness={0.8} />
      </mesh>
      <pointLight position={[0, 0, -0.35]} color="#ffb36b" intensity={0.35} distance={2} />
    </group>
  );
}

export function PlayerController() {
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const keysRef = useKeyboard();
  const { camera, gl } = useThree();

  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const recoilRef = useRef(0);
  const shotCooldownRef = useRef(0);

  const setPosition = usePlayerStore((s) => s.setPosition);
  const setRotation = usePlayerStore((s) => s.setRotation);
  const setMoving = usePlayerStore((s) => s.setMoving);
  const isMoving = usePlayerStore((s) => s.isMoving);

  const isPaused = useGameStore((s) => s.isPaused);
  const dialogueActive = useGameStore((s) => s.dialogueState.active);
  const advanceTime = useGameStore((s) => s.advanceTime);

  const consumeAmmo = useCombatStore((s) => s.consumeAmmo);
  const reload = useCombatStore((s) => s.reload);
  const damageEnemy = useCombatStore((s) => s.damageEnemy);
  const grantAmmo = useCombatStore((s) => s.grantAmmo);
  const setDirectorLine = useCombatStore((s) => s.setDirectorLine);
  const setPointerLocked = useCombatStore((s) => s.setPointerLocked);

  const moveSpeed = 6.4;
  const sprintMultiplier = 1.45;

  useEffect(() => {
    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      setPointerLocked(locked);
      if (!locked) {
        setDirectorLine('Director AI: Click back into the world to re-engage combat.');
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;

      yawRef.current -= e.movementX * 0.0022;
      pitchRef.current -= e.movementY * 0.0018;
      pitchRef.current = THREE.MathUtils.clamp(pitchRef.current, -1.35, 1.35);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || isPaused || dialogueActive) return;

      if (document.pointerLockElement !== gl.domElement) {
        gl.domElement.requestPointerLock();
        return;
      }

      if (shotCooldownRef.current > 0) return;

      const fired = consumeAmmo();
      if (!fired) {
        setDirectorLine('Director AI: Magazine dry. Press R to reload.');
        return;
      }

      shotCooldownRef.current = 0.12;
      recoilRef.current = 0.08;

      const direction = new THREE.Vector3();
      camera.getWorldDirection(direction);
      const origin = camera.position.clone();

      const enemies = useCombatStore.getState().enemies.filter((enemy) => enemy.alive);
      let closestEnemyId: string | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const enemy of enemies) {
        const enemyPos = new THREE.Vector3(enemy.position[0], enemy.position[1] + 0.3, enemy.position[2]);
        const toEnemy = enemyPos.clone().sub(origin);
        const proj = toEnemy.dot(direction);
        if (proj < 0 || proj > 42) continue;

        const distanceToRay = toEnemy.clone().sub(direction.clone().multiplyScalar(proj)).length();
        if (distanceToRay < 0.9 && proj < closestDistance) {
          closestDistance = proj;
          closestEnemyId = enemy.enemyId;
        }
      }

      if (closestEnemyId) {
        const result = damageEnemy(closestEnemyId, 48);
        if (result.defeated) {
          grantAmmo(8);
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isPaused || dialogueActive) return;
      if (e.code === 'KeyR') {
        reload();
      }
    };

    document.addEventListener('pointerlockchange', onPointerLockChange);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [camera, consumeAmmo, damageEnemy, dialogueActive, gl.domElement, grantAmmo, isPaused, reload, setDirectorLine, setPointerLocked]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    const dt = Math.min(0.06, Math.max(0.001, delta));
    shotCooldownRef.current = Math.max(0, shotCooldownRef.current - dt);

    const canMove = !isPaused && !dialogueActive;
    if (!isPaused) {
      advanceTime(dt);
    }

    const keys = keysRef.current;
    let inputX = 0;
    let inputZ = 0;

    if (canMove) {
      if (keys.forward) inputZ += 1;
      if (keys.backward) inputZ -= 1;
      if (keys.left) inputX -= 1;
      if (keys.right) inputX += 1;
    }

    const inputLength = Math.hypot(inputX, inputZ);
    if (inputLength > 0) {
      inputX /= inputLength;
      inputZ /= inputLength;
    }

    const forward = new THREE.Vector3(-Math.sin(yawRef.current), 0, -Math.cos(yawRef.current));
    const right = new THREE.Vector3(Math.cos(yawRef.current), 0, -Math.sin(yawRef.current));

    const moveVector = forward.multiplyScalar(inputZ).add(right.multiplyScalar(inputX));

    const speed = moveSpeed * (keys.sprint ? sprintMultiplier : 1);
    const velocity = rigidBodyRef.current.linvel();
    rigidBodyRef.current.setLinvel(
      {
        x: moveVector.x * speed,
        y: velocity.y,
        z: moveVector.z * speed,
      },
      true
    );

    const position = rigidBodyRef.current.translation();
    const moving = inputLength > 0.05;
    if (moving !== isMoving) {
      setMoving(moving);
    }

    setPosition([position.x, position.y, position.z]);
    setRotation(yawRef.current);

    camera.position.set(position.x, position.y + 0.85, position.z);
    camera.quaternion.setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, 'YXZ'));
  });

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        position={[0, 1, 0]}
        enabledRotations={[false, false, false]}
        linearDamping={7}
        angularDamping={6}
        colliders={false}
        mass={1}
      >
        <CapsuleCollider args={[0.35, 0.28]} position={[0, 0.62, 0]} />
      </RigidBody>
      <WeaponViewModel recoilRef={recoilRef} />
    </>
  );
}

export default PlayerController;

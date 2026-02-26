'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Difficulty = 'rookie' | 'veteran' | 'nightmare';
type GameState = 'briefing' | 'running' | 'won' | 'lost';
type RadioMood = 'calm' | 'alert' | 'urgent' | 'critical' | 'victory';
type RadioTrigger =
  | 'welcome'
  | 'mission_start'
  | 'first_blood'
  | 'wave_cleared'
  | 'low_health'
  | 'out_of_ammo'
  | 'mission_complete'
  | 'mission_failed'
  | 'player_message';

type FeedSource = 'COMMAND-9' | 'SYSTEM' | 'YOU';

interface Enemy {
  id: string;
  base: [number, number, number];
  hp: number;
  maxHp: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  moveSpeed: number;
  phase: number;
}

interface DifficultyProfile {
  missionTime: number;
  totalWaves: number;
  baseEnemies: number;
  enemyHp: number;
  enemyDamage: number;
  startingArmor: number;
  startingReserveAmmo: number;
  waveAmmoReward: number;
  maxReserveAmmo: number;
}

interface RadioResponse {
  line: string;
  objective: string;
  mood: RadioMood;
}

interface FeedEntry {
  id: string;
  text: string;
  mood: RadioMood;
  source: FeedSource;
}

const MAG_SIZE = 30;

const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  rookie: {
    missionTime: 360,
    totalWaves: 3,
    baseEnemies: 4,
    enemyHp: 80,
    enemyDamage: 10,
    startingArmor: 70,
    startingReserveAmmo: 180,
    waveAmmoReward: 30,
    maxReserveAmmo: 280,
  },
  veteran: {
    missionTime: 300,
    totalWaves: 4,
    baseEnemies: 5,
    enemyHp: 95,
    enemyDamage: 13,
    startingArmor: 55,
    startingReserveAmmo: 150,
    waveAmmoReward: 24,
    maxReserveAmmo: 240,
  },
  nightmare: {
    missionTime: 240,
    totalWaves: 5,
    baseEnemies: 6,
    enemyHp: 110,
    enemyDamage: 16,
    startingArmor: 45,
    startingReserveAmmo: 130,
    waveAmmoReward: 18,
    maxReserveAmmo: 220,
  },
};

const OBSTACLES = [
  { position: [0, 1, 0] as [number, number, number], size: [6, 2, 3] as [number, number, number], color: '#284557' },
  { position: [-11, 1, -7] as [number, number, number], size: [5, 2, 2.5] as [number, number, number], color: '#204458' },
  { position: [12, 1, -6] as [number, number, number], size: [5, 2, 2.5] as [number, number, number], color: '#314a5d' },
  { position: [-8, 1, 10] as [number, number, number], size: [4.5, 2, 2.2] as [number, number, number], color: '#29405a' },
  { position: [9, 1, 10] as [number, number, number], size: [4.5, 2, 2.2] as [number, number, number], color: '#2a4860' },
  { position: [0, 1, 14] as [number, number, number], size: [8, 2, 2] as [number, number, number], color: '#2f4e65' },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatTime(seconds: number) {
  const safeSeconds = Math.max(seconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

function sanitizeCallsign(raw: string | null) {
  const cleaned = (raw ?? 'RAVEN-7')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 16);

  return cleaned || 'RAVEN-7';
}

function parseDifficulty(raw: string | null): Difficulty {
  if (raw === 'rookie' || raw === 'nightmare') return raw;
  return 'veteran';
}

function buildWave(wave: number, difficulty: Difficulty): Enemy[] {
  const profile = DIFFICULTY_PROFILES[difficulty];
  const count = profile.baseEnemies + (wave - 1) * 2;
  const radius = 15 + wave * 2.4;

  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    const lane = index % 2 === 0 ? 1 : -1;
    const spread = 1.4 + wave * 0.25;

    const x = Math.cos(angle) * radius + lane * spread;
    const z = Math.sin(angle) * radius - lane * 1.2;

    return {
      id: `w${wave}-e${index}`,
      base: [x, 1.2, z],
      hp: profile.enemyHp + wave * 10,
      maxHp: profile.enemyHp + wave * 10,
      damage: profile.enemyDamage + wave,
      attackRange: 8 + wave * 0.2,
      attackCooldown: Math.max(0.7, 1.5 - wave * 0.1),
      moveSpeed: 1 + (index % 3) * 0.2,
      phase: index * 0.85 + wave,
    };
  });
}

interface ArenaSceneProps {
  enemies: Enemy[];
  paused: boolean;
  ended: boolean;
  shotVersion: number;
  onShotResolved: (enemyId: string | null) => void;
  onPlayerDamage: (amount: number) => void;
  onPlayerMove: (position: [number, number, number]) => void;
  onPointerLockChange: (locked: boolean) => void;
}

function ArenaScene({
  enemies,
  paused,
  ended,
  shotVersion,
  onShotResolved,
  onPlayerDamage,
  onPlayerMove,
  onPointerLockChange,
}: ArenaSceneProps) {
  const { camera, gl } = useThree();
  const inputState = useRef<Record<string, boolean>>({});
  const enemyMeshRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const enemyCooldown = useRef<Record<string, number>>({});
  const movementRef = useRef(new THREE.Vector3());
  const forwardRef = useRef(new THREE.Vector3());
  const rightRef = useRef(new THREE.Vector3());
  const probePointRef = useRef(new THREE.Vector3());
  const upRef = useRef(new THREE.Vector3(0, 1, 0));

  const obstacleColliders = useMemo(
    () =>
      OBSTACLES.map((obstacle) => {
        const [x, , z] = obstacle.position;
        const [sx, , sz] = obstacle.size;

        return new THREE.Box3(
          new THREE.Vector3(x - sx / 2 - 0.75, 0, z - sz / 2 - 0.75),
          new THREE.Vector3(x + sx / 2 + 0.75, 3, z + sz / 2 + 0.75),
        );
      }),
    [],
  );

  useEffect(() => {
    camera.position.set(0, 1.7, 22);
    camera.lookAt(0, 1.7, 0);
  }, [camera]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      inputState.current[event.code] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      inputState.current[event.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const handlePointerLock = () => {
      onPointerLockChange(document.pointerLockElement === gl.domElement);
    };

    document.addEventListener('pointerlockchange', handlePointerLock);

    return () => {
      document.removeEventListener('pointerlockchange', handlePointerLock);
    };
  }, [gl, onPointerLockChange]);

  useEffect(() => {
    if ((paused || ended) && document.pointerLockElement === gl.domElement) {
      document.exitPointerLock();
    }
  }, [paused, ended, gl]);

  useEffect(() => {
    if (shotVersion < 1 || paused || ended) return;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

    const targets = enemies
      .filter((enemy) => enemy.hp > 0)
      .map((enemy) => ({ id: enemy.id, mesh: enemyMeshRefs.current[enemy.id] }))
      .filter((entry): entry is { id: string; mesh: THREE.Mesh } => entry.mesh !== null);

    if (targets.length === 0) {
      onShotResolved(null);
      return;
    }

    const intersections = raycaster.intersectObjects(
      targets.map((target) => target.mesh),
      false,
    );

    if (intersections.length === 0) {
      onShotResolved(null);
      return;
    }

    const hitObject = intersections[0].object;
    const matched = targets.find((target) => target.mesh.uuid === hitObject.uuid);

    onShotResolved(matched?.id ?? null);
  }, [shotVersion, paused, ended, camera, enemies, onShotResolved]);

  useFrame((state, delta) => {
    if (paused || ended) return;

    const movement = movementRef.current;
    const forward = forwardRef.current;
    const right = rightRef.current;
    const probePoint = probePointRef.current;
    const up = upRef.current;

    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    right.crossVectors(forward, up).normalize();

    movement.set(0, 0, 0);

    if (inputState.current.KeyW) movement.add(forward);
    if (inputState.current.KeyS) movement.addScaledVector(forward, -1);
    if (inputState.current.KeyA) movement.addScaledVector(right, -1);
    if (inputState.current.KeyD) movement.add(right);

    if (movement.lengthSq() > 0) {
      movement.normalize();

      const sprinting = inputState.current.ShiftLeft || inputState.current.ShiftRight;
      const speed = sprinting ? 9.8 : 7.1;

      const candidateX = clamp(camera.position.x + movement.x * speed * delta, -32, 32);
      const candidateZ = clamp(camera.position.z + movement.z * speed * delta, -32, 32);

      probePoint.set(candidateX, 1.1, candidateZ);
      const blocked = obstacleColliders.some((box) => box.containsPoint(probePoint));

      if (!blocked) {
        camera.position.set(candidateX, camera.position.y, candidateZ);
      }
    }

    camera.position.set(camera.position.x, 1.7, camera.position.z);
    onPlayerMove([camera.position.x, camera.position.y, camera.position.z]);

    const now = state.clock.elapsedTime;

    for (const enemy of enemies) {
      const mesh = enemyMeshRefs.current[enemy.id];
      if (!mesh) continue;

      if (enemy.hp <= 0) {
        mesh.visible = false;
        continue;
      }

      mesh.visible = true;

      const offsetX = Math.sin(now * enemy.moveSpeed + enemy.phase) * 1.2;
      const offsetZ = Math.cos(now * enemy.moveSpeed * 0.8 + enemy.phase) * 1.1;
      const bob = Math.sin(now * 2 + enemy.phase) * 0.24;

      mesh.position.set(enemy.base[0] + offsetX, enemy.base[1] + bob, enemy.base[2] + offsetZ);

      const distance = mesh.position.distanceTo(camera.position);
      const nextAllowed = enemyCooldown.current[enemy.id] ?? 0;

      if (distance < enemy.attackRange && now >= nextAllowed) {
        enemyCooldown.current[enemy.id] = now + enemy.attackCooldown;
        onPlayerDamage(enemy.damage);
      }
    }
  });

  return (
    <>
      <PointerLockControls />

      <Sky
        sunPosition={[20, 15, 5]}
        turbidity={9}
        rayleigh={2.4}
        mieCoefficient={0.005}
        mieDirectionalG={0.74}
      />

      <Stars radius={95} depth={55} count={2100} factor={4.4} fade />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[76, 76]} />
        <meshStandardMaterial color="#132635" roughness={0.88} metalness={0.12} />
      </mesh>

      <gridHelper args={[76, 76, '#20c2af', '#204557']} position={[0, 0.03, 0]} />

      {OBSTACLES.map((obstacle, index) => (
        <mesh key={`obstacle-${index}`} castShadow receiveShadow position={obstacle.position}>
          <boxGeometry args={obstacle.size} />
          <meshStandardMaterial
            color={obstacle.color}
            roughness={0.45}
            metalness={0.55}
            emissive="#0a1923"
            emissiveIntensity={0.45}
          />
        </mesh>
      ))}

      {[[-35, 2, 0], [35, 2, 0], [0, 2, -35], [0, 2, 35]].map((position, index) => (
        <mesh key={`wall-${index}`} position={position as [number, number, number]} castShadow receiveShadow>
          <boxGeometry args={index < 2 ? [1.5, 4, 74] : [74, 4, 1.5]} />
          <meshStandardMaterial color="#1d3a4d" emissive="#102733" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {enemies.map((enemy) => {
        const healthRatio = enemy.hp / enemy.maxHp;
        const color = healthRatio > 0.6 ? '#fb7185' : healthRatio > 0.3 ? '#f97316' : '#facc15';

        return (
          <mesh
            key={enemy.id}
            ref={(node) => {
              enemyMeshRefs.current[enemy.id] = node;
            }}
            position={enemy.base}
            castShadow
          >
            <sphereGeometry args={[0.6, 18, 18]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              roughness={0.3}
              metalness={0.8}
            />
          </mesh>
        );
      })}
    </>
  );
}

export default function FPSGame() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callsign = sanitizeCallsign(searchParams.get('callsign'));
  const difficulty = parseDifficulty(searchParams.get('difficulty'));
  const profile = DIFFICULTY_PROFILES[difficulty];

  const totalTargets = useMemo(() => {
    let sum = 0;
    for (let wave = 1; wave <= profile.totalWaves; wave += 1) {
      sum += profile.baseEnemies + (wave - 1) * 2;
    }
    return sum;
  }, [profile.baseEnemies, profile.totalWaves]);

  const initialWave = useMemo(() => buildWave(1, difficulty), [difficulty]);

  const [gameState, setGameState] = useState<GameState>('briefing');
  const [paused, setPaused] = useState(false);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [touchDevice, setTouchDevice] = useState(false);

  const [wave, setWave] = useState(1);
  const [kills, setKills] = useState(0);

  const [health, setHealth] = useState(100);
  const [armor, setArmor] = useState(profile.startingArmor);

  const [ammo, setAmmo] = useState(MAG_SIZE);
  const [reserveAmmo, setReserveAmmo] = useState(profile.startingReserveAmmo);
  const [isReloading, setIsReloading] = useState(false);

  const [timeLeft, setTimeLeft] = useState(profile.missionTime);
  const [enemies, setEnemies] = useState<Enemy[]>(initialWave);
  const [shotVersion, setShotVersion] = useState(0);
  const [objective, setObjective] = useState('Sweep wave one and hold central cover.');

  const [playerPosition, setPlayerPosition] = useState<[number, number, number]>([0, 1.7, 22]);

  const [radioFeed, setRadioFeed] = useState<FeedEntry[]>([
    {
      id: createId(),
      text: 'Telemetry reset. Awaiting deployment order.',
      mood: 'calm',
      source: 'SYSTEM',
    },
  ]);
  const [messageInput, setMessageInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  const waveRef = useRef(1);
  const killsRef = useRef(0);
  const healthRef = useRef(100);
  const armorRef = useRef(profile.startingArmor);
  const ammoRef = useRef(MAG_SIZE);
  const reserveAmmoRef = useRef(profile.startingReserveAmmo);
  const enemiesRef = useRef<Enemy[]>(initialWave);
  const timeLeftRef = useRef(profile.missionTime);
  const gameStateRef = useRef<GameState>('briefing');
  const pausedRef = useRef(false);
  const isReloadingRef = useRef(false);

  const lowHealthAlertSent = useRef(false);
  const outOfAmmoAlertSent = useRef(false);
  const firstBloodSent = useRef(false);
  const missionOutcomeSent = useRef(false);
  const reloadTimeoutRef = useRef<number | null>(null);
  const welcomeRequestedRef = useRef(false);

  const enemiesRemaining = useMemo(
    () => enemies.filter((enemy) => enemy.hp > 0).length,
    [enemies],
  );

  const progress = Math.round((kills / Math.max(1, totalTargets)) * 100);

  const pushFeed = useCallback((text: string, mood: RadioMood, source: FeedSource) => {
    setRadioFeed((previous) => [
      {
        id: createId(),
        text,
        mood,
        source,
      },
      ...previous,
    ].slice(0, 7));
  }, []);

  const resetMission = useCallback(
    (nextState: GameState) => {
      const refreshedWave = buildWave(1, difficulty);

      setWave(1);
      waveRef.current = 1;

      setKills(0);
      killsRef.current = 0;

      setHealth(100);
      healthRef.current = 100;

      setArmor(profile.startingArmor);
      armorRef.current = profile.startingArmor;

      setAmmo(MAG_SIZE);
      ammoRef.current = MAG_SIZE;

      setReserveAmmo(profile.startingReserveAmmo);
      reserveAmmoRef.current = profile.startingReserveAmmo;

      setTimeLeft(profile.missionTime);
      timeLeftRef.current = profile.missionTime;

      setShotVersion(0);
      setIsReloading(false);
      isReloadingRef.current = false;

      setEnemies(refreshedWave);
      enemiesRef.current = refreshedWave;

      setObjective('Sweep wave one and hold central cover.');
      setPaused(false);
      pausedRef.current = false;

      setPointerLocked(false);

      setRadioFeed([
        {
          id: createId(),
          text: 'Telemetry reset. Awaiting deployment order.',
          mood: 'calm',
          source: 'SYSTEM',
        },
      ]);

      lowHealthAlertSent.current = false;
      outOfAmmoAlertSent.current = false;
      firstBloodSent.current = false;
      missionOutcomeSent.current = false;

      setGameState(nextState);
      gameStateRef.current = nextState;
    },
    [difficulty, profile.missionTime, profile.startingArmor, profile.startingReserveAmmo],
  );

  useEffect(() => {
    setTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  useEffect(() => {
    return () => {
      if (reloadTimeoutRef.current) {
        window.clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, []);

  const requestRadio = useCallback(
    async (trigger: RadioTrigger, note?: string) => {
      try {
        setAiBusy(true);

        const response = await fetch('/api/ai/fps/radio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger,
            callsign,
            difficulty,
            note,
            stats: {
              wave: waveRef.current,
              kills: killsRef.current,
              health: healthRef.current,
              armor: armorRef.current,
              ammo: ammoRef.current,
              reserveAmmo: reserveAmmoRef.current,
              enemiesRemaining: enemiesRef.current.filter((enemy) => enemy.hp > 0).length,
              timeLeft: timeLeftRef.current,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Radio endpoint failed with status ${response.status}`);
        }

        const data = (await response.json()) as RadioResponse;

        if (data.line) {
          pushFeed(data.line, data.mood ?? 'alert', 'COMMAND-9');
        }

        if (data.objective) {
          setObjective(data.objective);
        }
      } catch (error) {
        console.error('Radio request failed:', error);
        pushFeed('Signal degraded. Continue mission protocol and hold lanes.', 'urgent', 'SYSTEM');
      } finally {
        setAiBusy(false);
      }
    },
    [callsign, difficulty, pushFeed],
  );

  useEffect(() => {
    if (welcomeRequestedRef.current) return;
    welcomeRequestedRef.current = true;
    void requestRadio('welcome');
  }, [requestRadio]);

  const handleReload = useCallback(() => {
    if (gameStateRef.current !== 'running' || pausedRef.current || isReloadingRef.current) return;
    if (ammoRef.current >= MAG_SIZE) return;

    if (reserveAmmoRef.current <= 0) {
      pushFeed('Reserve ammo depleted. Every shot must count.', 'urgent', 'SYSTEM');

      if (!outOfAmmoAlertSent.current) {
        outOfAmmoAlertSent.current = true;
        void requestRadio('out_of_ammo');
      }
      return;
    }

    setIsReloading(true);
    isReloadingRef.current = true;
    pushFeed('Reloading weapon...', 'alert', 'SYSTEM');

    reloadTimeoutRef.current = window.setTimeout(() => {
      const needed = MAG_SIZE - ammoRef.current;
      const transfer = Math.min(needed, reserveAmmoRef.current);

      ammoRef.current += transfer;
      reserveAmmoRef.current -= transfer;

      setAmmo(ammoRef.current);
      setReserveAmmo(reserveAmmoRef.current);

      setIsReloading(false);
      isReloadingRef.current = false;

      if (ammoRef.current > 0) {
        outOfAmmoAlertSent.current = false;
      }
    }, 900);
  }, [pushFeed, requestRadio]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (event.code === 'KeyR') {
        event.preventDefault();
        handleReload();
      }

      if (event.code === 'Escape' && gameStateRef.current === 'running') {
        setPaused((previous) => {
          const nextValue = !previous;
          pausedRef.current = nextValue;
          return nextValue;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleReload]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (gameStateRef.current !== 'running' || pausedRef.current || isReloadingRef.current) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-ui-root="true"]')) return;

      if (ammoRef.current <= 0) {
        pushFeed('Magazine empty. Press R to reload.', 'urgent', 'SYSTEM');

        if (reserveAmmoRef.current <= 0 && !outOfAmmoAlertSent.current) {
          outOfAmmoAlertSent.current = true;
          void requestRadio('out_of_ammo');
        }
        return;
      }

      ammoRef.current -= 1;
      setAmmo(ammoRef.current);
      setShotVersion((value) => value + 1);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [pushFeed, requestRadio]);

  const handleShotResolved = useCallback(
    (enemyId: string | null) => {
      if (!enemyId || gameStateRef.current !== 'running') return;

      const existing = enemiesRef.current;
      const enemyIndex = existing.findIndex((enemy) => enemy.id === enemyId && enemy.hp > 0);
      if (enemyIndex === -1) return;

      const target = existing[enemyIndex];
      const nextHp = Math.max(0, target.hp - 45);
      const nextEnemies = existing.map((enemy, index) =>
        index === enemyIndex
          ? {
              ...enemy,
              hp: nextHp,
            }
          : enemy,
      );

      enemiesRef.current = nextEnemies;
      setEnemies(nextEnemies);

      if (nextHp > 0) return;

      const nextKills = killsRef.current + 1;
      killsRef.current = nextKills;
      setKills(nextKills);

      if (!firstBloodSent.current) {
        firstBloodSent.current = true;
        void requestRadio('first_blood');
      }

      const alive = nextEnemies.filter((enemy) => enemy.hp > 0).length;
      if (alive > 0) return;

      const completedWave = waveRef.current;

      if (completedWave >= profile.totalWaves) {
        setGameState('won');
        gameStateRef.current = 'won';
        return;
      }

      const nextWaveNumber = completedWave + 1;
      const nextWaveEnemies = buildWave(nextWaveNumber, difficulty);

      setWave(nextWaveNumber);
      waveRef.current = nextWaveNumber;

      setEnemies(nextWaveEnemies);
      enemiesRef.current = nextWaveEnemies;

      ammoRef.current = Math.min(MAG_SIZE, ammoRef.current + 8);
      reserveAmmoRef.current = Math.min(profile.maxReserveAmmo, reserveAmmoRef.current + profile.waveAmmoReward);

      setAmmo(ammoRef.current);
      setReserveAmmo(reserveAmmoRef.current);

      pushFeed(`Wave ${completedWave} cleared. Hostiles inbound.`, 'alert', 'SYSTEM');
      setObjective(`Wave ${nextWaveNumber}: collapse hostile angles and survive.`);
      void requestRadio('wave_cleared', `Wave ${completedWave} complete.`);
    },
    [difficulty, profile.maxReserveAmmo, profile.totalWaves, profile.waveAmmoReward, pushFeed, requestRadio],
  );

  const handlePlayerDamage = useCallback(
    (damage: number) => {
      if (gameStateRef.current !== 'running' || pausedRef.current) return;

      const absorbed = Math.min(armorRef.current, Math.round(damage * 0.6));
      const healthDamage = Math.max(0, damage - absorbed);

      armorRef.current = Math.max(0, armorRef.current - absorbed);
      healthRef.current = Math.max(0, healthRef.current - healthDamage);

      setArmor(armorRef.current);
      setHealth(healthRef.current);

      if (healthRef.current <= 30 && !lowHealthAlertSent.current) {
        lowHealthAlertSent.current = true;
        void requestRadio('low_health');
      }

      if (healthRef.current <= 0) {
        setGameState('lost');
        gameStateRef.current = 'lost';
      }
    },
    [requestRadio],
  );

  useEffect(() => {
    if (gameState !== 'running' || paused) return;

    const timer = window.setInterval(() => {
      const next = Math.max(0, timeLeftRef.current - 1);
      timeLeftRef.current = next;
      setTimeLeft(next);

      if (next === 0) {
        setGameState('lost');
        gameStateRef.current = 'lost';
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [gameState, paused]);

  useEffect(() => {
    if (gameState === 'running') {
      missionOutcomeSent.current = false;
      return;
    }

    if (missionOutcomeSent.current) return;

    if (gameState === 'won') {
      missionOutcomeSent.current = true;
      void requestRadio('mission_complete');
    }

    if (gameState === 'lost') {
      missionOutcomeSent.current = true;
      void requestRadio('mission_failed');
    }
  }, [gameState, requestRadio]);

  const startMission = useCallback(() => {
    setGameState('running');
    gameStateRef.current = 'running';
    setPaused(false);
    pausedRef.current = false;

    pushFeed('Deployment confirmed. Click inside the arena to lock aim.', 'alert', 'SYSTEM');
    void requestRadio('mission_start');
  }, [pushFeed, requestRadio]);

  const redeploy = useCallback(() => {
    resetMission('running');
    pushFeed('Rapid redeploy initiated.', 'alert', 'SYSTEM');
    void requestRadio('mission_start');
  }, [pushFeed, requestRadio, resetMission]);

  const handleTransmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = messageInput.trim();
      if (!message) return;

      setMessageInput('');
      pushFeed(message, 'calm', 'YOU');
      await requestRadio('player_message', message);
    },
    [messageInput, pushFeed, requestRadio],
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#060c11] text-white">
      <div className="absolute inset-0">
        <Canvas
          shadows
          dpr={[1, 1.5]}
          camera={{ fov: 76, near: 0.1, far: 200 }}
        >
          <color attach="background" args={['#08131b']} />
          <fog attach="fog" args={['#08131b', 45, 135]} />

          <ambientLight intensity={0.3} />
          <hemisphereLight color="#75a0bf" groundColor="#11273a" intensity={0.5} />
          <directionalLight
            castShadow
            position={[15, 20, 8]}
            intensity={1.15}
            color="#fff4d0"
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={1}
            shadow-camera-far={120}
            shadow-camera-left={-40}
            shadow-camera-right={40}
            shadow-camera-top={40}
            shadow-camera-bottom={-40}
          />

          <ArenaScene
            enemies={enemies}
            paused={paused || gameState !== 'running'}
            ended={gameState === 'won' || gameState === 'lost'}
            shotVersion={shotVersion}
            onShotResolved={handleShotResolved}
            onPlayerDamage={handlePlayerDamage}
            onPlayerMove={setPlayerPosition}
            onPointerLockChange={setPointerLocked}
          />
        </Canvas>
      </div>

      {gameState === 'running' && pointerLocked && !paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative h-7 w-7">
            <span className="absolute left-1/2 top-0 h-2 w-[2px] -translate-x-1/2 bg-cyan-300" />
            <span className="absolute bottom-0 left-1/2 h-2 w-[2px] -translate-x-1/2 bg-cyan-300" />
            <span className="absolute left-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-cyan-300" />
            <span className="absolute right-0 top-1/2 h-[2px] w-2 -translate-y-1/2 bg-cyan-300" />
          </div>
        </div>
      )}

      <div data-ui-root="true" className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-4 top-4 w-[min(460px,calc(100vw-2rem))] rounded-xl border border-cyan-400/30 bg-[#0a1620]/85 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-300">Callsign {callsign}</p>
            <p className="font-mono text-sm text-amber-300">T-{formatTime(timeLeft)}</p>
          </div>

          <p className="text-sm text-cyan-100">{objective}</p>

          <div className="mt-3 space-y-2">
            <div>
              <div className="mb-1 flex justify-between text-xs text-cyan-100/80">
                <span>Vitals</span>
                <span>{health}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-700/50">
                <div
                  className="h-full bg-emerald-400 transition-all"
                  style={{ width: `${health}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-cyan-100/80">
                <span>Armor</span>
                <span>{armor}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-700/50">
                <div
                  className="h-full bg-sky-400 transition-all"
                  style={{ width: `${armor}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-xs text-cyan-100/80">
                <span>Mission Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-slate-700/50">
                <div
                  className="h-full bg-amber-400 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-cyan-100/90 sm:grid-cols-4">
            <div className="rounded border border-cyan-400/20 bg-slate-900/40 px-2 py-1">Wave: {wave}/{profile.totalWaves}</div>
            <div className="rounded border border-cyan-400/20 bg-slate-900/40 px-2 py-1">Kills: {kills}</div>
            <div className="rounded border border-cyan-400/20 bg-slate-900/40 px-2 py-1">
              Ammo: {isReloading ? 'RELOADING' : `${ammo}/${MAG_SIZE}`}
            </div>
            <div className="rounded border border-cyan-400/20 bg-slate-900/40 px-2 py-1">Reserve: {reserveAmmo}</div>
          </div>
        </div>

        <div className="pointer-events-auto absolute right-4 top-4 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-amber-300/30 bg-[#1a1210]/85 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-amber-300">Command Feed</p>
            <span className={`text-[11px] ${aiBusy ? 'text-amber-200' : 'text-emerald-300'}`}>
              {aiBusy ? 'AI uplink active' : 'AI uplink stable'}
            </span>
          </div>

          <div className="space-y-2">
            {radioFeed.map((entry) => (
              <div key={entry.id} className="rounded border border-amber-200/15 bg-black/25 p-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-200/70">{entry.source}</p>
                <p className="mt-1 text-sm leading-snug text-amber-50">{entry.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleTransmit} className="mt-3 flex gap-2">
            <input
              value={messageInput}
              onChange={(event) => setMessageInput(event.target.value)}
              placeholder="Send command request..."
              className="h-10 flex-1 rounded border border-amber-300/30 bg-black/30 px-3 text-sm text-amber-50 placeholder:text-amber-100/40 outline-none focus:border-amber-200"
              maxLength={160}
            />
            <Button
              type="submit"
              className="h-10 bg-amber-400 text-black hover:bg-amber-300"
              disabled={aiBusy || messageInput.trim().length === 0}
            >
              TX
            </Button>
          </form>
        </div>

        <div className="pointer-events-auto absolute bottom-4 left-4 rounded-lg border border-cyan-300/20 bg-[#0a1620]/80 px-3 py-2 text-xs text-cyan-100/90">
          <p>Move: `W A S D`</p>
          <p>Sprint: `Shift`</p>
          <p>Shoot: `Left Click`</p>
          <p>Reload: `R`</p>
          <p>Pause: `Esc`</p>
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg border border-cyan-300/20 bg-[#0a1620]/70 px-3 py-2 text-xs text-cyan-50/85">
          <p>
            POS {playerPosition[0].toFixed(1)}, {playerPosition[2].toFixed(1)}
          </p>
          <p>Hostiles active: {enemiesRemaining}</p>
          {!pointerLocked && gameState === 'running' && <p>Click arena to lock aim</p>}
        </div>
      </div>

      {touchDevice && (
        <div className="absolute bottom-4 left-1/2 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 rounded border border-amber-300/30 bg-[#1b1410]/90 px-4 py-2 text-center text-xs text-amber-100">
          Mobile is view-only for this build. Desktop with mouse + keyboard is required for full FPS controls.
        </div>
      )}

      {gameState === 'briefing' && (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl border-cyan-300/30 bg-[#07131d]/95 text-slate-100 backdrop-blur">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-[0.32em] text-cyan-300">FPS Combat Sim</p>
              <CardTitle className="text-3xl">Neon Extraction Protocol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-200">
              <p>
                Sector 9 has gone hot. You are entering a fully first-person combat scenario with reactive AI mission command.
                Clear each wave, manage ammo discipline, and survive until extraction.
              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Callsign</p>
                  <p className="mt-1 font-mono text-lg">{callsign}</p>
                </div>
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Difficulty</p>
                  <p className="mt-1 font-mono text-lg">{difficulty}</p>
                </div>
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Wave Target</p>
                  <p className="mt-1 font-mono text-lg">{profile.totalWaves}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="h-12 flex-1 bg-cyan-400 text-black hover:bg-cyan-300" onClick={startMission}>
                  Deploy Operator
                </Button>
                <Button
                  variant="outline"
                  className="h-12 flex-1 border-cyan-300/40 text-cyan-100 hover:bg-cyan-950/40"
                  onClick={() => router.push('/')}
                >
                  Back to Welcome
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {gameState === 'running' && paused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-md border-cyan-300/35 bg-[#07131d]/95 text-slate-100">
            <CardHeader>
              <CardTitle className="text-center text-2xl">Mission Paused</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="h-11 w-full bg-cyan-400 text-black hover:bg-cyan-300"
                onClick={() => {
                  setPaused(false);
                  pausedRef.current = false;
                }}
              >
                Resume
              </Button>
              <Button variant="outline" className="h-11 w-full" onClick={() => resetMission('briefing')}>
                Abort to Briefing
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {(gameState === 'won' || gameState === 'lost') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-4">
          <Card className="w-full max-w-lg border-cyan-300/35 bg-[#07131d]/95 text-slate-100">
            <CardHeader>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">Debrief</p>
              <CardTitle className="text-3xl">
                {gameState === 'won' ? 'Mission Complete' : 'Mission Failed'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">Waves reached: {wave}</div>
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">Kills: {kills}</div>
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">Time left: {formatTime(timeLeft)}</div>
                <div className="rounded border border-cyan-300/25 bg-cyan-950/30 p-3">Vitals: {health}%</div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button className="h-11 flex-1 bg-cyan-400 text-black hover:bg-cyan-300" onClick={redeploy}>
                  Redeploy
                </Button>
                <Button variant="outline" className="h-11 flex-1" onClick={() => resetMission('briefing')}>
                  Return to Briefing
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </main>
  );
}

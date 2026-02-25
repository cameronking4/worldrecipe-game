'use client';

import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { NPC, POI } from '@/types/game';
import { normalizePosition } from '@/types/game';
import { useGameStore } from '@/lib/store/gameStore';
import { usePlayerStore } from '@/lib/store/playerStore';

// ============================================
// NPC Visual Component
// ============================================

interface NPCVisualProps {
  npc: NPC;
  isHighlighted: boolean;
}

function NPCVisual({ npc, isHighlighted }: NPCVisualProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bobOffset = useRef(Math.random() * Math.PI * 2);
  
  // Get colors based on NPC personality/role
  const colors = useMemo(() => {
    const roleColors: Record<string, string> = {
      'Chef': '#FF6B6B',
      'Head Chef': '#FF6B6B',
      'Fisherman': '#4A90D9',
      'Farmer': '#32CD32',
      'Merchant': '#FFD700',
      'Elder': '#9370DB',
      'Herbalist': '#7BC67E',
      'default': '#DEB887',
    };
    
    const skinTones = ['#FFE4C9', '#D4A574', '#8D5524', '#C68642', '#F1C27D'];
    const skinIndex = Math.abs(npc.npcId.charCodeAt(0)) % skinTones.length;
    
    return {
      body: roleColors[npc.role.job] || roleColors.default,
      skin: skinTones[skinIndex],
    };
  }, [npc]);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    
    // Idle bobbing animation
    bobOffset.current += 0.02;
    groupRef.current.position.y = Math.sin(bobOffset.current) * 0.03;
    
    // Subtle rotation when highlighted
    if (isHighlighted) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Body */}
      <RoundedBox
        args={[0.5, 0.7, 0.4]}
        radius={0.1}
        smoothness={4}
        position={[0, 0.35, 0]}
        castShadow
      >
        <meshStandardMaterial 
          color={colors.body} 
          roughness={0.7}
          emissive={isHighlighted ? colors.body : '#000000'}
          emissiveIntensity={isHighlighted ? 0.2 : 0}
        />
      </RoundedBox>
      
      {/* Head */}
      <RoundedBox
        args={[0.4, 0.4, 0.35]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.9, 0]}
        castShadow
      >
        <meshStandardMaterial color={colors.skin} roughness={0.6} />
      </RoundedBox>
      
      {/* Eyes */}
      <mesh position={[-0.1, 0.95, 0.15]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#2D2D2D" />
      </mesh>
      <mesh position={[0.1, 0.95, 0.15]} castShadow>
        <boxGeometry args={[0.08, 0.08, 0.05]} />
        <meshStandardMaterial color="#2D2D2D" />
      </mesh>
      
      {/* Role-specific accessories */}
      {npc.role.job.includes('Chef') && (
        <>
          <RoundedBox
            args={[0.35, 0.3, 0.3]}
            radius={0.05}
            smoothness={4}
            position={[0, 1.2, 0]}
            castShadow
          >
            <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 1.4, 0]} castShadow>
            <cylinderGeometry args={[0.15, 0.18, 0.15, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.5} />
          </mesh>
        </>
      )}
      
      {npc.role.job === 'Fisherman' && (
        <mesh position={[0, 1.1, 0]} castShadow>
          <coneGeometry args={[0.25, 0.2, 8]} />
          <meshStandardMaterial color="#8B4513" roughness={0.9} />
        </mesh>
      )}

      {npc.role.job === 'Herbalist' && (
        <>
          {/* Flower crown */}
          <mesh position={[0, 1.15, 0]} castShadow>
            <torusGeometry args={[0.2, 0.04, 8, 16]} />
            <meshStandardMaterial color="#2E7D32" roughness={0.7} />
          </mesh>
          {/* Flowers on crown */}
          {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle, i) => (
            <mesh
              key={i}
              position={[
                Math.cos(angle) * 0.2,
                1.18,
                Math.sin(angle) * 0.2,
              ]}
              castShadow
            >
              <sphereGeometry args={[0.05, 6, 6]} />
              <meshStandardMaterial
                color={['#FF69B4', '#FFD700', '#FF6347', '#DA70D6'][i]}
                roughness={0.5}
              />
            </mesh>
          ))}
        </>
      )}
      
      {/* Arms */}
      <RoundedBox
        args={[0.15, 0.4, 0.15]}
        radius={0.03}
        smoothness={4}
        position={[-0.35, 0.35, 0]}
        castShadow
      >
        <meshStandardMaterial color={colors.skin} roughness={0.6} />
      </RoundedBox>
      <RoundedBox
        args={[0.15, 0.4, 0.15]}
        radius={0.03}
        smoothness={4}
        position={[0.35, 0.35, 0]}
        castShadow
      >
        <meshStandardMaterial color={colors.skin} roughness={0.6} />
      </RoundedBox>
      
      {/* Legs */}
      <RoundedBox
        args={[0.18, 0.25, 0.18]}
        radius={0.03}
        smoothness={4}
        position={[-0.12, -0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color="#4A4A4A" roughness={0.8} />
      </RoundedBox>
      <RoundedBox
        args={[0.18, 0.25, 0.18]}
        radius={0.03}
        smoothness={4}
        position={[0.12, -0.12, 0]}
        castShadow
      >
        <meshStandardMaterial color="#4A4A4A" roughness={0.8} />
      </RoundedBox>
      
      {/* Name tag */}
      <Text
        position={[0, 1.8, 0]}
        fontSize={0.2}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {npc.name}
      </Text>
      
      {/* Highlight indicator */}
      {isHighlighted && (
        <mesh position={[0, 2.1, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial 
            color="#FFD700" 
            emissive="#FFD700" 
            emissiveIntensity={0.8}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}
    </group>
  );
}

// ============================================
// Single NPC Controller
// ============================================

interface NPCControllerProps {
  npc: NPC;
  pois: POI[];
  onInteract: (npcId: string) => void;
}

export function SingleNPCController({ npc, pois, onInteract }: NPCControllerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const highlightedRef = useRef(false); // Track highlight without causing re-renders
  
  const playerPosition = usePlayerStore((s) => s.position);
  const timeOfDay = useGameStore((s) => s.timeOfDay);
  const showInteractionPrompt = useGameStore((s) => s.showInteractionPrompt);
  const hideInteractionPrompt = useGameStore((s) => s.hideInteractionPrompt);
  
  // Find current schedule location based on time of day
  const currentSchedule = useMemo(() => {
    return npc.schedule.find(s => s.timeOfDay === timeOfDay) || npc.schedule[0];
  }, [npc.schedule, timeOfDay]);
  
  // Find POI position for current schedule with NPC-specific offset
  const targetPosition = useMemo(() => {
    // Generate a consistent offset for this NPC based on their ID
    const npcHash = npc.npcId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const offsetAngle = (npcHash % 8) * (Math.PI / 4); // 8 possible positions around POI
    const offsetDistance = 1.5 + (npcHash % 3) * 0.5; // 1.5 to 2.5 units away
    const offsetX = Math.cos(offsetAngle) * offsetDistance;
    const offsetZ = Math.sin(offsetAngle) * offsetDistance;
    
    // Try to find the scheduled POI
    const poi = pois.find(p => p.poiId === currentSchedule?.locationId);
    if (poi) {
      const [px, py] = normalizePosition(poi.position);
      if (Number.isFinite(px) && Number.isFinite(py)) {
        return [px + offsetX, 0.5, py + offsetZ] as [number, number, number];
      }
    }
    
    // Try to match by POI name or type if locationId doesn't match directly
    const scheduleLocation = currentSchedule?.locationId || '';
    const matchingPoi = pois.find(p => 
      p.name.toLowerCase().includes(scheduleLocation.toLowerCase()) ||
      p.type === scheduleLocation ||
      scheduleLocation.includes(p.poiId)
    );
    if (matchingPoi) {
      const [mpx, mpy] = normalizePosition(matchingPoi.position);
      if (Number.isFinite(mpx) && Number.isFinite(mpy)) {
        return [mpx + offsetX, 0.5, mpy + offsetZ] as [number, number, number];
      }
    }
    
    // Fallback: spread NPCs around the map based on their hash
    const fallbackAngle = (npcHash % 12) * (Math.PI / 6);
    const fallbackDistance = 8 + (npcHash % 10);
    return [
      Math.cos(fallbackAngle) * fallbackDistance, 
      0.5, 
      Math.sin(fallbackAngle) * fallbackDistance
    ] as [number, number, number];
  }, [npc.npcId, currentSchedule, pois]);
  
  // Stable key for position to force remount when position changes significantly
  const positionKey = useMemo(() => {
    return `${Math.round(targetPosition[0])}-${Math.round(targetPosition[2])}`;
  }, [targetPosition]);
  
  // Check distance to player for interaction - use refs to avoid setState in useFrame
  useFrame(() => {
    // Validate positions
    if (!Number.isFinite(targetPosition[0]) || !Number.isFinite(targetPosition[2])) return;
    if (!Number.isFinite(playerPosition[0]) || !Number.isFinite(playerPosition[2])) return;
    
    const distance = Math.sqrt(
      Math.pow(targetPosition[0] - playerPosition[0], 2) +
      Math.pow(targetPosition[2] - playerPosition[2], 2)
    );
    
    if (!Number.isFinite(distance)) return;
    
    const inRange = distance < 2.5;
    
    // Only update state if changed to avoid render loops
    if (inRange !== highlightedRef.current) {
      highlightedRef.current = inRange;
      setIsHighlighted(inRange);
      if (inRange) {
        showInteractionPrompt(`Talk to ${npc.name}`, npc.npcId, 'npc');
      } else {
        hideInteractionPrompt();
      }
    }
  });
  
  // Handle keyboard interaction
  const handleInteraction = useCallback(() => {
    if (highlightedRef.current) {
      onInteract(npc.npcId);
    }
  }, [npc.npcId, onInteract]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' || e.code === 'Space') {
        handleInteraction();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInteraction]);
  
  // Use a simple group for NPCs - no physics needed since they're stationary
  // The key forces a clean remount when position changes significantly
  return (
    <group 
      ref={groupRef}
      key={positionKey}
      position={targetPosition}
    >
      <NPCVisual npc={npc} isHighlighted={isHighlighted} />
    </group>
  );
}

// ============================================
// NPC Manager - Renders all NPCs
// ============================================

interface NPCManagerProps {
  npcs: NPC[];
  pois: POI[];
  onNPCInteract: (npcId: string) => void;
}

export function NPCManager({ npcs, pois, onNPCInteract }: NPCManagerProps) {
  // Don't render NPCs if there are no valid POIs to place them at
  if (!pois || pois.length === 0) {
    return null;
  }
  
  // Filter NPCs that have valid schedule locations
  const validNpcs = npcs.filter(npc => {
    // NPC is valid if at least one of their schedule locations exists or there's a fallback POI
    return npc.schedule.length > 0 || pois.length > 0;
  });
  
  return (
    <group>
      {validNpcs.map((npc) => (
        <SingleNPCController
          key={npc.npcId}
          npc={npc}
          pois={pois}
          onInteract={onNPCInteract}
        />
      ))}
    </group>
  );
}

export default NPCManager;


'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import { RoundedBox, Text } from '@react-three/drei';
import * as THREE from 'three';
import { usePlayerStore } from '@/lib/store/playerStore';
import { useGameStore } from '@/lib/store/gameStore';
import type { Item, IngredientNode } from '@/types/game';

// ============================================
// Ingredient Pickup Component
// ============================================

interface IngredientPickupProps {
  ingredient: IngredientNode;
  position: [number, number, number];
  onPickup: (ingredientId: string) => void;
}

export function IngredientPickup({ ingredient, position, onPickup }: IngredientPickupProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  
  const playerPosition = usePlayerStore((s) => s.position);
  const showInteractionPrompt = useGameStore((s) => s.showInteractionPrompt);
  const hideInteractionPrompt = useGameStore((s) => s.hideInteractionPrompt);
  
  // Category colors
  const categoryColors: Record<string, string> = {
    vegetable: '#32CD32',
    protein: '#FF6B6B',
    grain: '#DEB887',
    spice: '#FFD700',
    liquid: '#4A90D9',
    default: '#9370DB',
  };
  
  const color = categoryColors[ingredient.category] || categoryColors.default;
  
  // Floating and rotation animation
  useFrame((state) => {
    if (!meshRef.current || isCollected) return;
    
    // Validate positions to prevent NaN propagation
    if (!Number.isFinite(position[0]) || !Number.isFinite(position[1]) || !Number.isFinite(position[2])) return;
    if (!Number.isFinite(playerPosition[0]) || !Number.isFinite(playerPosition[2])) return;
    
    const yOffset = Math.sin(state.clock.elapsedTime * 2) * 0.1;
    if (Number.isFinite(yOffset)) {
      meshRef.current.position.y = position[1] + 0.3 + yOffset;
    }
    meshRef.current.rotation.y += 0.02;
    
    // Check distance to player
    const distance = Math.sqrt(
      Math.pow(position[0] - playerPosition[0], 2) +
      Math.pow(position[2] - playerPosition[2], 2)
    );
    
    if (!Number.isFinite(distance)) return;
    
    const inRange = distance < 2.8;
    
    if (inRange !== isHighlighted) {
      setIsHighlighted(inRange);
      if (inRange) {
        showInteractionPrompt(`Pick up ${ingredient.name}`, ingredient.ingredientId, 'item');
      } else {
        hideInteractionPrompt();
      }
    }
  });
  
  // Handle keyboard interaction
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.code === 'Space') && isHighlighted && !isCollected) {
        setIsCollected(true);
        hideInteractionPrompt();
        onPickup(ingredient.ingredientId);
        // Mark as collected in player store to prevent respawn after reload
        usePlayerStore.getState().markCollected(ingredient.ingredientId);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHighlighted, isCollected, ingredient.ingredientId, onPickup, hideInteractionPrompt]);
  
  if (isCollected) return null;
  
  return (
    <group position={position}>
      <group ref={meshRef}>
        {/* Main item shape */}
        <RoundedBox
          args={[0.3, 0.3, 0.3]}
          radius={0.05}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial 
            color={color}
            emissive={isHighlighted ? color : '#000000'}
            emissiveIntensity={isHighlighted ? 0.5 : 0}
            roughness={0.6}
          />
        </RoundedBox>
        
        {/* Glow effect when highlighted */}
        {isHighlighted && (
          <mesh scale={1.5}>
            <sphereGeometry args={[0.25, 16, 16]} />
            <meshBasicMaterial 
              color={color}
              transparent
              opacity={0.3}
            />
          </mesh>
        )}
        
        {/* Name label */}
        <Text
          position={[0, 0.5, 0]}
          fontSize={0.15}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {ingredient.name}
        </Text>
      </group>
      
      {/* Ground indicator */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}

// ============================================
// Generic Item Pickup
// ============================================

interface ItemPickupProps {
  item: Item;
  position: [number, number, number];
  onPickup: (item: Item) => void;
}

export function ItemPickup({ item, position, onPickup }: ItemPickupProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  
  const playerPosition = usePlayerStore((s) => s.position);
  const showInteractionPrompt = useGameStore((s) => s.showInteractionPrompt);
  const hideInteractionPrompt = useGameStore((s) => s.hideInteractionPrompt);
  
  // Rarity colors
  const rarityColors: Record<string, string> = {
    common: '#FFFFFF',
    uncommon: '#32CD32',
    rare: '#4A90D9',
    legendary: '#FFD700',
  };
  
  const color = rarityColors[item.rarity];
  
  useFrame((state) => {
    if (!meshRef.current || isCollected) return;
    
    meshRef.current.position.y = position[1] + 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    meshRef.current.rotation.y += 0.02;
    
    const distance = Math.sqrt(
      Math.pow(position[0] - playerPosition[0], 2) +
      Math.pow(position[2] - playerPosition[2], 2)
    );
    
    const inRange = distance < 2.8;
    
    if (inRange !== isHighlighted) {
      setIsHighlighted(inRange);
      if (inRange) {
        showInteractionPrompt(`Pick up ${item.name}`, item.itemId, 'item');
      } else {
        hideInteractionPrompt();
      }
    }
  });
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'KeyE' || e.code === 'Space') && isHighlighted && !isCollected) {
        setIsCollected(true);
        hideInteractionPrompt();
        onPickup(item);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHighlighted, isCollected, item, onPickup, hideInteractionPrompt]);
  
  if (isCollected) return null;
  
  return (
    <group position={position}>
      <group ref={meshRef}>
        <RoundedBox
          args={[0.25, 0.25, 0.25]}
          radius={0.04}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial 
            color={color}
            emissive={isHighlighted ? color : '#000000'}
            emissiveIntensity={isHighlighted ? 0.5 : 0}
            roughness={0.5}
            metalness={item.rarity === 'legendary' ? 0.5 : 0}
          />
        </RoundedBox>
        
        {isHighlighted && (
          <mesh scale={1.5}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} />
          </mesh>
        )}
        
        <Text
          position={[0, 0.45, 0]}
          fontSize={0.12}
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {item.name}
        </Text>
      </group>
    </group>
  );
}

// ============================================
// Interactable Manager
// ============================================

interface InteractableManagerProps {
  ingredients: IngredientNode[];
  regionId: string;
  seed: string;
  onIngredientPickup: (ingredientId: string) => void;
  collectedItemIds?: string[];
  mapWidth?: number;
  mapHeight?: number;
}

// Seeded random for consistent spawns
function seededRandom(seed: string) {
  let hash = 0;
  
  // Handle empty or invalid seed
  if (!seed || seed.length === 0) {
    seed = 'default-seed';
  }
  
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  // Ensure hash is not zero
  if (hash === 0) hash = 1;
  
  return function() {
    hash = Math.sin(hash) * 10000;
    const result = hash - Math.floor(hash);
    // Ensure we never return NaN
    return Number.isFinite(result) ? result : 0.5;
  };
}

// Get spawn positions for ingredients based on their gather method
function getIngredientSpawnPositions(
  ingredients: IngredientNode[],
  regionId: string,
  seed: string,
  collectedItemIds: string[] = [],
  mapWidth: number = 40,
  mapHeight: number = 40
) {
  // Filter ingredients for this region that can be picked up
  const spawnableIngredients = ingredients.filter(i => 
    i.regionId === regionId &&
    (i.gatherMethod === 'pickup' || i.gatherMethod === 'harvest') &&
    !collectedItemIds.includes(i.ingredientId)
  );
  
  // Generate spawn positions with validation
  return spawnableIngredients.map((ingredient, index) => {
    const random = seededRandom(seed + ingredient.ingredientId + index);
    
    // Spread ingredients across the map, avoiding center (player spawn)
    const angle = random() * Math.PI * 2;
    const distance = 8 + random() * (Math.min(mapWidth, mapHeight) / 2 - 10);
    
    let x = Math.cos(angle) * distance;
    let z = Math.sin(angle) * distance;
    
    // Keep within bounds
    x = Math.max(-mapWidth / 2 + 3, Math.min(mapWidth / 2 - 3, x));
    z = Math.max(-mapHeight / 2 + 3, Math.min(mapHeight / 2 - 3, z));
    
    // Ensure valid numbers
    if (!Number.isFinite(x)) x = 5;
    if (!Number.isFinite(z)) z = 5;
    
    return {
      ingredient,
      position: [x, 0, z] as [number, number, number],
    };
  });
}

// Export spawn positions for mini-map use
export function useIngredientSpawnPositions(
  ingredients: IngredientNode[],
  regionId: string,
  seed: string,
  collectedItemIds: string[] = [],
  mapWidth?: number,
  mapHeight?: number
) {
  return getIngredientSpawnPositions(
    ingredients, 
    regionId, 
    seed, 
    collectedItemIds, 
    mapWidth, 
    mapHeight
  );
}

export function InteractableManager({ 
  ingredients, 
  regionId, 
  seed, 
  onIngredientPickup,
  collectedItemIds = [],
  mapWidth = 40,
  mapHeight = 40,
}: InteractableManagerProps) {
  const spawnPositions = getIngredientSpawnPositions(
    ingredients,
    regionId,
    seed,
    collectedItemIds,
    mapWidth,
    mapHeight
  );
  
  // Don't render if no valid positions
  if (spawnPositions.length === 0) return null;
  
  return (
    <group>
      {spawnPositions.map(({ ingredient, position }) => (
        <IngredientPickup
          key={ingredient.ingredientId}
          ingredient={ingredient}
          position={position}
          onPickup={onIngredientPickup}
        />
      ))}
    </group>
  );
}

export default InteractableManager;

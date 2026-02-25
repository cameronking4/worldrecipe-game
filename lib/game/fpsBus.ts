import * as THREE from 'three';

export interface ShootEvent {
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  timestamp: number;
}

type ShootListener = (event: ShootEvent) => void;

const shootListeners = new Set<ShootListener>();

export function emitShoot(event: ShootEvent) {
  shootListeners.forEach((listener) => {
    listener(event);
  });
}

export function onShoot(listener: ShootListener) {
  shootListeners.add(listener);
  return () => shootListeners.delete(listener);
}

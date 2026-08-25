import type { SeededRandom } from "./types";

export function hashSeed(value: string | number) {
  const text = String(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed: string | number): SeededRandom {
  let state = hashSeed(seed) || 0x6d2b79f5;
  const next = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    pick: <T,>(values: readonly T[]) => values[Math.min(values.length - 1, Math.floor(next() * values.length))],
  };
}

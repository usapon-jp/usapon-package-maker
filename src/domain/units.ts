export type Millimeters = number;

export const A4_PORTRAIT = Object.freeze({ widthMm: 210, heightMm: 297 });
export const DEFAULT_SAFE_MARGIN_MM = 5;

export function roundMm(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

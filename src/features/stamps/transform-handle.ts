type Point = { x: number; y: number };

export type StampHandleMode = "rotate" | "scale";

/** Movement (in mm) below which a rotate-handle press counts as a tap (= 90° turn). */
export const HANDLE_TAP_TOLERANCE_MM = 1.5;
const SNAP_DEGREES = 4;

export function normalizeDegrees(degrees: number) {
  return ((degrees % 360) + 360) % 360;
}

/** Snap to 0/90/180/270 when the drag lands close, so straight placement stays easy. */
export function snapRotation(degrees: number) {
  const normalized = normalizeDegrees(degrees);
  const nearest = Math.round(normalized / 90) * 90;
  return Math.abs(normalized - nearest) <= SNAP_DEGREES ? normalizeDegrees(nearest) : Math.round(normalized);
}

/**
 * One-finger rotate/scale around the stamp center, driven by a corner handle.
 * Both values are relative to where the finger started, so grabbing the handle never jumps.
 */
export class StampHandleGesture {
  private start: { id: string; mode: StampHandleMode; center: Point; point: Point; width: number; rotation: number } | null = null;
  private moved = false;
  get active() { return this.start !== null; }
  get mode() { return this.start?.mode ?? null; }
  get id() { return this.start?.id ?? null; }
  begin(mode: StampHandleMode, stamp: { id: string; xMm: number; yMm: number; widthMm: number; rotationDeg: number }, point: Point) {
    this.start = { id: stamp.id, mode, center: { x: stamp.xMm, y: stamp.yMm }, point, width: stamp.widthMm, rotation: stamp.rotationDeg };
    this.moved = false;
  }
  move(point: Point): { id: string; widthMm?: number; rotationDeg?: number } | null {
    const start = this.start;
    if (!start) return null;
    if (!this.moved && Math.hypot(point.x - start.point.x, point.y - start.point.y) < HANDLE_TAP_TOLERANCE_MM) return null;
    this.moved = true;
    const from = { x: start.point.x - start.center.x, y: start.point.y - start.center.y };
    const to = { x: point.x - start.center.x, y: point.y - start.center.y };
    if (start.mode === "scale") {
      const ratio = Math.hypot(to.x, to.y) / Math.max(0.5, Math.hypot(from.x, from.y));
      return { id: start.id, widthMm: Math.min(200, Math.max(2, Math.round(start.width * ratio * 10) / 10)) };
    }
    const delta = (Math.atan2(to.y, to.x) - Math.atan2(from.y, from.x)) * 180 / Math.PI;
    return { id: start.id, rotationDeg: snapRotation(start.rotation + delta) };
  }
  /** Returns true when the press ended without dragging (a tap). */
  end() {
    const tapped = this.start !== null && !this.moved;
    this.start = null;
    this.moved = false;
    return tapped;
  }
  cancel() { this.start = null; this.moved = false; }
}

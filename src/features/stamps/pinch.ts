type Point = { x: number; y: number };

/** One gesture owns its pointers until both fingers lift, preventing a drag jump. */
export class StampPinch {
  private points = new Map<number, Point>();
  private start: { id: string; width: number; distance: number } | null = null;
  private candidate: { id: string; width: number } | null = null;
  private pinched = false;
  get active() { return this.points.size > 0; }
  get suppressDrag() { return this.pinched; }
  down(pointerId: number, point: Point, stamp?: { id: string; width: number }) {
    if (!this.points.size) {
      if (!stamp) return false;
      this.candidate = stamp;
      this.pinched = false;
    }
    if (this.points.size >= 2) return this.pinched;
    this.points.set(pointerId, point);
    if (this.points.size === 2 && this.candidate) {
      const [a, b] = [...this.points.values()];
      this.start = { ...this.candidate, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
      this.pinched = true;
    }
    return this.pinched;
  }
  move(pointerId: number, point: Point) {
    if (!this.points.has(pointerId)) return null;
    this.points.set(pointerId, point);
    if (!this.start || this.points.size !== 2) return null;
    const [a, b] = [...this.points.values()];
    return { id: this.start.id, widthMm: Math.min(200, Math.max(2, this.start.width * Math.hypot(a.x - b.x, a.y - b.y) / this.start.distance)) };
  }
  up(pointerId: number) {
    this.points.delete(pointerId);
    this.start = null;
    if (!this.points.size) { this.pinched = false; this.candidate = null; }
  }
  cancel() { this.points.clear(); this.start = null; this.candidate = null; this.pinched = false; }
}

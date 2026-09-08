import { describe, it, expect } from "vitest";
import { StampPinch } from "../src/features/stamps/pinch";

describe("stamp pinch", () => {
  it("only starts on a stamp and doubles or halves its width", () => {
    const gesture = new StampPinch();
    gesture.down(1, { x: 0, y: 0 });
    expect(gesture.active).toBe(false);
    gesture.down(1, { x: 0, y: 0 }, { id: "a", width: 40 });
    expect(gesture.down(2, { x: 100, y: 0 })).toBe(true);
    expect(gesture.move(2, { x: 200, y: 0 })).toEqual({ id: "a", widthMm: 80 });
    expect(gesture.move(2, { x: 50, y: 0 })).toEqual({ id: "a", widthMm: 20 });
  });
  it("clamps width and ignores unrelated pointers", () => {
    const gesture = new StampPinch();
    gesture.down(1, { x: 0, y: 0 }, { id: "a", width: 40 });
    gesture.down(2, { x: 100, y: 0 });
    expect(gesture.move(3, { x: 500, y: 0 })).toBeNull();
    expect(gesture.move(2, { x: 1000, y: 0 })?.widthMm).toBe(200);
    expect(gesture.move(2, { x: 0, y: 0 })?.widthMm).toBe(2);
  });
  it("does not jump into dragging when one finger lifts; cancel permits a new gesture", () => {
    const gesture = new StampPinch();
    gesture.down(1, { x: 0, y: 0 }, { id: "a", width: 40 });
    gesture.down(2, { x: 100, y: 0 });
    gesture.up(2);
    expect(gesture.suppressDrag).toBe(true);
    expect(gesture.move(1, { x: 20, y: 0 })).toBeNull();
    gesture.up(1);
    expect(gesture.suppressDrag).toBe(false);
    gesture.down(4, { x: 0, y: 0 }, { id: "b", width: 20 });
    gesture.cancel();
    expect(gesture.active).toBe(false);
  });
});

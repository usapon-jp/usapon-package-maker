import { describe, expect, it } from "vitest";
import { snapRotation, StampHandleGesture } from "../src/features/stamps/transform-handle";

const stamp = { id: "a", xMm: 50, yMm: 50, widthMm: 20, rotationDeg: 0 };

describe("stamp corner handles (one finger)", () => {
  it("scales by the finger's distance from the stamp center", () => {
    const gesture = new StampHandleGesture();
    gesture.begin("scale", stamp, { x: 60, y: 60 });
    expect(gesture.move({ x: 70, y: 70 })).toEqual({ id: "a", widthMm: 40 });
    expect(gesture.move({ x: 55, y: 55 })).toEqual({ id: "a", widthMm: 10 });
    expect(gesture.move({ x: 500, y: 500 })?.widthMm).toBe(200);
    expect(gesture.move({ x: 50.1, y: 50.1 })?.widthMm).toBe(2);
  });

  it("rotates by the angle swept around the center, relative to the start", () => {
    const gesture = new StampHandleGesture();
    gesture.begin("rotate", { ...stamp, rotationDeg: 10 }, { x: 60, y: 40 });
    // top-right (-45°) → bottom-right (+45°) = +90°
    expect(gesture.move({ x: 60, y: 60 })).toEqual({ id: "a", rotationDeg: 100 });
    // a 30° sweep stays free (no snap)
    const angle = (-45 + 30) * Math.PI / 180;
    expect(gesture.move({ x: 50 + 14 * Math.cos(angle), y: 50 + 14 * Math.sin(angle) })?.rotationDeg).toBe(40);
  });

  it("snaps near straight angles and wraps into 0-359", () => {
    expect(snapRotation(87)).toBe(90);
    expect(snapRotation(-3)).toBe(0);
    expect(snapRotation(358)).toBe(0);
    expect(snapRotation(-20)).toBe(340);
    expect(snapRotation(45.4)).toBe(45);
  });

  it("treats a press without movement as a tap", () => {
    const gesture = new StampHandleGesture();
    gesture.begin("rotate", stamp, { x: 60, y: 40 });
    expect(gesture.move({ x: 60.5, y: 40.5 })).toBeNull();
    expect(gesture.end()).toBe(true);
    expect(gesture.active).toBe(false);
    gesture.begin("rotate", stamp, { x: 60, y: 40 });
    gesture.move({ x: 60, y: 50 });
    expect(gesture.end()).toBe(false);
  });
});

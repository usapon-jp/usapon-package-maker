import { describe, expect, it } from "vitest";

import type { BoxInput, Point, PolygonShape } from "../src/domain/boxes/types";
import { calculateEnvelopeMetrics, generateEnvelope } from "../src/domain/boxes/stationery";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const baseInput: Omit<BoxInput, "widthMm" | "heightMm"> = {
  type: "envelope-v1",
  depthMm: 1,
  paperThicknessMm: 0.12,
  glueFlapMm: 12,
};

function pointInPolygon(point: Point, polygon: PolygonShape) {
  let inside = false;
  for (let index = 0, previous = polygon.points.length - 1; index < polygon.points.length; previous = index++) {
    const currentPoint = polygon.points[index];
    const previousPoint = polygon.points[previous];
    const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function overlapFraction(source: PolygonShape, target: PolygonShape) {
  const xs = source.points.map((point) => point.x);
  const ys = source.points.map((point) => point.y);
  const bounds = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  let sourceSamples = 0;
  let overlapSamples = 0;
  for (let row = 0; row < 30; row += 1) {
    for (let column = 0; column < 30; column += 1) {
      const point = {
        x: bounds.left + (bounds.right - bounds.left) * ((column + 0.5) / 30),
        y: bounds.top + (bounds.bottom - bounds.top) * ((row + 0.5) / 30),
      };
      if (!pointInPolygon(point, source)) continue;
      sourceSamples += 1;
      if (pointInPolygon(point, target)) overlapSamples += 1;
    }
  }
  return overlapSamples / sourceSamples;
}

function foldLeft(polygon: PolygonShape, foldX: number, top: number): PolygonShape {
  return { ...polygon, points: polygon.points.map((point) => ({ x: foldX - point.x, y: point.y - top })) };
}

function foldRight(polygon: PolygonShape, left: number, foldX: number, top: number): PolygonShape {
  return { ...polygon, points: polygon.points.map((point) => ({ x: foldX * 2 - point.x - left, y: point.y - top })) };
}

function foldBottom(polygon: PolygonShape, left: number, top: number, foldY: number): PolygonShape {
  return { ...polygon, points: polygon.points.map((point) => ({ x: point.x - left, y: foldY * 2 - point.y - top })) };
}

describe("ダイヤ貼封筒の幾何計算", () => {
  it.each([
    [91, 55, "safe"],
    [120, 80, "safe"],
    [162, 114, "overflow"],
    [176, 120, "overflow"],
  ] as const)("完成 %s×%smm から各面と展開外寸を再計算する", (width, height, fitStatus) => {
    const input = { ...baseInput, widthMm: width, heightMm: height };
    const metrics = calculateEnvelopeMetrics(input);
    const geometry = generateEnvelope(input);

    expect(geometry.panels[0]).toMatchObject({ id: "panel-envelope-front", width, height });
    expect(geometry.bounds.widthMm).toBeCloseTo(width + metrics.sideFlapMm * 2, 5);
    expect(geometry.bounds.heightMm).toBeCloseTo(height + metrics.topFlapMm + metrics.bottomFlapMm, 5);
    expect(metrics.sideSeamGapMm).toBeGreaterThanOrEqual(3);
    expect(metrics.sideSeamGapMm).toBeLessThanOrEqual(6);
    expect(metrics.bottomFlapMm / height).toBeGreaterThanOrEqual(0.56);
    expect(metrics.topFlapMm / height).toBeGreaterThanOrEqual(0.6);
    expect(evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm).status).toBe(fitStatus);
  });

  it("左右フラップが中央でほぼ接し、下フラップの接着帯が両側へ重なる", () => {
    const geometry = generateEnvelope({ ...baseInput, widthMm: 162, heightMm: 114 });
    const front = geometry.panels[0];
    const left = geometry.clipPolygons.find((polygon) => polygon.id === "envelope-left-flap")!;
    const right = geometry.clipPolygons.find((polygon) => polygon.id === "envelope-right-flap")!;
    const foldedLeft = foldLeft(left, front.x, front.y);
    const foldedRight = foldRight(right, front.x, front.x + front.width, front.y);

    expect(Math.max(...foldedLeft.points.map((point) => point.x))).toBeCloseTo(geometry.envelope!.sideFlapMm, 5);
    expect(Math.min(...foldedRight.points.map((point) => point.x))).toBeCloseTo(front.width - geometry.envelope!.sideFlapMm, 5);
    expect(front.width - geometry.envelope!.sideFlapMm * 2).toBeCloseTo(geometry.envelope!.sideSeamGapMm, 5);

    const bottom = geometry.clipPolygons.find((polygon) => polygon.id === "envelope-bottom-flap")!;
    const foldedBottom = foldBottom(bottom, front.x, front.y, front.y + front.height);
    const foldedGlue = [
      foldLeft(geometry.layers.glue[0], front.x, front.y),
      foldRight(geometry.layers.glue[1], front.x, front.x + front.width, front.y),
    ];
    expect(overlapFraction(foldedGlue[0], foldedBottom)).toBeGreaterThan(0.45);
    expect(overlapFraction(foldedGlue[1], foldedBottom)).toBeGreaterThan(0.45);
  });

  it("下フラップが中央より上まで届き、上フラップも中央を越えて正常に閉じる", () => {
    const geometry = generateEnvelope({ ...baseInput, widthMm: 162, heightMm: 114 });
    const metrics = geometry.envelope!;
    expect(geometry.input.heightMm - metrics.bottomFlapMm).toBeLessThan(geometry.input.heightMm / 2);
    expect(metrics.topFlapMm).toBeGreaterThan(geometry.input.heightMm / 2);
  });
});

describe("洋形2号カマス貼りの幾何計算", () => {
  it("A4内へ実寸で収まり、A/B/Cと左右のりしろを生成する", () => {
    const geometry = generateEnvelope({ ...baseInput, widthMm: 162, heightMm: 114, envelopeConstruction: "kamasu" });
    expect(geometry.bounds).toEqual({ x: 0, y: 0, widthMm: 186, heightMm: 258 });
    expect(evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm)).toMatchObject({ status: "safe", orientation: "portrait" });
    expect(geometry.panels.slice(0, 3)).toMatchObject([
      { id: "panel-envelope-front", x: 12, y: 30, width: 162, height: 114 },
      { id: "panel-envelope-flap", x: 12, y: 0, width: 162, height: 30 },
      { id: "panel-envelope-back", x: 12, y: 144, width: 162, height: 114 },
    ]);
    expect(geometry.layers.fold.map((line) => line.id)).toEqual(["envelope-flap-fold", "envelope-front-back-fold", "envelope-left-glue-fold", "envelope-right-glue-fold"]);
    expect(geometry.layers.glue).toHaveLength(2);
  });
});

import type { BoxGenerator, BoxInput, DielineGeometry, Line, Panel, Point, PolygonShape } from "./types";

function polygon(id: string, points: Point[]): PolygonShape {
  return { id, points };
}

function rectangle(id: string, x: number, y: number, width: number, height: number) {
  return polygon(id, [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }]);
}

function outline(points: Point[]) {
  return `M ${points.map(({ x, y }) => `${x},${y}`).join(" L ")} Z`;
}

function edgeGlueStrip(id: string, from: Point, to: Point, toward: Point, width: number): PolygonShape {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const unit = { x: dx / length, y: dy / length };
  let normal = { x: -unit.y, y: unit.x };
  const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  if (normal.x * (toward.x - midpoint.x) + normal.y * (toward.y - midpoint.y) < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }
  const trim = Math.min(length * 0.25, width * 2);
  const start = { x: from.x + unit.x * trim, y: from.y + unit.y * trim };
  const end = { x: to.x - unit.x * trim, y: to.y - unit.y * trim };
  const offset = { x: normal.x * width, y: normal.y * width };
  return polygon(id, [start, end, { x: end.x + offset.x, y: end.y + offset.y }, { x: start.x + offset.x, y: start.y + offset.y }]);
}

function centerGuides(panel: Panel): Line[] {
  return [
    { id: `${panel.id}-center-x`, from: { x: panel.x + panel.width / 2, y: panel.y }, to: { x: panel.x + panel.width / 2, y: panel.y + panel.height } },
    { id: `${panel.id}-center-y`, from: { x: panel.x, y: panel.y + panel.height / 2 }, to: { x: panel.x + panel.width, y: panel.y + panel.height / 2 } },
  ];
}

function assertDimensions(input: BoxInput) {
  if (![input.widthMm, input.heightMm].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("用紙の幅と高さは0より大きいmm値で指定してください。");
  }
}

export const generateFlatStationery: BoxGenerator = (input): DielineGeometry => {
  assertDimensions(input);
  const { widthMm: width, heightMm: height } = input;
  const panel: Panel = { id: "panel-front", label: input.type === "letter-paper-v1" ? "便箋" : "カード表面", x: 0, y: 0, width, height };
  const surface = rectangle("stationery-surface", 0, 0, width, height);
  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: width, heightMm: height },
    bodyTopMm: 0,
    bodyBottomMm: height,
    panels: [panel],
    clipPolygons: [surface],
    layers: { cut: [{ id: "stationery-outline", d: outline(surface.points) }], fold: [], foldover: [], glue: [], guide: centerGuides(panel) },
  };
};

export const generateEnvelope: BoxGenerator = (input): DielineGeometry => {
  assertDimensions(input);
  const { widthMm: width, heightMm: height } = input;
  const sideFlap = Math.min(Math.round(height / 2), Math.round(width * 0.36));
  const topFlap = Math.min(40, Math.round(height * 0.35));
  const bottomFlap = Math.min(46, Math.round(height * 0.4));
  const glueWidth = Math.min(Math.max(input.glueFlapMm, 8), 12);
  const x0 = sideFlap;
  const x1 = x0 + width;
  const y0 = topFlap;
  const y1 = y0 + height;
  const centerX = x0 + width / 2;
  const centerY = y0 + height / 2;
  const bottomPoint = { x: centerX, y: y1 + bottomFlap };
  const front: Panel = { id: "panel-envelope-front", label: "封筒の表面", x: x0, y: y0, width, height };
  const frontSurface = rectangle("envelope-front", x0, y0, width, height);
  const top = polygon("envelope-top-flap", [{ x: x0, y: y0 }, { x: centerX, y: 0 }, { x: x1, y: y0 }]);
  const bottom = polygon("envelope-bottom-flap", [{ x: x0, y: y1 }, { x: x1, y: y1 }, bottomPoint]);
  const left = polygon("envelope-left-flap", [{ x: x0, y: y0 }, { x: 0, y: centerY }, { x: x0, y: y1 }]);
  const right = polygon("envelope-right-flap", [{ x: x1, y: y0 }, { x: x1 + sideFlap, y: centerY }, { x: x1, y: y1 }]);
  const bottomCenter = { x: centerX, y: y1 + bottomFlap / 3 };
  const leftGlue = edgeGlueStrip("envelope-bottom-left-glue", bottom.points[0], bottomPoint, bottomCenter, glueWidth);
  const rightGlue = edgeGlueStrip("envelope-bottom-right-glue", bottom.points[1], bottomPoint, bottomCenter, glueWidth);
  const outerPoints = [top.points[1], top.points[2], right.points[1], right.points[2], bottom.points[2], bottom.points[0], left.points[1], left.points[0]];
  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: width + sideFlap * 2, heightMm: topFlap + height + bottomFlap },
    bodyTopMm: y0,
    bodyBottomMm: y1,
    panels: [front, { id: "panel-envelope-back", label: "背面（下フラップ）", x: x0, y: y1, width, height: bottomFlap }],
    clipPolygons: [frontSurface, top, bottom, left, right],
    layers: {
      cut: [{ id: "envelope-outline", d: outline(outerPoints) }],
      fold: [
        { id: "envelope-top-fold", from: { x: x0, y: y0 }, to: { x: x1, y: y0 } },
        { id: "envelope-bottom-fold", from: { x: x0, y: y1 }, to: { x: x1, y: y1 } },
        { id: "envelope-left-fold", from: { x: x0, y: y0 }, to: { x: x0, y: y1 } },
        { id: "envelope-right-fold", from: { x: x1, y: y0 }, to: { x: x1, y: y1 } },
      ],
      foldover: [],
      glue: [leftGlue, rightGlue],
      guide: centerGuides(front),
    },
  };
};

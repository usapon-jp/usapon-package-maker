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
  const sideFlap = Math.min(Math.max(input.glueFlapMm, 10), width / 4);
  const topFlap = Math.min(32, height * 0.38);
  const bottomFlap = Math.min(height - 8, Math.max(48, height * 0.78));
  const inset = 5;
  const x0 = sideFlap;
  const x1 = x0 + width;
  const y0 = topFlap;
  const y1 = y0 + height;
  const front: Panel = { id: "panel-envelope-front", label: "封筒の表面", x: x0, y: y0, width, height };
  const frontSurface = rectangle("envelope-front", x0, y0, width, height);
  const top = polygon("envelope-top-flap", [{ x: x0, y: y0 }, { x: x0 + inset * 2, y: 0 }, { x: x1 - inset * 2, y: 0 }, { x: x1, y: y0 }]);
  const bottom = polygon("envelope-bottom-flap", [{ x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1 - inset, y: y1 + bottomFlap }, { x: x0 + inset, y: y1 + bottomFlap }]);
  const left = polygon("envelope-left-glue", [{ x: x0, y: y0 }, { x: 0, y: y0 + inset }, { x: 0, y: y1 - inset }, { x: x0, y: y1 }]);
  const right = polygon("envelope-right-glue", [{ x: x1, y: y0 }, { x: x1 + sideFlap, y: y0 + inset }, { x: x1 + sideFlap, y: y1 - inset }, { x: x1, y: y1 }]);
  const outerPoints = [top.points[1], top.points[2], top.points[3], right.points[1], right.points[2], right.points[3], bottom.points[2], bottom.points[3], bottom.points[0], left.points[2], left.points[1], left.points[0]];
  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: width + sideFlap * 2, heightMm: topFlap + height + bottomFlap },
    bodyTopMm: y0,
    bodyBottomMm: y1,
    panels: [front, { id: "panel-envelope-back", label: "背面・折り上げ", x: x0, y: y1, width, height: bottomFlap }],
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
      glue: [left, right],
      guide: centerGuides(front),
    },
  };
};

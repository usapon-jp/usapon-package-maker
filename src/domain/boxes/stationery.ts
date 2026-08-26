import type { BoxGenerator, BoxInput, DielineDocument, DielineGeometry, EnvelopeMetrics, Line, Panel, Point, PolygonShape, StationerySetSelection } from "./types";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
  const trim = Math.min(length * 0.08, Math.max(4, width * 0.6));
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
    layers: {
      cut: [{ id: "stationery-outline", d: outline(surface.points) }],
      fold: input.type === "letter-paper-v1"
        ? [{ id: "letter-paper-center-fold", from: { x: 0, y: height / 2 }, to: { x: width, y: height / 2 } }]
        : [],
      foldover: [],
      glue: [],
      guide: centerGuides(panel),
    },
  };
};

/**
 * ハート社の洋2ダイヤ貼（仕上162×114+フタ70、展開320×249mm）を基準に、
 * 完成寸法から各フラップを個別に再計算する。外寸を先に決めて余りを配らない。
 */
export function calculateEnvelopeMetrics(input: Pick<BoxInput, "widthMm" | "heightMm" | "glueFlapMm">): EnvelopeMetrics {
  const width = input.widthMm;
  const height = input.heightMm;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("封筒の完成幅と完成高さは0より大きいmm値で指定してください。");
  }
  const sideSeamGapMm = clamp(round(width * (4 / 162)), 3, 6);
  return {
    finishedWidthMm: width,
    finishedHeightMm: height,
    topFlapMm: round(height * (70 / 114)),
    bottomFlapMm: round(height * (65 / 114)),
    sideFlapMm: round((width - sideSeamGapMm) / 2),
    sideSeamGapMm,
    glueWidthMm: clamp(round(input.glueFlapMm), 8, 15),
    tipFlatMm: clamp(round(height * (8 / 114)), 4, 10),
  };
}

export function calculateLetterPaperSize(input: Pick<BoxInput, "widthMm" | "heightMm">) {
  const sideClearanceMm = clamp(round(Math.min(input.widthMm, input.heightMm) * 0.03), 3, 5);
  const foldedWidthMm = round(input.widthMm - sideClearanceMm * 2);
  const foldedHeightMm = round(input.heightMm - sideClearanceMm * 2);
  return {
    widthMm: foldedWidthMm,
    heightMm: round(foldedHeightMm * 2),
    foldedWidthMm,
    foldedHeightMm,
    sideClearanceMm,
    foldYmm: foldedHeightMm,
  };
}

export function calculateMiniCardSize(input: Pick<BoxInput, "widthMm" | "heightMm">) {
  const aspectRatio = 91 / 55;
  const widthFromEnvelope = input.widthMm * 0.56;
  const widthFromHeight = input.heightMm * 0.48 * aspectRatio;
  const widthMm = round(Math.max(35, Math.min(widthFromEnvelope, widthFromHeight, input.widthMm - 12)));
  const heightMm = round(widthMm / aspectRatio);
  return { widthMm, heightMm, clearanceXmm: round((input.widthMm - widthMm) / 2), clearanceYmm: round((input.heightMm - heightMm) / 2) };
}

export function stationerySelectionIncludes(selection: StationerySetSelection, item: "letter" | "card") {
  return selection === "envelope-letter-card" || selection === `envelope-${item}`;
}

export function generateStationerySetDocument(input: BoxInput, selection: StationerySetSelection): DielineDocument {
  if (input.type !== "envelope-v1") throw new TypeError("レターセットは封筒の完成寸法から生成してください。");
  const pages: DielineDocument["pages"] = [{ id: "main", label: "封筒", geometry: generateEnvelope(input) }];
  if (stationerySelectionIncludes(selection, "letter")) {
    const size = calculateLetterPaperSize(input);
    const letterInput: BoxInput = { ...input, type: "letter-paper-v1", widthMm: size.widthMm, heightMm: size.heightMm };
    pages.push({ id: "letter", label: "便箋（2つ折り）", geometry: generateFlatStationery(letterInput) });
  }
  if (stationerySelectionIncludes(selection, "card")) {
    const size = calculateMiniCardSize(input);
    const cardInput: BoxInput = { ...input, type: "mini-card-v1", widthMm: size.widthMm, heightMm: size.heightMm };
    pages.push({ id: "card", label: "ミニカード", geometry: generateFlatStationery(cardInput) });
  }
  return { type: input.type, input, pages };
}

export const generateEnvelope: BoxGenerator = (input): DielineGeometry => {
  assertDimensions(input);
  const { widthMm: width, heightMm: height } = input;
  const envelope = calculateEnvelopeMetrics(input);
  const { sideFlapMm: sideFlap, topFlapMm: topFlap, bottomFlapMm: bottomFlap, glueWidthMm: glueWidth, tipFlatMm: tipFlat } = envelope;
  const x0 = sideFlap;
  const x1 = x0 + width;
  const y0 = topFlap;
  const y1 = y0 + height;
  const centerX = x0 + width / 2;
  const centerY = y0 + height / 2;
  const shoulder = clamp(round(height * 0.08), 5, 12);
  const topRise = round(topFlap * 0.14);
  const bottomDrop = round(bottomFlap * 0.14);
  const front: Panel = { id: "panel-envelope-front", label: "封筒の表面", x: x0, y: y0, width, height };
  const frontSurface = rectangle("envelope-front", x0, y0, width, height);
  const top = polygon("envelope-top-flap", [
    { x: x0, y: y0 },
    { x: x0 + shoulder, y: y0 - topRise },
    { x: centerX - tipFlat / 2, y: 0 },
    { x: centerX + tipFlat / 2, y: 0 },
    { x: x1 - shoulder, y: y0 - topRise },
    { x: x1, y: y0 },
  ]);
  const bottom = polygon("envelope-bottom-flap", [
    { x: x0, y: y1 },
    { x: x1, y: y1 },
    { x: x1 - shoulder, y: y1 + bottomDrop },
    { x: centerX + tipFlat / 2, y: y1 + bottomFlap },
    { x: centerX - tipFlat / 2, y: y1 + bottomFlap },
    { x: x0 + shoulder, y: y1 + bottomDrop },
  ]);
  const left = polygon("envelope-left-flap", [
    { x: x0, y: y0 },
    { x: x0 - shoulder, y: y0 + shoulder },
    { x: 0, y: centerY - tipFlat / 2 },
    { x: 0, y: centerY + tipFlat / 2 },
    { x: x0 - shoulder, y: y1 - shoulder },
    { x: x0, y: y1 },
  ]);
  const right = polygon("envelope-right-flap", [
    { x: x1, y: y0 },
    { x: x1 + shoulder, y: y0 + shoulder },
    { x: x1 + sideFlap, y: centerY - tipFlat / 2 },
    { x: x1 + sideFlap, y: centerY + tipFlat / 2 },
    { x: x1 + shoulder, y: y1 - shoulder },
    { x: x1, y: y1 },
  ]);
  const leftFlapCenter = { x: x0 - sideFlap * 0.4, y: centerY + height * 0.18 };
  const rightFlapCenter = { x: x1 + sideFlap * 0.4, y: centerY + height * 0.18 };
  const leftGlue = edgeGlueStrip("envelope-left-side-glue", left.points[3], left.points[5], leftFlapCenter, glueWidth);
  const rightGlue = edgeGlueStrip("envelope-right-side-glue", right.points[3], right.points[5], rightFlapCenter, glueWidth);
  const outerPoints = [
    ...top.points.slice(1),
    ...right.points.slice(1),
    ...bottom.points.slice(2),
    ...left.points.slice(1, -1).reverse(),
    top.points[0],
  ];
  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: round(width + sideFlap * 2), heightMm: round(topFlap + height + bottomFlap) },
    bodyTopMm: y0,
    bodyBottomMm: y1,
    envelope,
    panels: [
      front,
      { id: "panel-envelope-top-flap", label: "封をする上フラップ", x: x0, y: 0, width, height: topFlap },
      { id: "panel-envelope-bottom-flap", label: "裏面を作る下フラップ", x: x0, y: y1, width, height: bottomFlap },
      { id: "panel-envelope-left-flap", label: "左フラップ", x: 0, y: y0, width: sideFlap, height },
      { id: "panel-envelope-right-flap", label: "右フラップ", x: x1, y: y0, width: sideFlap, height },
    ],
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

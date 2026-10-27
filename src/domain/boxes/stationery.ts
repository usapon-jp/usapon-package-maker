import type { BoxGenerator, BoxInput, DielineDocument, DielineGeometry, EnvelopeMetrics, Line, Panel, Point, PolygonShape, StationerySetSelection } from "./types";

function round(value: number, digits = 1) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function shouldShowAssemblyGuide(boxType: string, pageId: string): boolean {
  return boxType === "envelope-v1" && pageId === "main";
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

export function calculateEnvelopeMetrics(input: Pick<BoxInput, "widthMm" | "heightMm" | "glueFlapMm">): EnvelopeMetrics {
  const width = input.widthMm;
  const height = input.heightMm;
  if (![width, height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("封筒の完成幅と完成高さは0より大きいmm値で指定してください。");
  }
  const glueWidthMm = clamp(round(input.glueFlapMm), 8, 15);
  return {
    construction: "kamasu",
    finishedWidthMm: width,
    finishedHeightMm: height,
    topFlapMm: round(height * (30 / 114)),
    bottomFlapMm: height,
    sideFlapMm: glueWidthMm,
    sideSeamGapMm: 0,
    glueWidthMm,
    tipFlatMm: clamp(round(width * (6 / 162)), 4, 10),
  };
}

export function calculateLetterPaperSize(input: Pick<BoxInput, "widthMm" | "heightMm">) {
  // A4横を中央で1回切るだけで、同じ便箋が2枚できる寸法。
  // 規格A5（148×210mm）との差は幅0.5mmだけなので、封筒への収まりも保てる。
  const widthMm = 148.5;
  const heightMm = 210;
  const foldedWidthMm = widthMm;
  const foldedHeightMm = heightMm / 2;
  const sideClearanceMm = round(Math.max(0, Math.min((input.widthMm - foldedWidthMm) / 2, (input.heightMm - foldedHeightMm) / 2)));
  return {
    widthMm,
    heightMm,
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
  const width = input.widthMm;
  const height = input.heightMm;
  const envelope = calculateEnvelopeMetrics(input);
  const glue = envelope.glueWidthMm;
  const flap = envelope.topFlapMm;
  const x0 = glue;
  const x1 = x0 + width;
  const yA0 = flap;
  const yA1 = yA0 + height;
  const yC1 = yA1 + height;
  const shoulder = envelope.tipFlatMm;
  const front = rectangle("envelope-front", x0, yA0, width, height);
  const flapShape = polygon("envelope-top-flap", [
    { x: x0, y: yA0 },
    { x: x0 + shoulder, y: 0 },
    { x: x1 - shoulder, y: 0 },
    { x: x1, y: yA0 },
  ]);
  const back = rectangle("envelope-back", x0, yA1, width, height);
  const tabInset = clamp(round(height * 0.05), 4, 8);
  const leftGlue = polygon("envelope-left-side-glue", [
    { x: x0, y: yA1 }, { x: 0, y: yA1 + tabInset }, { x: 0, y: yC1 - tabInset }, { x: x0, y: yC1 },
  ]);
  const rightGlue = polygon("envelope-right-side-glue", [
    { x: x1, y: yA1 }, { x: x1 + glue, y: yA1 + tabInset }, { x: x1 + glue, y: yC1 - tabInset }, { x: x1, y: yC1 },
  ]);
  const outerPoints = [
    flapShape.points[1], flapShape.points[2], flapShape.points[3],
    { x: x1, y: yA1 }, rightGlue.points[1], rightGlue.points[2], rightGlue.points[3],
    { x: x0, y: yC1 }, leftGlue.points[2], leftGlue.points[1], { x: x0, y: yA1 }, flapShape.points[0],
  ];
  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: round(width + glue * 2), heightMm: round(flap + height * 2) },
    bodyTopMm: yA0,
    bodyBottomMm: yC1,
    envelope,
    panels: [
      { id: "panel-envelope-front", label: "B 中央", x: x0, y: yA0, width, height },
      { id: "panel-envelope-flap", label: "A フタ（完成向き）", x: x0, y: 0, width, height: flap },
      { id: "panel-envelope-back", label: "C 裏（完成向き）", x: x0, y: yA1, width, height },
      { id: "panel-envelope-left-glue", label: "のりしろ（完成時に隠れます）", x: 0, y: yA1, width: glue, height },
      { id: "panel-envelope-right-glue", label: "のりしろ（完成時に隠れます）", x: x1, y: yA1, width: glue, height },
    ],
    clipPolygons: [front, flapShape, back, leftGlue, rightGlue],
    layers: {
      cut: [{ id: "envelope-outline", d: outline(outerPoints) }],
      fold: [
        { id: "envelope-flap-fold", from: { x: x0, y: yA0 }, to: { x: x1, y: yA0 } },
        { id: "envelope-front-back-fold", from: { x: x0, y: yA1 }, to: { x: x1, y: yA1 } },
        { id: "envelope-left-glue-fold", from: { x: x0, y: yA1 }, to: { x: x0, y: yC1 } },
        { id: "envelope-right-glue-fold", from: { x: x1, y: yA1 }, to: { x: x1, y: yC1 } },
      ],
      foldover: [],
      glue: [leftGlue, rightGlue],
      guide: centerGuides({ id: "panel-envelope-front", label: "B 中央", x: x0, y: yA0, width, height }),
    },
  };
};


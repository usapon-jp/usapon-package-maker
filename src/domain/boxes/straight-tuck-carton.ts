import { clamp, roundMm } from "../units";
import type {
  BoxGenerator,
  BoxInput,
  DielineGeometry,
  Line,
  PathShape,
  Point,
  PolygonShape,
} from "./types";

const pointList = (points: Point[]) => points.map(({ x, y }) => `${roundMm(x)},${roundMm(y)}`).join(" ");

const openPath = (id: string, points: Point[]): PathShape => ({
  id,
  d: `M ${pointList(points).replaceAll(" ", " L ")}`,
});

const rectPolygon = (id: string, x: number, y: number, width: number, height: number): PolygonShape => ({
  id,
  points: [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ],
});

function assertInput(input: BoxInput) {
  const checks: Array<[string, number]> = [
    ["幅", input.widthMm],
    ["奥行", input.depthMm],
    ["高さ", input.heightMm],
    ["紙厚", input.paperThicknessMm],
    ["のりしろ", input.glueFlapMm],
  ];
  for (const [label, value] of checks) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${label}は0より大きいmm値で指定してください。`);
    }
  }
}

function flapPolygon(
  id: string,
  x: number,
  width: number,
  baseY: number,
  direction: -1 | 1,
  kind: "tuck" | "receiver" | "dust",
  coverDepth: number,
  tongueDepth: number,
  clearance: number,
): PolygonShape {
  const sideInset = kind === "dust" ? Math.min(2.2, width * 0.12) : Math.min(1.8, width * 0.05);
  const tipInset = kind === "tuck" ? clamp(width * 0.1 + clearance, 3, 10) : Math.min(width * 0.18, 5);
  const coverY = baseY + direction * coverDepth;
  const tipY = coverY + direction * (kind === "tuck" ? tongueDepth : 0);

  if (kind === "tuck") {
    return {
      id,
      points: [
        { x, y: baseY },
        { x: x + width, y: baseY },
        { x: x + width - sideInset, y: coverY },
        { x: x + width - tipInset, y: tipY },
        { x: x + tipInset, y: tipY },
        { x: x + sideInset, y: coverY },
      ],
    };
  }

  return {
    id,
    points: [
      { x, y: baseY },
      { x: x + width, y: baseY },
      { x: x + width - sideInset, y: coverY },
      { x: x + sideInset, y: coverY },
    ],
  };
}

function perimeterPath(polygon: PolygonShape): PathShape {
  const points = polygon.points;
  return openPath(`${polygon.id}-cut`, [points[0], ...points.slice(1), points[0]]);
}

export const generateStraightTuckCarton: BoxGenerator = (input): DielineGeometry => {
  assertInput(input);

  const { widthMm: width, depthMm: depth, heightMm: height, glueFlapMm: glue, paperThicknessMm } = input;
  const clearance = Math.max(0.5, paperThicknessMm * 2);
  const coverDepth = depth + paperThicknessMm;
  const tongueDepth = clamp(depth * 0.28 + clearance, 8, 15);
  const receiverDepth = clamp(depth * 0.42, 7, 18);
  const dustDepth = clamp(Math.min(width / 2 - clearance, depth * 0.66), 5, depth);
  const topExtent = coverDepth + tongueDepth;
  const bottomExtent = topExtent;
  const bodyTop = topExtent;
  const bodyBottom = bodyTop + height;

  const panelXs = [glue, glue + width, glue + width + depth, glue + width + depth + width];
  const panelWidths = [width, depth, width, depth];
  const labels = ["前面", "右側面", "背面", "左側面"];
  const bodyWidth = glue + width * 2 + depth * 2;

  const panels = panelXs.map((x, index) => ({
    id: `panel-${index}`,
    label: labels[index],
    x,
    y: bodyTop,
    width: panelWidths[index],
    height,
  }));

  const clipPolygons: PolygonShape[] = [rectPolygon("body", 0, bodyTop, bodyWidth, height)];
  const cut: PathShape[] = [
    openPath("glue-left", [
      { x: 0, y: bodyTop },
      { x: 0, y: bodyBottom },
    ]),
    openPath("glue-top", [
      { x: 0, y: bodyTop },
      { x: glue, y: bodyTop },
    ]),
    openPath("glue-bottom", [
      { x: 0, y: bodyBottom },
      { x: glue, y: bodyBottom },
    ]),
    openPath("body-right", [
      { x: bodyWidth, y: bodyTop },
      { x: bodyWidth, y: bodyBottom },
    ]),
  ];
  const fold: Line[] = [];

  panelXs.forEach((x, index) => {
    const panelWidth = panelWidths[index];
    const kind: "tuck" | "receiver" | "dust" = index === 0 ? "tuck" : index === 2 ? "receiver" : "dust";
    const flapDepth = kind === "tuck" ? coverDepth : kind === "receiver" ? receiverDepth : dustDepth;

    const topFlap = flapPolygon(
      `top-${kind}-${index}`,
      x,
      panelWidth,
      bodyTop,
      -1,
      kind,
      flapDepth,
      tongueDepth,
      clearance,
    );
    const bottomFlap = flapPolygon(
      `bottom-${kind}-${index}`,
      x,
      panelWidth,
      bodyBottom,
      1,
      kind,
      flapDepth,
      tongueDepth,
      clearance,
    );

    clipPolygons.push(topFlap, bottomFlap);
    cut.push(perimeterPath(topFlap), perimeterPath(bottomFlap));
    fold.push(
      { id: `top-base-${index}`, from: { x, y: bodyTop }, to: { x: x + panelWidth, y: bodyTop } },
      { id: `bottom-base-${index}`, from: { x, y: bodyBottom }, to: { x: x + panelWidth, y: bodyBottom } },
    );

    if (kind === "tuck") {
      const inset = Math.min(1.8, panelWidth * 0.05);
      fold.push(
        {
          id: `top-tuck-fold-${index}`,
          from: { x: x + inset, y: bodyTop - coverDepth },
          to: { x: x + panelWidth - inset, y: bodyTop - coverDepth },
        },
        {
          id: `bottom-tuck-fold-${index}`,
          from: { x: x + inset, y: bodyBottom + coverDepth },
          to: { x: x + panelWidth - inset, y: bodyBottom + coverDepth },
        },
      );
    }
  });

  const verticalFolds = [glue, glue + width, glue + width + depth, glue + width + depth + width];
  verticalFolds.forEach((x, index) => {
    fold.push({
      id: `body-fold-${index}`,
      from: { x, y: bodyTop },
      to: { x, y: bodyBottom },
    });
  });

  const guide: Line[] = panels.flatMap((panel) => [
    {
      id: `${panel.id}-center-x`,
      from: { x: panel.x + panel.width / 2, y: panel.y },
      to: { x: panel.x + panel.width / 2, y: panel.y + panel.height },
    },
    {
      id: `${panel.id}-center-y`,
      from: { x: panel.x, y: panel.y + panel.height / 2 },
      to: { x: panel.x + panel.width, y: panel.y + panel.height / 2 },
    },
  ]);

  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: roundMm(bodyWidth), heightMm: roundMm(height + topExtent + bottomExtent) },
    bodyTopMm: roundMm(bodyTop),
    bodyBottomMm: roundMm(bodyBottom),
    panels,
    clipPolygons,
    layers: {
      cut,
      fold,
      glue: [rectPolygon("glue-region", 0, bodyTop, glue, height)],
      guide,
    },
  };
};

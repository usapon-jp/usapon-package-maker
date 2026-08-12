import { clamp, roundMm } from "../units";
import type {
  BoxInput,
  DielineDocument,
  DielineGeometry,
  Line,
  Panel,
  PathShape,
  Point,
  PolygonShape,
} from "./types";

const pathThrough = (id: string, points: Point[]): PathShape => ({
  id,
  d: `M ${points.map(({ x, y }) => `${roundMm(x)},${roundMm(y)}`).join(" L ")}`,
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
    ["高さ", input.heightMm],
    ["深さ", input.depthMm],
    ["紙厚", input.paperThicknessMm],
    ["のりしろ", input.glueFlapMm],
    ["蓋の深さ", input.lidDepthMm ?? input.depthMm],
    ["蓋の片側余裕", input.lidClearanceMm ?? 0.6],
    ["側面の折り返し", input.foldoverMm ?? 25],
  ];
  for (const [label, value] of checks) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError(`${label}は0より大きいmm値で指定してください。`);
    }
  }
}

function panelGuides(panels: Panel[]): Line[] {
  return panels.flatMap((panel) => [
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
}

/** 四隅の接着タブで組み立てる、蓋または本体のトレーを生成する。 */
function generateTray(
  input: BoxInput,
  part: "lid" | "base",
  panelWidth: number,
  panelHeight: number,
  wallDepth: number,
): DielineGeometry {
  const prefix = part;
  const foldover = input.foldoverMm ?? 25;
  const outerDepth = wallDepth + foldover;
  const x0 = outerDepth;
  const x1 = x0 + panelWidth;
  const y0 = outerDepth;
  const y1 = y0 + panelHeight;
  const outerRight = x1 + outerDepth;
  const outerBottom = y1 + outerDepth;
  const relief = clamp(input.paperThicknessMm * 2.5, 1, Math.max(1, wallDepth * 0.16));
  const glueReach = Math.min(input.glueFlapMm, Math.max(4, wallDepth - relief * 2));
  const chamfer = Math.min(2.5, glueReach * 0.22);

  function sideTab(id: string, side: "left" | "right", top: boolean): PolygonShape {
    const attachX = side === "left" ? x0 : x1;
    const outerX = side === "left" ? attachX - glueReach : attachX + glueReach;
    const nearY = top ? foldover + relief : y1 + relief;
    const farY = top ? y0 - relief : y1 + wallDepth - relief;
    const direction = side === "left" ? -1 : 1;
    return {
      id: `${prefix}-${id}`,
      points: top
        ? [
            { x: attachX, y: nearY },
            { x: outerX + direction * -chamfer, y: nearY },
            { x: outerX, y: nearY + chamfer },
            { x: outerX, y: farY - chamfer },
            { x: outerX + direction * -chamfer, y: farY },
            { x: attachX, y: farY },
          ]
        : [
            { x: attachX, y: nearY },
            { x: outerX + direction * -chamfer, y: nearY },
            { x: outerX, y: nearY + chamfer },
            { x: outerX, y: farY - chamfer },
            { x: outerX + direction * -chamfer, y: farY },
            { x: attachX, y: farY },
          ],
    };
  }

  const topLeftTab = sideTab("glue-top-left", "left", true);
  const topRightTab = sideTab("glue-top-right", "right", true);
  const bottomLeftTab = sideTab("glue-bottom-left", "left", false);
  const bottomRightTab = sideTab("glue-bottom-right", "right", false);
  const tabs = [topLeftTab, topRightTab, bottomLeftTab, bottomRightTab];

  const center = rectPolygon(`${prefix}-center-shape`, x0, y0, panelWidth, panelHeight);
  const topFoldover = rectPolygon(`${prefix}-top-foldover-shape`, x0, 0, panelWidth, foldover);
  const topWall = rectPolygon(`${prefix}-top-wall-shape`, x0, foldover, panelWidth, wallDepth);
  const bottomWall = rectPolygon(`${prefix}-bottom-wall-shape`, x0, y1, panelWidth, wallDepth);
  const bottomFoldover = rectPolygon(`${prefix}-bottom-foldover-shape`, x0, y1 + wallDepth, panelWidth, foldover);
  const leftFoldover = rectPolygon(`${prefix}-left-foldover-shape`, 0, y0, foldover, panelHeight);
  const leftWall = rectPolygon(`${prefix}-left-wall-shape`, foldover, y0, wallDepth, panelHeight);
  const rightWall = rectPolygon(`${prefix}-right-wall-shape`, x1, y0, wallDepth, panelHeight);
  const rightFoldover = rectPolygon(`${prefix}-right-foldover-shape`, x1 + wallDepth, y0, foldover, panelHeight);

  const panels: Panel[] = [
    { id: `${prefix}-center`, label: part === "lid" ? "蓋（天面）" : "本体（底面）", x: x0, y: y0, width: panelWidth, height: panelHeight },
    { id: `${prefix}-top-wall`, label: "上側面", x: x0, y: foldover, width: panelWidth, height: wallDepth },
    { id: `${prefix}-right-wall`, label: "右側面", x: x1, y: y0, width: wallDepth, height: panelHeight },
    { id: `${prefix}-bottom-wall`, label: "下側面", x: x0, y: y1, width: panelWidth, height: wallDepth },
    { id: `${prefix}-left-wall`, label: "左側面", x: foldover, y: y0, width: wallDepth, height: panelHeight },
    { id: `${prefix}-top-foldover`, label: "上側面 折り返し", x: x0, y: 0, width: panelWidth, height: foldover },
    { id: `${prefix}-right-foldover`, label: "右側面 折り返し", x: x1 + wallDepth, y: y0, width: foldover, height: panelHeight },
    { id: `${prefix}-bottom-foldover`, label: "下側面 折り返し", x: x0, y: y1 + wallDepth, width: panelWidth, height: foldover },
    { id: `${prefix}-left-foldover`, label: "左側面 折り返し", x: 0, y: y0, width: foldover, height: panelHeight },
  ];

  const cut: PathShape[] = [
    pathThrough(`${prefix}-top-edge`, [{ x: x0, y: 0 }, { x: x1, y: 0 }]),
    pathThrough(`${prefix}-top-left-tab-cut`, [
      { x: x0, y: 0 }, { x: x0, y: foldover + relief }, ...topLeftTab.points.slice(1, -1), { x: x0, y: y0 - relief }, { x: x0, y: y0 },
    ]),
    pathThrough(`${prefix}-top-right-tab-cut`, [
      { x: x1, y: 0 }, { x: x1, y: foldover + relief }, ...topRightTab.points.slice(1, -1), { x: x1, y: y0 - relief }, { x: x1, y: y0 },
    ]),
    pathThrough(`${prefix}-left-edge`, [
      { x: x0, y: y0 }, { x: 0, y: y0 }, { x: 0, y: y1 }, { x: x0, y: y1 },
    ]),
    pathThrough(`${prefix}-right-edge`, [
      { x: x1, y: y0 }, { x: outerRight, y: y0 }, { x: outerRight, y: y1 }, { x: x1, y: y1 },
    ]),
    pathThrough(`${prefix}-bottom-left-tab-cut`, [
      { x: x0, y: y1 }, { x: x0, y: y1 + relief }, ...bottomLeftTab.points.slice(1, -1), { x: x0, y: y1 + wallDepth - relief }, { x: x0, y: outerBottom },
    ]),
    pathThrough(`${prefix}-bottom-right-tab-cut`, [
      { x: x1, y: y1 }, { x: x1, y: y1 + relief }, ...bottomRightTab.points.slice(1, -1), { x: x1, y: y1 + wallDepth - relief }, { x: x1, y: outerBottom },
    ]),
    pathThrough(`${prefix}-bottom-edge`, [{ x: x0, y: outerBottom }, { x: x1, y: outerBottom }]),
  ];

  const fold: Line[] = [
    { id: `${prefix}-center-top-fold`, from: { x: x0, y: y0 }, to: { x: x1, y: y0 } },
    { id: `${prefix}-center-right-fold`, from: { x: x1, y: y0 }, to: { x: x1, y: y1 } },
    { id: `${prefix}-center-bottom-fold`, from: { x: x0, y: y1 }, to: { x: x1, y: y1 } },
    { id: `${prefix}-center-left-fold`, from: { x: x0, y: y0 }, to: { x: x0, y: y1 } },
    { id: `${prefix}-top-left-tab-fold`, from: topLeftTab.points[0], to: topLeftTab.points.at(-1)! },
    { id: `${prefix}-top-right-tab-fold`, from: topRightTab.points[0], to: topRightTab.points.at(-1)! },
    { id: `${prefix}-bottom-left-tab-fold`, from: bottomLeftTab.points[0], to: bottomLeftTab.points.at(-1)! },
    { id: `${prefix}-bottom-right-tab-fold`, from: bottomRightTab.points[0], to: bottomRightTab.points.at(-1)! },
  ];

  const foldoverLines: Line[] = [
    { id: `${prefix}-top-foldover-fold`, from: { x: x0, y: foldover }, to: { x: x1, y: foldover } },
    { id: `${prefix}-right-foldover-fold`, from: { x: x1 + wallDepth, y: y0 }, to: { x: x1 + wallDepth, y: y1 } },
    { id: `${prefix}-bottom-foldover-fold`, from: { x: x0, y: y1 + wallDepth }, to: { x: x1, y: y1 + wallDepth } },
    { id: `${prefix}-left-foldover-fold`, from: { x: foldover, y: y0 }, to: { x: foldover, y: y1 } },
  ];

  return {
    type: input.type,
    input,
    bounds: { x: 0, y: 0, widthMm: roundMm(outerRight), heightMm: roundMm(outerBottom) },
    bodyTopMm: roundMm(y0),
    bodyBottomMm: roundMm(y1),
    panels,
    clipPolygons: [center, topFoldover, topWall, rightWall, rightFoldover, bottomWall, bottomFoldover, leftWall, leftFoldover, ...tabs],
    layers: { cut, fold, foldover: foldoverLines, glue: tabs, guide: panelGuides(panels) },
  };
}

export function generateTwoPieceGiftBox(input: BoxInput): DielineDocument {
  assertInput(input);
  const lidDepth = input.lidDepthMm ?? input.depthMm;
  const clearance = input.lidClearanceMm ?? 0.6;
  const lidWidth = input.widthMm + input.paperThicknessMm * 2 + clearance * 2;
  const lidHeight = input.heightMm + input.paperThicknessMm * 2 + clearance * 2;

  return {
    type: input.type,
    input,
    pages: [
      { id: "lid", label: "1ページ目：蓋", geometry: generateTray(input, "lid", lidWidth, lidHeight, lidDepth) },
      { id: "base", label: "2ページ目：本体", geometry: generateTray(input, "base", input.widthMm, input.heightMm, input.depthMm) },
    ],
  };
}

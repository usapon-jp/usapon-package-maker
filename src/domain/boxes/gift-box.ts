import { clamp, roundMm } from "../units";
import type {
  BoxGenerator,
  BoxInput,
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

function assertGiftBoxInput(input: BoxInput) {
  const checks: Array<[string, number]> = [
    ["幅", input.widthMm],
    ["高さ", input.heightMm],
    ["深さ", input.depthMm],
    ["紙厚", input.paperThicknessMm],
    ["のりしろ", input.glueFlapMm],
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

/**
 * 接着式の浅型差し込み箱。
 * 差し込み舌・フタ・背面・底面・前面を横一列につなぎ、
 * 底面の左右側壁を前後4枚ののりしろで固定する。
 */
export const generateGiftBox: BoxGenerator = (input): DielineGeometry => {
  assertGiftBoxInput(input);

  const {
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    paperThicknessMm,
    glueFlapMm,
  } = input;
  const clearance = Math.max(0.5, paperThicknessMm * 2);
  const tuckDepth = clamp(depth * 0.6 + clearance, 10, 22);
  const tuckInset = clamp(clearance + 1.5, 2, Math.max(2, height * 0.1));
  const cornerCut = clamp(depth * 0.14, 2, 5);
  const dustInset = clamp(clearance + 1.5, 2, Math.max(2, width * 0.06));
  const dustReach = clamp(depth * 0.68, 8, depth);
  const glueReach = Math.min(glueFlapMm, Math.max(4, depth - cornerCut));

  const xTuckStart = 0;
  const xLidStart = tuckDepth;
  const xRearStart = xLidStart + width;
  const xBaseStart = xRearStart + depth;
  const xFrontStart = xBaseStart + width;
  const xFrontEnd = xFrontStart + depth;
  const yBodyTop = depth;
  const yBodyBottom = yBodyTop + height;
  const yOuterBottom = yBodyBottom + depth;

  const tuck: PolygonShape = {
    id: "lid-tuck",
    points: [
      { x: xLidStart, y: yBodyTop + tuckInset },
      { x: xTuckStart + cornerCut, y: yBodyTop + tuckInset },
      { x: xTuckStart, y: yBodyTop + tuckInset + cornerCut },
      { x: xTuckStart, y: yBodyBottom - tuckInset - cornerCut },
      { x: xTuckStart + cornerCut, y: yBodyBottom - tuckInset },
      { x: xLidStart, y: yBodyBottom - tuckInset },
    ],
  };
  const lid = rectPolygon("lid-panel", xLidStart, yBodyTop, width, height);
  const rearWall = rectPolygon("rear-wall", xRearStart, yBodyTop, depth, height);
  const base = rectPolygon("base-panel", xBaseStart, yBodyTop, width, height);
  const frontWall = rectPolygon("front-wall", xFrontStart, yBodyTop, depth, height);

  const lidDustTop: PolygonShape = {
    id: "lid-dust-left",
    points: [
      { x: xLidStart + dustInset, y: yBodyTop },
      { x: xRearStart - dustInset, y: yBodyTop },
      { x: xRearStart - dustInset - cornerCut, y: yBodyTop - dustReach },
      { x: xLidStart + dustInset + cornerCut, y: yBodyTop - dustReach },
    ],
  };
  const lidDustBottom: PolygonShape = {
    id: "lid-dust-right",
    points: [
      { x: xLidStart + dustInset, y: yBodyBottom },
      { x: xLidStart + dustInset + cornerCut, y: yBodyBottom + dustReach },
      { x: xRearStart - dustInset - cornerCut, y: yBodyBottom + dustReach },
      { x: xRearStart - dustInset, y: yBodyBottom },
    ],
  };
  const sideWallTop = rectPolygon("side-wall-left", xBaseStart, 0, width, depth);
  const sideWallBottom = rectPolygon("side-wall-right", xBaseStart, yBodyBottom, width, depth);

  const rearGlueTop: PolygonShape = {
    id: "glue-rear-left",
    points: [
      { x: xRearStart, y: yBodyTop },
      { x: xBaseStart, y: yBodyTop },
      { x: xBaseStart - cornerCut, y: yBodyTop - glueReach },
      { x: xRearStart + cornerCut, y: yBodyTop - glueReach },
    ],
  };
  const rearGlueBottom: PolygonShape = {
    id: "glue-rear-right",
    points: [
      { x: xRearStart, y: yBodyBottom },
      { x: xRearStart + cornerCut, y: yBodyBottom + glueReach },
      { x: xBaseStart - cornerCut, y: yBodyBottom + glueReach },
      { x: xBaseStart, y: yBodyBottom },
    ],
  };
  const frontGlueTop: PolygonShape = {
    id: "glue-front-left",
    points: [
      { x: xFrontStart, y: yBodyTop },
      { x: xFrontEnd, y: yBodyTop },
      { x: xFrontEnd - cornerCut, y: yBodyTop - glueReach },
      { x: xFrontStart + cornerCut, y: yBodyTop - glueReach },
    ],
  };
  const frontGlueBottom: PolygonShape = {
    id: "glue-front-right",
    points: [
      { x: xFrontStart, y: yBodyBottom },
      { x: xFrontStart + cornerCut, y: yBodyBottom + glueReach },
      { x: xFrontEnd - cornerCut, y: yBodyBottom + glueReach },
      { x: xFrontEnd, y: yBodyBottom },
    ],
  };

  const panels: Panel[] = [
    { id: "panel-lid", label: "フタ（表）", x: xLidStart, y: yBodyTop, width, height },
    { id: "panel-base", label: "底面", x: xBaseStart, y: yBodyTop, width, height },
    { id: "panel-rear-wall", label: "背面", x: xRearStart, y: yBodyTop, width: depth, height },
    { id: "panel-front-wall", label: "前面", x: xFrontStart, y: yBodyTop, width: depth, height },
    { id: "panel-side-left", label: "左側面", x: xBaseStart, y: 0, width, height: depth },
    { id: "panel-side-right", label: "右側面", x: xBaseStart, y: yBodyBottom, width, height: depth },
  ];

  const cut: PathShape[] = [
    pathThrough("lid-tuck-cut", tuck.points),
    pathThrough("tuck-relief-top", [{ x: xLidStart, y: yBodyTop }, { x: xLidStart, y: yBodyTop + tuckInset }]),
    pathThrough("tuck-relief-bottom", [{ x: xLidStart, y: yBodyBottom - tuckInset }, { x: xLidStart, y: yBodyBottom }]),
    pathThrough("lid-dust-left-cut", [
      lidDustTop.points[0],
      lidDustTop.points[3],
      lidDustTop.points[2],
      lidDustTop.points[1],
    ]),
    pathThrough("lid-dust-right-cut", lidDustBottom.points),
    pathThrough("rear-glue-left-cut", rearGlueTop.points.slice(1).concat(rearGlueTop.points.slice(0, 1))),
    pathThrough("rear-glue-right-cut", rearGlueBottom.points),
    pathThrough("side-wall-left-cut", [
      { x: xBaseStart, y: yBodyTop },
      { x: xBaseStart, y: 0 },
      { x: xFrontStart, y: 0 },
      { x: xFrontStart, y: yBodyTop },
    ]),
    pathThrough("side-wall-right-cut", [
      { x: xBaseStart, y: yBodyBottom },
      { x: xBaseStart, y: yOuterBottom },
      { x: xFrontStart, y: yOuterBottom },
      { x: xFrontStart, y: yBodyBottom },
    ]),
    pathThrough("front-glue-left-cut", frontGlueTop.points.slice(1).concat(frontGlueTop.points.slice(0, 1))),
    pathThrough("front-glue-right-cut", frontGlueBottom.points),
    pathThrough("front-edge-cut", [{ x: xFrontEnd, y: yBodyTop }, { x: xFrontEnd, y: yBodyBottom }]),
  ];

  const fold: Line[] = [
    { id: "tuck-fold", from: { x: xLidStart, y: yBodyTop + tuckInset }, to: { x: xLidStart, y: yBodyBottom - tuckInset } },
    { id: "lid-rear-fold", from: { x: xRearStart, y: yBodyTop }, to: { x: xRearStart, y: yBodyBottom } },
    { id: "rear-base-fold", from: { x: xBaseStart, y: yBodyTop }, to: { x: xBaseStart, y: yBodyBottom } },
    { id: "base-front-fold", from: { x: xFrontStart, y: yBodyTop }, to: { x: xFrontStart, y: yBodyBottom } },
    { id: "lid-dust-left-fold", from: { x: xLidStart + dustInset, y: yBodyTop }, to: { x: xRearStart - dustInset, y: yBodyTop } },
    { id: "lid-dust-right-fold", from: { x: xLidStart + dustInset, y: yBodyBottom }, to: { x: xRearStart - dustInset, y: yBodyBottom } },
    { id: "side-wall-left-fold", from: { x: xBaseStart, y: yBodyTop }, to: { x: xFrontStart, y: yBodyTop } },
    { id: "side-wall-right-fold", from: { x: xBaseStart, y: yBodyBottom }, to: { x: xFrontStart, y: yBodyBottom } },
    { id: "glue-rear-left-fold", from: { x: xRearStart, y: yBodyTop }, to: { x: xBaseStart, y: yBodyTop } },
    { id: "glue-rear-right-fold", from: { x: xRearStart, y: yBodyBottom }, to: { x: xBaseStart, y: yBodyBottom } },
    { id: "glue-front-left-fold", from: { x: xFrontStart, y: yBodyTop }, to: { x: xFrontEnd, y: yBodyTop } },
    { id: "glue-front-right-fold", from: { x: xFrontStart, y: yBodyBottom }, to: { x: xFrontEnd, y: yBodyBottom } },
  ];

  const glue = [rearGlueTop, rearGlueBottom, frontGlueTop, frontGlueBottom];

  return {
    type: input.type,
    input,
    bounds: {
      x: 0,
      y: 0,
      widthMm: roundMm(xFrontEnd),
      heightMm: roundMm(yOuterBottom),
    },
    bodyTopMm: roundMm(yBodyTop),
    bodyBottomMm: roundMm(yBodyBottom),
    panels,
    clipPolygons: [
      tuck,
      lid,
      rearWall,
      base,
      frontWall,
      lidDustTop,
      lidDustBottom,
      sideWallTop,
      sideWallBottom,
      ...glue,
    ],
    layers: {
      cut,
      fold,
      glue,
      guide: panelGuides(panels),
    },
  };
};

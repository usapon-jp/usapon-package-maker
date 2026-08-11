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

function assertNStyleGiftBoxInput(input: BoxInput) {
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
 * N式（ラーメン式）を基準にした、のり不要の一体型浅箱。
 * 横方向は 差し込み舌C + フタH + 背面C + 底面H + 前面C + 前面返しC。
 * 底面の上下には側壁Cと折り返しロック、背面・前面には角ロックフラップを設ける。
 */
export const generateNStyleGiftBox: BoxGenerator = (input): DielineGeometry => {
  assertNStyleGiftBoxInput(input);

  const {
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    paperThicknessMm,
  } = input;
  const clearance = Math.max(0.5, paperThicknessMm * 2);
  const relief = clamp(clearance + 0.6, 1, Math.max(1, depth * 0.14));
  const lockLip = clamp(depth * 0.34 + clearance, 8, 16);
  const tongueInset = clamp(clearance + 1.5, 2, Math.max(2, width * 0.1));
  const tongueRadius = clamp(depth * 0.45, 4, 12);
  const cornerRadius = clamp(depth * 0.16, 2.5, 5);
  const rearEarReach = clamp(depth * 0.7, 8, Math.max(8, height * 0.35));
  const notchDepth = clamp(clearance + 1.5, 2, 3);
  const notchHeight = clamp(width * 0.065, 5, 9);
  const slotInset = clamp(depth * 0.24, 4, 8);

  const xTuckStart = 0;
  const xLidStart = depth;
  const xRearStart = xLidStart + height;
  const xBaseStart = xRearStart + depth;
  const xFrontStart = xBaseStart + height;
  const xReturnStart = xFrontStart + depth;
  const xReturnEnd = xReturnStart + depth;

  const yOuterTop = 0;
  const ySideTop = lockLip;
  const yBodyTop = ySideTop + depth;
  const yBodyBottom = yBodyTop + width;
  const ySideBottom = yBodyBottom + depth;
  const yOuterBottom = ySideBottom + lockLip;
  const bodyCenterY = yBodyTop + width / 2;

  const tuck: PolygonShape = {
    id: "lid-tuck",
    points: [
      { x: xLidStart, y: yBodyTop + tongueInset },
      { x: xTuckStart + tongueRadius, y: yBodyTop + tongueInset },
      { x: xTuckStart, y: yBodyTop + tongueInset + tongueRadius },
      { x: xTuckStart, y: yBodyBottom - tongueInset - tongueRadius },
      { x: xTuckStart + tongueRadius, y: yBodyBottom - tongueInset },
      { x: xLidStart, y: yBodyBottom - tongueInset },
    ],
  };
  const lid = rectPolygon("lid-panel", xLidStart, yBodyTop, height, width);
  const rearWall = rectPolygon("rear-wall", xRearStart, yBodyTop, depth, width);
  const base = rectPolygon("base-panel", xBaseStart, yBodyTop, height, width);
  const frontWall = rectPolygon("front-wall", xFrontStart, yBodyTop, depth, width);
  const frontReturn: PolygonShape = {
    id: "front-return",
    points: [
      { x: xReturnStart, y: yBodyTop },
      { x: xReturnEnd, y: yBodyTop },
      { x: xReturnEnd, y: bodyCenterY - notchHeight * 2.5 },
      { x: xReturnEnd + notchDepth, y: bodyCenterY - notchHeight * 2 },
      { x: xReturnEnd + notchDepth, y: bodyCenterY - notchHeight },
      { x: xReturnEnd, y: bodyCenterY - notchHeight * 0.5 },
      { x: xReturnEnd, y: bodyCenterY + notchHeight * 0.5 },
      { x: xReturnEnd + notchDepth, y: bodyCenterY + notchHeight },
      { x: xReturnEnd + notchDepth, y: bodyCenterY + notchHeight * 2 },
      { x: xReturnEnd, y: bodyCenterY + notchHeight * 2.5 },
      { x: xReturnEnd, y: yBodyBottom },
      { x: xReturnStart, y: yBodyBottom },
    ],
  };

  const topSideWall = rectPolygon("side-wall-top", xBaseStart, ySideTop, height, depth);
  const bottomSideWall = rectPolygon("side-wall-bottom", xBaseStart, yBodyBottom, height, depth);
  const topLockLip: PolygonShape = {
    id: "side-lock-lip-top",
    points: [
      { x: xBaseStart, y: ySideTop },
      { x: xBaseStart + cornerRadius, y: yOuterTop },
      { x: xFrontStart - cornerRadius, y: yOuterTop },
      { x: xFrontStart, y: ySideTop },
    ],
  };
  const bottomLockLip: PolygonShape = {
    id: "side-lock-lip-bottom",
    points: [
      { x: xBaseStart, y: ySideBottom },
      { x: xBaseStart + cornerRadius, y: yOuterBottom },
      { x: xFrontStart - cornerRadius, y: yOuterBottom },
      { x: xFrontStart, y: ySideBottom },
    ],
  };

  const rearTopLock: PolygonShape = {
    id: "corner-lock-rear-top",
    points: [
      { x: xRearStart, y: yBodyTop },
      { x: xRearStart - rearEarReach, y: yBodyTop },
      { x: xRearStart - rearEarReach, y: ySideTop + cornerRadius },
      { x: xRearStart - rearEarReach + cornerRadius, y: ySideTop },
      { x: xBaseStart - cornerRadius, y: ySideTop },
      { x: xBaseStart, y: ySideTop + cornerRadius },
      { x: xBaseStart, y: yBodyTop },
    ],
  };
  const rearBottomLock: PolygonShape = {
    id: "corner-lock-rear-bottom",
    points: [
      { x: xRearStart, y: yBodyBottom },
      { x: xRearStart - rearEarReach, y: yBodyBottom },
      { x: xRearStart - rearEarReach, y: ySideBottom - cornerRadius },
      { x: xRearStart - rearEarReach + cornerRadius, y: ySideBottom },
      { x: xBaseStart - cornerRadius, y: ySideBottom },
      { x: xBaseStart, y: ySideBottom - cornerRadius },
      { x: xBaseStart, y: yBodyBottom },
    ],
  };
  const frontTopLock: PolygonShape = {
    id: "corner-lock-front-top",
    points: [
      { x: xFrontStart, y: yBodyTop },
      { x: xFrontStart, y: ySideTop },
      { x: xReturnStart - cornerRadius, y: ySideTop },
      { x: xReturnStart, y: ySideTop + cornerRadius },
      { x: xReturnStart, y: yBodyTop },
    ],
  };
  const frontBottomLock: PolygonShape = {
    id: "corner-lock-front-bottom",
    points: [
      { x: xFrontStart, y: yBodyBottom },
      { x: xFrontStart, y: ySideBottom },
      { x: xReturnStart - cornerRadius, y: ySideBottom },
      { x: xReturnStart, y: ySideBottom - cornerRadius },
      { x: xReturnStart, y: yBodyBottom },
    ],
  };

  const panels: Panel[] = [
    { id: "panel-lid", label: "フタ（表）", x: xLidStart, y: yBodyTop, width: height, height: width },
    { id: "panel-base", label: "底面", x: xBaseStart, y: yBodyTop, width: height, height: width },
    { id: "panel-rear-wall", label: "背面", x: xRearStart, y: yBodyTop, width: depth, height: width },
    { id: "panel-front-wall", label: "前面", x: xFrontStart, y: yBodyTop, width: depth, height: width },
    { id: "panel-front-return", label: "前面折り返し", x: xReturnStart, y: yBodyTop, width: depth, height: width },
    { id: "panel-tuck", label: "フタ差し込み", x: xTuckStart, y: yBodyTop, width: depth, height: width },
    { id: "panel-side-top", label: "左側面", x: xBaseStart, y: ySideTop, width: height, height: depth },
    { id: "panel-side-bottom", label: "右側面", x: xBaseStart, y: yBodyBottom, width: height, height: depth },
    { id: "panel-side-lock-top", label: "側面ロック", x: xBaseStart, y: yOuterTop, width: height, height: lockLip },
    { id: "panel-side-lock-bottom", label: "側面ロック", x: xBaseStart, y: ySideBottom, width: height, height: lockLip },
  ];

  const cut: PathShape[] = [
    pathThrough("lid-tuck-cut", tuck.points),
    pathThrough("tuck-relief-top", [{ x: xLidStart, y: yBodyTop }, { x: xLidStart, y: yBodyTop + tongueInset }]),
    pathThrough("tuck-relief-bottom", [{ x: xLidStart, y: yBodyBottom - tongueInset }, { x: xLidStart, y: yBodyBottom }]),
    pathThrough("lid-top-cut", [{ x: xLidStart, y: yBodyTop }, { x: xRearStart, y: yBodyTop }]),
    pathThrough("lid-bottom-cut", [{ x: xLidStart, y: yBodyBottom }, { x: xRearStart, y: yBodyBottom }]),
    pathThrough("front-return-top-cut", [{ x: xReturnStart, y: yBodyTop }, { x: xReturnEnd, y: yBodyTop }]),
    pathThrough("front-return-bottom-cut", [{ x: xReturnStart, y: yBodyBottom }, { x: xReturnEnd, y: yBodyBottom }]),
    pathThrough("front-return-edge-cut", frontReturn.points.slice(1, -1)),
    pathThrough("side-lock-lip-top-cut", [topLockLip.points[0], topLockLip.points[1], topLockLip.points[2], topLockLip.points[3]]),
    pathThrough("side-lock-lip-bottom-cut", [bottomLockLip.points[0], bottomLockLip.points[1], bottomLockLip.points[2], bottomLockLip.points[3]]),
    pathThrough("corner-lock-rear-top-cut", rearTopLock.points),
    pathThrough("corner-lock-rear-bottom-cut", rearBottomLock.points),
    pathThrough("corner-lock-front-top-cut", frontTopLock.points),
    pathThrough("corner-lock-front-bottom-cut", frontBottomLock.points),
    pathThrough("corner-slot-rear-top", [
      { x: xRearStart - rearEarReach + slotInset, y: ySideTop + relief },
      { x: xRearStart - rearEarReach + slotInset, y: ySideTop + depth * 0.58 },
    ]),
    pathThrough("corner-slot-rear-bottom", [
      { x: xRearStart - rearEarReach + slotInset, y: ySideBottom - relief },
      { x: xRearStart - rearEarReach + slotInset, y: ySideBottom - depth * 0.58 },
    ]),
  ];

  const notchTop1 = bodyCenterY - notchHeight * 2.5;
  const notchBottom1 = bodyCenterY - notchHeight * 0.5;
  const notchTop2 = bodyCenterY + notchHeight * 0.5;
  const notchBottom2 = bodyCenterY + notchHeight * 2.5;
  cut.push(
    pathThrough("front-lock-notch-upper", [
      { x: xFrontStart, y: notchTop1 },
      { x: xFrontStart - notchDepth, y: notchTop1 + notchHeight * 0.5 },
      { x: xFrontStart - notchDepth, y: notchBottom1 - notchHeight * 0.5 },
      { x: xFrontStart, y: notchBottom1 },
    ]),
    pathThrough("front-lock-notch-lower", [
      { x: xFrontStart, y: notchTop2 },
      { x: xFrontStart - notchDepth, y: notchTop2 + notchHeight * 0.5 },
      { x: xFrontStart - notchDepth, y: notchBottom2 - notchHeight * 0.5 },
      { x: xFrontStart, y: notchBottom2 },
    ]),
  );

  const fold: Line[] = [
    { id: "tuck-lid-fold", from: { x: xLidStart, y: yBodyTop + tongueInset }, to: { x: xLidStart, y: yBodyBottom - tongueInset } },
    { id: "lid-rear-fold", from: { x: xRearStart, y: yBodyTop }, to: { x: xRearStart, y: yBodyBottom } },
    { id: "rear-base-fold", from: { x: xBaseStart, y: yBodyTop }, to: { x: xBaseStart, y: yBodyBottom } },
    { id: "base-front-fold-1", from: { x: xFrontStart, y: yBodyTop }, to: { x: xFrontStart, y: notchTop1 } },
    { id: "base-front-fold-2", from: { x: xFrontStart, y: notchBottom1 }, to: { x: xFrontStart, y: notchTop2 } },
    { id: "base-front-fold-3", from: { x: xFrontStart, y: notchBottom2 }, to: { x: xFrontStart, y: yBodyBottom } },
    { id: "front-return-fold", from: { x: xReturnStart, y: yBodyTop }, to: { x: xReturnStart, y: yBodyBottom } },
    { id: "side-wall-top-fold", from: { x: xBaseStart, y: yBodyTop }, to: { x: xFrontStart, y: yBodyTop } },
    { id: "side-wall-bottom-fold", from: { x: xBaseStart, y: yBodyBottom }, to: { x: xFrontStart, y: yBodyBottom } },
    { id: "side-lock-lip-top-fold", from: { x: xBaseStart, y: ySideTop }, to: { x: xFrontStart, y: ySideTop } },
    { id: "side-lock-lip-bottom-fold", from: { x: xBaseStart, y: ySideBottom }, to: { x: xFrontStart, y: ySideBottom } },
    { id: "corner-lock-rear-top-fold", from: { x: xRearStart, y: yBodyTop }, to: { x: xBaseStart, y: yBodyTop } },
    { id: "corner-lock-rear-bottom-fold", from: { x: xRearStart, y: yBodyBottom }, to: { x: xBaseStart, y: yBodyBottom } },
    { id: "corner-lock-front-top-fold", from: { x: xFrontStart, y: yBodyTop }, to: { x: xReturnStart, y: yBodyTop } },
    { id: "corner-lock-front-bottom-fold", from: { x: xFrontStart, y: yBodyBottom }, to: { x: xReturnStart, y: yBodyBottom } },
  ];

  const clipPolygons = [
    tuck,
    lid,
    rearWall,
    base,
    frontWall,
    frontReturn,
    topSideWall,
    bottomSideWall,
    topLockLip,
    bottomLockLip,
    rearTopLock,
    rearBottomLock,
    frontTopLock,
    frontBottomLock,
  ];

  return {
    type: input.type,
    input,
    bounds: {
      x: 0,
      y: 0,
      widthMm: roundMm(xReturnEnd + notchDepth),
      heightMm: roundMm(yOuterBottom),
    },
    bodyTopMm: roundMm(yBodyTop),
    bodyBottomMm: roundMm(yBodyBottom),
    panels,
    clipPolygons,
    layers: {
      cut,
      fold,
      glue: [],
      guide: panelGuides(panels),
    },
  };
};

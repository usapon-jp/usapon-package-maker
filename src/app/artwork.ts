import type {
  ArtworkLayer,
  BuiltInStampKey,
  DotPatternLayer,
  QuarterTurn,
  StampItem,
  StripePatternLayer,
  UploadedArtworkLayer,
  UploadedAsset,
} from "./app-types";
import type { DielineGeometry, DielinePageId } from "../domain/boxes/types";

export const POFUMOFU_STAMP_FILE = "pofumofu-friends.png";
export const POFUMOFU_STAMP_KEY = "pofumofu-friends" as const;

export const BUILT_IN_STAMPS = [
  {
    key: "usapon-box-rabbits",
    fileName: "usapon-box-rabbits.png",
    name: "うさぽんBOX",
    themePackId: null,
  },
  {
    key: POFUMOFU_STAMP_KEY,
    fileName: POFUMOFU_STAMP_FILE,
    name: "Pofumofu friends",
    themePackId: null,
  },
  { key: "autumn-rabbit-sweet-potato-car", fileName: "autumn-rabbit-sweet-potato-car.png", name: "おいもの車", themePackId: "autumn-letter-set" },
  { key: "autumn-rabbit-acorn-hug", fileName: "autumn-rabbit-acorn-hug.png", name: "どんぐりぎゅっ", themePackId: "autumn-letter-set" },
  { key: "autumn-rabbit-sweet-potato", fileName: "autumn-rabbit-sweet-potato.png", name: "おいもをもぐもぐ", themePackId: "autumn-letter-set" },
  { key: "autumn-rabbit-chestnut", fileName: "autumn-rabbit-chestnut.png", name: "栗からこんにちは", themePackId: "autumn-letter-set" },
  { key: "autumn-rabbit-sleeping-sweet-potato", fileName: "autumn-rabbit-sleeping-sweet-potato-no-text.png", name: "おいもの中でおやすみ", themePackId: "autumn-letter-set" },
] as const satisfies ReadonlyArray<{ key: BuiltInStampKey; fileName: string; name: string; themePackId: string | null }>;

export function builtInStampForKey(key: BuiltInStampKey) {
  const preset = BUILT_IN_STAMPS.find((item) => item.key === key);
  if (!preset) throw new Error("内蔵スタンプが見つかりません。");
  return preset;
}

function runtimeAsset(asset: UploadedAsset) {
  const { id, assetRef, ...runtime } = asset;
  return {
    id,
    asset: {
      ...runtime,
      assetRef: assetRef ?? { kind: "user" as const, assetId: id },
    },
  };
}

export function markAsBuiltInStamp(asset: UploadedAsset, key: BuiltInStampKey = POFUMOFU_STAMP_KEY): UploadedAsset {
  return { ...asset, assetRef: { kind: "builtin", key } };
}

function panelCenter(geometry: DielineGeometry) {
  const panel = geometry.panels[0];
  return { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2, panel };
}

export function rotateQuarterTurn(rotation: QuarterTurn): QuarterTurn {
  return ((rotation + 90) % 360) as QuarterTurn;
}

export function createUploadedArtwork(asset: UploadedAsset, geometry: DielineGeometry, pageId: DielinePageId = "main"): UploadedArtworkLayer {
  const center = panelCenter(geometry);
  const widthMm = Math.min(50, Math.max(20, center.panel.width * 0.72));
  const runtime = runtimeAsset(asset);
  return {
    ...runtime.asset,
    id: runtime.id,
    kind: "uploaded-artwork",
    role: "background",
    pageId,
    name: asset.fileName,
    widthMm,
    offsetXmm: center.x,
    offsetYmm: center.y,
    repeat: false,
    repeatGapMm: 0,
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

export function createStripePattern(id: string, number: number, pageId: DielinePageId = "main"): StripePatternLayer {
  return {
    id,
    kind: "stripe-pattern",
    role: "background",
    pageId,
    name: `ストライプ ${number}`,
    color: "#f6d96f",
    stripeWidthMm: 5,
    gapMm: 5,
    angleDeg: 45,
    offsetXmm: 0,
    offsetYmm: 0,
    visible: true,
    opacity: 1,
  };
}

export function createDotPattern(id: string, number: number, pageId: DielinePageId = "main"): DotPatternLayer {
  return {
    id,
    kind: "dot-pattern",
    role: "background",
    pageId,
    name: `水玉 ${number}`,
    color: "#f6d96f",
    dotDiameterMm: 8,
    spacingMm: 24,
    angleDeg: 0,
    offsetXmm: 0,
    offsetYmm: 0,
    visible: true,
    opacity: 1,
  };
}

export function createStamp(asset: UploadedAsset, geometry: DielineGeometry, name = asset.fileName, pageId: DielinePageId = "main"): StampItem {
  const center = panelCenter(geometry);
  const runtime = runtimeAsset(asset);
  return {
    ...runtime.asset,
    id: runtime.id,
    kind: "stamp",
    role: "stamp",
    pageId,
    name,
    xMm: center.x,
    yMm: center.y,
    widthMm: Math.min(40, Math.max(10, center.panel.width * 0.72)),
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

export function rotateByDegrees(rotation: number, amount = 90) {
  return ((rotation + amount) % 360 + 360) % 360;
}

export function artworkKindLabel(item: ArtworkLayer) {
  if (item.kind === "stripe-pattern") return "STRIPE";
  if (item.kind === "dot-pattern") return "DOT";
  return item.sourceType.toUpperCase();
}

import type {
  ArtworkLayer,
  DotPatternLayer,
  QuarterTurn,
  StampItem,
  StripePatternLayer,
  UploadedArtworkLayer,
  UploadedAsset,
} from "./app-types";
import type { DielineGeometry } from "../domain/boxes/types";

export const POFUMOFU_STAMP_FILE = "pofumofu-friends.png";

function panelCenter(geometry: DielineGeometry) {
  const panel = geometry.panels[0];
  return { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2, panel };
}

export function rotateQuarterTurn(rotation: QuarterTurn): QuarterTurn {
  return ((rotation + 90) % 360) as QuarterTurn;
}

export function createUploadedArtwork(asset: UploadedAsset, geometry: DielineGeometry): UploadedArtworkLayer {
  const center = panelCenter(geometry);
  const widthMm = Math.min(50, Math.max(20, center.panel.width * 0.72));
  return {
    ...asset,
    kind: "uploaded-artwork",
    name: asset.fileName,
    widthMm,
    offsetXmm: center.x,
    offsetYmm: center.y,
    repeat: false,
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

export function createStripePattern(id: string, number: number): StripePatternLayer {
  return {
    id,
    kind: "stripe-pattern",
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

export function createDotPattern(id: string, number: number): DotPatternLayer {
  return {
    id,
    kind: "dot-pattern",
    name: `水玉 ${number}`,
    color: "#f6d96f",
    dotDiameterMm: 8,
    spacingMm: 24,
    offsetXmm: 0,
    offsetYmm: 0,
    visible: true,
    opacity: 1,
  };
}

export function createStamp(asset: UploadedAsset, geometry: DielineGeometry, name = asset.fileName): StampItem {
  const center = panelCenter(geometry);
  return {
    ...asset,
    kind: "stamp",
    name,
    xMm: center.x,
    yMm: center.y,
    widthMm: Math.min(40, Math.max(10, center.panel.width * 0.72)),
    rotationDeg: 0,
    visible: true,
    opacity: 1,
  };
}

export function artworkKindLabel(item: ArtworkLayer) {
  if (item.kind === "stripe-pattern") return "STRIPE";
  if (item.kind === "dot-pattern") return "DOT";
  return item.sourceType.toUpperCase();
}

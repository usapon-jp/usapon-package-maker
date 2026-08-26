import type { ArtworkLayer, DielineLineColors, EnvelopeTemplateStyle, StampItem, TextItem } from "../../app/app-types";
import type { DielineGeometry, DielinePageId, Panel } from "../../domain/boxes/types";
import { clamp, roundMm } from "../../domain/units";

type PageDesign = {
  backgroundColor: string;
  artworkLayers: ArtworkLayer[];
  stamps: StampItem[];
  texts: TextItem[];
  lineColors?: DielineLineColors;
};

function normalizedPoint(x: number, y: number, panel: Panel) {
  return {
    x: clamp((x - panel.x) / panel.width, 0.08, 0.92),
    y: clamp((y - panel.y) / panel.height, 0.08, 0.92),
  };
}

function targetPoint(point: { x: number; y: number }, panel: Panel) {
  return { x: panel.x + panel.width * point.x, y: panel.y + panel.height * point.y };
}

function sharedId(id: string, pageId: DielinePageId) {
  return `${id}--shared-${pageId}`;
}

function scaleBetween(source: Panel, target: Panel) {
  return Math.min(target.width / source.width, target.height / source.height);
}

function templatePoint(kind: "artwork" | "stamp" | "text", index: number, target: Panel, targetGeometry: DielineGeometry, style?: EnvelopeTemplateStyle) {
  if (!style) return null;
  const letter = targetGeometry.type === "letter-paper-v1";
  const anchors = kind === "text"
    ? style === "cute" ? [[0.18, 0.12], [0.82, 0.9], [0.5, 0.08]] : style === "adult" ? [[0.14, 0.1], [0.86, 0.92], [0.5, 0.08]] : [[0.14, 0.92], [0.86, 0.1], [0.5, 0.08]]
    : style === "cute" ? (letter ? [[0.84, 0.88], [0.16, 0.12], [0.86, 0.14]] : [[0.84, 0.72], [0.16, 0.24], [0.82, 0.22]])
      : style === "adult" ? (letter ? [[0.88, 0.91], [0.12, 0.1], [0.88, 0.12]] : [[0.88, 0.76], [0.12, 0.22], [0.86, 0.22]])
        : (letter ? [[0.88, 0.11], [0.12, 0.91], [0.88, 0.9]] : [[0.88, 0.22], [0.12, 0.78], [0.86, 0.78]]);
  const anchor = anchors[index % anchors.length];
  return targetPoint({ x: anchor[0], y: anchor[1] }, target);
}

export function adaptEnvelopeDesignToPage(
  sourceGeometry: DielineGeometry,
  targetGeometry: DielineGeometry,
  targetPageId: DielinePageId,
  source: PageDesign,
  style?: EnvelopeTemplateStyle,
) {
  const sourcePanel = sourceGeometry.panels.find((panel) => panel.id === "panel-envelope-front") ?? sourceGeometry.panels[0];
  const targetPanel = targetGeometry.panels[0];
  const scale = scaleBetween(sourcePanel, targetPanel);
  const artworkLayers = source.artworkLayers.map((item, index): ArtworkLayer => {
    if (item.kind === "uploaded-artwork") {
      const point = item.repeat ? targetPoint(normalizedPoint(item.offsetXmm, item.offsetYmm, sourcePanel), targetPanel) : templatePoint("artwork", index, targetPanel, targetGeometry, style) ?? targetPoint(normalizedPoint(item.offsetXmm, item.offsetYmm, sourcePanel), targetPanel);
      return {
        ...item,
        id: sharedId(item.id, targetPageId),
        pageId: targetPageId,
        surfaceId: undefined,
        offsetXmm: roundMm(point.x, 1),
        offsetYmm: roundMm(point.y, 1),
        widthMm: roundMm(clamp(item.widthMm * scale, 6, targetPanel.width * 0.72), 1),
        repeatGapMm: roundMm(item.repeatGapMm * scale, 1),
      };
    }
    return {
      ...item,
      id: sharedId(item.id, targetPageId),
      pageId: targetPageId,
      surfaceId: undefined,
      offsetXmm: roundMm(item.offsetXmm * scale, 1),
      offsetYmm: roundMm(item.offsetYmm * scale, 1),
      ...(item.kind === "stripe-pattern"
        ? { stripeWidthMm: roundMm(Math.max(1, item.stripeWidthMm * scale), 1), gapMm: roundMm(Math.max(1, item.gapMm * scale), 1) }
        : { dotDiameterMm: roundMm(Math.max(1, item.dotDiameterMm * scale), 1), spacingMm: roundMm(Math.max(2, item.spacingMm * scale), 1) }),
    } as ArtworkLayer;
  });
  const stamps = source.stamps.map((item, index): StampItem => {
    const point = templatePoint("stamp", index, targetPanel, targetGeometry, style) ?? targetPoint(normalizedPoint(item.xMm, item.yMm, sourcePanel), targetPanel);
    return {
      ...item,
      id: sharedId(item.id, targetPageId),
      pageId: targetPageId,
      surfaceId: undefined,
      xMm: roundMm(point.x, 1),
      yMm: roundMm(point.y, 1),
      widthMm: roundMm(clamp(item.widthMm * scale, 5, targetPanel.width * 0.38), 1),
    };
  });
  const texts = source.texts.map((item, index): TextItem => {
    const point = templatePoint("text", index, targetPanel, targetGeometry, style) ?? targetPoint(normalizedPoint(item.xMm, item.yMm, sourcePanel), targetPanel);
    return {
      ...item,
      id: sharedId(item.id, targetPageId),
      pageId: targetPageId,
      surfaceId: undefined,
      rotationDeg: undefined,
      xMm: roundMm(point.x, 1),
      yMm: roundMm(point.y, 1),
      fontSizeMm: roundMm(clamp(item.fontSizeMm * scale, 2, 12), 1),
      letterSpacingMm: roundMm(item.letterSpacingMm * scale, 2),
      labelPaddingMm: roundMm(item.labelPaddingMm * scale, 1),
    };
  });
  return { pageId: targetPageId, backgroundColor: source.backgroundColor, artworkLayers, stamps, texts };
}

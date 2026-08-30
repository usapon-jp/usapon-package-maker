import type { ArtworkLayer, EnvelopeDesignSettings, EnvelopeTemplateStyle, StampItem, TextItem } from "../../app/app-types";
import type { DielineGeometry, Panel } from "../../domain/boxes/types";
import { clamp, roundMm } from "../../domain/units";
import type { LayoutDesign } from "../auto-layout/types";

export type EnvelopeTemplateDefinition = {
  id: EnvelopeTemplateStyle;
  label: string;
  description: string;
  backgroundColor: string;
  settings: EnvelopeDesignSettings;
};

export const ENVELOPE_LAYOUT_TEMPLATES: Record<EnvelopeTemplateStyle, EnvelopeTemplateDefinition> = {
  cute: {
    id: "cute",
    label: "かわいい",
    description: "白い宛名枠と3本線、ワンポイント、柄入りフラップ",
    backgroundColor: "#fff8f6",
    settings: { style: "cute", flapAccentEnabled: true, flapColor: "#f3bdc7", flapPattern: "dots", showAddressField: true, showAddressLines: true, marginMm: 9 },
  },
  adult: {
    id: "adult",
    label: "大人っぽい",
    description: "落ち着いた近似色、細いフレーム、小さなワンポイント",
    backgroundColor: "#f7f3ee",
    settings: { style: "adult", flapAccentEnabled: true, flapColor: "#c9bdb1", flapPattern: "solid", showAddressField: true, showAddressLines: true, marginMm: 15 },
  },
  simple: {
    id: "simple",
    label: "シンプル",
    description: "白場を多く、宛名が読みやすい最小限の構成",
    backgroundColor: "#ffffff",
    settings: { style: "simple", flapAccentEnabled: true, flapColor: "#f1efec", flapPattern: "solid", showAddressField: true, showAddressLines: true, marginMm: 14 },
  },
};

export const DEFAULT_LETTER_SET_ENVELOPE = {
  backgroundColor: ENVELOPE_LAYOUT_TEMPLATES.cute.backgroundColor,
  settings: {
    ...ENVELOPE_LAYOUT_TEMPLATES.cute.settings,
    flapAccentEnabled: false,
    flapColor: ENVELOPE_LAYOUT_TEMPLATES.cute.backgroundColor,
    flapPattern: "solid" as const,
  },
};

function frontPanel(geometry: DielineGeometry) {
  return geometry.panels.find((panel) => panel.id === "panel-envelope-front") ?? geometry.panels[0];
}

function at(panel: Panel, x: number, y: number) {
  return { x: roundMm(panel.x + panel.width * x, 1), y: roundMm(panel.y + panel.height * y, 1) };
}

const STAMP_ANCHORS: Record<EnvelopeTemplateStyle, Array<[number, number]>> = {
  cute: [[0.84, 0.79], [0.15, 0.18], [0.88, 0.17], [0.13, 0.82]],
  adult: [[0.88, 0.82], [0.12, 0.16], [0.87, 0.18], [0.14, 0.84]],
  simple: [[0.87, 0.18], [0.13, 0.82], [0.88, 0.82], [0.13, 0.18]],
};

const TEXT_ANCHORS: Record<EnvelopeTemplateStyle, Array<[number, number]>> = {
  cute: [[0.5, 0.12], [0.16, 0.9], [0.84, 0.9]],
  adult: [[0.5, 0.14], [0.14, 0.88], [0.86, 0.88]],
  simple: [[0.14, 0.88], [0.86, 0.88], [0.5, 0.14]],
};

function arrangeArtwork(items: ArtworkLayer[], panel: Panel, style: EnvelopeTemplateStyle) {
  return items.map((item, index): ArtworkLayer => {
    if (item.surfaceId && item.surfaceId !== "envelope-front") return item;
    if (item.kind === "stripe-pattern") {
      return {
        ...item,
        color: style === "cute" ? item.color : style === "adult" ? "#b7aa9e" : "#d8d3ce",
        opacity: Math.min(item.opacity, style === "cute" ? 0.38 : style === "adult" ? 0.2 : 0.14),
        stripeWidthMm: style === "cute" ? 4 : 2,
        gapMm: style === "cute" ? 7 : style === "adult" ? 11 : 14,
      };
    }
    if (item.kind === "dot-pattern") {
      return {
        ...item,
        color: style === "cute" ? item.color : style === "adult" ? "#b7aa9e" : "#d8d3ce",
        opacity: Math.min(item.opacity, style === "cute" ? 0.34 : style === "adult" ? 0.18 : 0.12),
        dotDiameterMm: style === "cute" ? 4 : 2,
        spacingMm: style === "cute" ? 16 : style === "adult" ? 22 : 26,
      };
    }
    if (item.repeat) {
      return {
        ...item,
        opacity: Math.min(item.opacity, style === "cute" ? 0.28 : style === "adult" ? 0.16 : 0.1),
        widthMm: roundMm(clamp(item.widthMm, 10, style === "cute" ? 26 : 20), 1),
        repeatGapMm: style === "cute" ? 8 : style === "adult" ? 16 : 20,
      };
    }
    const anchor = STAMP_ANCHORS[style][index % STAMP_ANCHORS[style].length];
    const point = at(panel, ...anchor);
    return {
      ...item,
      offsetXmm: point.x,
      offsetYmm: point.y,
      widthMm: roundMm(clamp(panel.width * (style === "cute" ? 0.2 : style === "adult" ? 0.13 : 0.11), 8, 34), 1),
      opacity: style === "adult" ? Math.min(item.opacity, 0.82) : item.opacity,
      rotationDeg: style === "cute" ? ([0, 90, 0, 270] as const)[index % 4] : 0,
    };
  });
}

function arrangeStamps(items: StampItem[], panel: Panel, style: EnvelopeTemplateStyle) {
  return items.map((item, index): StampItem => {
    if (item.surfaceId && item.surfaceId !== "envelope-front") return item;
    const anchor = STAMP_ANCHORS[style][index % STAMP_ANCHORS[style].length];
    const point = at(panel, ...anchor);
    const widthRatio = style === "cute" ? 0.2 : style === "adult" ? 0.12 : 0.1;
    return {
      ...item,
      xMm: point.x,
      yMm: point.y,
      widthMm: roundMm(clamp(panel.width * widthRatio, 7, style === "cute" ? 34 : 22), 1),
      rotationDeg: style === "cute" ? [-7, 5, -3, 7][index % 4] : 0,
      opacity: style === "adult" ? Math.min(item.opacity, 0.86) : item.opacity,
    };
  });
}

function arrangeTexts(items: TextItem[], panel: Panel, style: EnvelopeTemplateStyle) {
  return items.map((item, index): TextItem => {
    if (item.surfaceId && item.surfaceId !== "envelope-front") return item;
    const anchor = TEXT_ANCHORS[style][index % TEXT_ANCHORS[style].length];
    const point = at(panel, ...anchor);
    return {
      ...item,
      xMm: point.x,
      yMm: point.y,
      fontSizeMm: roundMm(clamp(item.fontSizeMm * (style === "cute" ? 1 : style === "adult" ? 0.78 : 0.72), 2.5, 8), 1),
      color: style === "cute" ? item.color : style === "adult" ? "#665d55" : "#5f5a56",
      letterSpacingMm: style === "adult" ? 0.45 : style === "simple" ? 0.25 : item.letterSpacingMm,
      fontWeight: style === "cute" ? 700 : style === "adult" ? 500 : 500,
      arcMm: style === "cute" ? Math.min(item.arcMm, 3) : 0,
      labelColor: null,
      strokeColor: null,
      strokeWidthMm: 0,
    };
  });
}

export function arrangeEnvelopeTemplate(design: LayoutDesign, geometry: DielineGeometry, style: EnvelopeTemplateStyle): LayoutDesign {
  const panel = frontPanel(geometry);
  return {
    artworkLayers: arrangeArtwork(design.artworkLayers, panel, style),
    stamps: arrangeStamps(design.stamps, panel, style),
    texts: arrangeTexts(design.texts, panel, style),
  };
}

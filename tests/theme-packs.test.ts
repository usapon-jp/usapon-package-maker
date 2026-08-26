import { describe, expect, it } from "vitest";

import { appReducer, initialState } from "../src/app/app-state";
import { AUTUMN_THEME_PACK } from "../src/features/theme-packs/theme-pack-catalog";

describe("テーマパック", () => {
  it("秋カラーを役割付き設定データとして提供する", () => {
    expect(AUTUMN_THEME_PACK.colors.map((color) => color.role)).toEqual(expect.arrayContaining(["background", "text", "frame", "accent"]));
    expect(AUTUMN_THEME_PACK.stampKeys).toHaveLength(5);
  });

  it("再適用時は同じテーマ由来スタンプだけを置き換え、手動素材を残す", () => {
    const manual = { id: "manual", kind: "stamp" as const, role: "stamp" as const, pageId: "main" as const, name: "手動", xMm: 10, yMm: 10, widthMm: 10, rotationDeg: 0, visible: true, opacity: 1, assetRef: { kind: "builtin" as const, key: "usapon-box-rabbits" as const }, fileName: "usapon-box-rabbits.png", sourceType: "png" as const, dataUrl: "data:", aspectRatio: 1 };
    const oldPreset = { ...manual, id: "old", themePresetId: "autumn-letter-set:front" };
    const newPreset = { ...manual, id: "new", themePresetId: "autumn-letter-set:front" };
    const state = { ...initialState, stamps: [manual, oldPreset], texts: [{ id: "message", kind: "text" as const, role: "text" as const, pageId: "main" as const, text: "ありがとう", xMm: 10, yMm: 10, fontSizeMm: 5, color: "#000000", letterSpacingMm: 0, lineHeight: 1.2, alignment: "middle" as const, fontWeight: 500 as const, arcMm: 0, strokeColor: null, strokeWidthMm: 0, labelColor: null, labelPaddingMm: 0 }] };
    const next = appReducer(state, { type: "apply-theme-pack", themePackId: AUTUMN_THEME_PACK.id, backgroundColors: AUTUMN_THEME_PACK.preset.pageBackgrounds, surfaceBackgroundColors: AUTUMN_THEME_PACK.preset.surfaceBackgrounds, lineColors: AUTUMN_THEME_PACK.preset.lineColors, envelopeDesign: AUTUMN_THEME_PACK.preset.envelopeDesign, textColor: AUTUMN_THEME_PACK.preset.textColor, stamps: [newPreset] });
    expect(next.stamps.map((stamp) => stamp.id)).toEqual(["manual", "new"]);
    expect(next.themePackId).toBe(AUTUMN_THEME_PACK.id);
    expect(next.texts[0].color).toBe(AUTUMN_THEME_PACK.preset.textColor);
  });
});

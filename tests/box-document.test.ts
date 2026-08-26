import { describe, expect, it, vi } from "vitest";

import { hydrateBoxDocument, parseBoxDocument, serializeBoxDocument } from "../src/app/box-document";
import { initialState } from "../src/app/app-state";
import type { AppState } from "../src/app/app-types";
import type { BoxType } from "../src/domain/boxes/types";
import { DEFAULT_TEXT_STYLE } from "../src/features/auto-layout/text-layout";

const USER_ASSET_ID = "c0a8012e-fb4a-4e8b-aac1-33ea68be17c1";

function stateFor(type: BoxType): AppState {
  return {
    ...initialState,
    screen: "print",
    box: { ...initialState.box, type },
    activePageId: type === "two-piece-gift-box-v1" ? "base" : "main",
    backgroundColors: { main: "#ffffff", lid: "#fff1dc", base: "#f7f0e8", letter: "#fffdf9", card: "#fffdf9" },
    artworkLayers: [
      {
        id: "uploaded-layer",
        kind: "uploaded-artwork",
        role: "background",
        pageId: type === "two-piece-gift-box-v1" ? "lid" : "main",
        name: "pattern.svg",
        assetRef: { kind: "user", assetId: USER_ASSET_ID },
        fileName: "pattern.svg",
        sourceType: "svg",
        dataUrl: "data:image/svg+xml;base64,SHOULD_NOT_BE_SAVED",
        blob: new Blob(["<svg viewBox='0 0 2 1'/>"]),
        aspectRatio: 2,
        widthMm: 32,
        repeat: true,
        repeatGapMm: 0,
        rotationDeg: 90,
        visible: true,
        opacity: 0.8,
        offsetXmm: 12,
        offsetYmm: 14,
      },
      {
        id: "stripe-layer",
        kind: "stripe-pattern",
        role: "background",
        pageId: type === "two-piece-gift-box-v1" ? "base" : "main",
        name: "ストライプ",
        color: "#f6d96f",
        stripeWidthMm: 4,
        gapMm: 6,
        angleDeg: 45,
        visible: true,
        opacity: 0.6,
        offsetXmm: 2,
        offsetYmm: 3,
      },
    ],
    stamps: [{
      id: "builtin-stamp-layer",
      kind: "stamp",
      role: "stamp",
      pageId: type === "two-piece-gift-box-v1" ? "base" : "main",
      name: "Pofumofu friends",
      assetRef: { kind: "builtin", key: "pofumofu-friends" },
      fileName: "pofumofu-friends.png",
      sourceType: "png",
      dataUrl: "data:image/png;base64,SHOULD_NOT_BE_SAVED",
      aspectRatio: 1,
      xMm: 20,
      yMm: 21,
      widthMm: 18,
      rotationDeg: 270,
      visible: true,
      opacity: 1,
    }],
    texts: [{
      id: "text-layer",
      kind: "text",
      ...DEFAULT_TEXT_STYLE,
      pageId: type === "two-piece-gift-box-v1" ? "lid" : "main",
      text: "ありがとう",
      xMm: 10,
      yMm: 11,
      fontSizeMm: 4,
      color: "#5d4638",
    }],
    selectedArtworkId: "uploaded-layer",
    selectedStampId: "builtin-stamp-layer",
    selectedTextId: "text-layer",
    openEditorSection: "text",
    showGuides: false,
    lineColors: { cut: "#111111", fold: "#777777" },
    includeCalibrationPage: false,
  };
}

describe("BoxDocumentV1", () => {
  it.each<BoxType>([
    "straight-tuck-carton-v1",
    "gift-box-v1",
    "two-piece-gift-box-v1",
    "letter-paper-v1",
    "envelope-v1",
    "mini-card-v1",
  ])("%s をJSONへ往復できる", async (type) => {
    const source = stateFor(type);
    const document = serializeBoxDocument(source);
    const serialized = JSON.stringify(document);

    expect(document.schemaVersion).toBe(1);
    expect(serialized).not.toContain("data:image");
    expect(serialized).not.toContain("SHOULD_NOT_BE_SAVED");
    expect(serialized).not.toContain("selectedArtworkId");
    expect(serialized).not.toContain("openEditorSection");
    expect(document.design.artworkLayers[0]).toMatchObject({
      assetRef: { kind: "user", assetId: USER_ASSET_ID },
    });
    expect(document.design.stamps[0]).toMatchObject({
      assetRef: { kind: "builtin", key: "pofumofu-friends" },
    });

    const resolveAsset = vi.fn(async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));
    const restored = await hydrateBoxDocument(JSON.parse(serialized), resolveAsset);

    expect(restored.box).toEqual(source.box);
    expect(restored.backgroundColors).toEqual(source.backgroundColors);
    expect(restored.artworkLayers).toMatchObject(document.design.artworkLayers);
    expect(restored.stamps).toMatchObject(document.design.stamps);
    expect(restored.texts).toEqual(source.texts);
    expect(restored.lineColors).toEqual(source.lineColors);
    expect(restored.includeCalibrationPage).toBe(false);
    expect(restored.activePageId).toBe(type === "two-piece-gift-box-v1" ? "lid" : "main");
    expect(resolveAsset).toHaveBeenCalledTimes(2);
  });

  it("保存済みのN式ギフト箱は浅型差し込みギフト箱として開く", async () => {
    const legacy = serializeBoxDocument(stateFor("gift-box-v1")) as { box: { type: string } };
    legacy.box.type = "n-style-gift-box-v1";

    const restored = await hydrateBoxDocument(legacy, async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));

    expect(restored.box.type).toBe("gift-box-v1");
  });

  it("ユーザー画像を複数レイヤーで使っても参照だけを保持する", () => {
    const state = stateFor("straight-tuck-carton-v1");
    state.stamps = [{
      ...state.stamps[0],
      id: "user-stamp-layer",
      assetRef: { kind: "user", assetId: USER_ASSET_ID },
    }];
    const document = serializeBoxDocument(state);
    expect(document.design.artworkLayers[0]).toMatchObject({ assetRef: { kind: "user", assetId: USER_ASSET_ID } });
    expect(document.design.stamps[0]).toMatchObject({ assetRef: { kind: "user", assetId: USER_ASSET_ID } });
  });

  it("うさぽんBOXスタンプの内蔵参照を保存できる", () => {
    const state = stateFor("straight-tuck-carton-v1");
    state.stamps = [{
      ...state.stamps[0],
      name: "うさぽんBOX",
      assetRef: { kind: "builtin", key: "usapon-box-rabbits" },
      fileName: "usapon-box-rabbits.png",
      aspectRatio: 865 / 1024,
    }];

    const document = serializeBoxDocument(state);
    expect(document.design.stamps[0]).toMatchObject({
      name: "うさぽんBOX",
      assetRef: { kind: "builtin", key: "usapon-box-rabbits" },
      fileName: "usapon-box-rabbits.png",
    });
    expect(() => parseBoxDocument(document)).not.toThrow();
  });

  it("秋の便箋テンプレートと罫線設定と内蔵素材を保存して復元できる", async () => {
    const state = stateFor("letter-paper-v1");
    state.templateId = "autumn-letter-paper";
    state.showWritingLines = true;
    state.stamps = [{ ...state.stamps[0], assetRef: { kind: "builtin", key: "autumn-rabbit-acorn-hug" }, fileName: "autumn-rabbit-acorn-hug.png" }];

    const document = serializeBoxDocument(state);
    const restored = await hydrateBoxDocument(document, async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));

    expect(document.design).toMatchObject({ templateId: "autumn-letter-paper", showWritingLines: true });
    expect(restored.templateId).toBe("autumn-letter-paper");
    expect(restored.showWritingLines).toBe(true);
    expect(restored.stamps[0].assetRef).toEqual({ kind: "builtin", key: "autumn-rabbit-acorn-hug" });
  });

  it("テンプレート項目がない既存作品に後方互換の初期値を補う", async () => {
    const legacy = JSON.parse(JSON.stringify(serializeBoxDocument(stateFor("gift-box-v1")))) as {
      design: {
        templateId?: string | null;
        showWritingLines?: boolean;
        envelopeDesign?: unknown;
        stationerySetSelection?: string;
        surfaceBackgroundColors?: unknown;
        themePackId?: string | null;
        printGuideMode?: string;
        backgroundColors: Record<string, string>;
      };
    };
    delete legacy.design.templateId;
    delete legacy.design.showWritingLines;
    delete legacy.design.envelopeDesign;
    delete legacy.design.stationerySetSelection;
    delete legacy.design.surfaceBackgroundColors;
    delete legacy.design.themePackId;
    delete legacy.design.printGuideMode;
    delete legacy.design.backgroundColors.letter;
    delete legacy.design.backgroundColors.card;

    const restored = await hydrateBoxDocument(legacy, async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));

    expect(restored.templateId).toBeNull();
    expect(restored.showWritingLines).toBe(false);
    expect(restored.stationerySetSelection).toBe("envelope-only");
    expect(restored.surfaceBackgroundColors).toEqual({});
    expect(restored.themePackId).toBeNull();
    expect(restored.printGuideMode).toBe("assembly");
    expect(restored.envelopeDesign).toMatchObject({
      style: "simple",
      flapAccentEnabled: false,
      showAddressField: false,
      showAddressLines: false,
    });
    expect(restored.backgroundColors.letter).toBe("#fffdf9");
    expect(restored.backgroundColors.card).toBe("#fffdf9");
  });

  it("新しい折り返し項目がない既存V1作品も読み込める", async () => {
    const legacy = JSON.parse(JSON.stringify(serializeBoxDocument(stateFor("two-piece-gift-box-v1")))) as {
      box: { foldoverMm?: number };
      design: { printFoldoverLines?: boolean };
    };
    delete legacy.box.foldoverMm;
    delete legacy.design.printFoldoverLines;

    const parsed = parseBoxDocument(legacy);
    expect(parsed.box.foldoverMm).toBeUndefined();
    expect(parsed.design.printFoldoverLines).toBe(true);

    const restored = await hydrateBoxDocument(legacy, async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));
    expect(restored.box.foldoverMm).toBeUndefined();
    expect(restored.printFoldoverLines).toBe(true);
  });

  it("role・ロゴ装飾・パターン拡張がない既存V1作品へ既定値を補う", async () => {
    const legacy = JSON.parse(JSON.stringify(serializeBoxDocument(stateFor("straight-tuck-carton-v1")))) as {
      design: {
        artworkLayers: Array<Record<string, unknown>>;
        stamps: Array<Record<string, unknown>>;
        texts: Array<Record<string, unknown>>;
      };
    };
    for (const item of legacy.design.artworkLayers) {
      delete item.role;
      if (item.kind === "uploaded-artwork") delete item.repeatGapMm;
      if (item.kind === "dot-pattern") delete item.angleDeg;
    }
    for (const item of legacy.design.stamps) delete item.role;
    for (const item of legacy.design.texts) {
      delete item.role;
      delete item.letterSpacingMm;
      delete item.lineHeight;
      delete item.alignment;
      delete item.fontWeight;
      delete item.arcMm;
      delete item.strokeColor;
      delete item.strokeWidthMm;
      delete item.labelColor;
      delete item.labelPaddingMm;
    }

    const restored = await hydrateBoxDocument(legacy, async () => ({ dataUrl: "data:image/png;base64,RESTORED" }));
    expect(restored.artworkLayers.every((item) => item.role === "background")).toBe(true);
    expect(restored.stamps.every((item) => item.role === "stamp")).toBe(true);
    expect(restored.texts[0]).toMatchObject({
      role: "text",
      letterSpacingMm: 0,
      lineHeight: 1.25,
      alignment: "middle",
      fontWeight: 700,
      arcMm: 0,
      strokeColor: null,
      strokeWidthMm: 0,
      labelColor: null,
      labelPaddingMm: 1.8,
    });
  });

  it.each([
    null,
    {},
    { schemaVersion: 2 },
    { ...serializeBoxDocument(stateFor("gift-box-v1")), schemaVersion: 99 },
  ])("壊れたJSONや未対応バージョンを拒否する", (value) => {
    expect(() => parseBoxDocument(value)).toThrow("作品データの形式が壊れているか、このアプリではまだ開けません。");
  });
});

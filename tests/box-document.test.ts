import { describe, expect, it, vi } from "vitest";

import { hydrateBoxDocument, parseBoxDocument, serializeBoxDocument } from "../src/app/box-document";
import { initialState } from "../src/app/app-state";
import type { AppState } from "../src/app/app-types";
import type { BoxType } from "../src/domain/boxes/types";

const USER_ASSET_ID = "c0a8012e-fb4a-4e8b-aac1-33ea68be17c1";

function stateFor(type: BoxType): AppState {
  return {
    ...initialState,
    screen: "print",
    box: { ...initialState.box, type },
    activePageId: type === "two-piece-gift-box-v1" ? "base" : "main",
    backgroundColors: { main: "#ffffff", lid: "#fff1dc", base: "#f7f0e8" },
    artworkLayers: [
      {
        id: "uploaded-layer",
        kind: "uploaded-artwork",
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
        rotationDeg: 90,
        visible: true,
        opacity: 0.8,
        offsetXmm: 12,
        offsetYmm: 14,
      },
      {
        id: "stripe-layer",
        kind: "stripe-pattern",
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
    "n-style-gift-box-v1",
    "two-piece-gift-box-v1",
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

  it.each([
    null,
    {},
    { schemaVersion: 2 },
    { ...serializeBoxDocument(stateFor("gift-box-v1")), schemaVersion: 99 },
  ])("壊れたJSONや未対応バージョンを拒否する", (value) => {
    expect(() => parseBoxDocument(value)).toThrow("作品データの形式が壊れているか、このアプリではまだ開けません。");
  });
});

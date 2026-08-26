import { describe, expect, it } from "vitest";

import { appReducer, initialState } from "../src/app/app-state";
import { createStamp, createStripePattern } from "../src/app/artwork";
import type { BoxInput, StationerySetSelection } from "../src/domain/boxes/types";
import {
  calculateLetterPaperSize,
  calculateMiniCardSize,
  generateStationerySetDocument,
} from "../src/domain/boxes/stationery";
import { printImposition } from "../src/domain/paper/imposition";
import { adaptEnvelopeDesignToPage } from "../src/features/letter-set/design-sharing";

const envelope: BoxInput = {
  type: "envelope-v1",
  widthMm: 162,
  heightMm: 114,
  depthMm: 1,
  paperThicknessMm: 0.12,
  glueFlapMm: 12,
};

describe("封筒連動レターセット", () => {
  it.each([
    ["envelope-only", ["main"]],
    ["envelope-letter", ["main", "letter"]],
    ["envelope-card", ["main", "card"]],
    ["envelope-letter-card", ["main", "letter", "card"]],
  ] as Array<[StationerySetSelection, string[]]>) ("%s のページだけを生成する", (selection, expected) => {
    expect(generateStationerySetDocument(envelope, selection).pages.map((page) => page.id)).toEqual(expected);
  });

  it("便箋を2つ折り後に封筒へ周囲の余裕を残して収め、折り線を表示する", () => {
    const size = calculateLetterPaperSize(envelope);
    const page = generateStationerySetDocument(envelope, "envelope-letter").pages[1];

    expect(size).toMatchObject({ widthMm: 155.2, heightMm: 214.4, foldedWidthMm: 155.2, foldedHeightMm: 107.2, sideClearanceMm: 3.4, foldYmm: 107.2 });
    expect(size.foldedWidthMm).toBeLessThan(envelope.widthMm);
    expect(size.foldedHeightMm).toBeLessThan(envelope.heightMm);
    expect(page.geometry.layers.fold).toEqual([{ id: "letter-paper-center-fold", from: { x: 0, y: 107.2 }, to: { x: 155.2, y: 107.2 } }]);
  });

  it("ミニカードを自然な比率で封筒内へ収め、A4に複数面付けする", () => {
    const size = calculateMiniCardSize(envelope);
    const page = generateStationerySetDocument(envelope, "envelope-card").pages[1];

    expect(size).toEqual({ widthMm: 90.5, heightMm: 54.7, clearanceXmm: 35.8, clearanceYmm: 29.7 });
    expect(size.widthMm).toBeLessThan(envelope.widthMm);
    expect(size.heightMm).toBeLessThan(envelope.heightMm);
    expect(printImposition(page.geometry)).toMatchObject({ columns: 2, rows: 5, count: 10 });
  });

  it("封筒の素材を便箋の面形状へ縮尺・位置調整して共有する", () => {
    const document = generateStationerySetDocument(envelope, "envelope-letter");
    const sourceGeometry = document.pages[0].geometry;
    const targetGeometry = document.pages[1].geometry;
    const stamp = createStamp({ id: "rabbit", fileName: "rabbit.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, sourceGeometry);
    const stripe = createStripePattern("stripe", 1);
    const source = { backgroundColor: "#f9dde2", artworkLayers: [stripe], stamps: [stamp], texts: [] };
    const adapted = adaptEnvelopeDesignToPage(sourceGeometry, targetGeometry, "letter", source);

    expect(adapted.backgroundColor).toBe("#f9dde2");
    expect(adapted.artworkLayers[0]).toMatchObject({ id: "stripe--shared-letter", pageId: "letter" });
    expect(adapted.stamps[0]).toMatchObject({ id: "rabbit--shared-letter", pageId: "letter" });
    expect(adapted.stamps[0].xMm).not.toBe(stamp.xMm);
    expect(adapted.stamps[0].yMm).not.toBe(stamp.yMm);
    expect(source.stamps[0]).toEqual(stamp);
  });

  it("共有先だけを置き換え、封筒の手動編集を保持する", () => {
    const sourceStamp = { ...createStamp({ id: "source", fileName: "source.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, generateStationerySetDocument(envelope, "envelope-only").pages[0].geometry), pageId: "main" as const };
    const targetStamp = { ...sourceStamp, id: "target", pageId: "letter" as const };
    const state = { ...initialState, box: envelope, stamps: [sourceStamp], stationerySetSelection: "envelope-letter" as const };
    const next = appReducer(state, { type: "replace-stationery-set-design", pageIds: ["letter"], backgroundColors: { letter: "#f9dde2" }, artworkLayers: [], stamps: [targetStamp], texts: [] });

    expect(next.stamps).toEqual([sourceStamp, targetStamp]);
    expect(next.backgroundColors.letter).toBe("#f9dde2");
    expect(next.backgroundColors.main).toBe(state.backgroundColors.main);
  });
});

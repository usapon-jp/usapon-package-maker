import { describe, expect, it } from "vitest";

import { appReducer, initialState } from "../src/app/app-state";
import { createDotPattern, createStamp, createUploadedArtwork } from "../src/app/artwork";
import type { LayoutDesign } from "../src/features/auto-layout/types";
import { arrangeDesign } from "../src/features/auto-layout/layout-engine";
import { packageSafetyScore } from "../src/features/auto-layout/package-safe-area";
import { createTextItem, textRect } from "../src/features/auto-layout/text-layout";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";
import { generateGiftBox } from "../src/domain/boxes/gift-box";
import { generateTwoPieceGiftBox } from "../src/domain/boxes/two-piece-gift-box";

const geometry = generateStraightTuckCarton(initialState.box);
const asset = {
  id: "layout-asset",
  fileName: "motif.svg",
  sourceType: "svg" as const,
  dataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'/%3E",
  aspectRatio: 1.25,
};

function sampleDesign(): LayoutDesign {
  const firstStamp = createStamp({ ...asset, id: "stamp-1" }, geometry, "主役");
  return {
    artworkLayers: [
      createDotPattern("dots", 1),
      { ...createUploadedArtwork({ ...asset, id: "background-photo" }, geometry), widthMm: 25 },
    ],
    stamps: [
      firstStamp,
      { ...firstStamp, id: "stamp-2", name: "サブ1", xMm: firstStamp.xMm + 3 },
      { ...firstStamp, id: "stamp-3", name: "サブ2", xMm: firstStamp.xMm - 3 },
    ],
    texts: [
      createTextItem("text-1", "main", "ありがとう", 28, 52),
      { ...createTextItem("text-2", "main", "USAPON", 31, 70), fontSizeMm: 4 },
    ],
  };
}

const naturalAll = {
  taste: "natural" as const,
  size: "standard" as const,
  density: "standard" as const,
  target: "all" as const,
  logoEnabled: false,
};

describe("ブラウザ内の自動デザイン調整", () => {
  it("同じseedなら同じ最良案を再現し、40候補を短時間で評価する", () => {
    const design = sampleDesign();
    const first = arrangeDesign({ geometry, design, settings: naturalAll, seed: 1208 });
    const second = arrangeDesign({ geometry, design, settings: naturalAll, seed: 1208 });

    expect(first.signature).toBe(second.signature);
    expect(first.score.total).toBe(second.score.total);
    expect(first.candidateCount).toBe(40);
    expect(first.elapsedMs).toBeLessThan(250);
    expect(first.score.overlap).toBeGreaterThan(35);
    first.texts.forEach((text) => {
      expect(packageSafetyScore(geometry, textRect(text), text.role)).toBeGreaterThanOrEqual(0.58);
    });
  });

  it("もう一回用のseedで一定品質を保った別案を返す", () => {
    const design = sampleDesign();
    const first = arrangeDesign({ geometry, design, settings: naturalAll, seed: "run-0" });
    const next = arrangeDesign({ geometry, design, settings: naturalAll, seed: "run-1", previousSignature: first.signature });

    expect(next.signature).not.toBe(first.signature);
    expect(next.score.total).toBeGreaterThan(40);
    expect(next.score.packageSafety).toBeGreaterThan(60);
  });

  it.each(["text", "background", "stamp"] as const)("%sだけの調整では対象外配列を変更しない", (target) => {
    const design = sampleDesign();
    const result = arrangeDesign({ geometry, design, settings: { ...naturalAll, target }, seed: target });

    if (target !== "background") expect(result.artworkLayers).toBe(design.artworkLayers);
    if (target !== "stamp") expect(result.stamps).toBe(design.stamps);
    if (target !== "text") expect(result.texts).toBe(design.texts);
    expect(result.candidateCount).toBe(16);
  });

  it("3テイストとロゴON/OFFを文字だけへ反映する", () => {
    const design = sampleDesign();
    const natural = arrangeDesign({ geometry, design, settings: { ...naturalAll, target: "text" }, seed: 1 });
    const popLogo = arrangeDesign({ geometry, design, settings: { ...naturalAll, taste: "pop", target: "text", logoEnabled: true }, seed: 2 });
    const elegant = arrangeDesign({ geometry, design, settings: { ...naturalAll, taste: "elegant", target: "text" }, seed: 3 });

    expect(natural.texts.every((item) => item.role === "text" && !item.strokeColor && !item.labelColor)).toBe(true);
    expect(popLogo.texts.every((item) => item.role === "logoText")).toBe(true);
    expect(popLogo.texts.some((item) => item.strokeColor || item.labelColor || item.arcMm > 0)).toBe(true);
    expect(elegant.texts.every((item) => item.letterSpacingMm >= natural.texts[0].letterSpacingMm)).toBe(true);
    expect(popLogo.artworkLayers).toBe(design.artworkLayers);
    expect(popLogo.stamps).toBe(design.stamps);
  });

  it("ポップ・大きめ・ぎっしり・ロゴONでも採用基準を下回らない", () => {
    const design = sampleDesign();
    design.texts[0] = { ...design.texts[0], text: "うさぽん\nありがとう" };
    design.stamps = design.stamps.map((item) => ({ ...item, aspectRatio: 0.84 }));
    const result = arrangeDesign({
      geometry,
      design,
      settings: { taste: "pop", size: "large", density: "dense", target: "all", logoEnabled: true },
      seed: "pop-dense-logo",
    });

    const textSafeties = result.texts.map((item) => ({ id: item.id, rect: textRect(item), safety: packageSafetyScore(geometry, textRect(item), item.role), item }));
    expect(result.score.meetsThreshold, JSON.stringify({ score: result.score, textSafeties })).toBe(true);
    expect(result.score.total).toBeGreaterThanOrEqual(58);
    expect(result.score.overlap).toBeGreaterThan(45);
  });

  it("全面画像とパターン背景を別のパラメータで調整する", () => {
    const design = sampleDesign();
    const result = arrangeDesign({ geometry, design, settings: { ...naturalAll, target: "background", density: "dense" }, seed: 44 });
    const dots = result.artworkLayers.find((item) => item.kind === "dot-pattern");
    const full = result.artworkLayers.find((item) => item.kind === "uploaded-artwork");

    expect(dots?.angleDeg).toBeTypeOf("number");
    expect(dots?.spacingMm ?? 0).toBeGreaterThan(dots?.dotDiameterMm ?? 0);
    expect(full?.repeat).toBe(false);
    expect(full && full.widthMm).toBeGreaterThan(geometry.bounds.widthMm * 0.9);
  });

  it("Reducerの一括適用でも別ページと対象外要素を保持する", () => {
    const lidStamp = { ...createStamp({ ...asset, id: "lid-stamp" }, geometry, "蓋", "lid") };
    const baseStamp = { ...createStamp({ ...asset, id: "base-stamp" }, geometry, "本体", "base") };
    const state = { ...initialState, stamps: [lidStamp, baseStamp] };
    const moved = { ...lidStamp, xMm: lidStamp.xMm + 8 };
    const next = appReducer(state, { type: "apply-auto-layout", pageId: "lid", stamps: [moved] });

    expect(next.stamps.find((item) => item.id === "lid-stamp")?.xMm).toBe(moved.xMm);
    expect(next.stamps.find((item) => item.id === "base-stamp")).toBe(baseStamp);
    expect(next.artworkLayers).toBe(state.artworkLayers);
    expect(next.texts).toBe(state.texts);
  });

  it.each([
    ["キャラメル箱", geometry],
    ["浅型ギフト箱", generateGiftBox({ ...initialState.box, type: "gift-box-v1" })],
    ["ツーピース蓋", generateTwoPieceGiftBox({ ...initialState.box, type: "two-piece-gift-box-v1", widthMm: 100, heightMm: 75, depthMm: 40 }).pages[0].geometry],
  ] as const)("%sでも重要文字を折り線・断裁線・のりしろから離す", (_name, targetGeometry) => {
    const first = createStamp({ ...asset, id: "safe-stamp-1" }, targetGeometry, "主役");
    const design: LayoutDesign = {
      artworkLayers: [createDotPattern("safe-dots", 1)],
      stamps: [first, { ...first, id: "safe-stamp-2" }],
      texts: [createTextItem("safe-text", "main", "大切な名前", targetGeometry.panels[0].x, targetGeometry.panels[0].y)],
    };
    const result = arrangeDesign({ geometry: targetGeometry, design, settings: naturalAll, seed: _name });

    expect(result.score.meetsThreshold, JSON.stringify(result.score)).toBe(true);
    expect(packageSafetyScore(targetGeometry, textRect(result.texts[0]), result.texts[0].role)).toBeGreaterThanOrEqual(0.58);
  });
});

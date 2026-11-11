import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { initialState, appReducer } from "../src/app/app-state";
import { createStamp } from "../src/app/artwork";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import { evaluateA4Fit } from "../src/domain/paper/a4";
import { printImposition } from "../src/domain/paper/imposition";
import { templateById } from "../src/features/templates/template-catalog";
import { hydrateBoxDocument, serializeBoxDocument } from "../src/app/box-document";
import { previousScreen } from "../src/app/navigation";

const geometry = generateDielineDocument(templateById("basic-mini-card")!.box).pages[0].geometry;
const fit = evaluateA4Fit(printImposition(geometry).widthMm, printImposition(geometry).heightMm);
const stamps = ["red", "blue"].map((name) => ({ ...createStamp({ id: name, fileName: name + ".png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1, assetRef: { kind: "builtin", key: "usapon-box-rabbits" } }, geometry), id: name }));
const props = { geometry, fit, backgroundColor: "#ffffff", artworkLayers: [], stamps, texts: [], lineColors: initialState.lineColors };

describe("個別の文具制作と画像ごとの印刷", () => {
  it("3種類は単独ページとして始まり、各制作画面からホームへ戻れる", () => {
    for (const id of ["y2-kamasu-envelope", "basic-letter-paper", "basic-mini-card"]) {
      const pages = generateDielineDocument(templateById(id)!.box).pages;
      expect(pages).toHaveLength(1);
      expect(previousScreen("design", id)).toBe("home");
    }
  });
  it("画像を2枚ずつ印刷し、残りは白紙にする", () => {
    const markup = renderToStaticMarkup(<A4ExportSvg {...props} cardPrintCounts={{ red: 2, blue: 2 }} />);
    expect(markup.match(/data-imposition-item=/g)).toHaveLength(4);
    expect(markup.match(/data-stamp-id="red"/g)).toHaveLength(2);
    expect(markup.match(/data-stamp-id="blue"/g)).toHaveLength(2);
  });
  it("同じ画像で全面、または元のデザイン全体で全面にできる", () => {
    const same = renderToStaticMarkup(<A4ExportSvg {...props} cardPrintCounts={{ blue: 10 }} />);
    expect(same.match(/data-stamp-id="blue"/g)).toHaveLength(10);
    expect(same).not.toContain('data-stamp-id="red"');
    const full = renderToStaticMarkup(<A4ExportSvg {...props} />);
    expect(full.match(/data-stamp-id="red"/g)).toHaveLength(10);
    expect(full.match(/data-stamp-id="blue"/g)).toHaveLength(10);
  });
  it("枚数設定を保存・復元し、削除した画像の枚数は残さない", async () => {
    const state = { ...initialState, box: geometry.input, stamps, cardPrintCounts: { red: 2, blue: 2 } };
    const restored = await hydrateBoxDocument(serializeBoxDocument(state), async () => ({ dataUrl: "data:image/png;base64,AA==" }));
    expect(restored.cardPrintCounts).toEqual({ red: 2, blue: 2 });
    const migrated = appReducer(state, { type: "remove-stamp", id: "red" });
    expect(migrated.cardPrintCounts).toBeUndefined();
    expect(migrated.miniCardProject?.designs.map((design) => design.copies)).toEqual([2]);
    expect(migrated.miniCardProject?.designs[0].data.stamps.map((stamp) => stamp.id)).toEqual(["blue"]);
  });
  it("印刷の初期状態では案内文字を出さず、自分の文字は残す", () => {
    const envelope = generateDielineDocument(templateById("y2-kamasu-envelope")!.box).pages[0].geometry;
    const markup = renderToStaticMarkup(<A4ExportSvg {...props} geometry={envelope} stamps={[]} />);
    expect(markup).not.toContain("のりしろ</text>");
    expect(markup).not.toContain("B 中央");
    expect(markup).toContain('data-layer="cut"');
    expect(markup).toContain('data-layer="fold"');
    expect(appReducer({ ...initialState, printGuideMode: "assembly" }, { type: "go", screen: "print" }).printGuideMode).toBe("design");
  });
});

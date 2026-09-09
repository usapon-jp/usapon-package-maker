import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { createStamp } from "../src/app/artwork";
import { createTextItem } from "../src/features/auto-layout/text-layout";
import { A4ExportSvg, A4PreviewSvg } from "../src/components/dieline/A4ExportSvg";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import { evaluateA4Fit } from "../src/domain/paper/a4";
import { printImposition } from "../src/domain/paper/imposition";
import { PACKAGE_TEMPLATES, stampSetsForTemplate, templateById } from "../src/features/templates/template-catalog";
import { DEFAULT_LETTER_SET_ENVELOPE } from "../src/features/letter-set/envelope-layout-templates";

describe("秋のレターセットテンプレート", () => {
  it("便箋・封筒・ミニカードを同じシリーズとおすすめ素材にまとめる", () => {
    const autumnTemplates = PACKAGE_TEMPLATES.filter((template) => template.seriesId === "autumn-letter-set");
    expect(autumnTemplates.map((template) => template.category)).toEqual(["letter-paper", "envelope", "card"]);
    expect(templateById("y2-kamasu-envelope")?.themePackId).toBeUndefined();
    for (const template of autumnTemplates) {
      expect(stampSetsForTemplate(template)[0]).toMatchObject({ name: "秋うさぎスタンプセット" });
      expect(template.themePackId).toBe("autumn-letter-set");
    }
    expect(templateById("autumn-mini-card")?.previewStampKey).toBe("autumn-rabbit-sleeping-sweet-potato");
  });

  it("便箋の罫線をプレビューと印刷元SVGでON/OFFできる", () => {
    const template = templateById("autumn-letter-paper")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);
    const props = { geometry, fit, backgroundColor: "#fffdf9", artworkLayers: [], stamps: [], texts: [], lineColors: initialState.lineColors };
    const withLines = renderToStaticMarkup(<A4PreviewSvg {...props} showWritingLines writingLineCount={12} writingLineWidthPercent={80} />);
    const withoutLines = renderToStaticMarkup(<A4ExportSvg {...props} showWritingLines={false} />);

    expect(fit.status).toBe("safe");
    expect(withLines).toContain('data-layer="writing-lines"');
    const writingLayer = withLines.match(/<g data-layer="writing-lines"[\s\S]*?<\/g>/)?.[0] ?? "";
    expect(writingLayer.match(/<line /g)).toHaveLength(12);
    expect(writingLayer).toContain('x1="19"');
    expect(withoutLines).not.toContain('data-layer="writing-lines"');
  });

  it("洋形2号カマス貼りを186×258mmで作り、A4縦へ実寸配置する", () => {
    const template = templateById("autumn-envelope")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

    expect(fit).toMatchObject({ status: "safe", orientation: "portrait", offsetXmm: 12, offsetYmm: 19.5 });
    expect(template.description).toContain("洋形2号");
    expect(geometry.panels.slice(0, 3).map((panel) => panel.label)).toEqual(["B 中央", "A フタ（完成向き）", "C 裏（完成向き）"]);
    expect(geometry.bounds).toMatchObject({ widthMm: 186, heightMm: 258 });
    expect(geometry.envelope).toMatchObject({ construction: "kamasu", topFlapMm: 30, bottomFlapMm: 114, glueWidthMm: 12 });
    expect(geometry.layers.cut).toHaveLength(1);
    expect(geometry.layers.cut[0].d).toContain("18,0");
    expect(geometry.layers.cut[0].d).toContain("186,149.7");
    expect(geometry.layers.cut[0].d).toContain("12,258");
    expect(geometry.layers.fold).toHaveLength(4);
    expect(geometry.layers.glue).toHaveLength(2);

    const printed = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" artworkLayers={[]} stamps={[]} texts={[]} lineColors={initialState.lineColors} />);
    expect(printed.match(/fill="#f6e8e2"/g)).toHaveLength(2);
    expect(printed.match(/>のりしろ<\/text>/g)).toHaveLength(2);
    expect(printed).not.toContain("のりしろ（完成時に隠れます）");
    expect(printed).toContain("B 中央");

    const designOnly = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" artworkLayers={[]} stamps={[]} texts={[]} lineColors={initialState.lineColors} printGuideMode="design" />);
    expect(designOnly).not.toContain('fill="#f6e8e2"');
    expect(designOnly).not.toContain(">のりしろ</text>");
    expect(designOnly).not.toContain("B 中央");
    expect(designOnly).toContain('data-layer="fold"');
    expect(designOnly).toContain('data-layer="cut"');
  });

  it("宛名線を白枠の中央へ揃え、意味のない装飾点を表示しない", () => {
    const template = templateById("y2-kamasu-envelope")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);
    const markup = renderToStaticMarkup(<A4PreviewSvg geometry={geometry} fit={fit} backgroundColor="#fff8f6" artworkLayers={[]} stamps={[]} texts={[]} lineColors={initialState.lineColors} envelopeDesign={DEFAULT_LETTER_SET_ENVELOPE.settings} />);
    const lines = [...markup.matchAll(/data-envelope-address-line="true" x1="([\d.]+)" x2="([\d.]+)"/g)];
    const front = geometry.panels.find((panel) => panel.id === "panel-envelope-front")!;

    expect(lines).toHaveLength(3);
    for (const line of lines) expect((Number(line[1]) + Number(line[2])) / 2).toBeCloseTo(front.x + front.width / 2, 5);
    expect(markup).not.toContain("<circle");
  });

  it("91×55mmカードをA4縦へ実寸のまま10面付けし、スタンプを複製する", () => {
    const template = templateById("autumn-mini-card")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const imposition = printImposition(geometry);
    const fit = evaluateA4Fit(imposition.widthMm, imposition.heightMm);
    const stamp = createStamp({ id: "autumn-stamp", fileName: "rabbit.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, geometry);
    const markup = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" artworkLayers={[]} stamps={[stamp]} texts={[]} lineColors={initialState.lineColors} />);

    expect(imposition).toEqual({ columns: 2, rows: 5, count: 10, widthMm: 182, heightMm: 275 });
    expect(fit).toMatchObject({ status: "safe", orientation: "portrait", offsetXmm: 14, offsetYmm: 11 });
    expect(markup).toContain('data-imposition-count="10"');
    expect(markup.match(/data-imposition-item=/g)).toHaveLength(10);
    expect(markup.match(/data-stamp-id="autumn-stamp"/g)).toHaveLength(10);
    expect(markup).toContain('transform="translate(105 231)"');
  });

  it("ミニカードの白い記入枠と罫線を中央へ揃えて全カードへ印刷する", () => {
    const template = templateById("autumn-mini-card")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const imposition = printImposition(geometry);
    const fit = evaluateA4Fit(imposition.widthMm, imposition.heightMm);
    const markup = renderToStaticMarkup(<A4PreviewSvg geometry={geometry} fit={fit} backgroundColor="#fffdf9" artworkLayers={[]} stamps={[]} texts={[]} lineColors={initialState.lineColors} showWritingFrame showWritingLines writingLineCount={3} writingLineWidthPercent={76} />);
    const writingLayers = [...markup.matchAll(/<g data-layer="writing-lines"[\s\S]*?<\/g>/g)].map((match) => match[0]);
    const firstLines = [...(writingLayers[0] ?? "").matchAll(/x1="([\d.]+)"[^>]*x2="([\d.]+)"/g)];

    expect(markup.match(/data-card-writing-frame="true"/g)).toHaveLength(10);
    expect(writingLayers).toHaveLength(10);
    expect(firstLines).toHaveLength(3);
    for (const line of firstLines) expect((Number(line[1]) + Number(line[2])) / 2).toBeCloseTo(geometry.bounds.x + geometry.bounds.widthMm / 2, 5);
  });

  it("A/B/C面別背景をクリップし、C裏の文字を完成向きへ180度補正できる", () => {
    const template = templateById("autumn-envelope")!;
    const geometry = generateDielineDocument(template.box).pages[0].geometry;
    const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);
    const text = { ...createTextItem("back-text", "main", "C 裏の文字", 93, 201), surfaceId: "envelope-back" as const, rotationDeg: 180 };
    const markup = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" surfaceBackgroundColors={{ "envelope-front": "#fff4dc", "envelope-flap": "#d8793f", "envelope-back": "#ead2ad" }} artworkLayers={[]} stamps={[]} texts={[text]} lineColors={initialState.lineColors} />);
    expect(markup).toContain("export-dieline-main-envelope-back-clip");
    expect(markup).toContain('fill="#ead2ad"');
    expect(markup).toContain('transform="rotate(180 93 201)"');
  });
});

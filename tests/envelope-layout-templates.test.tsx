import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { createStamp } from "../src/app/artwork";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { generateEnvelope } from "../src/domain/boxes/stationery";
import { evaluateA4Fit } from "../src/domain/paper/a4";
import { createTextItem } from "../src/features/auto-layout/text-layout";
import { arrangeEnvelopeTemplate, ENVELOPE_LAYOUT_TEMPLATES } from "../src/features/letter-set/envelope-layout-templates";

const input = { ...initialState.box, type: "envelope-v1" as const, widthMm: 120, heightMm: 80, glueFlapMm: 12 };
const geometry = generateEnvelope(input);
const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

describe("封筒の完成形レイアウトテンプレート", () => {
  it.each(["cute", "adult", "simple"] as const)("%s を宛名欄・上フラップ込みで印刷SVGへ反映する", (style) => {
    const definition = ENVELOPE_LAYOUT_TEMPLATES[style];
    const markup = renderToStaticMarkup(
      <A4ExportSvg
        geometry={geometry}
        fit={fit}
        backgroundColor={definition.backgroundColor}
        artworkLayers={[]}
        stamps={[]}
        texts={[]}
        lineColors={initialState.lineColors}
        envelopeDesign={definition.settings}
      />,
    );

    expect(markup).toContain(`data-envelope-template="${style}"`);
    expect(markup).toContain("data-envelope-flap-accent");
    expect(markup).toContain('data-envelope-address-field="visible"');
    expect(markup.match(/data-envelope-address-line/g)).toHaveLength(3);
    if (style === "adult") expect(markup).toContain("data-envelope-front-frame");
  });

  it("同じテンプレートは毎回同じ完成位置へ素材を流し込み、スタイル間では配置を変える", () => {
    const stamp = createStamp({ id: "rabbit", fileName: "rabbit.png", sourceType: "png", dataUrl: "data:image/png;base64,AA==", aspectRatio: 1 }, geometry);
    const text = createTextItem("thanks", "main", "ありがとう", 20, 20);
    const source = { artworkLayers: [], stamps: [stamp], texts: [text] };
    const cuteA = arrangeEnvelopeTemplate(source, geometry, "cute");
    const cuteB = arrangeEnvelopeTemplate(source, geometry, "cute");
    const adult = arrangeEnvelopeTemplate(source, geometry, "adult");
    const front = geometry.panels[0];

    expect(cuteA).toEqual(cuteB);
    expect(cuteA.stamps[0]).not.toMatchObject({ xMm: adult.stamps[0].xMm, yMm: adult.stamps[0].yMm, widthMm: adult.stamps[0].widthMm });
    expect(cuteA.stamps[0].xMm).toBeGreaterThan(front.x);
    expect(cuteA.stamps[0].xMm).toBeLessThan(front.x + front.width);
    expect(cuteA.stamps[0].yMm).toBeGreaterThan(front.y);
    expect(cuteA.stamps[0].yMm).toBeLessThan(front.y + front.height);
    expect(source.stamps[0]).toEqual(stamp);
  });

  it("詳細設定で上フラップ・宛名欄・宛名線を個別にOFFにできる", () => {
    const settings = { ...ENVELOPE_LAYOUT_TEMPLATES.simple.settings, flapAccentEnabled: false, showAddressField: false, showAddressLines: false };
    const markup = renderToStaticMarkup(<A4ExportSvg geometry={geometry} fit={fit} backgroundColor="#ffffff" artworkLayers={[]} stamps={[]} texts={[]} lineColors={initialState.lineColors} envelopeDesign={settings} />);

    expect(markup).not.toContain("data-envelope-flap-accent");
    expect(markup).not.toContain("data-envelope-address-field");
    expect(markup).not.toContain("data-envelope-address-line");
  });
});

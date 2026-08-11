import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { appReducer, DEFAULT_DIELINE_LINE_COLORS, initialState } from "../src/app/app-state";
import { A4ExportSvg } from "../src/components/dieline/A4ExportSvg";
import { generateStraightTuckCarton } from "../src/domain/boxes/straight-tuck-carton";
import { evaluateA4Fit } from "../src/domain/paper/a4";

const geometry = generateStraightTuckCarton(initialState.box);
const fit = evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm);

describe("展開図の線色", () => {
  it("目立ちにくいベージュを初期色にする", () => {
    expect(initialState.lineColors).toEqual(DEFAULT_DIELINE_LINE_COLORS);
    expect(initialState.lineColors).toEqual({ cut: "#a69888", fold: "#c3b7a8" });
  });

  it("カット線と折り線を個別または一括で変更できる", () => {
    const cutChanged = appReducer(initialState, { type: "set-line-color", layer: "cut", color: "#8f8172" });
    expect(cutChanged.lineColors).toEqual({ cut: "#8f8172", fold: "#c3b7a8" });

    const bothChanged = appReducer(cutChanged, {
      type: "set-line-colors",
      colors: { cut: "#918b84", fold: "#bbb5ae" },
    });
    expect(bothChanged.lineColors).toEqual({ cut: "#918b84", fold: "#bbb5ae" });
  });

  it("選択色をA4 PDF用SVGのカット・折りレイヤーへ反映する", () => {
    const markup = renderToStaticMarkup(
      <A4ExportSvg
        geometry={geometry}
        fit={fit}
        backgroundColor={initialState.backgroundColor}
        artworkLayers={[]}
        stamps={[]}
        texts={[]}
        lineColors={{ cut: "#8f8172", fold: "#bbb5ae" }}
      />,
    );

    expect(markup).toContain('data-layer="cut"');
    expect(markup).toContain('stroke="#8f8172"');
    expect(markup).toContain('data-layer="fold"');
    expect(markup).toContain('stroke="#bbb5ae"');
  });
});

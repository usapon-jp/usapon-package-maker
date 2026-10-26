import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { initialState } from "../src/app/app-state";
import { StationeryTurntable } from "../src/components/common/StationeryTurntable";
import { generateDielineDocument } from "../src/domain/boxes/registry";
import type { BoxInput } from "../src/domain/boxes/types";

const render = (type: BoxInput["type"]) => {
  const box = { ...initialState.box, type } as BoxInput;
  const page = generateDielineDocument(box).pages[0];
  return renderToStaticMarkup(<StationeryTurntable state={{ ...initialState, box }} pageId={page.id} geometry={page.geometry} />);
};

describe("便箋・カード・封筒の3D完成イメージ", () => {
  it.each(["letter-paper-v1", "mini-card-v1", "envelope-v1"] as const)("%s は表と裏の2面を持ち、ドラッグで回せる", (type) => {
    const html = render(type);
    expect(html).toContain('data-finished-face="front"');
    expect(html).toContain('data-finished-face="back"');
    expect(html).toContain("ドラッグで回せます");
    expect(html).toContain("完成イメージ・斜め");
  });
  it("封筒は表と裏を別のSVGで描き、便箋の裏は白紙になる", () => {
    expect(render("envelope-v1")).toContain("うら（A・C）");
    expect(render("envelope-v1")).toContain("face-back-svg");
    expect(render("letter-paper-v1")).toContain("finished-turntable-blank");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoxTypeIcon } from "../src/components/icons/BoxTypeIcon";
import type { BoxType } from "../src/domain/boxes/types";

const BOX_TYPES: BoxType[] = [
  "straight-tuck-carton-v1",
  "gift-box-v1",
  "two-piece-gift-box-v1",
];

describe("箱形式アイコン", () => {
  it.each(BOX_TYPES)("%s を共通仕様のSVGで描画する", (type) => {
    const markup = renderToStaticMarkup(<BoxTypeIcon type={type} />);

    expect(markup).toContain('viewBox="0 0 64 48"');
    expect(markup).toContain('fill="none"');
    expect(markup).toContain('stroke="currentColor"');
    expect(markup).toContain('stroke-width="1.8"');
    expect(markup).toContain('stroke-linecap="round"');
    expect(markup).toContain('stroke-linejoin="round"');
  });

  it("3形式をそれぞれ異なる線画で描き分ける", () => {
    const markups = BOX_TYPES.map((type) => renderToStaticMarkup(<BoxTypeIcon type={type} />));

    expect(new Set(markups).size).toBe(BOX_TYPES.length);
  });
});

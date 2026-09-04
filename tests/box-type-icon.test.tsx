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
  it.each(BOX_TYPES)("%s を指定イラストの表示枠として描画する", (type) => {
    const markup = renderToStaticMarkup(<BoxTypeIcon type={type} />);

    expect(markup).toContain('preserveAspectRatio="none"');
    expect(markup).toContain('<image');
    expect(markup).toContain('width="2048"');
    expect(markup).toContain('height="2048"');
  });

  it("3形式をそれぞれ対応する指定イラストで描き分ける", () => {
    const markups = BOX_TYPES.map((type) => renderToStaticMarkup(<BoxTypeIcon type={type} />));

    expect(new Set(markups).size).toBe(BOX_TYPES.length);
    expect(markups[0]).toContain('/assets/box-caramel.png');
    expect(markups[1]).toContain('/assets/box-shallow.png');
    expect(markups[2]).toContain('/assets/box-two-piece.png');
  });
});

// @ts-expect-error Vitest runs in Node, while the browser app intentionally omits Node globals from tsconfig.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalCss = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
const workspaceCss = readFileSync(new URL("../src/styles/design-workspace.css", import.meta.url), "utf8");

// デザイン画面の骨格（高さ・幅・並び）は design-workspace.css だけで決める。
// global.css 側に戻ってくると、1か所の修正が別の画面幅で崩れる状態に逆戻りする。
const SKELETON = /(?:^|[\s,>])\.(?:editor-layout|editor-canvas-panel|editor-stage|editor-controls)(?:[.:][^\s{,]*)?\s*\{([^}]*)\}/gm;
const SIZE_PROPS = /(?:^|[;\s{])(?:height|min-height|max-height|flex|grid-template-columns)\s*:/;

describe("design workspace stylesheet", () => {
  it("keeps the design screen skeleton out of global.css", () => {
    const offending = [...globalCss.matchAll(SKELETON)].filter((match) => SIZE_PROPS.test(match[1])).map((match) => match[0].trim().slice(0, 80));
    expect(offending).toEqual([]);
  });

  it("does not need !important to win", () => {
    expect(workspaceCss).not.toContain("!important");
  });

  it("lets the canvas take the remaining space on phones and PCs", () => {
    expect(workspaceCss).toMatch(/\.editor-canvas-panel \{ flex: 1 1 auto;/);
    expect(workspaceCss).toMatch(/grid-template-columns: minmax\(0, 1fr\) var\(--design-controls-width\)/);
  });
});

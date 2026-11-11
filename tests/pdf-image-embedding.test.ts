import { afterEach, expect, it, vi } from "vitest";
import { embedPdfImages } from "../src/lib/pdf/export-a4-pdf";

function source(hrefs: string[]) {
  const images = hrefs.map((href) => {
    const attributes = new Map([["href", href]]);
    return { getAttribute: (name: string) => attributes.get(name) ?? null, getAttributeNS: () => null, setAttribute: (name: string, value: string) => attributes.set(name, value), removeAttributeNS: vi.fn() };
  });
  return { images, svg: { querySelectorAll: () => images } as unknown as SVGSVGElement };
}
afterEach(() => vi.unstubAllGlobals());

it("繰り返したblob画像を1度だけ読み込み、全配置にPDF用データを埋め込む", async () => {
  const fetch = vi.fn(async () => ({ ok: true, blob: async () => new Blob(["png"], { type: "image/png" }) }));
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("FileReader", class {
    result = "data:image/png;base64,embedded";
    onload?: () => void;
    readAsDataURL() { this.onload?.(); }
  });
  const { svg, images } = source(["blob:uploaded-png", "blob:uploaded-png", "data:image/png;base64,existing"]);
  await embedPdfImages(svg);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(images.map((image) => image.getAttribute("href"))).toEqual(["data:image/png;base64,embedded", "data:image/png;base64,embedded", "data:image/png;base64,existing"]);
});

it("画像を取得できないときは欠けたPDFの保存を止める", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  await expect(embedPdfImages(source(["blob:missing-png"]).svg)).rejects.toThrow("PDFに使う画像を読み込めませんでした");
});

import { describe, expect, it, vi } from "vitest";

import { canSharePdfFile, createPdfShareFile, sharePdfFile } from "../src/lib/pdf/share-pdf";

describe("PDF共有", () => {
  const blob = new Blob(["pdf"], { type: "application/pdf" });

  it("PDF Blobを共有用Fileへ変換する", () => {
    const file = createPdfShareFile(blob, "box.pdf");

    expect(file.name).toBe("box.pdf");
    expect(file.type).toBe("application/pdf");
    expect(file.size).toBe(blob.size);
  });

  it("PDFファイル共有に対応したブラウザだけを有効にする", () => {
    const file = createPdfShareFile(blob, "box.pdf");
    const supported = { canShare: vi.fn(() => true), share: vi.fn(async () => undefined) };
    const unsupported = { canShare: vi.fn(() => false), share: vi.fn(async () => undefined) };

    expect(canSharePdfFile(file, supported)).toBe(true);
    expect(canSharePdfFile(file, unsupported)).toBe(false);
    expect(canSharePdfFile(file, {})).toBe(false);
  });

  it("作成済みPDFだけを共有画面へ渡す", async () => {
    const file = createPdfShareFile(blob, "box.pdf");
    const share = vi.fn(async () => undefined);

    await sharePdfFile(file, { share });

    expect(share).toHaveBeenCalledWith({ files: [file], title: "うさぽん パッケージPDF" });
  });
});

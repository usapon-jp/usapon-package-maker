type PdfShareNavigator = {
  canShare?: (data?: ShareData) => boolean;
  share?: (data?: ShareData) => Promise<void>;
};

function currentNavigator(): PdfShareNavigator {
  return typeof navigator === "undefined" ? {} : navigator;
}

export function createPdfShareFile(blob: Blob, fileName: string) {
  return new File([blob], fileName, { type: "application/pdf", lastModified: Date.now() });
}

export function createTimestampedPdfFileName(baseName: string, date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `${baseName.replace(/\.pdf$/i, "")}-${stamp}.pdf`;
}

export function canSharePdfFile(file: File, shareNavigator: PdfShareNavigator = currentNavigator()) {
  if (typeof shareNavigator.share !== "function" || typeof shareNavigator.canShare !== "function") return false;
  try {
    return shareNavigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function sharePdfFile(file: File, shareNavigator: PdfShareNavigator = currentNavigator()) {
  if (typeof shareNavigator.share !== "function") throw new Error("このブラウザはPDF共有に対応していません。");
  await shareNavigator.share({
    files: [file],
    title: "うさぽん パッケージPDF",
  });
}

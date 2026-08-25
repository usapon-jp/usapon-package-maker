export function downloadPdfBlob(blob: Blob, fileName = "usapon-package-a4.pdf") {
  const downloadUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Androidのダウンロード処理はブラウザ外へ渡るまで時間がかかることがある。
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
}

import { A4_PORTRAIT, DEFAULT_SAFE_MARGIN_MM, roundMm } from "../units";

export type FitStatus = "safe" | "paper-only" | "overflow";
export type PageOrientation = "portrait" | "landscape";

export type A4FitResult = {
  status: FitStatus;
  orientation: PageOrientation;
  pageWidthMm: number;
  pageHeightMm: number;
  safeMarginMm: number;
  offsetXmm: number;
  offsetYmm: number;
  excessWidthMm: number;
  excessHeightMm: number;
};

type Candidate = A4FitResult & { score: number };

function evaluateOrientation(
  netWidthMm: number,
  netHeightMm: number,
  orientation: PageOrientation,
  safeMarginMm: number,
): Candidate {
  const portrait = orientation === "portrait";
  const pageWidthMm = portrait ? A4_PORTRAIT.widthMm : A4_PORTRAIT.heightMm;
  const pageHeightMm = portrait ? A4_PORTRAIT.heightMm : A4_PORTRAIT.widthMm;
  const safeWidth = pageWidthMm - safeMarginMm * 2;
  const safeHeight = pageHeightMm - safeMarginMm * 2;
  const fitsSafe = netWidthMm <= safeWidth && netHeightMm <= safeHeight;
  const fitsPaper = netWidthMm <= pageWidthMm && netHeightMm <= pageHeightMm;
  const excessWidthMm = Math.max(0, netWidthMm - pageWidthMm);
  const excessHeightMm = Math.max(0, netHeightMm - pageHeightMm);
  const status: FitStatus = fitsSafe ? "safe" : fitsPaper ? "paper-only" : "overflow";
  const availableWidth = fitsSafe ? safeWidth : pageWidthMm;
  const availableHeight = fitsSafe ? safeHeight : pageHeightMm;
  const offsetXmm = (pageWidthMm - netWidthMm) / 2;
  const offsetYmm = (pageHeightMm - netHeightMm) / 2;
  const slack = Math.min(availableWidth - netWidthMm, availableHeight - netHeightMm);
  const score = status === "safe" ? 3000 + slack : status === "paper-only" ? 2000 + slack : -1000 - excessWidthMm - excessHeightMm;

  return {
    status,
    orientation,
    pageWidthMm,
    pageHeightMm,
    safeMarginMm,
    offsetXmm: roundMm(offsetXmm),
    offsetYmm: roundMm(offsetYmm),
    excessWidthMm: roundMm(excessWidthMm),
    excessHeightMm: roundMm(excessHeightMm),
    score,
  };
}

export function evaluateA4Fit(
  netWidthMm: number,
  netHeightMm: number,
  safeMarginMm = DEFAULT_SAFE_MARGIN_MM,
): A4FitResult {
  if (![netWidthMm, netHeightMm].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError("展開図サイズは0より大きいmm値で指定してください。");
  }
  const candidates = (["portrait", "landscape"] as const).map((orientation) =>
    evaluateOrientation(netWidthMm, netHeightMm, orientation, safeMarginMm),
  );
  const winner = candidates.sort((a, b) => b.score - a.score)[0];
  const { score: _score, ...result } = winner;
  return result;
}

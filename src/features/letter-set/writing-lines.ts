import { clamp } from "../../domain/units";

export const RECOMMENDED_LETTER_LINE_COUNT = 18;
export const RECOMMENDED_LETTER_LINE_WIDTH_PERCENT = 82;
export const RECOMMENDED_CARD_LINE_COUNT = 3;
export const RECOMMENDED_CARD_LINE_WIDTH_PERCENT = 76;
export const RECOMMENDED_ADDRESS_LINE_COUNT = 3;
export const RECOMMENDED_ADDRESS_LINE_WIDTH_PERCENT = 76;

export function centeredLineSpan(x: number, width: number, widthPercent: number) {
  const lineWidth = width * clamp(widthPercent, 40, 96) / 100;
  const x1 = x + (width - lineWidth) / 2;
  return { x1, x2: x1 + lineWidth };
}

export function evenlySpacedLineYs(y: number, height: number, count: number, topRatio = 0.22, bottomRatio = 0.82) {
  const safeCount = Math.max(1, Math.round(count));
  const start = y + height * topRatio;
  const end = y + height * bottomRatio;
  if (safeCount === 1) return [y + height / 2];
  return Array.from({ length: safeCount }, (_, index) => start + (end - start) * index / (safeCount - 1));
}

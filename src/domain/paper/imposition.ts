import type { DielineGeometry } from "../boxes/types";
import { A4_PORTRAIT, DEFAULT_SAFE_MARGIN_MM } from "../units";

export type PrintImposition = {
  columns: number;
  rows: number;
  count: number;
  widthMm: number;
  heightMm: number;
};

export function printImposition(geometry: DielineGeometry): PrintImposition {
  const { widthMm, heightMm } = geometry.bounds;
  if (geometry.type !== "mini-card-v1") return { columns: 1, rows: 1, count: 1, widthMm, heightMm };

  const candidates = [A4_PORTRAIT, { widthMm: A4_PORTRAIT.heightMm, heightMm: A4_PORTRAIT.widthMm }]
    .map((page) => {
      const columns = Math.max(1, Math.floor((page.widthMm - DEFAULT_SAFE_MARGIN_MM * 2) / widthMm));
      const rows = Math.max(1, Math.floor((page.heightMm - DEFAULT_SAFE_MARGIN_MM * 2) / heightMm));
      return { columns, rows, count: columns * rows, widthMm: columns * widthMm, heightMm: rows * heightMm };
    });

  return candidates.sort((left, right) => right.count - left.count)[0];
}

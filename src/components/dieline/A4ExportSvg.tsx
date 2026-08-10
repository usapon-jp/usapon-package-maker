import { forwardRef } from "react";

import type { PatternItem, TextItem } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import type { A4FitResult } from "../../domain/paper/a4";
import { DielineLayers } from "./DielineSvg";

type Props = {
  geometry: DielineGeometry;
  fit: A4FitResult;
  pattern: PatternItem | null;
  texts: TextItem[];
};

export const A4ExportSvg = forwardRef<SVGSVGElement, Props>(function A4ExportSvg(
  { geometry, fit, pattern, texts },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={`${fit.pageWidthMm}mm`}
      height={`${fit.pageHeightMm}mm`}
      viewBox={`0 0 ${fit.pageWidthMm} ${fit.pageHeightMm}`}
      data-export-document="dieline"
    >
      <rect width={fit.pageWidthMm} height={fit.pageHeightMm} fill="#ffffff" />
      <g transform={`translate(${fit.offsetXmm} ${fit.offsetYmm})`}>
        <DielineLayers
          geometry={geometry}
          pattern={pattern}
          texts={texts}
          showGuides={false}
          selectedTextId={null}
          exportMode
          idPrefix="export-dieline"
        />
      </g>
    </svg>
  );
});

export const CalibrationSvg = forwardRef<SVGSVGElement>(function CalibrationSvg(_, ref) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="210mm"
      height="297mm"
      viewBox="0 0 210 297"
      data-export-document="calibration"
    >
      <rect width="210" height="297" fill="#ffffff" />
      <g fill="#3b2e2b" fontFamily="Usapon Noto Sans JP, sans-serif">
        <text data-export-text="実寸印刷チェック" x="25" y="28" fontSize="7" fontWeight="700">
          実寸印刷チェック
        </text>
        <text data-export-text="100%／実際のサイズで印刷し、用紙に合わせないでください。" x="25" y="39" fontSize="3.8">
          100%／実際のサイズで印刷し、用紙に合わせないでください。
        </text>
        <text data-export-text="印刷後、定規で下の線と正方形が50mmか確認します。" x="25" y="47" fontSize="3.8">
          印刷後、定規で下の線と正方形が50mmか確認します。
        </text>
      </g>

      <g fill="none" stroke="#111111" strokeWidth="0.32">
        <line x1="30" y1="80" x2="80" y2="80" />
        <line x1="30" y1="76" x2="30" y2="84" />
        <line x1="80" y1="76" x2="80" y2="84" />
        <rect x="30" y="110" width="50" height="50" />
      </g>
      <g fill="#111111" fontFamily="Usapon Noto Sans JP, sans-serif" fontSize="4">
        <text data-export-text="50mm" x="55" y="73" textAnchor="middle">50mm</text>
        <text data-export-text="50 × 50mm" x="55" y="168" textAnchor="middle">50 × 50mm</text>
      </g>
      <g fill="#7c6762" fontFamily="Usapon Noto Sans JP, sans-serif" fontSize="3.5">
        <text data-export-text="50mmより短い／長い場合は、プリンター設定の拡大縮小を確認してください。" x="25" y="190">
          50mmより短い／長い場合は、プリンター設定の拡大縮小を確認してください。
        </text>
      </g>
    </svg>
  );
});

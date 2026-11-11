import { forwardRef } from "react";
import type { DielineGeometry } from "../../domain/boxes/types";
import { DielineLayers } from "../../components/dieline/DielineSvg";
import type { CardDesignData } from "./mini-card-project";
export const CardDesignSvg = forwardRef<SVGSVGElement, { data: CardDesignData; geometry: DielineGeometry; prefix: string }>(function CardDesignSvg({ data, geometry, prefix }, ref) {
  const clean = { ...geometry, layers: { ...geometry.layers, cut: [], fold: [], foldover: [], glue: [], guides: [] } };
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${geometry.bounds.widthMm} ${geometry.bounds.heightMm}`} width={`${geometry.bounds.widthMm}mm`} height={`${geometry.bounds.heightMm}mm`} role="img" aria-label="完成したカードのデザイン"><DielineLayers geometry={clean} backgroundColor={data.backgroundColor} artworkLayers={data.artworkLayers} stamps={data.stamps} texts={data.texts} lineColors={data.lineColors} showWritingFrame={data.showFrame} writingFrame={data.frame} showWritingLines={data.showLines} writingLineCount={data.lineCount} writingLineWidthPercent={data.lineWidth} showGuides={false} selectedArtworkId={null} selectedStampId={null} selectedTextId={null} exportMode idPrefix={prefix} printGuideMode="design" /></svg>;
});

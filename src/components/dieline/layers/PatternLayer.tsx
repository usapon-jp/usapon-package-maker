import type { PatternItem } from "../../../app/app-types";
import type { DielineGeometry } from "../../../domain/boxes/types";

type Props = {
  geometry: DielineGeometry;
  pattern: PatternItem | null;
  clipId: string;
  patternId: string;
};
export function PatternLayer({ geometry, pattern, clipId, patternId }: Props) {
  const tileWidth = pattern ? Math.max(5, pattern.tileWidthMm) : 5;
  const tileHeight = pattern ? tileWidth / Math.max(0.05, pattern.aspectRatio) : 5;

  return (
    <g data-layer="pattern" clipPath={`url(#${clipId})`}>
      <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill="#fffdf9" />
      {pattern?.repeat && (
        <>
          <defs>
            <pattern
              id={patternId}
              x={pattern.offsetXmm}
              y={pattern.offsetYmm}
              width={tileWidth}
              height={tileHeight}
              patternUnits="userSpaceOnUse"
            >
              <image href={pattern.dataUrl} width={tileWidth} height={tileHeight} preserveAspectRatio="xMidYMid meet" />
            </pattern>
          </defs>
          <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={`url(#${patternId})`} />
        </>
      )}
      {pattern && !pattern.repeat && (
        <image
          href={pattern.dataUrl}
          x={pattern.offsetXmm}
          y={pattern.offsetYmm}
          width={tileWidth}
          height={tileHeight}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
    </g>
  );
}

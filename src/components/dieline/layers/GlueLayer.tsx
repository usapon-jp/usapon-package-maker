import type { DielineGeometry } from "../../../domain/boxes/types";
import { pointsToString } from "../geometry-utils";

type Props = { geometry: DielineGeometry; patternId: string; exportMode: boolean };

export function GlueLayer({ geometry, patternId, exportMode }: Props) {
  return (
    <g data-layer="glue">
      <defs>
        <pattern id={patternId} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="4" stroke="#dc8795" strokeWidth="0.6" opacity="0.45" />
        </pattern>
      </defs>
      {geometry.layers.glue.map((region) => (
        <polygon
          key={region.id}
          points={pointsToString(region.points)}
          fill={exportMode ? "none" : `url(#${patternId})`}
          stroke="none"
        />
      ))}
      {!exportMode && (
        <text
          x={geometry.input.glueFlapMm / 2}
          y={(geometry.bodyTopMm + geometry.bodyBottomMm) / 2}
          fontSize="3"
          fill="#a65e6a"
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90 ${geometry.input.glueFlapMm / 2} ${(geometry.bodyTopMm + geometry.bodyBottomMm) / 2})`}
        >
          のりしろ
        </text>
      )}
    </g>
  );
}

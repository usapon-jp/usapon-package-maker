import type { DielineGeometry } from "../../../domain/boxes/types";

export function CutLayer({ geometry, color, strokeWidth = 0.34 }: { geometry: DielineGeometry; color: string; strokeWidth?: number }) {
  return (
    <g data-layer="cut" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {geometry.layers.cut.map((path) => (
        <path key={path.id} d={path.d} />
      ))}
    </g>
  );
}

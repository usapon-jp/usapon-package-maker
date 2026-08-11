import type { DielineGeometry } from "../../../domain/boxes/types";

export function CutLayer({ geometry, color }: { geometry: DielineGeometry; color: string }) {
  return (
    <g data-layer="cut" fill="none" stroke={color} strokeWidth="0.34" strokeLinecap="round" strokeLinejoin="round">
      {geometry.layers.cut.map((path) => (
        <path key={path.id} d={path.d} />
      ))}
    </g>
  );
}

import type { DielineGeometry } from "../../../domain/boxes/types";

export function CutLayer({ geometry }: { geometry: DielineGeometry }) {
  return (
    <g data-layer="cut" fill="none" stroke="#20262d" strokeWidth="0.34" strokeLinecap="round" strokeLinejoin="round">
      {geometry.layers.cut.map((path) => (
        <path key={path.id} d={path.d} />
      ))}
    </g>
  );
}

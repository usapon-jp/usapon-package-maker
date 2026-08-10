import type { DielineGeometry } from "../../../domain/boxes/types";

export function FoldLayer({ geometry }: { geometry: DielineGeometry }) {
  return (
    <g data-layer="fold" fill="none" stroke="#557aa4" strokeWidth="0.28" strokeDasharray="2 1.25">
      {geometry.layers.fold.map((line) => (
        <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
      ))}
    </g>
  );
}

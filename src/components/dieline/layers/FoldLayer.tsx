import type { DielineGeometry } from "../../../domain/boxes/types";

export function FoldLayer({ geometry, color, strokeWidth = 0.28 }: { geometry: DielineGeometry; color: string; strokeWidth?: number }) {
  return (
    <g data-layer="fold" fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray="2 1.25">
      {geometry.layers.fold.map((line) => (
        <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
      ))}
    </g>
  );
}

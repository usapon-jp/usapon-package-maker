import type { DielineGeometry } from "../../../domain/boxes/types";

export function FoldoverLayer({ geometry, color }: { geometry: DielineGeometry; color: string }) {
  if (geometry.layers.foldover.length === 0) return null;
  return (
    <g
      data-layer="foldover"
      fill="none"
      stroke={color}
      strokeWidth="0.4"
      strokeDasharray="2 1.25"
      strokeLinecap="round"
    >
      {geometry.layers.foldover.map((line) => (
        <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
      ))}
    </g>
  );
}

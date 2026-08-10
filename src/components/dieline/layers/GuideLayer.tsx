import type { DielineGeometry } from "../../../domain/boxes/types";

export function GuideLayer({ geometry }: { geometry: DielineGeometry }) {
  return (
    <g data-layer="guide" pointerEvents="none">
      <g fill="none" stroke="#e5a8b1" strokeWidth="0.18" strokeDasharray="1 1.5" opacity="0.75">
        {geometry.layers.guide.map((line) => (
          <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
        ))}
      </g>
      {geometry.panels.map((panel) => (
        <text
          key={panel.id}
          x={panel.x + panel.width / 2}
          y={panel.y + 4.5}
          fontSize="2.7"
          fill="#a86c75"
          textAnchor="middle"
        >
          {panel.label}
        </text>
      ))}
    </g>
  );
}

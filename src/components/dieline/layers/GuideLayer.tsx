import type { DielineGeometry } from "../../../domain/boxes/types";

export function GuideLayer({ geometry, assemblyOnly = false }: { geometry: DielineGeometry; assemblyOnly?: boolean }) {
  return (
    <g data-layer="guide" pointerEvents="none">
      {!assemblyOnly && <g fill="none" stroke="#e5a8b1" strokeWidth="0.18" strokeDasharray="1 1.5" opacity="0.75">
        {geometry.layers.guide.map((line) => (
          <line key={line.id} x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} />
        ))}
      </g>}
      {geometry.panels.map((panel) => {
        // GlueLayer owns the glue-flap labels in both editor and print views.
        // Keeping them out of this panel guide prevents duplicate text and
        // avoids a long label overflowing the narrow 12 mm side flap.
        if (panel.id.includes("-glue")) return null;

        return (
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
        );
      })}
    </g>
  );
}

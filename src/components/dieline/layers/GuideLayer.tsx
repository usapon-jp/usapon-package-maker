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
        // GlueLayer owns these labels in the print-only assembly guide.
        // Omitting them here prevents duplicate text in the exported PDF.
        if (assemblyOnly && panel.id.includes("-glue")) return null;

        // The side glue flaps on a Kamasu envelope are only 12 mm wide.
        // Keep their print label short so it stays within the A4 page rather
        // than extending beyond the cutting line.
        const label = panel.id.includes("-glue") ? "のりしろ" : panel.label;

        return (
          <text
            key={panel.id}
            x={panel.x + panel.width / 2}
            y={panel.y + 4.5}
            fontSize="2.7"
            fill="#a86c75"
            textAnchor="middle"
          >
            {label}
          </text>
        );
      })}
    </g>
  );
}

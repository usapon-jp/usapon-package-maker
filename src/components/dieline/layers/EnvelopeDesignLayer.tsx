import type { EnvelopeDesignSettings } from "../../../app/app-types";
import type { DielineGeometry } from "../../../domain/boxes/types";
import { clamp } from "../../../domain/units";
import { pointsToString } from "../geometry-utils";

type Props = { geometry: DielineGeometry; settings: EnvelopeDesignSettings; idPrefix: string };

const STYLE = {
  cute: { fieldWidth: 0.62, fieldHeight: 0.36, fieldY: 0.32, radius: 5, border: "#e9a3b0", line: "#c98a97", opacity: 0.94 },
  adult: { fieldWidth: 0.56, fieldHeight: 0.3, fieldY: 0.36, radius: 1.5, border: "#8f8379", line: "#928980", opacity: 0.82 },
  simple: { fieldWidth: 0.64, fieldHeight: 0.34, fieldY: 0.34, radius: 2, border: "#b8afa8", line: "#aaa29c", opacity: 0.9 },
} as const;

export function EnvelopeDesignLayer({ geometry, settings, idPrefix }: Props) {
  if (geometry.type !== "envelope-v1") return null;
  const front = geometry.panels.find((panel) => panel.id === "panel-envelope-front") ?? geometry.panels[0];
  const topFlap = geometry.clipPolygons.find((polygon) => polygon.id === "envelope-top-flap");
  const style = STYLE[settings.style];
  const margin = clamp(settings.marginMm, 4, Math.min(front.width, front.height) * 0.28);
  const fieldWidth = Math.min(front.width - margin * 2, front.width * style.fieldWidth);
  const fieldHeight = Math.min(front.height - margin * 2, front.height * style.fieldHeight);
  const fieldX = front.x + (front.width - fieldWidth) / 2;
  const fieldY = front.y + Math.min(front.height - margin - fieldHeight, Math.max(margin, front.height * style.fieldY));
  const patternId = `${idPrefix}-envelope-flap-${settings.flapPattern}`;
  const flapFill = settings.flapPattern === "solid" ? settings.flapColor : `url(#${patternId})`;
  const lineLeft = fieldX + Math.max(7, fieldWidth * 0.14);
  const lineRight = fieldX + fieldWidth - Math.max(7, fieldWidth * 0.1);
  return (
    <g data-layer="envelope-template" data-envelope-template={settings.style} pointerEvents="none">
      <defs>
        <pattern id={patternId} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill={settings.flapColor} />
          {settings.flapPattern === "dots" && <><circle cx="2.5" cy="2.5" r="1.1" fill="#ffffff" opacity="0.64" /><circle cx="7.5" cy="7.5" r="1.1" fill="#ffffff" opacity="0.64" /></>}
          {settings.flapPattern === "stripes" && <path d="M -2 2 L 2 -2 M 0 10 L 10 0 M 8 12 L 12 8" fill="none" stroke="#ffffff" strokeWidth="2.2" opacity="0.5" />}
        </pattern>
      </defs>
      {settings.flapAccentEnabled && topFlap && <polygon data-envelope-flap-accent points={pointsToString(topFlap.points)} fill={flapFill} />}
      {settings.style === "adult" && <rect data-envelope-front-frame x={front.x + margin} y={front.y + margin} width={front.width - margin * 2} height={front.height - margin * 2} fill="none" stroke="#8f8379" strokeWidth="0.45" opacity="0.72" />}
      {(settings.showAddressField || settings.showAddressLines) && (
        <g data-envelope-address-field={settings.showAddressField ? "visible" : "lines-only"}>
          {settings.showAddressField && <rect x={fieldX} y={fieldY} width={fieldWidth} height={fieldHeight} rx={style.radius} fill="#ffffff" fillOpacity={style.opacity} stroke={style.border} strokeWidth={settings.style === "cute" ? 0.65 : 0.4} />}
          {settings.showAddressLines && [0.34, 0.58, 0.82].map((ratio) => <line key={ratio} data-envelope-address-line x1={lineLeft} x2={lineRight} y1={fieldY + fieldHeight * ratio} y2={fieldY + fieldHeight * ratio} stroke={style.line} strokeWidth="0.45" strokeLinecap="round" />)}
          {settings.style === "cute" && <g fill={style.border} opacity="0.86"><circle cx={fieldX + 7} cy={fieldY + 8} r="1.2" /><circle cx={fieldX + 10.5} cy={fieldY + 5.5} r="0.8" /><circle cx={fieldX + 12.8} cy={fieldY + 9} r="0.65" /></g>}
        </g>
      )}
    </g>
  );
}

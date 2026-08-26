import type { PointerEvent, SVGProps } from "react";

import type { TextItem } from "../../../app/app-types";
import type { EnvelopeFaceId } from "../../../domain/boxes/types";
import { normalizeTextItem, textLineWidth, textRect } from "../../../features/auto-layout/text-layout";

type Props = {
  texts: TextItem[];
  selectedTextId: string | null;
  exportMode: boolean;
  onPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  surfaceClipIds?: Partial<Record<EnvelopeFaceId, string>>;
};

function textPaintProps(item: TextItem): SVGProps<SVGTextElement> {
  return {
    fill: item.color,
    stroke: item.strokeColor ?? undefined,
    strokeWidth: item.strokeColor ? item.strokeWidthMm : undefined,
    fontFamily: "Usapon Noto Sans JP, Noto Sans JP, sans-serif",
    fontSize: item.fontSizeMm,
    fontWeight: item.fontWeight,
    textAnchor: item.alignment,
    dominantBaseline: "middle",
    letterSpacing: item.letterSpacingMm,
    style: { paintOrder: "stroke fill" },
  };
}

function ArchedLine({ item, line, yMm }: { item: TextItem; line: string; yMm: number }) {
  const characters = [...line];
  const width = textLineWidth(item, line);
  const left = item.alignment === "start" ? item.xMm : item.alignment === "end" ? item.xMm - width : item.xMm - width / 2;
  const advance = characters.length > 0 ? width / characters.length : width;
  const halfWidth = Math.max(1, width / 2);
  return (
    <g data-text-arc={item.arcMm}>
      {characters.map((character, index) => {
        const x = left + advance * (index + 0.5);
        const normalized = (x - (left + width / 2)) / halfWidth;
        const y = yMm - item.arcMm * (1 - normalized * normalized);
        const angle = Math.atan((2 * item.arcMm * normalized) / halfWidth) * 180 / Math.PI;
        return (
          <text key={`${index}-${character}`} {...textPaintProps({ ...item, alignment: "middle" })} x={x} y={y} transform={`rotate(${angle} ${x} ${y})`}>
            {character}
          </text>
        );
      })}
    </g>
  );
}

export function TextLayer({ texts, selectedTextId, exportMode, onPointerDown, surfaceClipIds = {} }: Props) {
  return (
    <g data-layer="text">
      {texts.map((rawItem) => {
        const item = normalizeTextItem(rawItem);
        const bounds = textRect(item);
        const lines = item.text.split("\n");
        const firstLineY = item.yMm - Math.max(0, lines.length - 1) * item.fontSizeMm * item.lineHeight / 2;
        return (
          <g
            key={item.id}
            data-text-container={item.id}
            data-text-role={item.role}
            data-export-text={item.text}
            clipPath={item.surfaceId && surfaceClipIds[item.surfaceId] ? `url(#${surfaceClipIds[item.surfaceId]})` : undefined}
            transform={item.rotationDeg ? `rotate(${item.rotationDeg} ${item.xMm} ${item.yMm})` : undefined}
            style={{ cursor: exportMode ? "default" : "grab", touchAction: "none", userSelect: "none" }}
            onPointerDown={exportMode ? undefined : (event) => onPointerDown?.(event, item.id)}
          >
            {item.labelColor && (
              <rect
                data-text-label={item.id}
                x={bounds.x}
                y={bounds.y}
                width={bounds.width}
                height={bounds.height}
                rx={Math.min(3, item.labelPaddingMm)}
                fill={item.labelColor}
              />
            )}
            {!exportMode && selectedTextId === item.id && (
              <rect
                x={bounds.x - 1.5}
                y={bounds.y - 1.5}
                width={bounds.width + 3}
                height={bounds.height + 3}
                rx="1.2"
                fill="none"
                stroke="#ee6f83"
                strokeWidth="0.45"
                strokeDasharray="1.4 1"
                pointerEvents="none"
              />
            )}
            {lines.map((line, index) => {
              const yMm = firstLineY + index * item.fontSizeMm * item.lineHeight;
              return item.arcMm && line.length > 1
                ? <ArchedLine key={`${index}-${line}`} item={item} line={line} yMm={yMm} />
                : (
                  <text key={`${index}-${line}`} data-text-id={item.id} {...textPaintProps(item)} x={item.xMm} y={yMm}>
                    {line}
                  </text>
                );
            })}
          </g>
        );
      })}
    </g>
  );
}

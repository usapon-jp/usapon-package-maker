import type { PointerEvent } from "react";

import type { TextItem } from "../../../app/app-types";

type Props = {
  texts: TextItem[];
  selectedTextId: string | null;
  exportMode: boolean;
  onPointerDown?: (event: PointerEvent<SVGTextElement>, id: string) => void;
};

export function TextLayer({ texts, selectedTextId, exportMode, onPointerDown }: Props) {
  return (
    <g data-layer="text">
      {texts.map((item) => {
        const estimatedWidth = Math.max(item.fontSizeMm * 1.2, item.text.length * item.fontSizeMm * 0.62);
        return (
          <g key={item.id}>
            {!exportMode && selectedTextId === item.id && (
              <rect
                x={item.xMm - estimatedWidth / 2 - 1.5}
                y={item.yMm - item.fontSizeMm * 0.75}
                width={estimatedWidth + 3}
                height={item.fontSizeMm * 1.4}
                rx="1.2"
                fill="none"
                stroke="#ee6f83"
                strokeWidth="0.45"
                strokeDasharray="1.4 1"
                pointerEvents="none"
              />
            )}
            <text
              data-export-text={item.text}
              data-text-id={item.id}
              x={item.xMm}
              y={item.yMm}
              fill={item.color}
              fontFamily="Usapon Noto Sans JP, Noto Sans JP, sans-serif"
              fontSize={item.fontSizeMm}
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ cursor: exportMode ? "default" : "grab", touchAction: "none", userSelect: "none" }}
              onPointerDown={exportMode ? undefined : (event) => onPointerDown?.(event, item.id)}
            >
              {item.text}
            </text>
          </g>
        );
      })}
    </g>
  );
}

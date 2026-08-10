import { useId, useRef, type PointerEvent } from "react";

import type { PatternItem, TextItem } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { clamp } from "../../domain/units";
import { pointsToString } from "./geometry-utils";
import { CutLayer } from "./layers/CutLayer";
import { FoldLayer } from "./layers/FoldLayer";
import { GlueLayer } from "./layers/GlueLayer";
import { GuideLayer } from "./layers/GuideLayer";
import { PatternLayer } from "./layers/PatternLayer";
import { TextLayer } from "./layers/TextLayer";

type LayersProps = {
  geometry: DielineGeometry;
  pattern: PatternItem | null;
  texts: TextItem[];
  showGuides: boolean;
  selectedTextId: string | null;
  exportMode: boolean;
  idPrefix: string;
  onTextPointerDown?: (event: PointerEvent<SVGTextElement>, id: string) => void;
};

export function DielineLayers({
  geometry,
  pattern,
  texts,
  showGuides,
  selectedTextId,
  exportMode,
  idPrefix,
  onTextPointerDown,
}: LayersProps) {
  const clipId = `${idPrefix}-artwork-clip`;
  const artworkPatternId = `${idPrefix}-artwork-pattern`;
  const gluePatternId = `${idPrefix}-glue-hatch`;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {geometry.clipPolygons.map((polygon) => (
            <polygon key={polygon.id} points={pointsToString(polygon.points)} />
          ))}
        </clipPath>
      </defs>
      <PatternLayer geometry={geometry} pattern={pattern} clipId={clipId} patternId={artworkPatternId} />
      <TextLayer
        texts={texts}
        selectedTextId={selectedTextId}
        exportMode={exportMode}
        onPointerDown={onTextPointerDown}
      />
      <GlueLayer geometry={geometry} patternId={gluePatternId} exportMode={exportMode} />
      <FoldLayer geometry={geometry} />
      <CutLayer geometry={geometry} />
      {!exportMode && showGuides && <GuideLayer geometry={geometry} />}
    </>
  );
}

type Props = Omit<LayersProps, "idPrefix" | "onTextPointerDown"> & {
  onSelectText: (id: string | null) => void;
  onMoveText: (id: string, xMm: number, yMm: number) => void;
  className?: string;
};

export function DielineSvg({
  geometry,
  pattern,
  texts,
  showGuides,
  selectedTextId,
  exportMode,
  onSelectText,
  onMoveText,
  className,
}: Props) {
  const rawId = useId();
  const idPrefix = `preview-${rawId.replaceAll(":", "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const padding = Math.max(4, Math.min(12, geometry.bounds.widthMm * 0.06));

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM()?.inverse());
  };

  const handleTextPointerDown = (event: PointerEvent<SVGTextElement>, id: string) => {
    event.stopPropagation();
    const item = texts.find((text) => text.id === id);
    if (!item) return;
    const point = pointFromEvent(event);
    drag.current = { id, dx: item.xMm - point.x, dy: item.yMm - point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectText(id);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const point = pointFromEvent(event);
    onMoveText(
      drag.current.id,
      clamp(point.x + drag.current.dx, 0, geometry.bounds.widthMm),
      clamp(point.y + drag.current.dy, 0, geometry.bounds.heightMm),
    );
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`${-padding} ${-padding} ${geometry.bounds.widthMm + padding * 2} ${geometry.bounds.heightMm + padding * 2}`}
      role="img"
      aria-label="箱の実寸展開図プレビュー"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onSelectText(null);
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        drag.current = null;
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
    >
      <DielineLayers
        geometry={geometry}
        pattern={pattern}
        texts={texts}
        showGuides={showGuides}
        selectedTextId={selectedTextId}
        exportMode={exportMode}
        idPrefix={idPrefix}
        onTextPointerDown={handleTextPointerDown}
      />
    </svg>
  );
}

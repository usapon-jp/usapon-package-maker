import { useId, useRef, type PointerEvent } from "react";

import type { ArtworkLayer as ArtworkItem, DielineLineColors, EnvelopeDesignSettings, PrintGuideMode, StampItem, TextItem } from "../../app/app-types";
import type { DielineGeometry, EnvelopeFaceId } from "../../domain/boxes/types";
import { clamp } from "../../domain/units";
import { pointsToString } from "./geometry-utils";
import { CutLayer } from "./layers/CutLayer";
import { FoldLayer } from "./layers/FoldLayer";
import { FoldoverLayer } from "./layers/FoldoverLayer";
import { GlueLayer } from "./layers/GlueLayer";
import { GuideLayer } from "./layers/GuideLayer";
import { ArtworkLayer } from "./layers/ArtworkLayer";
import { TextLayer } from "./layers/TextLayer";
import { EnvelopeDesignLayer } from "./layers/EnvelopeDesignLayer";

type LayersProps = {
  geometry: DielineGeometry;
  backgroundColor: string;
  surfaceBackgroundColors?: Partial<Record<EnvelopeFaceId, string>>;
  artworkLayers: ArtworkItem[];
  stamps: StampItem[];
  texts: TextItem[];
  lineColors: DielineLineColors;
  showGuides: boolean;
  selectedArtworkId: string | null;
  selectedStampId: string | null;
  selectedTextId: string | null;
  exportMode: boolean;
  includeFoldoverLines?: boolean;
  showWritingLines?: boolean;
  envelopeDesign?: EnvelopeDesignSettings;
  activeEnvelopeFace?: EnvelopeFaceId;
  printGuideMode?: PrintGuideMode;
  idPrefix: string;
  onArtworkPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onStampPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onStampRotate?: (id: string) => void;
  onTextPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
};

export function DielineLayers({
  geometry,
  backgroundColor,
  surfaceBackgroundColors = {},
  artworkLayers,
  stamps,
  texts,
  lineColors,
  showGuides,
  selectedArtworkId,
  selectedStampId,
  selectedTextId,
  exportMode,
  includeFoldoverLines = true,
  showWritingLines = false,
  envelopeDesign,
  activeEnvelopeFace,
  printGuideMode = "assembly",
  idPrefix,
  onArtworkPointerDown,
  onStampPointerDown,
  onStampRotate,
  onTextPointerDown,
}: LayersProps) {
  const clipId = `${idPrefix}-artwork-clip`;
  const gluePatternId = `${idPrefix}-glue-hatch`;
  const facePolygons: Partial<Record<EnvelopeFaceId, (typeof geometry.clipPolygons)[number]>> = {
    "envelope-front": geometry.clipPolygons.find((polygon) => polygon.id === "envelope-front"),
    "envelope-flap": geometry.clipPolygons.find((polygon) => polygon.id === "envelope-top-flap"),
    "envelope-back": geometry.clipPolygons.find((polygon) => polygon.id === "envelope-back"),
  };
  const surfaceClipIds = Object.fromEntries(Object.entries(facePolygons).filter(([, polygon]) => polygon).map(([faceId]) => [faceId, `${idPrefix}-${faceId}-clip`])) as Partial<Record<EnvelopeFaceId, string>>;
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          {geometry.clipPolygons.map((polygon) => (
            <polygon key={polygon.id} points={pointsToString(polygon.points)} />
          ))}
        </clipPath>
        {Object.entries(facePolygons).map(([faceId, polygon]) => polygon ? <clipPath key={faceId} id={surfaceClipIds[faceId as EnvelopeFaceId]}><polygon points={pointsToString(polygon.points)} /></clipPath> : null)}
      </defs>
      <ArtworkLayer
        geometry={geometry}
        backgroundColor={backgroundColor}
        surfaceBackgroundColors={surfaceBackgroundColors}
        surfaceClipIds={surfaceClipIds}
        artworkLayers={artworkLayers}
        stamps={stamps}
        clipId={clipId}
        idPrefix={`${idPrefix}-artwork`}
        selectedArtworkId={selectedArtworkId}
        selectedStampId={selectedStampId}
        exportMode={exportMode}
        onArtworkPointerDown={onArtworkPointerDown}
        onStampPointerDown={onStampPointerDown}
        onStampRotate={onStampRotate}
      />
      {envelopeDesign && <EnvelopeDesignLayer geometry={geometry} settings={envelopeDesign} idPrefix={idPrefix} />}
      <g clipPath={`url(#${clipId})`}>
        {geometry.type === "letter-paper-v1" && showWritingLines && (
          <g data-layer="writing-lines" fill="none" stroke="#c9b4a7" strokeWidth="0.22" opacity="0.72" pointerEvents="none">
            {Array.from({ length: Math.max(0, Math.floor((geometry.bounds.heightMm - 48) / 11)) }, (_, index) => {
              const y = 34 + index * 11;
              return <line key={y} x1="17" y1={y} x2={geometry.bounds.widthMm - 17} y2={y} />;
            })}
          </g>
        )}
        <TextLayer
          texts={texts}
          selectedTextId={selectedTextId}
          exportMode={exportMode}
          onPointerDown={onTextPointerDown}
          surfaceClipIds={surfaceClipIds}
        />
      </g>
      {!exportMode && activeEnvelopeFace && facePolygons[activeEnvelopeFace] && <polygon data-active-envelope-face={activeEnvelopeFace} points={pointsToString(facePolygons[activeEnvelopeFace]!.points)} fill="none" stroke="#ee6f83" strokeWidth="0.8" strokeDasharray="2 1.4" pointerEvents="none" />}
      <GlueLayer geometry={geometry} patternId={gluePatternId} exportMode={exportMode} showAssemblyGuide={printGuideMode === "assembly"} />
      <FoldLayer geometry={geometry} color={lineColors.fold} />
      {(!exportMode || includeFoldoverLines) && <FoldoverLayer geometry={geometry} color={lineColors.fold} />}
      <CutLayer geometry={geometry} color={lineColors.cut} />
      {!exportMode && showGuides && <GuideLayer geometry={geometry} />}
      {exportMode && printGuideMode === "assembly" && geometry.type === "envelope-v1" && <GuideLayer geometry={geometry} assemblyOnly />}
    </>
  );
}

type Props = Omit<LayersProps, "idPrefix" | "onArtworkPointerDown" | "onStampPointerDown" | "onStampRotate" | "onTextPointerDown"> & {
  onSelectArtwork: (id: string | null) => void;
  onMoveArtwork: (id: string, xMm: number, yMm: number) => void;
  onSelectStamp: (id: string | null) => void;
  onMoveStamp: (id: string, xMm: number, yMm: number) => void;
  onRotateStamp: (id: string) => void;
  onSelectText: (id: string | null) => void;
  onMoveText: (id: string, xMm: number, yMm: number) => void;
  className?: string;
};

export function DielineSvg({
  geometry,
  backgroundColor,
  surfaceBackgroundColors,
  artworkLayers,
  stamps,
  texts,
  lineColors,
  showGuides,
  selectedArtworkId,
  selectedStampId,
  selectedTextId,
  exportMode,
  includeFoldoverLines = true,
  showWritingLines = false,
  envelopeDesign,
  activeEnvelopeFace,
  printGuideMode,
  onSelectArtwork,
  onMoveArtwork,
  onSelectStamp,
  onMoveStamp,
  onRotateStamp,
  onSelectText,
  onMoveText,
  className,
}: Props) {
  const rawId = useId();
  const idPrefix = `preview-${rawId.replaceAll(":", "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "artwork" | "stamp" | "text"; id: string; dx: number; dy: number } | null>(null);
  const padding = Math.max(4, Math.min(12, geometry.bounds.widthMm * 0.06));

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM()?.inverse());
  };

  const handleTextPointerDown = (event: PointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    const item = texts.find((text) => text.id === id);
    if (!item) return;
    const point = pointFromEvent(event);
    drag.current = { kind: "text", id, dx: item.xMm - point.x, dy: item.yMm - point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectText(id);
  };

  const handleArtworkPointerDown = (event: PointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    const item = artworkLayers.find((layer) => layer.id === id);
    if (!item || item.kind !== "uploaded-artwork" || item.repeat) return;
    const point = pointFromEvent(event);
    drag.current = { kind: "artwork", id, dx: item.offsetXmm - point.x, dy: item.offsetYmm - point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectArtwork(id);
  };

  const handleStampPointerDown = (event: PointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    const item = stamps.find((stamp) => stamp.id === id);
    if (!item) return;
    const point = pointFromEvent(event);
    drag.current = { kind: "stamp", id, dx: item.xMm - point.x, dy: item.yMm - point.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelectStamp(id);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    const point = pointFromEvent(event);
    const xMm = clamp(point.x + drag.current.dx, 0, geometry.bounds.widthMm);
    const yMm = clamp(point.y + drag.current.dy, 0, geometry.bounds.heightMm);
    if (drag.current.kind === "text") onMoveText(drag.current.id, xMm, yMm);
    if (drag.current.kind === "artwork") onMoveArtwork(drag.current.id, xMm, yMm);
    if (drag.current.kind === "stamp") onMoveStamp(drag.current.id, xMm, yMm);
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`${-padding} ${-padding} ${geometry.bounds.widthMm + padding * 2} ${geometry.bounds.heightMm + padding * 2}`}
      role="img"
      aria-label="箱の実寸展開図プレビュー"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) {
          onSelectArtwork(null);
          onSelectStamp(null);
          onSelectText(null);
        }
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
        backgroundColor={backgroundColor}
        surfaceBackgroundColors={surfaceBackgroundColors}
        artworkLayers={artworkLayers}
        stamps={stamps}
        texts={texts}
        lineColors={lineColors}
        showGuides={showGuides}
        selectedArtworkId={selectedArtworkId}
        selectedStampId={selectedStampId}
        selectedTextId={selectedTextId}
        exportMode={exportMode}
        includeFoldoverLines={includeFoldoverLines}
        showWritingLines={showWritingLines}
        envelopeDesign={envelopeDesign}
        activeEnvelopeFace={activeEnvelopeFace}
        printGuideMode={printGuideMode}
        idPrefix={idPrefix}
        onArtworkPointerDown={handleArtworkPointerDown}
        onStampPointerDown={handleStampPointerDown}
        onStampRotate={onRotateStamp}
        onTextPointerDown={handleTextPointerDown}
      />
    </svg>
  );
}

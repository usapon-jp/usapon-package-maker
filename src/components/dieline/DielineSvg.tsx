import { useEffect, useId, useRef, type PointerEvent } from "react";

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

export type DielineViewportCenter = { x: number; y: number };

export type DielineViewBox = DielineViewportCenter & { width: number; height: number; zoom: number };

export function calculateDielineViewBox(widthMm: number, heightMm: number, padding: number, zoom: number, center: DielineViewportCenter): DielineViewBox {
  const baseX = -padding;
  const baseY = -padding;
  const baseWidth = widthMm + padding * 2;
  const baseHeight = heightMm + padding * 2;
  const safeZoom = clamp(zoom, 1, 3);
  const viewWidth = baseWidth / safeZoom;
  const viewHeight = baseHeight / safeZoom;
  const minCenterX = baseX + viewWidth / 2;
  const maxCenterX = baseX + baseWidth - viewWidth / 2;
  const minCenterY = baseY + viewHeight / 2;
  const maxCenterY = baseY + baseHeight - viewHeight / 2;
  const centerX = clamp(center.x, minCenterX, maxCenterX);
  const centerY = clamp(center.y, minCenterY, maxCenterY);
  return { x: centerX - viewWidth / 2, y: centerY - viewHeight / 2, width: viewWidth, height: viewHeight, zoom: safeZoom };
}

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
        showStamps={false}
        onArtworkPointerDown={onArtworkPointerDown}
        onStampPointerDown={onStampPointerDown}
        onStampRotate={onStampRotate}
      />
      {envelopeDesign && <EnvelopeDesignLayer geometry={geometry} settings={envelopeDesign} idPrefix={idPrefix} />}
      <ArtworkLayer
        geometry={geometry}
        backgroundColor={backgroundColor}
        surfaceBackgroundColors={surfaceBackgroundColors}
        surfaceClipIds={surfaceClipIds}
        artworkLayers={artworkLayers}
        stamps={stamps}
        clipId={clipId}
        idPrefix={`${idPrefix}-stamps`}
        selectedArtworkId={selectedArtworkId}
        selectedStampId={selectedStampId}
        exportMode={exportMode}
        showBaseLayers={false}
        onArtworkPointerDown={onArtworkPointerDown}
        onStampPointerDown={onStampPointerDown}
        onStampRotate={onStampRotate}
      />
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
      {!exportMode && activeEnvelopeFace && facePolygons[activeEnvelopeFace] && <polygon data-active-envelope-face={activeEnvelopeFace} points={pointsToString(facePolygons[activeEnvelopeFace]!.points)} fill="rgba(238,111,131,.10)" stroke="#ee6f83" strokeWidth="0.8" strokeDasharray="2 1.4" pointerEvents="none" />}
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
  onSelectEnvelopeFace?: (faceId: EnvelopeFaceId) => void;
  zoom?: number;
  viewportCenter?: DielineViewportCenter;
  onViewportCenterChange?: (center: DielineViewportCenter) => void;
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
  onSelectEnvelopeFace,
  zoom = 1,
  viewportCenter,
  onViewportCenterChange,
  className,
}: Props) {
  const rawId = useId();
  const idPrefix = `preview-${rawId.replaceAll(":", "")}`;
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: "artwork" | "stamp" | "text"; id: string; dx: number; dy: number } | null>(null);
  const pan = useRef<{ pointerId: number; point: DielineViewportCenter; center: DielineViewportCenter } | null>(null);
  const autoPan = useRef<{ pointerId: number; clientX: number; clientY: number; time: number } | null>(null);
  const autoPanFrame = useRef<number | null>(null);
  const padding = Math.max(4, Math.min(12, geometry.bounds.widthMm * 0.06));
  const defaultCenter = { x: geometry.bounds.widthMm / 2, y: geometry.bounds.heightMm / 2 };
  const viewBoxRef = useRef<DielineViewBox>(calculateDielineViewBox(geometry.bounds.widthMm, geometry.bounds.heightMm, padding, zoom, viewportCenter ?? defaultCenter));
  const viewBox = calculateDielineViewBox(geometry.bounds.widthMm, geometry.bounds.heightMm, padding, zoom, viewportCenter ?? defaultCenter);
  viewBoxRef.current = viewBox;

  const pointFromClient = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const currentViewBox = viewBoxRef.current;
    return {
      x: currentViewBox.x + clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1) * currentViewBox.width,
      y: currentViewBox.y + clamp((clientY - rect.top) / Math.max(1, rect.height), 0, 1) * currentViewBox.height,
    };
  };

  const pointFromEvent = (event: PointerEvent<SVGElement>) => {
    return pointFromClient(event.clientX, event.clientY);
  };

  const setViewportCenter = (center: DielineViewportCenter) => {
    const next = calculateDielineViewBox(geometry.bounds.widthMm, geometry.bounds.heightMm, padding, zoom, center);
    viewBoxRef.current = next;
    onViewportCenterChange?.({ x: next.x + next.width / 2, y: next.y + next.height / 2 });
  };

  const moveDraggedItem = (clientX: number, clientY: number) => {
    if (!drag.current) return;
    const point = pointFromClient(clientX, clientY);
    const xMm = clamp(point.x + drag.current.dx, 0, geometry.bounds.widthMm);
    const yMm = clamp(point.y + drag.current.dy, 0, geometry.bounds.heightMm);
    if (drag.current.kind === "text") onMoveText(drag.current.id, xMm, yMm);
    if (drag.current.kind === "artwork") onMoveArtwork(drag.current.id, xMm, yMm);
    if (drag.current.kind === "stamp") onMoveStamp(drag.current.id, xMm, yMm);
  };

  const stopAutoPan = () => {
    autoPan.current = null;
    if (autoPanFrame.current !== null) cancelAnimationFrame(autoPanFrame.current);
    autoPanFrame.current = null;
  };

  const updateAutoPan = (event: PointerEvent<SVGSVGElement>) => {
    if (zoom <= 1 || !drag.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const edge = 48;
    const nearEdge = event.clientX - rect.left < edge || rect.right - event.clientX < edge || event.clientY - rect.top < edge || rect.bottom - event.clientY < edge;
    if (!nearEdge) {
      stopAutoPan();
      return;
    }
    autoPan.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, time: performance.now() };
    if (autoPanFrame.current !== null) return;
    const tick = (time: number) => {
      const active = autoPan.current;
      const svg = svgRef.current;
      if (!active || !svg || !drag.current) {
        stopAutoPan();
        return;
      }
      const rect = svg.getBoundingClientRect();
      const edge = 48;
      const edgeVelocity = (distance: number) => distance < edge ? Math.pow((edge - Math.max(0, distance)) / edge, 1.6) : 0;
      const xVelocity = active.clientX - rect.left < edge ? -edgeVelocity(active.clientX - rect.left) : rect.right - active.clientX < edge ? edgeVelocity(rect.right - active.clientX) : 0;
      const yVelocity = active.clientY - rect.top < edge ? -edgeVelocity(active.clientY - rect.top) : rect.bottom - active.clientY < edge ? edgeVelocity(rect.bottom - active.clientY) : 0;
      if (!xVelocity && !yVelocity) {
        stopAutoPan();
        return;
      }
      const elapsed = Math.min(0.05, Math.max(0, (time - active.time) / 1000));
      active.time = time;
      const current = viewBoxRef.current;
      setViewportCenter({ x: current.x + current.width / 2 + xVelocity * current.width * 0.4 * elapsed, y: current.y + current.height / 2 + yVelocity * current.height * 0.4 * elapsed });
      moveDraggedItem(active.clientX, active.clientY);
      autoPanFrame.current = requestAnimationFrame(tick);
    };
    autoPanFrame.current = requestAnimationFrame(tick);
  };

  useEffect(() => () => stopAutoPan(), []);

  const handleEnvelopeFacePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (exportMode || !onSelectEnvelopeFace || geometry.envelope?.construction !== "kamasu") return;
    const point = pointFromEvent(event);
    const faces: Array<[EnvelopeFaceId, string]> = [
      ["envelope-front", "envelope-front"],
      ["envelope-flap", "envelope-top-flap"],
      ["envelope-back", "envelope-back"],
    ];
    const selected = faces.find(([, polygonId]) => {
      const polygon = geometry.clipPolygons.find((candidate) => candidate.id === polygonId);
      if (!polygon) return false;
      let inside = false;
      for (let index = 0, previous = polygon.points.length - 1; index < polygon.points.length; previous = index++) {
        const currentPoint = polygon.points[index]!;
        const previousPoint = polygon.points[previous]!;
        const crosses = currentPoint.y > point.y !== previousPoint.y > point.y
          && point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / (previousPoint.y - currentPoint.y) + currentPoint.x;
        if (crosses) inside = !inside;
      }
      return inside;
    });
    if (selected) onSelectEnvelopeFace(selected[0]);
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
    if (pan.current) {
      const point = pointFromEvent(event);
      setViewportCenter({ x: pan.current.center.x + pan.current.point.x - point.x, y: pan.current.center.y + pan.current.point.y - point.y });
      return;
    }
    if (!drag.current) return;
    moveDraggedItem(event.clientX, event.clientY);
    updateAutoPan(event);
  };

  const startPan = (event: PointerEvent<SVGSVGElement>) => {
    if (zoom <= 1 || !onViewportCenterChange) return false;
    const target = event.target as Element;
    if (target.closest("[data-artwork-id], [data-stamp-id], [data-text-container], [data-stamp-rotate-handle]")) return false;
    const current = viewBoxRef.current;
    pan.current = { pointerId: event.pointerId, point: pointFromEvent(event), center: { x: current.x + current.width / 2, y: current.y + current.height / 2 } };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
    return true;
  };

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      role="img"
      aria-label="箱の実寸展開図プレビュー"
      style={zoom > 1 ? { touchAction: "none" } : undefined}
      onPointerDownCapture={(event) => { if (!startPan(event)) handleEnvelopeFacePointerDown(event); }}
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
        pan.current = null;
        stopAutoPan();
      }}
      onPointerCancel={() => {
        drag.current = null;
        pan.current = null;
        stopAutoPan();
      }}
    >
      {!exportMode && onSelectEnvelopeFace && geometry.envelope?.construction === "kamasu" && (
        <g className="envelope-face-hit-areas" aria-label="編集する封筒の面">
          {([
            ["envelope-front", geometry.clipPolygons.find((polygon) => polygon.id === "envelope-front")],
            ["envelope-flap", geometry.clipPolygons.find((polygon) => polygon.id === "envelope-top-flap")],
            ["envelope-back", geometry.clipPolygons.find((polygon) => polygon.id === "envelope-back")],
          ] as Array<[EnvelopeFaceId, (typeof geometry.clipPolygons)[number] | undefined]>).map(([faceId, polygon]) => polygon ? <polygon key={faceId} data-envelope-face-hit={faceId} points={pointsToString(polygon.points)} fill="transparent" stroke="none" pointerEvents="none" /> : null)}
        </g>
      )}
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

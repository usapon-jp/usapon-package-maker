import type { PointerEvent } from "react";

import type { ArtworkLayer as ArtworkItem, StampItem, UploadedArtworkLayer } from "../../../app/app-types";
import type { EnvelopeFaceId } from "../../../domain/boxes/types";
import type { DielineGeometry } from "../../../domain/boxes/types";
import type { StampHandleMode } from "../../../features/stamps/transform-handle";

type Props = {
  geometry: DielineGeometry;
  backgroundColor: string;
  surfaceBackgroundColors?: Partial<Record<EnvelopeFaceId, string>>;
  surfaceClipIds?: Partial<Record<EnvelopeFaceId, string>>;
  artworkLayers: ArtworkItem[];
  stamps: StampItem[];
  clipId: string;
  idPrefix: string;
  selectedArtworkId: string | null;
  selectedStampId: string | null;
  exportMode: boolean;
  showBaseLayers?: boolean;
  showStamps?: boolean;
  onArtworkPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onStampPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
  onStampRotate?: (id: string) => void;
};

function selectedOutline(width: number, height: number) {
  return (
    <rect
      x={-width / 2 - 1.5}
      y={-height / 2 - 1.5}
      width={width + 3}
      height={height + 3}
      rx="1.2"
      fill="none"
      stroke="#ee6f83"
      strokeWidth="0.45"
      strokeDasharray="1.4 1"
      pointerEvents="none"
    />
  );
}

/**
 * Selected-stamp handles sit on the screen-aligned corners of the stamp, outside its surface clip,
 * so "top right = angle" and "bottom right = size" hold whatever the rotation or envelope face is.
 */
export function StampHandles({
  item,
  radius,
  onPointerDown,
  onRotate,
}: {
  item: StampItem;
  radius: number;
  onPointerDown?: (event: PointerEvent<SVGGElement>, id: string, mode: StampHandleMode) => void;
  onRotate?: (id: string) => void;
}) {
  const width = Math.max(2, item.widthMm);
  const height = width / Math.max(0.05, item.aspectRatio);
  const radians = item.rotationDeg * Math.PI / 180;
  const halfWidth = (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
  const halfHeight = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
  const gap = radius * 0.6;
  const x = item.xMm + halfWidth + gap;
  const handle = (mode: StampHandleMode, y: number, label: string, glyph: string) => (
    <g
      {...(mode === "rotate" ? { "data-stamp-rotate-handle": item.id } : { "data-stamp-scale-handle": item.id })}
      data-stamp-handle={mode}
      role="button"
      tabIndex={0}
      aria-label={label}
      transform={`translate(${x} ${y})`}
      style={{ cursor: mode === "rotate" ? "grab" : "nwse-resize", touchAction: "none" }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(event, item.id, mode);
      }}
      onKeyDown={(event) => {
        if (mode !== "rotate" || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        event.stopPropagation();
        onRotate?.(item.id);
      }}
    >
      <circle r={radius * 1.8} fill="transparent" />
      <circle r={radius} fill="#fffdfb" stroke="#ee6f83" strokeWidth={radius * 0.16} />
      <text x="0" y={radius * 0.09} fill="#c84e68" fontSize={radius * 1.35} fontWeight="800" textAnchor="middle" dominantBaseline="middle" pointerEvents="none">{glyph}</text>
    </g>
  );
  return (
    <g data-stamp-handles={item.id}>
      {handle("rotate", item.yMm - halfHeight - gap, `${item.name}の角度を変える（ドラッグで回転・タップで90度）`, "↻")}
      {handle("scale", item.yMm + halfHeight + gap, `${item.name}の大きさを変える（ドラッグで拡大縮小）`, "⤡")}
    </g>
  );
}

function UploadedArtwork({
  item,
  geometry,
  patternId,
  selected,
  exportMode,
  onPointerDown,
}: {
  item: UploadedArtworkLayer;
  geometry: DielineGeometry;
  patternId: string;
  selected: boolean;
  exportMode: boolean;
  onPointerDown?: (event: PointerEvent<SVGGElement>, id: string) => void;
}) {
  if (!item.visible) return null;
  const sourceWidth = Math.max(2, item.widthMm);
  const sourceHeight = sourceWidth / Math.max(0.05, item.aspectRatio);
  const quarterTurn = item.rotationDeg === 90 || item.rotationDeg === 270;
  const repeatGap = Math.max(0, item.repeatGapMm ?? 0);
  const tileWidth = (quarterTurn ? sourceHeight : sourceWidth) + repeatGap;
  const tileHeight = (quarterTurn ? sourceWidth : sourceHeight) + repeatGap;

  if (item.repeat) {
    return (
      <g data-artwork-id={item.id} opacity={item.opacity}>
        <defs>
          <pattern
            id={patternId}
            x={item.offsetXmm}
            y={item.offsetYmm}
            width={tileWidth}
            height={tileHeight}
            patternUnits="userSpaceOnUse"
            patternContentUnits="userSpaceOnUse"
          >
              <g transform={`translate(${tileWidth / 2} ${tileHeight / 2}) rotate(${item.rotationDeg})`}>
              <image href={item.dataUrl} x={-sourceWidth / 2} y={-sourceHeight / 2} width={sourceWidth} height={sourceHeight} preserveAspectRatio="xMidYMid meet" />
            </g>
          </pattern>
        </defs>
        {/* Use the full net's mm dimensions even in a cropped 3D face SVG. */}
        <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={`url(#${patternId})`} />
      </g>
    );
  }

  return (
    <g
      data-artwork-id={item.id}
      opacity={item.opacity}
      transform={`translate(${item.offsetXmm} ${item.offsetYmm}) rotate(${item.rotationDeg})`}
      style={{ cursor: exportMode ? "default" : "grab", touchAction: "none" }}
      onPointerDown={exportMode ? undefined : (event) => onPointerDown?.(event, item.id)}
    >
      <image href={item.dataUrl} x={-sourceWidth / 2} y={-sourceHeight / 2} width={sourceWidth} height={sourceHeight} preserveAspectRatio="xMidYMid meet" />
      {!exportMode && selected && selectedOutline(sourceWidth, sourceHeight)}
    </g>
  );
}

export function ArtworkLayer({
  geometry,
  backgroundColor,
  surfaceBackgroundColors = {},
  surfaceClipIds = {},
  artworkLayers,
  stamps,
  clipId,
  idPrefix,
  selectedArtworkId,
  selectedStampId,
  exportMode,
  showBaseLayers = true,
  showStamps = true,
  onArtworkPointerDown,
  onStampPointerDown,
  onStampRotate,
}: Props) {
  return (
    <>
      {showBaseLayers && <g data-layer="artwork" clipPath={`url(#${clipId})`}>
        <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={backgroundColor} />
        {Object.entries(surfaceBackgroundColors).map(([surfaceId, color]) => color ? (
          <rect key={surfaceId} width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={color} clipPath={surfaceClipIds[surfaceId as EnvelopeFaceId] ? `url(#${surfaceClipIds[surfaceId as EnvelopeFaceId]})` : undefined} />
        ) : null)}
        {artworkLayers.map((item) => {
          const patternId = `${idPrefix}-${item.id}`;
          const itemClip = item.surfaceId && surfaceClipIds[item.surfaceId] ? `url(#${surfaceClipIds[item.surfaceId]})` : undefined;
          if (!item.visible) return null;
          if (item.kind === "stripe-pattern") {
            const period = Math.max(item.stripeWidthMm + item.gapMm, item.stripeWidthMm + 0.5);
            return (
              <g key={item.id} data-artwork-id={item.id} opacity={item.opacity} clipPath={itemClip}>
                <defs>
                  <pattern id={patternId} width={period} height={period} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" patternTransform={`translate(${item.offsetXmm} ${item.offsetYmm}) rotate(${item.angleDeg})`}>
                    <rect width={item.stripeWidthMm} height={period} fill={item.color} />
                  </pattern>
                </defs>
                <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={`url(#${patternId})`} />
              </g>
            );
          }
          if (item.kind === "dot-pattern") {
            const spacing = Math.max(item.spacingMm, item.dotDiameterMm + 0.5);
            return (
              <g key={item.id} data-artwork-id={item.id} opacity={item.opacity} clipPath={itemClip}>
                <defs>
                  <pattern id={patternId} x={item.offsetXmm} y={item.offsetYmm} width={spacing} height={spacing * 2} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse" patternTransform={`rotate(${item.angleDeg ?? 0})`}>
                    <circle cx={spacing / 4} cy={spacing / 2} r={item.dotDiameterMm / 2} fill={item.color} />
                    <circle cx={spacing * 0.75} cy={spacing * 1.5} r={item.dotDiameterMm / 2} fill={item.color} />
                  </pattern>
                </defs>
                <rect width={geometry.bounds.widthMm} height={geometry.bounds.heightMm} fill={`url(#${patternId})`} />
              </g>
            );
          }
          return (
            <g key={item.id} clipPath={itemClip}><UploadedArtwork
              item={item}
              geometry={geometry}
              patternId={patternId}
              selected={selectedArtworkId === item.id}
              exportMode={exportMode}
              onPointerDown={onArtworkPointerDown}
            /></g>
          );
        })}
      </g>}

      {showStamps && <g data-layer="stamp" clipPath={`url(#${clipId})`}>
        {stamps.map((item) => {
          if (!item.visible) return null;
          const width = Math.max(2, item.widthMm);
          const height = width / Math.max(0.05, item.aspectRatio);
          return (
            <g
              key={item.id}
              clipPath={item.surfaceId && surfaceClipIds[item.surfaceId] ? `url(#${surfaceClipIds[item.surfaceId]})` : undefined}
            >
            <g
              data-stamp-id={item.id}
              opacity={item.opacity}
              transform={`translate(${item.xMm} ${item.yMm}) rotate(${item.rotationDeg})`}
              style={{ cursor: exportMode ? "default" : "grab", touchAction: "none" }}
              onPointerDown={exportMode ? undefined : (event) => onStampPointerDown?.(event, item.id)}
            >
              <image href={item.dataUrl} x={-width / 2} y={-height / 2} width={width} height={height} preserveAspectRatio="xMidYMid meet" />
              {!exportMode && selectedStampId === item.id && selectedOutline(width, height)}
            </g>
            </g>
          );
        })}
      </g>}
    </>
  );
}

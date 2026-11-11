import { useRef, type PointerEvent } from "react";
import type { DielineGeometry } from "../../../domain/boxes/types";
import { DEFAULT_WRITING_FRAME, writingFrameBounds, type WritingFrameSettings } from "../../../features/letter-set/writing-frame";

type Props = { clipId?: string; geometry: DielineGeometry; settings?: WritingFrameSettings; selected?: boolean; handleRadius?: number; onChange?: (patch: Partial<WritingFrameSettings>) => void };
export function WritingFrameLayer({ clipId, geometry, settings = DEFAULT_WRITING_FRAME, selected = false, handleRadius = 3, onChange }: Props) {
  const { x, y, width, height } = writingFrameBounds(geometry, settings);
  const gesture = useRef<{ mode: string; x: number; y: number; radius: number; angle: number; start: WritingFrameSettings } | null>(null);
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.ownerSVGElement?.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
  };
  const begin = (event: PointerEvent<SVGGElement>, mode: string) => {
    if (!selected || !onChange) return;
    event.stopPropagation(); event.preventDefault();
    const p = point(event);
    gesture.current = { mode, x: p.x, y: p.y, radius: Math.hypot(p.x - x, p.y - y), angle: Math.atan2(p.y - y, p.x - x), start: { ...settings } };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGGElement>) => {
    const drag = gesture.current;
    if (!drag || !onChange) return;
    event.stopPropagation(); const p = point(event);
    if (drag.mode === "move") onChange({ offsetXmm: Math.max(-geometry.bounds.widthMm / 2, Math.min(geometry.bounds.widthMm / 2, drag.start.offsetXmm + p.x - drag.x)), offsetYmm: Math.max(-geometry.bounds.heightMm / 2, Math.min(geometry.bounds.heightMm / 2, drag.start.offsetYmm + p.y - drag.y)) });
    else if (drag.mode === "size") onChange({ scale: Math.max(0.2, Math.min(2, drag.start.scale * Math.hypot(p.x - x, p.y - y) / Math.max(1, drag.radius))) });
    else { const degrees = (drag.start.rotationDeg + (Math.atan2(p.y - y, p.x - x) - drag.angle) * 180 / Math.PI + 540) % 360 - 180; const snapped = Math.round(degrees / 15) * 15; onChange({ rotationDeg: Math.abs(degrees - snapped) < 3 ? snapped : Math.round(degrees) }); }
  };
  // One compound path gives the body and tail a single opacity, without an overlapping seam.
  const bubble = `M ${-width / 2 + 4} ${-height / 2} H ${width / 2 - 4} Q ${width / 2} ${-height / 2} ${width / 2} ${-height / 2 + 4} V ${height / 2 - 4} Q ${width / 2} ${height / 2} ${width / 2 - 4} ${height / 2} H ${-width * 0.16} L ${-width * 0.34} ${height / 2 + Math.min(8, height * 0.22)} L ${-width * 0.3} ${height / 2} H ${-width / 2 + 4} Q ${-width / 2} ${height / 2} ${-width / 2} ${height / 2 - 4} V ${-height / 2 + 4} Q ${-width / 2} ${-height / 2} ${-width / 2 + 4} ${-height / 2} Z`;
  const radians = settings.rotationDeg * Math.PI / 180;
  const halfW = (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
  const halfH = (Math.abs(width * Math.sin(radians)) + Math.abs(height * Math.cos(radians))) / 2;
  const handle = (mode: "size" | "rotate", hy: number) => <g data-writing-frame-handle={mode} role="button" tabIndex={0} aria-label={mode === "size" ? "記入枠を拡大縮小" : "記入枠を回転"} transform={`translate(${x + halfW + handleRadius} ${hy})`} onPointerDown={(event) => begin(event, mode)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const direction = event.key === "ArrowRight" ? 1 : -1; onChange?.(mode === "size" ? { scale: Math.max(0.2, Math.min(2, settings.scale + direction * 0.05)) } : { rotationDeg: (settings.rotationDeg + direction * 15 + 540) % 360 - 180 }); } }}><circle r={handleRadius * 1.5} fill="transparent" /><circle r={handleRadius} fill="#fff" stroke="#c65b7c" strokeWidth="0.5" /><text fontSize={handleRadius * 1.4} textAnchor="middle" dominantBaseline="central" fill="#a34364">{mode === "size" ? "⤡" : "↻"}</text></g>;
  return <g data-layer="writing-frame" data-writing-frame={settings.shape} pointerEvents={selected ? undefined : "none"} onPointerMove={move} onPointerUp={(event) => { if (gesture.current) event.stopPropagation(); gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }}>
    <g clipPath={clipId ? `url(#${clipId})` : undefined}><g transform={`translate(${x} ${y}) rotate(${settings.rotationDeg})`} onPointerDown={(event) => begin(event, "move")} style={{ touchAction: "none", cursor: selected ? "move" : undefined }}>
      <g transform={`scale(${settings.flipX ? -1 : 1} ${settings.flipY ? -1 : 1})`} fill="#ffffff" fillOpacity={settings.opacity} stroke="#ead8d3" strokeWidth="0.55" strokeOpacity={settings.opacity}>
        {settings.shape === "ellipse" ? <ellipse cx="0" cy="0" rx={width / 2} ry={height / 2} data-card-writing-frame={geometry.type === "mini-card-v1" || undefined} data-letter-writing-frame={geometry.type === "letter-paper-v1" || undefined} /> : settings.shape === "bubble" ? <path d={bubble} data-card-writing-frame={geometry.type === "mini-card-v1" || undefined} data-letter-writing-frame={geometry.type === "letter-paper-v1" || undefined} /> : <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={settings.shape === "rounded" ? 4 : 0} data-card-writing-frame={geometry.type === "mini-card-v1" || undefined} data-letter-writing-frame={geometry.type === "letter-paper-v1" || undefined} />}
      </g>
      {selected && <rect x={-width / 2} y={-height / 2} width={width} height={height} fill="transparent" stroke="#c65b7c" strokeWidth="0.45" strokeDasharray="2 1" />}
    </g>
    </g>
    {selected && <>{handle("rotate", y - halfH - handleRadius)}{handle("size", y + halfH + handleRadius)}</>}
  </g>;
}

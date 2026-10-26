import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AppState } from '../../app/app-types';
import { rotateView, type Vec3 } from '../../domain/boxes/finished-box';
import type { DielineGeometry, DielinePageId } from '../../domain/boxes/types';
import { FoldedEnvelope } from './FoldedEnvelope';
import { FinishedStationeryPreview } from './FinishedStationeryPreview';

type Angle = { yaw: number; pitch: number };
const views: [string, Angle][] = [
  ['front', { yaw: 0, pitch: 0 }],
  ['back', { yaw: 180, pitch: 0 }],
  ['angle', { yaw: -28, pitch: 14 }],
];
// A sheet has two sides, so it can be tipped up or down but never turned over the top.
const MAX_PITCH = 70;
const normalize = (deg: number) => (((deg % 360) + 540) % 360) - 180;
const sameAngle = (a: Angle, b: Angle) => Math.abs(a.pitch - b.pitch) < 0.5 && Math.abs(normalize(a.yaw - b.yaw)) < 0.5;

type Props = { state: AppState; pageId: DielinePageId; geometry: DielineGeometry };

/** A letter paper, mini card or envelope as a two-sided sheet that can be turned by dragging. */
export function StationeryTurntable({ state, pageId, geometry }: Props) {
  const isEnvelope = geometry.type === 'envelope-v1';
  const envelope = state.box.type === 'envelope-v1' ? state.box : null;
  const widthMm = isEnvelope ? envelope?.widthMm ?? 162 : geometry.bounds.widthMm;
  const heightMm = isEnvelope ? envelope?.heightMm ?? 114 : geometry.bounds.heightMm;
  const labels = isEnvelope ? (geometry.envelope?.construction === 'kamasu' ? { front: 'おもて（B）', back: 'うら（A・C）' } : { front: 'おもて', back: 'うら' }) : { front: 'おもて', back: 'うら' };
  const viewLabels: Record<string, string> = { front: labels.front, back: labels.back, angle: '斜め' };

  const [angle, setAngle] = useState<Angle>(views[2][1]);
  const [animating, setAnimating] = useState(false);
  const [flapOpen, setFlapOpen] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 320, height: 300 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Angle } | null>(null);

  useEffect(() => {
    const element = stage.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const flapMm = isEnvelope ? geometry.envelope?.topFlapMm ?? 0 : 0;
  const scale = Math.max(0.5, Math.min(stageSize.width / (widthMm * 1.45), stageSize.height / ((heightMm + flapMm * 0.7) * 1.45)));
  const w = widthMm * scale, h = heightMm * scale;
  const half = Math.max(0.5, 0.2 * scale);
  const current = views.find(v => sameAngle(v[1], angle));
  const sides = [
    { key: 'front', normal: [0, 0, 1] as Vec3, transform: `translateZ(${half}px)` },
    { key: 'back', normal: [0, 0, -1] as Vec3, transform: `rotateY(180deg) translateZ(${half}px)` },
  ];

  const showView = (next: Angle) => {
    setAnimating(true);
    // Turn the short way round so the sheet does not spin a full lap.
    setAngle(previous => ({ pitch: next.pitch, yaw: previous.yaw + normalize(next.yaw - previous.yaw) }));
  };
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: angle };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setAnimating(false);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const pitch = Math.min(MAX_PITCH, Math.max(-MAX_PITCH, d.start.pitch + (event.clientY - d.y) * 0.45));
    setAngle({ yaw: d.start.yaw + (event.clientX - d.x) * 0.5, pitch });
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  return <div className="finished-box finished-turntable">
    <div className="finished-box-views" role="group" aria-label="完成図を見る方向">{views.map(([key, preset]) => <button key={key} type="button" aria-pressed={current?.[0] === key} onClick={() => showView(preset)}>{viewLabels[key]}</button>)}
      {isEnvelope && <button type="button" aria-pressed={flapOpen} onClick={() => setFlapOpen(open => !open)}>{flapOpen ? 'ふたを閉じる' : 'ふたを開ける'}</button>}
    </div>
    <div
      ref={stage}
      className="finished-box-stage"
      role="img"
      aria-label={`現在のデザインの完成イメージ・${current ? viewLabels[current[0]] : '自由な向き'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ perspective: `${Math.round(Math.hypot(w, h) * 4)}px` }}
    >
      <div className={`finished-box-scene${animating ? ' is-animating' : ''}`} style={{ transform: `rotateX(${-angle.pitch}deg) rotateY(${angle.yaw}deg)` }} onTransitionEnd={() => setAnimating(false)}>
        {isEnvelope ? <FoldedEnvelope state={state} geometry={geometry} scale={scale} flapOpen={flapOpen} /> : sides.map(side => {
          const facing = rotateView(side.normal, angle.yaw, angle.pitch);
          return <div
            key={side.key}
            className={`finished-turntable-face is-${side.key}`}
            data-finished-face={side.key}
            hidden={facing[2] <= 0.001}
            style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: side.transform }}
          >
            {side.key === 'front' ? <FinishedStationeryPreview state={state} pageId={pageId} geometry={geometry} bare /> : <div className="finished-turntable-blank" />}
            <span className="finished-box-shade" style={{ opacity: +(0.2 * (1 - Math.min(1, facing[2])) ** 2).toFixed(3) }} />
          </div>;
        })}
      </div>
    </div>
    <p className="finished-box-caption">ドラッグで回せます · {widthMm} × {heightMm} mm</p>
    <p className="finished-box-note">{isEnvelope ? '展開図を折って組み立てた形です。のりしろは中に隠れます。' : 'うらは白紙で表示しています。'}</p>
  </div>;
}

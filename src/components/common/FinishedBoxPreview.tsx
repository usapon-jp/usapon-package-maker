import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AppState } from '../../app/app-types';
import { boxSizeFields, faceFrames3d, finishedBoxFaces, rotateView, type Vec3 } from '../../domain/boxes/finished-box';
import { ArtworkLayer } from '../dieline/layers/ArtworkLayer';
import { TextLayer } from '../dieline/layers/TextLayer';
import type { DielineGeometry, DielinePageId } from '../../domain/boxes/types';
import { A4PrintPreview } from './A4PrintPreview';

type Angle = { yaw: number; pitch: number };
const views: [string, string, Angle][] = [
  ['front-angle', '斜め前', { yaw: -35, pitch: 28 }],
  ['back-angle', '斜め後ろ', { yaw: 145, pitch: 28 }],
  ['front', '正面', { yaw: 0, pitch: 0 }],
  ['top', '真上', { yaw: 0, pitch: 90 }],
];
// The box has no bottom face, so the camera never goes below the floor.
const MIN_PITCH = 0, MAX_PITCH = 90;
// A room light above the box, slightly to the front-left. It stays put while the box turns, so the lid is always the brightest face.
const LIGHT: Vec3 = (() => { const l: Vec3 = [-0.3, -1, 0.45]; const n = Math.hypot(...l); return l.map(v => v / n) as Vec3; })();
const matrix3d = (u: Vec3, v: Vec3, n: Vec3, t: Vec3) => `matrix3d(${[...u, 0, ...v, 0, ...n, 0, ...t, 1].map(x => +x.toFixed(5)).join(',')})`;
const sameAngle = (a: Angle, b: Angle) => Math.abs(a.pitch - b.pitch) < 0.5 && Math.abs((((a.yaw - b.yaw) % 360) + 540) % 360 - 180) < 0.5;

export function FinishedBoxPreview({ state }: { state: AppState }) {
  const [angle, setAngle] = useState<Angle>(views[0][2]);
  const [animating, setAnimating] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 320, height: 300 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: Angle } | null>(null);
  const id = useId().replaceAll(':', '');

  useEffect(() => {
    const element = stage.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const faces = finishedBoxFaces(state.box);
  const frames = faceFrames3d(faces);
  const corners = frames.flatMap(f => [f.origin, f.origin.map((x, i) => x + f.u[i] + f.v[i]) as Vec3]);
  const extent = [0, 1, 2].map(i => Math.max(...corners.map(p => p[i])) - Math.min(...corners.map(p => p[i])));
  const diagonal = Math.hypot(...extent);
  const scale = Math.max(0.5, 0.82 * Math.min(stageSize.width, stageSize.height) / diagonal);
  const floorY = Math.max(...corners.map(p => p[1]));
  const size = boxSizeFields(state.box);
  const current = views.find(v => sameAngle(v[2], angle));

  const showView = (next: Angle) => {
    setAnimating(true);
    // Turn the short way round so the box does not spin a full lap.
    setAngle(previous => ({ pitch: next.pitch, yaw: previous.yaw + ((((next.yaw - previous.yaw) % 360) + 540) % 360 - 180) }));
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
    const pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, d.start.pitch + (event.clientY - d.y) * 0.45));
    setAngle({ yaw: d.start.yaw + (event.clientX - d.x) * 0.5, pitch });
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === event.pointerId) drag.current = null;
  };

  return <div className="finished-box">
    <div className="finished-box-views" role="group" aria-label="完成図を見る方向">{views.map(([key, label, preset]) => <button key={key} type="button" aria-pressed={current?.[0] === key} onClick={() => showView(preset)}>{label}</button>)}</div>
    <div
      ref={stage}
      className="finished-box-stage"
      role="img"
      aria-label={`現在のデザインの完成イメージ・${current?.[1] ?? '自由な向き'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ perspective: `${Math.round(diagonal * scale * 4)}px` }}
    >
      <div className={`finished-box-scene${animating ? ' is-animating' : ''}`} style={{ transform: `rotateX(${-angle.pitch}deg) rotateY(${angle.yaw}deg)` }} onTransitionEnd={() => setAnimating(false)}>
        <div className="finished-box-floor" aria-hidden="true" style={{ transform: matrix3d([extent[0] * 1.6 * scale / 100, 0, 0], [0, 0, extent[2] * 1.6 * scale / 100], [0, 1, 0], [-extent[0] * 0.8 * scale, (floorY + 0.4) * scale, -extent[2] * 0.8 * scale]) }}/>
        {faces.map((f, index) => {
          const frame = frames[index];
          const facing = rotateView(frame.normal, angle.yaw, angle.pitch);
          const clip = `box-${id}-${index}`;
          const { x, y, width: w, height: h } = f.panel;
          const light = Math.max(0, frame.normal[0] * LIGHT[0] + frame.normal[1] * LIGHT[1] + frame.normal[2] * LIGHT[2]);
          return <div
            key={`${f.pageId}-${f.panel.id}`}
            className="finished-box-face"
            data-finished-face={f.name}
            data-source-panel={f.panel.id}
            hidden={facing[2] <= 0.001}
            style={{ width: w * scale, height: h * scale, transform: matrix3d(frame.u.map(v => v / w) as Vec3, frame.v.map(v => v / h) as Vec3, frame.normal, frame.origin.map(v => v * scale) as Vec3) }}
          >
            <svg viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
              <defs><clipPath id={clip}><rect x={x} y={y} width={w} height={h}/></clipPath></defs>
              <g clipPath={`url(#${clip})`}>
                <ArtworkLayer geometry={f.geometry} backgroundColor={state.backgroundColors[f.pageId]} artworkLayers={state.artworkLayers.filter(i => i.pageId === f.pageId)} stamps={state.stamps.filter(i => i.pageId === f.pageId)} clipId={clip} idPrefix={clip} selectedArtworkId={null} selectedStampId={null} exportMode/>
                <TextLayer texts={state.texts.filter(i => i.pageId === f.pageId)} selectedTextId={null} exportMode/>
              </g>
            </svg>
            <span className="finished-box-shade" style={{ opacity: +(0.22 * (1 - light) ** 2).toFixed(3) }}/>
          </div>;
        })}
      </div>
    </div>
    <p className="finished-box-caption">ドラッグで回せます · {size.map(f => `${f.label}${f.value}`).join(' × ')} mm</p>
    <p className="finished-box-note">紙の膨らみや接着のずれは省略しています。</p>
  </div>;
}

export function FinishedBoxDialog({ state, pageId, pageLabel, geometry, onClose }: { state: AppState; pageId: DielinePageId; pageLabel: string; geometry: DielineGeometry; onClose: ()=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<'paper'|'finished'>('finished');
  useEffect(()=>{ const previous = document.activeElement as HTMLElement; dialog.current?.showModal(); return ()=>{ previous?.focus(); }; },[]);
  return <dialog ref={dialog} className="finished-box-dialog" aria-label="箱のプレビュー" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <header><h2>プレビュー</h2><button type="button" onClick={onClose} aria-label="プレビューを閉じる" autoFocus>×</button></header>
    <div className="preview-mode-tabs" role="group" aria-label="プレビューの表示"><button type="button" aria-pressed={mode==='finished'} onClick={()=>setMode('finished')}>完成イメージ</button><button type="button" aria-pressed={mode==='paper'} onClick={()=>setMode('paper')}>A4印刷</button></div>
    {mode==='paper' ? <A4PrintPreview state={state} pageId={pageId} pageLabel={pageLabel} geometry={geometry}/> : <FinishedBoxPreview state={state}/>}
    <button className="primary-button full-button" type="button" onClick={onClose}>デザインへ戻る</button>
  </dialog>;
}

import { Fragment, useId, type CSSProperties } from 'react';
import type { AppState } from '../../app/app-types';
import { envelopeFoldParts, foldRotation, type FoldPart, type FoldRect } from '../../domain/boxes/finished-envelope';
import type { DielineGeometry, EnvelopeFaceId, Point } from '../../domain/boxes/types';
import { pointsToString } from '../dieline/geometry-utils';
import { ArtworkLayer } from '../dieline/layers/ArtworkLayer';
import { EnvelopeDesignLayer } from '../dieline/layers/EnvelopeDesignLayer';
import { TextLayer } from '../dieline/layers/TextLayer';

/** The flap leans back a little when open, as an envelope rests on a desk. */
export const FLAP_OPEN_DEG = 35;
export const FLAP_CLOSED_DEG = 180;
const THICKNESS_MM = 1.6;

/** The net's artwork as printed (no cut or fold lines), cropped to one piece of the net. */
function NetArt({ state, geometry, box, idPrefix }: { state: AppState; geometry: DielineGeometry; box: FoldRect; idPrefix: string }) {
  const clipId = `${idPrefix}-clip`;
  const faceIds: [EnvelopeFaceId, string][] = [['envelope-front', 'envelope-front'], ['envelope-flap', 'envelope-top-flap'], ['envelope-back', 'envelope-back']];
  const surfaceClipIds: Partial<Record<EnvelopeFaceId, string>> = {};
  for (const [face, polygonId] of faceIds) if (geometry.clipPolygons.some(p => p.id === polygonId)) surfaceClipIds[face] = `${idPrefix}-${face}-clip`;
  const artworkLayers = state.artworkLayers.filter(i => i.pageId === 'main' && i.visible);
  const stamps = state.stamps.filter(i => i.pageId === 'main' && i.visible);
  const texts = state.texts.filter(i => i.pageId === 'main');
  const backgroundColor = state.backgroundColors.main;
  return <svg viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <clipPath id={clipId}>{geometry.clipPolygons.map(p => <polygon key={p.id} points={pointsToString(p.points)} />)}</clipPath>
      {faceIds.map(([face, polygonId]) => { const polygon = geometry.clipPolygons.find(p => p.id === polygonId); return polygon ? <clipPath key={face} id={surfaceClipIds[face]}><polygon points={pointsToString(polygon.points)} /></clipPath> : null; })}
    </defs>
    <ArtworkLayer geometry={geometry} backgroundColor={backgroundColor} surfaceBackgroundColors={state.surfaceBackgroundColors} surfaceClipIds={surfaceClipIds} artworkLayers={artworkLayers} stamps={stamps} clipId={clipId} idPrefix={`${idPrefix}-art`} selectedArtworkId={null} selectedStampId={null} exportMode showStamps={false} />
    {state.envelopeDesign && <EnvelopeDesignLayer geometry={geometry} settings={state.envelopeDesign} idPrefix={idPrefix} />}
    <ArtworkLayer geometry={geometry} backgroundColor={backgroundColor} surfaceBackgroundColors={state.surfaceBackgroundColors} surfaceClipIds={surfaceClipIds} artworkLayers={artworkLayers} stamps={stamps} clipId={clipId} idPrefix={`${idPrefix}-stamps`} selectedArtworkId={null} selectedStampId={null} exportMode showBaseLayers={false} />
    <g clipPath={`url(#${clipId})`}><TextLayer texts={texts} selectedTextId={null} exportMode surfaceClipIds={surfaceClipIds} /></g>
  </svg>;
}

const clipPolygon = (points: Point[], box: FoldRect) => `polygon(${points.map(p => `${((p.x - box.x) / box.width * 100).toFixed(3)}% ${((p.y - box.y) / box.height * 100).toFixed(3)}%`).join(',')})`;

/** The finished envelope, built by folding the net's pieces onto the front face. Lives inside a `preserve-3d` scene centred on the front face. */
export function FoldedEnvelope({ state, geometry, scale, flapOpen }: { state: AppState; geometry: DielineGeometry; scale: number; flapOpen: boolean }) {
  const id = useId().replaceAll(':', '');
  const { front, parts } = envelopeFoldParts(geometry);
  const cx = front.x + front.width / 2, cy = front.y + front.height / 2;
  const half = Math.max(1.5, THICKNESS_MM / 2 * scale);
  const gap = Math.max(0.5, 0.35 * scale);
  const place = (box: FoldRect): CSSProperties => ({ left: (box.x - cx) * scale, top: (box.y - cy) * scale, width: box.width * scale, height: box.height * scale });
  const paper = '#fffdfa';
  const strip = '#eadfd5';

  const plane = (key: string, box: FoldRect, points: Point[], z: number, part?: FoldPart) => {
    const origin = part ? (part.edge === 'top' || part.edge === 'bottom' ? `50% ${(part.hinge - box.y) * scale}px` : `${(part.hinge - box.x) * scale}px 50%`) : '50% 50%';
    const angle = part ? (part.isFlap && flapOpen ? FLAP_OPEN_DEG : FLAP_CLOSED_DEG) : 0;
    const fold = (depth: number) => `${part ? foldRotation(part.edge, angle) : ''} translateZ(${depth}px)`;
    const className = `finished-fold-plane${part?.isFlap ? ' is-flap' : ''}`;
    return <Fragment key={key}>
      <div className={`${className} is-liner`} style={{ ...place(box), clipPath: clipPolygon(points, box), background: paper, transformOrigin: origin, transform: fold(z - gap * 0.8) }} />
      <div className={className} data-fold-part={key} style={{ ...place(box), clipPath: clipPolygon(points, box), transformOrigin: origin, transform: fold(z) }}><NetArt state={state} geometry={geometry} box={box} idPrefix={`${id}-${key}`} /></div>
    </Fragment>;
  };
  const edge = (key: string, style: CSSProperties, transform: string) => <div key={key} className="finished-fold-edge" style={{ ...style, background: strip, transform }} />;
  const w = front.width * scale, h = front.height * scale;

  return <>
    {plane('front', front, geometry.clipPolygons.find(p => p.id === 'envelope-front')!.points, half)}
    {parts.map(part => plane(part.id, part.box, part.points, half + part.layer * gap, part))}
    {edge('edge-bottom', { left: -w / 2, top: h / 2, width: w, height: half * 2 }, `translateZ(${half}px) rotateX(-90deg)`)}
    {edge('edge-left', { left: -w / 2, top: -h / 2, width: half * 2, height: h }, `translateZ(${half}px) rotateY(90deg)`)}
    {edge('edge-right', { left: w / 2, top: -h / 2, width: half * 2, height: h }, `translateZ(${half}px) rotateY(90deg)`)}
  </>;
}

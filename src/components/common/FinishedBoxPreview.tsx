import { useEffect, useId, useRef, useState } from 'react';
import type { AppState } from '../../app/app-types';
import { boxSizeFields, faceMatrix, finishedBoxFaces, visibleBoxFaces, type BoxView } from '../../domain/boxes/finished-box';
import { boxPerspective, perspectiveTriangles } from '../../domain/boxes/box-perspective';
import { ArtworkLayer } from '../dieline/layers/ArtworkLayer';
import { TextLayer } from '../dieline/layers/TextLayer';
import type { DielineGeometry, DielinePageId } from '../../domain/boxes/types';
import { A4PrintPreview } from './A4PrintPreview';

const views: [BoxView,string][] = [['front-angle','斜め前'],['back-angle','斜め後ろ'],['front','正面'],['top','真上']];
// Light comes from above: the lid stays bright and the side walls fall into shade, so the box reads as a solid.
const faceShade: Record<string, number> = { top: 0, front: 0.04, back: 0.04, left: 0.16, right: 0.16 };
export function FinishedBoxPreview({ state }: { state: AppState }) {
  const [view, setView] = useState<BoxView>('front-angle');
  const id = useId().replaceAll(':','');
  const allFaces = finishedBoxFaces(state.box);
  const faces = visibleBoxFaces(allFaces, view);
  const project = boxPerspective(allFaces,view);
  const perspective = view==='front-angle'||view==='back-angle';
  const points = faces.flatMap(f => {
    return [project(f,0,0),project(f,f.panel.width,0),project(f,0,f.panel.height),project(f,f.panel.width,f.panel.height)];
  });
  const minX = Math.min(...points.map(p=>p[0])), minY = Math.min(...points.map(p=>p[1]));
  const width = Math.max(...points.map(p=>p[0]))-minX, height = Math.max(...points.map(p=>p[1]))-minY;
  const pad = Math.max(width,height)*0.12;
  const size = boxSizeFields(state.box);
  return <div className="finished-box">
    <div className="finished-box-views" role="group" aria-label="完成図を見る方向">{views.map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</div>
    <svg className="finished-box-svg" viewBox={`${minX-pad} ${minY-pad} ${width+pad*2} ${height+pad*2}`} role="img" aria-label={`現在のデザインの完成イメージ・${views.find(v=>v[0]===view)![1]}`}>
      <defs><filter id={`box-${id}-shadow`} x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy={pad*0.22} stdDeviation={pad*0.2} floodColor="#5b4038" floodOpacity="0.24"/></filter></defs>
      <g filter={`url(#box-${id}-shadow)`}>
      {faces.map((f,index)=>{
        const clip = `box-${id}-${index}`;
        const {x,y,width:w,height:h} = f.panel;
        const surface = <>
          <defs><clipPath id={clip}><rect x={x} y={y} width={w} height={h}/></clipPath></defs>
          <g transform={`translate(${-x} ${-y})`} clipPath={`url(#${clip})`}>
            <ArtworkLayer geometry={f.geometry} backgroundColor={state.backgroundColors[f.pageId]} artworkLayers={state.artworkLayers.filter(i=>i.pageId===f.pageId)} stamps={state.stamps.filter(i=>i.pageId===f.pageId)} clipId={clip} idPrefix={clip} selectedArtworkId={null} selectedStampId={null} exportMode/>
            <TextLayer texts={state.texts.filter(i=>i.pageId===f.pageId)} selectedTextId={null} exportMode/>
          </g>
        </>;
        const outline=[project(f,0,0),project(f,w,0),project(f,w,h),project(f,0,h)].map(p=>p.join(',')).join(' ');
        return <g key={`${f.pageId}-${f.panel.id}`} data-finished-face={f.name} data-source-panel={f.panel.id}>
          {perspective ? <>
            <defs><g id={`${clip}-texture`}>{surface}</g></defs>
            <polygon points={outline} fill={state.backgroundColors[f.pageId]}/>
            {perspectiveTriangles(f,project).map((triangle,i)=><g key={i} transform={`matrix(${triangle.matrix.join(' ')})`}>
              <defs><clipPath id={`${clip}-triangle-${i}`}><polygon points={triangle.source.map(p=>p.join(',')).join(' ')}/></clipPath></defs>
              <use href={`#${clip}-texture`} clipPath={`url(#${clip}-triangle-${i})`}/>
            </g>)}
          </> : <g transform={`matrix(${faceMatrix(f,view).join(' ')})`}>{surface}</g>}
          <polygon points={outline} fill="#5b4038" fillOpacity={faceShade[f.name]} stroke="#8f7a6c" strokeWidth="0.9" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </g>;
      })}
      </g>
    </svg>
    <p className="finished-box-caption">{view==='top'?'ふたを完成時の向きで表示':'↑ 箱の上'} · {size.map(f=>`${f.label} ${f.value}`).join(' × ')} mm</p>
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

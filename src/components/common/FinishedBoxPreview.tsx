import { useEffect, useId, useRef, useState } from 'react';
import type { AppState } from '../../app/app-types';
import { faceMatrix, finishedBoxFaces, visibleBoxFaces, type BoxView } from '../../domain/boxes/finished-box';
import { boxPerspective, perspectiveTriangles } from '../../domain/boxes/box-perspective';
import { ArtworkLayer } from '../dieline/layers/ArtworkLayer';
import { TextLayer } from '../dieline/layers/TextLayer';

const views: [BoxView,string][] = [['top','真上から'],['front-angle','斜め前'],['back-angle','斜め後ろ'],['front','正面']];
export function FinishedBoxPreview({ state }: { state: AppState }) {
  const [view, setView] = useState<BoxView>(state.box.type === 'straight-tuck-carton-v1' ? 'front-angle' : 'top');
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
  return <div className="finished-box">
    <div className="finished-box-views" role="group" aria-label="完成図を見る方向">{views.map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</div>
    <svg className="finished-box-svg" viewBox={`${minX-pad} ${minY-pad} ${width+pad*2} ${height+pad*2}`} role="img" aria-label={`現在のデザインの完成イメージ・${views.find(v=>v[0]===view)![1]}`}>
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
          <polygon points={outline} fill={f.name==='top'?'none':'#70594e'} fillOpacity={f.name==='right'||f.name==='left'?0.10:0.025} stroke="#9c8879" strokeWidth="0.7" vectorEffect="non-scaling-stroke"/>
        </g>;
      })}
    </svg>
    <p className="finished-box-caption">{view==='top'?'天面を展開図と同じ向きで表示':'↑ 箱の上'} · 入力寸法の比率で表示</p>
    <p className="finished-box-caption">入力寸法：W {state.box.widthMm} × D {state.box.depthMm} × H {state.box.heightMm} mm</p>
    <p className="finished-box-note">模様・スタンプ・文字の向きを確認できます。紙の膨らみや接着によるわずかなずれは省略しています。</p>
  </div>;
}

export function FinishedBoxDialog({ state, onClose }: { state: AppState; onClose: ()=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(()=>{ const previous = document.activeElement as HTMLElement; dialog.current?.showModal(); return ()=>{ previous?.focus(); }; },[]);
  return <dialog ref={dialog} className="finished-box-dialog" aria-label="箱の完成イメージ" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
    <header><h2>完成イメージ</h2><button type="button" onClick={onClose} aria-label="完成イメージを閉じる" autoFocus>×</button></header>
    <FinishedBoxPreview state={state}/>
    <button className="primary-button full-button" type="button" onClick={onClose}>デザインへ戻る</button>
  </dialog>;
}

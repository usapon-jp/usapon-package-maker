import type { AppState } from './app-types';
import { finishedBoxFaces } from '../domain/boxes/finished-box';
import { generateDielineDocument } from '../domain/boxes/registry';
import type { Panel } from '../domain/boxes/types';

const clamp = (n:number, low:number, high:number) => Math.max(low, Math.min(high,n));
const orientation = (type:string, panel:Panel) => type === 'gift-box-v1'
  ? ({'panel-lid':90,'panel-front-wall':90,'panel-rear-wall':270,'panel-side-right':180} as Record<string,number>)[panel.id] ?? 0 : 0;

/** Preserve a decoration's position on its panel when the surrounding net changes. */
export function resizeBoxArtwork(before: AppState, after: AppState): AppState {
  const supported = ['straight-tuck-carton-v1','gift-box-v1','two-piece-gift-box-v1'];
  if (!supported.includes(before.box.type) || !supported.includes(after.box.type)) return after;
  if (!after.stamps.length && !after.artworkLayers.some(item=>item.kind==='uploaded-artwork'&&!item.repeat)) return after;
  let oldPages, newPages;
  try {
    oldPages=generateDielineDocument(before.box).pages;
    newPages=generateDielineDocument(after.box).pages;
  } catch { return after; } // A partially typed dimension must not interrupt editing.
  const oldFaces=finishedBoxFaces(before.box), newFaces=finishedBoxFaces(after.box);
  const placement=(pageId:string,x:number,y:number,width:number,ratio:number,rotation:number, inset=0.9) => {
    const oldPage=oldPages.find(p=>p.id===pageId);
    const newPage=newPages.find(p=>p.id===pageId) ?? newPages[0];
    if (!oldPage) return null;
    const panels=oldPage.geometry.panels;
    const source=panels.find(p=>x>=p.x && x<=p.x+p.width && y>=p.y && y<=p.y+p.height) ?? panels[0];
    const faceName=oldFaces.find(f=>f.pageId===oldPage.id && f.panel.id===source.id)?.name;
    const matchingFace=newFaces.find(f=>f.pageId===newPage.id && f.name===faceName);
    const target=before.box.type===after.box.type
      ? newPage.geometry.panels.find(p=>p.id===source.id) ?? newPage.geometry.panels[0]
      : source===panels[0] ? newPage.geometry.panels[0] : matchingFace?.panel ?? newPage.geometry.panels[0];
    const angle=((rotation+orientation(after.box.type,target)-orientation(before.box.type,source))%360+360)%360;
    const radians=angle*Math.PI/180, r=Math.max(ratio,0.01);
    const sx=Math.abs(Math.cos(radians))+Math.abs(Math.sin(radians))/r;
    const sy=Math.abs(Math.sin(radians))+Math.abs(Math.cos(radians))/r;
    const w=Math.min(width,target.width*inset/sx,target.height*inset/sy);
    const halfX=w*sx/2, halfY=w*sy/2;
    return {pageId:newPage.id,widthMm:w,rotationDeg:angle,
      x:target.x+clamp((x-source.x)/source.width*target.width,halfX,target.width-halfX),
      y:target.y+clamp((y-source.y)/source.height*target.height,halfY,target.height-halfY)};
  };
  return {...after,
    stamps:after.stamps.map(item=>{
      const p=placement(item.pageId,item.xMm,item.yMm,item.widthMm,item.aspectRatio,item.rotationDeg);
      if (!p) return item;
      const {x,y,...rest}=p; return {...item,...rest,xMm:x,yMm:y};
    }),
    artworkLayers:after.artworkLayers.map(item=>{
      if(item.kind!=='uploaded-artwork'||item.repeat) return item;
      const p=placement(item.pageId,item.offsetXmm,item.offsetYmm,item.widthMm,item.aspectRatio,item.rotationDeg,1);
      if(!p)return item;
      const {x,y,...rest}=p;return {...item,...rest,offsetXmm:x,offsetYmm:y,rotationDeg:rest.rotationDeg as typeof item.rotationDeg};
    })
  };
}

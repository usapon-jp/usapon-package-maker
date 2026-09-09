import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../src/app/app-state';
import { finishedBoxFaces, faceMatrix, visibleBoxFaces, projectBoxPoint, type BoxView } from '../src/domain/boxes/finished-box';
import { FinishedBoxPreview } from '../src/components/common/FinishedBoxPreview';

describe('箱の完成プレビュー', () => {
  it.each(['front-angle','back-angle'] as const)('%s で3方向の縮尺が等しく、奥側でも辺の長さが変わらない',view=>{
    const x = projectBoxPoint([50,0,0],view);
    const y = projectBoxPoint([0,50,0],view);
    const z = projectBoxPoint([0,0,50],view);
    expect(Math.hypot(...x)).toBeCloseTo(Math.hypot(...z));
    expect(Math.hypot(...x)).toBeCloseTo(Math.hypot(...y));
    const end = projectBoxPoint([50,0,50],view);
    expect(end[0]-z[0]).toBeCloseTo(x[0]);
    expect(end[1]-z[1]).toBeCloseTo(x[1]);
  });
  it.each(['gift-box-v1','two-piece-gift-box-v1'] as const)('%s の真上表示も組み立て後の天面の軸を使う',type=>{
    const face=finishedBoxFaces({...initialState.box,type}).find(f=>f.name==='top')!;
    const [a,b,c,d] = faceMatrix(face,'top');
    expect(a * d - b * c).toBeCloseTo(1);
    expect([a,b]).toEqual([face.u[0]/face.panel.width, -face.u[2]/face.panel.width]);
    const html=renderToStaticMarkup(<FinishedBoxPreview state={{...initialState,box:{...initialState.box,type}}}/>);
    expect(html).toContain(`translate(${-face.panel.x} ${-face.panel.y})`);
    expect(html).toContain('完成イメージ・斜め前');
  });
  it.each(['straight-tuck-carton-v1','gift-box-v1','two-piece-gift-box-v1'] as const)('%s の面を4方向に投影できる', type => {
    const faces = finishedBoxFaces({...initialState.box,type});
    for(const view of ['front-angle','back-angle','front','top'] as BoxView[]) {
      const shown = visibleBoxFaces(faces,view);
      expect(shown.length).toBeGreaterThan(0);
      for(const face of shown) {
        const [a,b,c,d] = faceMatrix(face,view);
        expect(Math.abs(a*d-b*c)).toBeGreaterThan(0);
        const m = faceMatrix(face, view);
        const point = (x:number,y:number) => [m[0]*x+m[2]*y+m[4], m[1]*x+m[3]*y+m[5]];
        const tl=point(0,0), tr=point(face.panel.width,0), bl=point(0,face.panel.height), br=point(face.panel.width,face.panel.height);
        for (const axis of [0,1]) {
          expect(tr[axis]-tl[axis]).toBeCloseTo(br[axis]-bl[axis],10);
          expect(bl[axis]-tl[axis]).toBeCloseTo(br[axis]-tr[axis],10);
        }
      }
    }
  });
  it('寸法変更を面の実寸へ反映し、前面と上面の折り目が一致する', () => {
    const faces = finishedBoxFaces({...initialState.box,widthMm:80,heightMm:100,depthMm:30});
    const front=faces.find(f=>f.name==='front')!, top=faces.find(f=>f.name==='top')!;
    expect(front.u).toEqual([80,0,0]);
    expect(front.v).toEqual([0,100,0]);
    expect(top.origin.map((v,i)=>v+top.v[i])).toEqual(front.origin);
    expect(top.u).toEqual(front.u);
  });
  it('浅型箱の蓋と背面は共有する折り線が一致する', () => {
    const faces=finishedBoxFaces({...initialState.box,type:'gift-box-v1'});
    const lid=faces.find(f=>f.name==='top')!, rear=faces.find(f=>f.name==='back')!;
    expect(lid.origin.map((v,i)=>v+lid.u[i])).toEqual(rear.origin);
    expect(lid.v).toEqual(rear.v);
  });
  it('ツーピース箱は蓋と本体の素材を別ページから描く',()=>{
    const faces=finishedBoxFaces({...initialState.box,type:'two-piece-gift-box-v1',lidDepthMm:10});
    expect(faces.filter(f=>f.name==='front').map(f=>f.pageId)).toEqual(['base','lid']);
    expect(faces.find(f=>f.name==='top')?.pageId).toBe('lid');
  });
  it('既存の文字描画と背景色を共有し、操作ボタンは持ち込まない',()=>{
    const html=renderToStaticMarkup(<FinishedBoxPreview state={{...initialState,backgroundColors:{...initialState.backgroundColors,main:'#abcdef'}}}/>);
    expect(html).toContain('#abcdef');
    expect(html).toContain('data-source-panel="panel-0"');
    expect(html).not.toContain('data-stamp-rotate-handle');
  });
});

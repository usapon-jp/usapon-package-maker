import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { initialState } from '../src/app/app-state';
import { boxSizeFields, faceFrames3d, rotateView, finishedBoxFaces, faceMatrix, visibleBoxFaces, projectBoxPoint, type BoxView } from '../src/domain/boxes/finished-box';
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
    expect(html).toContain(`viewBox="${face.panel.x} ${face.panel.y} ${face.panel.width} ${face.panel.height}"`);
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
  it.each([
    ['straight-tuck-carton-v1', '幅 40 × 奥行 25 × 高さ 60'],
    ['gift-box-v1', '幅 40 × 高さ 60 × 深さ 25'],
    ['two-piece-gift-box-v1', '幅 40 × 奥行 60 × 高さ 25'],
  ] as const)('%s の寸法はサイズ画面と同じ名前・順番で表示する',(type,expected)=>{
    const box={...initialState.box,type,widthMm:40,depthMm:25,heightMm:60};
    expect(boxSizeFields(box).map(f=>`${f.label} ${f.value}`).join(' × ')).toBe(expected);
    const html=renderToStaticMarkup(<FinishedBoxPreview state={{...initialState,box}}/>);
    expect(html).toContain(`${expected.replaceAll(/ (\d)/g,'$1')} mm`);
  });
  it('開いたときは斜め前の立体を最初に見せ、上から光を当てて陰影をつける',()=>{
    const html=renderToStaticMarkup(<FinishedBoxPreview state={initialState}/>);
    expect(html.indexOf('斜め前')).toBeLessThan(html.indexOf('真上'));
    expect(html).toContain('finished-box-floor');
    const shade=(name:string)=>Number(html.match(new RegExp(`data-finished-face="${name}"[\\s\\S]*?finished-box-shade" style="opacity:([0-9.]+)`))![1]);
    expect(shade('top')).toBeLessThan(shade('front'));
    expect(shade('front')).toBeLessThan(shade('right'));
  });
  it.each(['straight-tuck-carton-v1','gift-box-v1','two-piece-gift-box-v1'] as const)('%s の3D面は外向きで、斜め前から見える面だけ描く',type=>{
    const faces=finishedBoxFaces({...initialState.box,type});
    const frames=faceFrames3d(faces);
    const shown=new Set<string>();
    frames.forEach((frame,i)=>{
      const middle=frame.origin.map((v,k)=>v+frame.u[k]/2+frame.v[k]/2);
      expect(frame.normal.reduce((sum,v,k)=>sum+v*middle[k],0)).toBeGreaterThan(0);
      if(rotateView(frame.normal,-35,28)[2]>0) shown.add(faces[i].name);
    });
    expect([...shown].sort()).toEqual(['front','right','top']);
  });
  it('真上から見ると、ふたの面がまっすぐこちらを向く',()=>{
    const faces=finishedBoxFaces(initialState.box);
    const top=faceFrames3d(faces)[faces.findIndex(f=>f.name==='top')];
    expect(rotateView(top.normal,0,90)[2]).toBeCloseTo(1);
  });
});

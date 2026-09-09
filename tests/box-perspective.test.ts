import { expect, it } from 'vitest';
import { initialState } from '../src/app/app-state';
import { finishedBoxFaces } from '../src/domain/boxes/finished-box';
import { boxPerspective, perspectiveTriangles } from '../src/domain/boxes/box-perspective';

it.each(['front-angle','back-angle'] as const)('%s は遠い辺が短くなり、面の接点は一致する',view=>{
  const faces=finishedBoxFaces(initialState.box);
  const p=boxPerspective(faces,view);
  const top=faces.find(f=>f.name==='top')!, front=faces.find(f=>f.name==='front')!;
  const length=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const far=length(p(top,0,0),p(top,top.panel.width,0));
  const near=length(p(top,0,top.panel.height),p(top,top.panel.width,top.panel.height));
  if(view==='front-angle') expect(far).toBeLessThan(near);
  else expect(far).toBeGreaterThan(near);
  expect(p(top,0,top.panel.height)).toEqual(p(front,0,0));
  for(const triangle of perspectiveTriangles(top,p)) {
    const [a,b,c,d,e,f]=triangle.matrix;
    for(const [x,y] of triangle.source) {
      const target=p(top,x,y);
      expect(a*x+c*y+e).toBeCloseTo(target[0],9);
      expect(b*x+d*y+f).toBeCloseTo(target[1],9);
    }
  }
});

it('真上では元画像の座標と縮尺を維持する',()=>{
  const faces=finishedBoxFaces({...initialState.box,type:'two-piece-gift-box-v1'});
  const p=boxPerspective(faces,'top');
  const lid=faces.find(f=>f.name==='top')!;
  expect(p(lid,23,47)).toEqual([23,47-lid.panel.height]);
});

import { describe, expect, it } from 'vitest';
import { initialState } from '../src/app/app-state';
import { createFullPanelArtwork, createStamp } from '../src/app/artwork';
import { finishedBoxFaces, faceMatrix } from '../src/domain/boxes/finished-box';
import type { UploadedAsset } from '../src/app/app-types';

const asset = { id:'orientation', fileName:'upright.png', dataUrl:'data:image/png;base64,', aspectRatio:0.5 } as UploadedAsset;

describe('完成図に合わせた新規画像の向き', () => {
  it.each(['straight-tuck-carton-v1','gift-box-v1','two-piece-gift-box-v1'] as const)('%s はおすすめ画像の上方向と完成図の上方向が一致する', type => {
    const faces = finishedBoxFaces({...initialState.box, type, widthMm:70, heightMm:100, depthMm:20});
    const face = faces.find(f => f.name === (type === 'straight-tuck-carton-v1' ? 'front' : 'top'))!;
    const view = type === 'straight-tuck-carton-v1' ? 'front' : 'top';
    for (const ratio of [0.5, 1, 2]) {
      const source = {...asset, aspectRatio:ratio};
      const bg = createFullPanelArtwork(source, face.geometry, face.pageId, face.panel);
      const stamp = createStamp(source, face.geometry, 'stamp', face.pageId, face.panel);
      for (const item of [bg, stamp]) {
        const angle = item.rotationDeg*Math.PI/180;
        const [a,b,c,d] = faceMatrix(face,view);
        // Up vector in the image, after placement and folding.
        const upX = Math.sin(angle), upY = -Math.cos(angle);
        expect(a*upX+c*upY).toBeCloseTo(0);
        expect(b*upX+d*upY).toBeLessThan(0);
        const w=item.widthMm, h=w/ratio;
        expect(Math.abs(w*Math.cos(angle))+Math.abs(h*Math.sin(angle))).toBeLessThanOrEqual(face.panel.width+1e-8);
        expect(Math.abs(w*Math.sin(angle))+Math.abs(h*Math.cos(angle))).toBeLessThanOrEqual(face.panel.height+1e-8);
      }
      expect(stamp.widthMm).toBeLessThanOrEqual(40);
    }
  });
  it('極端に細い面でもスタンプをはみ出させない', () => {
    const face=finishedBoxFaces(initialState.box)[0];
    const panel={...face.panel,width:3,height:2};
    const stamp=createStamp(asset,face.geometry,'small','main',panel);
    expect(stamp.widthMm).toBeLessThan(panel.width);
    expect(stamp.widthMm/asset.aspectRatio).toBeLessThan(panel.height);
  });
});

import { expect, it } from 'vitest';
import { initialState, appReducer } from '../src/app/app-state';
import { createStamp } from '../src/app/artwork';
import { generateDielineDocument } from '../src/domain/boxes/registry';
import type { UploadedAsset } from '../src/app/app-types';

const asset={id:'test',fileName:'test.png',dataUrl:'data:image/png;base64,',aspectRatio:.5} as UploadedAsset;
it('箱を変更しても中心のスタンプは新しい主役の面の中心に追従する',()=>{
 const geometry=generateDielineDocument(initialState.box).pages[0].geometry;
 const stamp=createStamp(asset,geometry);
 const next=appReducer({...initialState,stamps:[stamp]},{type:'set-box-type',boxType:'gift-box-v1'});
 const panel=generateDielineDocument(next.box).pages[0].geometry.panels[0];
 expect(next.stamps[0].xMm).toBeCloseTo(panel.x+panel.width/2);
 expect(next.stamps[0].yMm).toBeCloseTo(panel.y+panel.height/2);
 expect(next.stamps[0].rotationDeg).toBe(90);
 expect(next.stamps[0].widthMm).toBeLessThanOrEqual(stamp.widthMm);
});
it('寸法を縮めてもスタンプが面からはみ出さず、再拡大しても勝手に大きくしない',()=>{
 const geometry=generateDielineDocument(initialState.box).pages[0].geometry;
 const stamp=createStamp(asset,geometry);
 const next=appReducer({...initialState,stamps:[stamp]},{type:'update-box',field:'widthMm',value:10});
 expect(next.stamps[0].widthMm).toBeLessThanOrEqual(9);
 const enlarged=appReducer(next,{type:'update-box',field:'widthMm',value:100});
 expect(enlarged.stamps[0].widthMm).toBe(next.stamps[0].widthMm);
});
it('二分割の蓋に切り替えたスタンプがページ不一致で消えない',()=>{
 const stamp=createStamp(asset,generateDielineDocument(initialState.box).pages[0].geometry);
 const next=appReducer({...initialState,stamps:[stamp]},{type:'set-box-type',boxType:'two-piece-gift-box-v1'});
 expect(next.stamps[0].pageId).toBe('lid');
});
it('浅型の初期配置はユーザーが調整したフタ幅35%・縦中央を基準にする',()=>{
 const box={...initialState.box,type:'gift-box-v1' as const,widthMm:100,heightMm:75,depthMm:40};
 const geometry=generateDielineDocument(box).pages[0].geometry;
 const stamp=createStamp({...asset,aspectRatio:.85},geometry);
 const panel=geometry.panels[0];
 expect(stamp.xMm).toBeCloseTo(panel.x+panel.width*.35);
 expect(stamp.yMm).toBeCloseTo(panel.y+panel.height*.5);
 expect(stamp.widthMm).toBe(40);
});

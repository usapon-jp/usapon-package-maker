import { describe, expect, it } from 'vitest';
import { previousScreen } from '../src/app/navigation';
import { appReducer, initialState } from '../src/app/app-state';
import { serializeBoxDocument } from '../src/app/box-document';

describe('制作の入口と戻り先', () => {
  it('初回はホーム、箱は印刷からサイズまで戻り、ホームへ着く', () => {
    expect(initialState.screen).toBe('home');
    const design=previousScreen('print',null)!;
    const size=previousScreen(design,null)!;
    expect([design,size,previousScreen(size,null)]).toEqual(['design','size','home']);
    expect(previousScreen('home',null)).toBeNull();
  });
  it('レターセットはセット選択へ戻り、箱のサイズ画面へ飛ばない', () => {
    expect(previousScreen('design','y2-kamasu-envelope')).toBe('letter-set');
    expect(previousScreen('letter-set','y2-kamasu-envelope')).toBe('home');
    expect(previousScreen('my-boxes',null)).toBe('home');
  });
  it('ホーム往復で作成中の寸法や印刷データを変更しない', () => {
    const working=appReducer(initialState,{type:'update-box',field:'widthMm',value:57});
    const home=appReducer(working,{type:'go',screen:'home'});
    const resumed=appReducer(home,{type:'go',screen:'design'});
    expect(serializeBoxDocument(resumed)).toEqual(serializeBoxDocument(working));
  });
});

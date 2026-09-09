import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { previousScreen } from '../src/app/navigation';
import { appReducer, initialState } from '../src/app/app-state';
import { serializeBoxDocument } from '../src/app/box-document';
import { CreationHome, HOME_LETTER_SETS } from '../src/components/common/CreationHome';

describe('制作の入口と戻り先', () => {
  it('初回はホーム、箱は印刷からサイズまで戻り、ホームへ着く', () => {
    expect(initialState.screen).toBe('home');
    const design=previousScreen('print',null)!;
    const size=previousScreen(design,null)!;
    expect([design,size,previousScreen(size,null)]).toEqual(['design','size','home']);
    expect(previousScreen('home',null)).toBeNull();
  });
  it('レターセットはホームへ戻り、箱のサイズ画面へ飛ばない', () => {
    expect(previousScreen('design','y2-kamasu-envelope')).toBe('home');
    expect(previousScreen('letter-set','y2-kamasu-envelope')).toBe('home');
    expect(previousScreen('my-boxes',null)).toBe('home');
  });
  it('ホームから4種類のレターセットを直接選べる', () => {
    const markup = renderToStaticMarkup(createElement(CreationHome, { onBox: () => undefined, onLetter: () => undefined, onResume: null, resumeLabel: '' }));
    expect(HOME_LETTER_SETS.map((option) => option.label)).toEqual(['封筒＋便箋', '封筒＋ミニカード', 'フルセット', '封筒のみ']);
    expect(markup).not.toContain('ほかのセット');
    HOME_LETTER_SETS.forEach((option) => expect(markup).toContain(option.label));
  });
  it('ホーム往復で作成中の寸法や印刷データを変更しない', () => {
    const working=appReducer(initialState,{type:'update-box',field:'widthMm',value:57});
    const home=appReducer(working,{type:'go',screen:'home'});
    const resumed=appReducer(home,{type:'go',screen:'design'});
    expect(serializeBoxDocument(resumed)).toEqual(serializeBoxDocument(working));
  });
});

import { expect, it } from 'vitest';
import { selectNewMaterial, noticeMode } from '../src/MaterialNotice';
it('does not prompt a signed-out normal visitor', () => { expect(noticeMode(undefined, false, 'signed-out')).toBe(''); });
it('prompts login only for purchase entry', () => { expect(noticeMode(undefined, true, 'signed-out')).toBe('login'); });
it('never announces cached packs while loading or logged out', () => { for (const status of ['loading', 'error', 'signed-out']) expect(selectNewMaterial('u', status, ['paid'], () => false)).toBeUndefined(); expect(selectNewMaterial(undefined,'ready',['paid'],()=>false)).toBeUndefined(); });
it('announces new entitlements for direct logged-in visits', () => { expect(noticeMode(selectNewMaterial('u','ready',['paid'],()=>false),false,'ready')).toBe('ready'); });
it('does not repeat seen packs, but a trial recipient sees a paid upgrade', () => { expect(selectNewMaterial('u','ready',['trial'],()=>true)).toBeUndefined(); expect(selectNewMaterial('u','ready',['paid','trial'],p=>p==='trial')).toBe('paid'); });
it('offers recovery without implying purchase when checks fail', () => { expect(noticeMode(undefined,true,'error')).toBe('missing'); expect(noticeMode(undefined,false,'none')).toBe(''); });

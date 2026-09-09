import type { BoxType, StationerySetSelection } from '../../domain/boxes/types';
import { BoxTypeIcon } from '../icons/BoxTypeIcon';
import { EnvelopeIcon, LetterIcon, CardIcon } from './UiIcons';

export const HOME_BOXES = [
  ['straight-tuck-carton-v1', 'キャラメル箱'],
  ['gift-box-v1', '浅型の箱'],
  ['two-piece-gift-box-v1', 'ふた付き箱'],
] as const;

export function CreationHome({ onBox, onLetter, onMore, onResume, resumeLabel }: {
  onBox: (type: BoxType) => void;
  onLetter: (selection: StationerySetSelection) => void;
  onMore: () => void;
  onResume: (() => void) | null;
  resumeLabel: string;
}) {
  return <main className="creation-home">
    <h1>何をつくる？</h1>
    <section aria-label="箱をつくる">
      <h2>箱</h2>
      <div className="creation-home-grid">{HOME_BOXES.map(([type,label]) =>
        <button key={type} type="button" onClick={() => onBox(type)}>
          <BoxTypeIcon type={type} className="home-box-picture"/>
          <strong>{label}</strong>
        </button>)}</div>
    </section>
    <section aria-label="レターセットをつくる">
      <h2>レターセット</h2>
      <div className="creation-home-grid">
        <button type="button" onClick={()=>onLetter('envelope-letter')}><span className="home-letter-picture"><LetterIcon/><EnvelopeIcon/></span><strong>封筒＋便箋</strong></button>
        <button type="button" onClick={()=>onLetter('envelope-card')}><span className="home-letter-picture"><CardIcon/><EnvelopeIcon/></span><strong>封筒＋カード</strong></button>
        <button type="button" onClick={onMore}><span className="home-letter-picture"><LetterIcon/><CardIcon/></span><strong>ほかのセット</strong></button>
      </div>
    </section>
    {onResume && <button className="home-resume" type="button" onClick={onResume}><span aria-hidden="true">↩</span><span><strong>つづきから</strong><small>{resumeLabel}</small></span></button>}
  </main>;
}

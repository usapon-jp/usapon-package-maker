import type { BoxType, StationerySetSelection } from '../../domain/boxes/types';

export const HOME_BOXES = [
  ['straight-tuck-carton-v1', 'キャラメル箱'],
  ['gift-box-v1', '浅型の箱'],
  ['two-piece-gift-box-v1', 'ふた付き箱'],
] as const;

export const HOME_LETTER_SETS = [
  { value: 'envelope-letter', label: '封筒＋便箋', letter: true, card: false },
  { value: 'envelope-card', label: '封筒＋ミニカード', letter: false, card: true },
  { value: 'envelope-letter-card', label: 'フルセット', letter: true, card: true },
  { value: 'envelope-only', label: '封筒のみ', letter: false, card: false },
] as const satisfies ReadonlyArray<{ value: StationerySetSelection; label: string; letter: boolean; card: boolean }>;

const HOME_BOX_PICTURES: Record<(typeof HOME_BOXES)[number][0], string> = {
  'straight-tuck-carton-v1': '/assets/home/box-caramel.png',
  'gift-box-v1': '/assets/home/box-shallow.png',
  'two-piece-gift-box-v1': '/assets/home/box-two-piece.png',
};

export function CreationHome({ onBox, onLetter, onResume, resumeLabel }: {
  onBox: (type: BoxType) => void;
  onLetter: (selection: StationerySetSelection) => void;
  onResume: (() => void) | null;
  resumeLabel: string;
}) {
  return <main className="creation-home">
    <h1>何をつくる？</h1>
    <section aria-label="箱をつくる">
      <h2>箱</h2>
      <div className="creation-home-grid">{HOME_BOXES.map(([type,label]) =>
        <button key={type} type="button" onClick={() => onBox(type)}>
          <img className="home-box-picture" src={HOME_BOX_PICTURES[type]} alt="" aria-hidden="true" />
          <strong>{label}</strong>
        </button>)}</div>
    </section>
    <section aria-label="レターセットをつくる">
      <h2>レターセット</h2>
      <div className="creation-home-grid creation-home-letter-grid">
        {HOME_LETTER_SETS.map((option) => (
          <button key={option.value} type="button" onClick={() => onLetter(option.value)}>
            <span className={`home-letter-picture is-${option.value}`} aria-hidden="true">
              {option.letter && <img className="home-stationery-letter" src="/assets/home/letter-paper.png" alt="" />}
              {option.card && <img className="home-stationery-card" src="/assets/home/mini-card.png" alt="" />}
              <img className="home-stationery-envelope" src="/assets/home/envelope.png" alt="" />
            </span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>
    </section>
    {onResume && <button className="home-resume" type="button" onClick={onResume}><span aria-hidden="true">↩</span><span><strong>つづきから</strong><small>{resumeLabel}</small></span></button>}
  </main>;
}

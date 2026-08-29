import type { StationerySetSelection } from "../../domain/boxes/types";

const OPTIONS: Array<{ value: StationerySetSelection; title: string; content: string; letter: boolean; card: boolean }> = [
  { value: "envelope-letter", title: "封筒＋便箋", content: "封筒1枚 ＋ 2つ折り便箋", letter: true, card: false },
  { value: "envelope-card", title: "封筒＋ミニカード", content: "封筒1枚 ＋ ミニカード", letter: false, card: true },
  { value: "envelope-letter-card", title: "フルセット", content: "封筒・便箋・ミニカード各1枚", letter: true, card: true },
  { value: "envelope-only", title: "封筒のみ", content: "洋形2号カマス貼り封筒1枚", letter: false, card: false },
];

export function LetterSetSelectScreen({ onSelect }: { onSelect: (selection: StationerySetSelection) => void }) {
  return (
    <main className="letter-set-start-screen" data-ui-id="letter.screen">
      <div className="letter-set-start-heading" data-ui-id="letter.heading">
        <div>
          <p className="eyebrow">LETTER SET</p>
          <h1>レターセットを選ぶ</h1>
          <span>完成162 × 114mm 封筒と便箋・カードの組み合わせを選択</span>
        </div>
      </div>
      <div className="letter-set-choice-grid" data-ui-id="letter.choice-grid">
        {OPTIONS.map((option) => (
          <button key={option.value} type="button" className="letter-set-choice-card" onClick={() => onSelect(option.value)}>
            <div className="choice-thumbnail-box" aria-hidden="true">
              <div className="mini-composition-stage">
                {option.letter && (
                  <div className="mini-css-letter">
                    <span className="mini-paper-line" />
                    <span className="mini-paper-line short" />
                  </div>
                )}
                {option.card && (
                  <div className="mini-css-card">
                    <span className="mini-card-badge">CARD</span>
                  </div>
                )}
                <div className="mini-css-envelope">
                  <div className="mini-envelope-flap" />
                  <img
                    src={`${import.meta.env.BASE_URL}assets/stamps/usapon-box-rabbits.png`}
                    alt=""
                    className="mini-usapon-stamp"
                  />
                  <div className="mini-envelope-body-mark">洋2</div>
                </div>
              </div>
            </div>
            <strong>{option.title}</strong>
            <small>{option.content}</small>
            <span className="letter-set-meta-tag">完成 162 × 114mm ／ A4印刷</span>
            <b className="choice-action-link">このセットで作る →</b>
          </button>
        ))}
      </div>
    </main>
  );
}

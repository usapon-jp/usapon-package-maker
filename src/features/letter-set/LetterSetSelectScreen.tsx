import type { StationerySetSelection } from "../../domain/boxes/types";
import { CardIcon, EnvelopeIcon, LetterIcon } from "../../components/common/UiIcons";

const OPTIONS: Array<{ value: StationerySetSelection; title: string; description: string; letter: boolean; card: boolean }> = [
  { value: "envelope-letter", title: "封筒＋便箋", description: "封筒1枚と、2つ折り便箋", letter: true, card: false },
  { value: "envelope-card", title: "封筒＋ミニカード", description: "封筒1枚と、ミニカード", letter: false, card: true },
  { value: "envelope-letter-card", title: "フルセット", description: "封筒・便箋・ミニカード", letter: true, card: true },
  { value: "envelope-only", title: "封筒のみ", description: "洋形2号カマス貼り封筒", letter: false, card: false },
];

export function LetterSetSelectScreen({ onSelect }: { onSelect: (selection: StationerySetSelection) => void }) {
  return <main className="letter-set-start-screen">
    <div className="letter-set-start-heading"><p>LETTER SET</p><h1>レターセットを選ぶ</h1><span>作りたい組み合わせを選ぶと、洋形2号カマス貼り封筒に合うサイズで用意します。</span></div>
    <div className="letter-set-choice-grid">{OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => onSelect(option.value)}>
      <div className="letter-set-choice-visual"><EnvelopeIcon />{option.letter && <LetterIcon />}{option.card && <CardIcon />}</div>
      <strong>{option.title}</strong><small>{option.description}</small><b>このセットで作る →</b>
    </button>)}</div>
    <p className="letter-set-start-note">封筒は完成162 × 114mm・洋形2号カマス貼りです。プリセット作品ではなく、背景・スタンプ・文字を自由に編集できます。</p>
  </main>;
}

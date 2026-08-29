import { BoxIcon, EnvelopeIcon } from "../common/UiIcons";

interface Props {
  onSelectBox: () => void;
  onSelectLetterSet: () => void;
  onClose: () => void;
}

export function NewCreationSheet({ onSelectBox, onSelectLetterSet, onClose }: Props) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="app-modal bottom-sheet-modal new-creation-sheet" data-ui-id="global.new-creation-sheet" role="dialog" aria-modal="true" aria-labelledby="new-creation-title">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h2 id="new-creation-title">新しく作品を作る</h2>
          <button type="button" onClick={onClose} aria-label="閉じる">×</button>
        </div>
        <div className="creation-choice-stack">
          <button type="button" className="creation-choice-button" onClick={() => { onSelectBox(); onClose(); }}>
            <div className="choice-icon-wrap"><BoxIcon /></div>
            <div>
              <strong>BOXを作る</strong>
              <small>キャラメル箱・ギフト箱・蓋付き二分割箱のサイズ指定とデザイン</small>
            </div>
            <span className="choice-arrow">→</span>
          </button>
          <button type="button" className="creation-choice-button" onClick={() => { onSelectLetterSet(); onClose(); }}>
            <div className="choice-icon-wrap"><EnvelopeIcon /></div>
            <div>
              <strong>レターセットを作る</strong>
              <small>洋形2号カマス貼り封筒・便箋・ミニカードのセットデザイン</small>
            </div>
            <span className="choice-arrow">→</span>
          </button>
        </div>
      </section>
    </div>
  );
}

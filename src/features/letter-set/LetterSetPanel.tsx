import type { StationerySetSelection } from "../../domain/boxes/types";
import { calculateLetterPaperSize, calculateMiniCardSize } from "../../domain/boxes/stationery";
import type { BoxInput } from "../../domain/boxes/types";
import { roundMm } from "../../domain/units";
import type { EnvelopeDesignSettings, EnvelopeFlapPattern, EnvelopeTemplateStyle } from "../../app/app-types";
import { ENVELOPE_LAYOUT_TEMPLATES } from "./envelope-layout-templates";

const OPTIONS: Array<{ value: StationerySetSelection; label: string }> = [
  { value: "envelope-only", label: "封筒のみ" },
  { value: "envelope-letter", label: "封筒＋便箋" },
  { value: "envelope-card", label: "封筒＋ミニカード" },
  { value: "envelope-letter-card", label: "封筒＋便箋＋ミニカード" },
];

function size(width: number, height: number) {
  return `${roundMm(width, 1)} × ${roundMm(height, 1)}mm`;
}

export function LetterSetPanel({
  box,
  selection,
  envelopeDesign,
  canShare,
  shareMessage,
  onSelectionChange,
  onTemplateSelect,
  onEnvelopeDesignChange,
  onBoxDimensionChange,
  onShare,
}: {
  box: BoxInput;
  selection: StationerySetSelection;
  envelopeDesign: EnvelopeDesignSettings;
  canShare: boolean;
  shareMessage: string;
  onSelectionChange: (selection: StationerySetSelection) => void;
  onTemplateSelect: (style: EnvelopeTemplateStyle) => void;
  onEnvelopeDesignChange: (patch: Partial<EnvelopeDesignSettings>) => void;
  onBoxDimensionChange: (field: "widthMm" | "heightMm", value: number) => void;
  onShare: () => void;
}) {
  const letter = calculateLetterPaperSize(box);
  const card = calculateMiniCardSize(box);
  return (
    <section className="letter-set-panel" aria-labelledby="letter-set-title">
      <div className="letter-set-heading"><span aria-hidden="true">✉</span><div><strong id="letter-set-title">レターセット</strong><small>封筒サイズに合わせて中身も自動計算</small></div></div>
      <div className="envelope-template-picker" role="group" aria-label="封筒デザインテンプレート">
        {(Object.values(ENVELOPE_LAYOUT_TEMPLATES)).map((template) => (
          <button key={template.id} type="button" className={envelopeDesign.style === template.id ? "is-selected" : ""} aria-pressed={envelopeDesign.style === template.id} onClick={() => onTemplateSelect(template.id)}>
            <i className={`envelope-template-swatch is-${template.id}`} aria-hidden="true" />
            <span><strong>{template.label}</strong><small>{template.description}</small></span>
          </button>
        ))}
      </div>
      <div className="letter-set-options" role="group" aria-label="セットに含めるもの">
        {OPTIONS.map((option) => <button key={option.value} type="button" className={selection === option.value ? "is-selected" : ""} aria-pressed={selection === option.value} onClick={() => onSelectionChange(option.value)}>{option.label}</button>)}
      </div>
      <dl className="letter-set-sizes">
        <div><dt>封筒</dt><dd>{size(box.widthMm, box.heightMm)}</dd></div>
        <div><dt>便箋</dt><dd>{size(letter.widthMm, letter.heightMm)}<small>2つ折り後 {size(letter.foldedWidthMm, letter.foldedHeightMm)}／周囲 {letter.sideClearanceMm}mm余裕</small></dd></div>
        <div><dt>ミニカード</dt><dd>{size(card.widthMm, card.heightMm)}<small>封筒内で左右 {card.clearanceXmm}mm・上下 {card.clearanceYmm}mm余裕</small></dd></div>
      </dl>
      <details className="letter-set-details">
        <summary>詳細設定</summary>
        <div className="letter-set-detail-body">
          <div className="envelope-size-inputs">
            <label>完成幅<input type="number" min="60" max="240" step="1" value={box.widthMm} onChange={(event) => onBoxDimensionChange("widthMm", Number(event.target.value))} /><em>mm</em></label>
            <label>完成高さ<input type="number" min="40" max="180" step="1" value={box.heightMm} onChange={(event) => onBoxDimensionChange("heightMm", Number(event.target.value))} /><em>mm</em></label>
          </div>
          <label className="toggle-row"><span><strong>上フラップを別デザイン</strong><small>片面印刷の上フラップだけ色・柄を変更</small></span><input type="checkbox" checked={envelopeDesign.flapAccentEnabled} onChange={(event) => onEnvelopeDesignChange({ flapAccentEnabled: event.target.checked })} /></label>
          <label className="envelope-flap-color">上フラップの色<span><code>{envelopeDesign.flapColor.toUpperCase()}</code><input aria-label="上フラップの色" type="color" value={envelopeDesign.flapColor} onChange={(event) => onEnvelopeDesignChange({ flapColor: event.target.value })} /></span></label>
          <div className="envelope-flap-pattern" role="group" aria-label="上フラップの柄">
            {(["solid", "dots", "stripes"] as EnvelopeFlapPattern[]).map((pattern) => <button key={pattern} type="button" className={envelopeDesign.flapPattern === pattern ? "is-selected" : ""} onClick={() => onEnvelopeDesignChange({ flapPattern: pattern })}>{pattern === "solid" ? "無地" : pattern === "dots" ? "水玉" : "ストライプ"}</button>)}
          </div>
          <label className="toggle-row"><span><strong>宛名欄</strong><small>中央の表面に白い記入欄を表示</small></span><input type="checkbox" checked={envelopeDesign.showAddressField} onChange={(event) => onEnvelopeDesignChange({ showAddressField: event.target.checked })} /></label>
          <label className="toggle-row"><span><strong>宛名線</strong><small>宛名欄へ3本の記入線を表示</small></span><input type="checkbox" checked={envelopeDesign.showAddressLines} onChange={(event) => onEnvelopeDesignChange({ showAddressLines: event.target.checked })} /></label>
          <label className="range-control"><span>余白 <output>{roundMm(envelopeDesign.marginMm, 1)}mm</output></span><input aria-label="封筒デザインの余白" type="range" min="4" max="24" step="1" value={envelopeDesign.marginMm} onChange={(event) => onEnvelopeDesignChange({ marginMm: Number(event.target.value) })} /></label>
          <p className="letter-set-existing-tools">背景・スタンプ・イラスト・配置は、下の各編集パネルで追加・手動調整できます。</p>
        </div>
      </details>
      <button className="outline-button full-button" type="button" disabled={!canShare} onClick={onShare}>封筒のデザインをセットへ反映</button>
      <small className="letter-set-share-help">背景・柄・スタンプ・イラスト・装飾を、便箋とカードの形に合わせて縮尺と位置を調整します。</small>
      {shareMessage && <p role="status">{shareMessage}</p>}
    </section>
  );
}

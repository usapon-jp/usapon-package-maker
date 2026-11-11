import { useEffect, useState } from "react";
import type { Dispatch } from "react";
import type { AppAction, AppState, DielineLineColors } from "../../app/app-types";
import { DEFAULT_DIELINE_LINE_COLORS } from "../../app/app-state";
import { MobileSettingsSheet } from "../../components/modals/MobileSettingsSheet";

export const PRINT_LINE_PRESETS: Array<{ label: string; colors: DielineLineColors }> = [
  { label: "白", colors: { cut: "#ffffff", fold: "#ffffff" } },
  { label: "淡いオレンジ", colors: { cut: "#c79a62", fold: "#dbc1a0" } },
  { label: "ベージュ", colors: DEFAULT_DIELINE_LINE_COLORS },
  { label: "薄いグレー", colors: { cut: "#9f9b95", fold: "#c1beb9" } },
  { label: "黒", colors: { cut: "#20262d", fold: "#666b70" } },
];
function LineHexInput({ label, value, onChange }: { label: string; value: string; onChange: (color: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <label className="print-line-hex">カラーコード<input aria-label={`${label}のカラーコード`} value={draft} maxLength={7} spellCheck={false} onChange={(event) => { const color = event.target.value; setDraft(color); if (/^#[0-9a-f]{6}$/i.test(color)) onChange(color); }} onBlur={() => { if (!/^#[0-9a-f]{6}$/i.test(draft)) setDraft(value); }} onFocus={(event) => event.target.select()} /></label>;
}
export function PrintLineSettingsControls({ state, dispatch }: { state: AppState; dispatch: Dispatch<AppAction> }) {
  const update = (colors: DielineLineColors) => dispatch({ type: "set-print-line-colors", colors });
  return <div className="print-line-settings-controls">
    <p>変更はプレビューと、これから保存するPDF・A4画像に反映されます。</p>
    {state.box.type === "mini-card-v1" && state.miniCardProject && <small>この印刷シートのすべてのカードに反映します。</small>}
    <div className="print-line-quick-colors" role="group" aria-label="印刷線の色プリセット">{PRINT_LINE_PRESETS.map((preset) => <button type="button" key={preset.label} aria-pressed={state.lineColors.cut === preset.colors.cut && state.lineColors.fold === preset.colors.fold} onClick={() => update(preset.colors)}><i style={{ backgroundColor: preset.colors.cut }} aria-hidden="true" />{preset.label}</button>)}</div>
    <div className="print-line-color-fields">{([["cut", "カット線"], ["fold", "折り線"]] as const).map(([layer, label]) => <fieldset key={layer}><legend>{label}</legend><label className="print-line-color-picker">色を選ぶ<input aria-label={`${label}の色`} type="color" value={state.lineColors[layer]} onChange={(event) => update({ ...state.lineColors, [layer]: event.target.value })} /></label><LineHexInput label={label} value={state.lineColors[layer]} onChange={(color) => update({ ...state.lineColors, [layer]: color })} /></fieldset>)}</div>
    <small>白い線は白い部分では見えなくなります。カードの寸法と割り付けは変わりません。</small>
  </div>;
}
export function PrintLineSettingsDialog({ state, dispatch, open, onClose }: { state: AppState; dispatch: Dispatch<AppAction>; open: boolean; onClose: () => void }) {
  return <MobileSettingsSheet open={open} title="印刷設定" onClose={onClose}><PrintLineSettingsControls state={state} dispatch={dispatch} /></MobileSettingsSheet>;
}
export function PrintSettingsButton({ onClick, disabled = false }: { onClick?: () => void; disabled?: boolean }) {
  return <button className="print-settings-trigger" type="button" onClick={onClick} disabled={disabled} aria-label="印刷設定を開く">⚙ 設定</button>;
}

import type { AutoLayoutResult, AutoLayoutSettings } from "./types";

type Option<T extends string> = { value: T; label: string };

function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="auto-layout-choice">
      <legend>{label}</legend>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={value === option.value ? "is-selected" : ""}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function AutoLayoutPanel({
  settings,
  result,
  disabled,
  onSettingsChange,
  onArrange,
  onArrangeAgain,
}: {
  settings: AutoLayoutSettings;
  result: AutoLayoutResult | null;
  disabled: boolean;
  onSettingsChange: (settings: AutoLayoutSettings) => void;
  onArrange: () => void;
  onArrangeAgain: () => void;
}) {
  const update = <Key extends keyof AutoLayoutSettings>(key: Key, value: AutoLayoutSettings[Key]) => {
    onSettingsChange({ ...settings, [key]: value });
  };
  return (
    <div className="auto-layout-panel">
      <p className="auto-layout-intro">入れた素材を、ブラウザ内のレイアウト計算で整えます。自動配置のあとも手動で編集できます。</p>
      <ChoiceGroup label="テイスト" value={settings.taste} options={[
        { value: "natural", label: "ナチュラル" },
        { value: "pop", label: "ポップ" },
        { value: "elegant", label: "大人っぽい" },
      ]} onChange={(value) => update("taste", value)} />
      <ChoiceGroup label="サイズ" value={settings.size} options={[
        { value: "small", label: "小さめ" },
        { value: "standard", label: "標準" },
        { value: "large", label: "大きめ" },
      ]} onChange={(value) => update("size", value)} />
      <ChoiceGroup label="密度" value={settings.density} options={[
        { value: "airy", label: "すっきり" },
        { value: "standard", label: "標準" },
        { value: "dense", label: "ぎっしり" },
      ]} onChange={(value) => update("density", value)} />
      <ChoiceGroup label="調整対象" value={settings.target} options={[
        { value: "all", label: "全体" },
        { value: "text", label: "文字" },
        { value: "background", label: "背景" },
        { value: "stamp", label: "スタンプ" },
      ]} onChange={(value) => update("target", value)} />
      <label className="toggle-row auto-layout-logo-toggle">
        <span><strong>ロゴ化</strong><small>文字だけをテイストに合わせて装飾</small></span>
        <input type="checkbox" checked={settings.logoEnabled} onChange={(event) => update("logoEnabled", event.target.checked)} />
      </label>
      <div className="auto-layout-actions">
        <button className="auto-layout-primary" type="button" disabled={disabled} onClick={onArrange}>いい感じに配置</button>
        <button type="button" disabled={!result || disabled} onClick={onArrangeAgain}>もう一回</button>
      </div>
      {disabled && <small className="auto-layout-empty">選んだ対象の素材を追加すると使えます。</small>}
      {result && (
        <p
          className="auto-layout-result"
          role="status"
          data-layout-score={result.score.total.toFixed(2)}
          data-layout-elapsed-ms={result.elapsedMs.toFixed(2)}
          data-layout-seed={result.seed}
          data-layout-meets-threshold={result.score.meetsThreshold}
        >
          整えました · スコア {Math.round(result.score.total)} · 案 {result.seed.toString(16).slice(-5)}
        </p>
      )}
    </div>
  );
}

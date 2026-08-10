import { useMemo, useReducer, useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { A4ExportSvg, CalibrationSvg } from "../components/dieline/A4ExportSvg";
import { DielineSvg } from "../components/dieline/DielineSvg";
import { generateDieline } from "../domain/boxes/registry";
import type { DielineGeometry } from "../domain/boxes/types";
import { evaluateA4Fit, type A4FitResult, type FitStatus } from "../domain/paper/a4";
import { roundMm } from "../domain/units";
import { exportA4Pdf } from "../lib/pdf/export-a4-pdf";
import { readPatternFile } from "../lib/uploads/read-pattern";
import { appReducer, initialState } from "./app-state";
import type { AppAction, AppState, PatternItem, Screen, TextItem } from "./app-types";

const FIT_COPY: Record<FitStatus, { title: string; description: string }> = {
  safe: {
    title: "A4に安全余白込みで収まります",
    description: "上下左右5mm以上の余白を確保できます。",
  },
  "paper-only": {
    title: "A4用紙内には収まります",
    description: "5mmの安全余白は確保できません。プリンターの印刷可能範囲を確認してください。",
  },
  overflow: {
    title: "A4に収まりません",
    description: "実寸を守るため自動縮小しません。箱の寸法を小さくしてください。",
  },
};

function mm(value: number) {
  return `${roundMm(value, 1)}mm`;
}

function AppHeader({ screen, onGo }: { screen: Screen; onGo: (screen: Screen) => void }) {
  return (
    <header className="app-header">
      <button className="brand-button" type="button" onClick={() => onGo("home")} aria-label="トップへ戻る">
        <span className="brand-icon-frame" aria-hidden="true">
          <img
            className="brand-icon"
            src={`${import.meta.env.BASE_URL}assets/usapon-brand-icon.png`}
            alt=""
          />
        </span>
        <span><strong>うさぽん</strong><small>パッケージメーカー</small></span>
      </button>
      {screen !== "home" && (
        <nav className="step-nav" aria-label="作成ステップ">
          {(["size", "design", "print"] as const).map((step, index) => (
            <button
              key={step}
              type="button"
              className={screen === step ? "is-current" : ""}
              onClick={() => onGo(step)}
            >
              <span>{index + 1}</span>{step === "size" ? "サイズ" : step === "design" ? "デザイン" : "印刷"}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

function HeroIllustration() {
  return (
    <img
      className="hero-illustration"
      src={`${import.meta.env.BASE_URL}assets/usapon-rabbits-transparent.png`}
      alt="福袋から顔を出す2匹のうさぎ"
    />
  );
}

function FitNotice({ geometry, fit, compact = false }: { geometry: DielineGeometry; fit: A4FitResult; compact?: boolean }) {
  const copy = FIT_COPY[fit.status];
  return (
    <div className={`fit-notice fit-${fit.status} ${compact ? "is-compact" : ""}`} role="status">
      <span className="fit-icon" aria-hidden="true">{fit.status === "safe" ? "✓" : fit.status === "paper-only" ? "!" : "×"}</span>
      <div>
        <strong>{copy.title}</strong>
        {!compact && <p>{copy.description}</p>}
        <small>
          展開図 {mm(geometry.bounds.widthMm)} × {mm(geometry.bounds.heightMm)} ／ A4 {fit.orientation === "portrait" ? "縦" : "横"}
          {fit.status === "overflow" && ` ／ 超過 ${mm(fit.excessWidthMm)} × ${mm(fit.excessHeightMm)}`}
        </small>
      </div>
    </div>
  );
}

function HomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="home-screen">
      <section className="home-hero">
        <div className="hero-sparkles" aria-hidden="true">✦　·　✧</div>
        <HeroIllustration />
        <div className="hero-card">
          <p className="eyebrow">HANDMADE PACKAGE TOOL</p>
          <h1>うさぽん<br /><span>パッケージメーカー</span></h1>
          <p>箱のサイズを入力するだけで、実寸の展開図を作れます。柄と文字をのせて、A4 PDFで印刷しましょう。</p>
          <div className="hero-points">
            <span>実寸mm設計</span><span>A4自動判定</span><span>端末内で編集</span>
          </div>
        </div>
      </section>

      <section className="choice-section" aria-labelledby="choice-title">
        <div className="section-heading">
          <p className="eyebrow">LET'S MAKE</p>
          <h2 id="choice-title">つくりかたを選んでください</h2>
        </div>
        <div className="choice-grid">
          <button className="choice-card is-active" type="button" onClick={onStart}>
            <span className="choice-icon" aria-hidden="true">⌑</span>
            <strong>サイズから作る</strong>
            <p>W・D・Hをmmで入力して、ぴったりの展開図を作成</p>
            <b>この方法ではじめる　→</b>
          </button>
          <div className="choice-card is-disabled" aria-disabled="true">
            <span className="coming-soon">準備中</span>
            <span className="choice-icon" aria-hidden="true">▦</span>
            <strong>テンプレートから作る</strong>
            <p>人気の箱や封筒から選べる機能は、次のバージョンで追加予定です。</p>
          </div>
        </div>
      </section>

      <section className="flow-strip" aria-label="完成までの流れ">
        <div><span>1</span><strong>サイズを指定</strong><small>mmで正確に入力</small></div>
        <i>→</i>
        <div><span>2</span><strong>デザイン</strong><small>柄と文字を配置</small></div>
        <i>→</i>
        <div><span>3</span><strong>印刷</strong><small>A4実寸PDF</small></div>
      </section>
    </main>
  );
}

type NumberFieldProps = {
  label: string;
  shortLabel?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  hint?: string;
};

function NumberField({ label, shortLabel, value, min, max, step = 1, onChange, hint }: NumberFieldProps) {
  return (
    <label className="number-field">
      <span>{label}{shortLabel && <b>（{shortLabel}）</b>}</span>
      <div><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><em>mm</em></div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function SizeScreen({ state, dispatch, geometry, fit }: ScreenProps) {
  return (
    <main className="tool-page size-page">
      <div className="page-heading">
        <button className="back-button" type="button" onClick={() => dispatch({ type: "go", screen: "home" })}>← トップ</button>
        <p className="eyebrow">STEP 1</p>
        <h1>箱のサイズを設定</h1>
        <p>入力値は完成箱の罫線間寸法です。商品が入る余裕を含めて入力してください。</p>
      </div>

      <div className="size-layout">
        <section className="panel-card form-card">
          <div className="card-title"><span>1</span><div><h2>仕上がり寸法</h2><p>straight-tuck-carton-v1</p></div></div>
          <div className="dimension-grid">
            <NumberField label="幅" shortLabel="W" value={state.box.widthMm} min={10} max={400} onChange={(value) => dispatch({ type: "update-box", field: "widthMm", value })} />
            <NumberField label="奥行" shortLabel="D" value={state.box.depthMm} min={5} max={300} onChange={(value) => dispatch({ type: "update-box", field: "depthMm", value })} />
            <NumberField label="高さ" shortLabel="H" value={state.box.heightMm} min={10} max={500} onChange={(value) => dispatch({ type: "update-box", field: "heightMm", value })} />
          </div>
          <div className="form-divider" />
          <div className="option-grid">
            <NumberField label="紙の厚み" value={state.box.paperThicknessMm} min={0.1} max={2} step={0.01} onChange={(value) => dispatch({ type: "update-box", field: "paperThicknessMm", value })} hint="コピー用紙の目安：0.09mm／厚紙：0.2〜0.4mm" />
            <NumberField label="のりしろ幅" value={state.box.glueFlapMm} min={5} max={40} step={0.5} onChange={(value) => dispatch({ type: "update-box", field: "glueFlapMm", value })} hint="接着しやすい12〜15mmがおすすめ" />
          </div>
          <div className="measurement-note"><strong>寸法の考え方</strong><p>紙厚は差し込み部の逃げに反映します。印刷後は実際の紙で一度試作してください。</p></div>
        </section>

        <section className="panel-card size-preview-card">
          <div className="preview-card-head"><div><p className="eyebrow">LIVE PREVIEW</p><h2>展開図</h2></div><span>mm基準</span></div>
          <div className="dieline-stage compact-stage">
            <DielineSvg
              geometry={geometry}
              pattern={state.pattern}
              texts={state.texts}
              showGuides={state.showGuides}
              selectedTextId={null}
              exportMode={false}
              onSelectText={() => undefined}
              onMoveText={() => undefined}
            />
          </div>
          <div className="line-legend"><span className="cut-swatch">カット線</span><span className="fold-swatch">折り線</span><span className="glue-swatch">のりしろ</span></div>
          <FitNotice geometry={geometry} fit={fit} />
        </section>
      </div>

      <div className="sticky-actions">
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "go", screen: "home" })}>戻る</button>
        <button className="primary-button" type="button" onClick={() => dispatch({ type: "go", screen: "design" })}>デザインに進む <span>→</span></button>
      </div>
    </main>
  );
}

type ScreenProps = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  geometry: DielineGeometry;
  fit: A4FitResult;
};

function ControlSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="editor-control-section">
      <h3><span aria-hidden="true">{icon}</span>{title}</h3>
      {children}
    </section>
  );
}

function DesignScreen({ state, dispatch, geometry, fit }: ScreenProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const selectedText = state.texts.find((item) => item.id === state.selectedTextId) ?? null;

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const asset = await readPatternFile(file);
      const tileWidthMm = Math.min(50, Math.max(20, state.box.widthMm));
      const front = geometry.panels[0];
      const tileHeight = tileWidthMm / asset.aspectRatio;
      const pattern: PatternItem = {
        ...asset,
        tileWidthMm,
        offsetXmm: front.x + (front.width - tileWidthMm) / 2,
        offsetYmm: front.y + (front.height - tileHeight) / 2,
        repeat: false,
      };
      dispatch({ type: "set-pattern", pattern });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "柄を読み込めませんでした。");
    } finally {
      setUploading(false);
    }
  };

  const addText = () => {
    const front = geometry.panels[0];
    const item: TextItem = {
      id: crypto.randomUUID(),
      kind: "text",
      text: "ありがとう",
      xMm: front.x + front.width / 2,
      yMm: front.y + front.height / 2,
      fontSizeMm: 6,
      color: "#6d4037",
    };
    dispatch({ type: "add-text", item });
  };

  return (
    <main className="tool-page design-page">
      <div className="page-heading horizontal-heading">
        <div><button className="back-button" type="button" onClick={() => dispatch({ type: "go", screen: "size" })}>← サイズ設定</button><p className="eyebrow">STEP 2</p><h1>デザイン編集</h1></div>
        <FitNotice geometry={geometry} fit={fit} compact />
      </div>

      <div className="editor-layout">
        <aside className="editor-controls panel-card">
          <ControlSection title="柄・背景" icon="▧">
            <input ref={fileInput} type="file" accept="image/png,image/svg+xml,.png,.svg" hidden onChange={handleFile} />
            <button className="upload-button" type="button" disabled={uploading} onClick={() => fileInput.current?.click()}>
              <span>↑</span>{uploading ? "読み込み中…" : state.pattern ? "柄を変更" : "PNG／SVGを選ぶ"}
            </button>
            {uploadError && <p className="field-error">{uploadError}</p>}
            {state.pattern && (
              <div className="pattern-controls">
                <div className="file-pill"><span>{state.pattern.sourceType.toUpperCase()}</span><b>{state.pattern.fileName}</b><button type="button" onClick={() => dispatch({ type: "set-pattern", pattern: null })}>×</button></div>
                <label className="range-control"><span>柄の幅 <output>{mm(state.pattern.tileWidthMm)}</output></span><input type="range" min="5" max="150" step="1" value={state.pattern.tileWidthMm} onChange={(event) => dispatch({ type: "update-pattern", patch: { tileWidthMm: Number(event.target.value) } })} /></label>
                <label className="toggle-row"><span><strong>リピート</strong><small>柄を繰り返して全面に配置</small></span><input type="checkbox" checked={state.pattern.repeat} onChange={(event) => dispatch({ type: "update-pattern", patch: { repeat: event.target.checked } })} /></label>
                <div className="mini-number-grid">
                  <NumberField label="横位置 X" value={roundMm(state.pattern.offsetXmm, 1)} min={-500} max={500} step={1} onChange={(value) => dispatch({ type: "update-pattern", patch: { offsetXmm: value } })} />
                  <NumberField label="縦位置 Y" value={roundMm(state.pattern.offsetYmm, 1)} min={-500} max={500} step={1} onChange={(value) => dispatch({ type: "update-pattern", patch: { offsetYmm: value } })} />
                </div>
              </div>
            )}
          </ControlSection>

          <ControlSection title="テキスト" icon="T">
            <button className="outline-button full-button" type="button" onClick={addText}>＋ テキストを追加</button>
            {state.texts.length > 0 && (
              <div className="text-list">
                {state.texts.map((item) => <button key={item.id} className={state.selectedTextId === item.id ? "is-selected" : ""} type="button" onClick={() => dispatch({ type: "select-text", id: item.id })}>{item.text || "（空のテキスト）"}</button>)}
              </div>
            )}
            {selectedText && (
              <div className="selected-text-controls">
                <label className="text-input-label">文字<input type="text" maxLength={40} value={selectedText.text} onChange={(event) => dispatch({ type: "update-text", id: selectedText.id, patch: { text: event.target.value } })} /></label>
                <label className="range-control"><span>文字サイズ <output>{mm(selectedText.fontSizeMm)}</output></span><input type="range" min="2" max="18" step="0.5" value={selectedText.fontSizeMm} onChange={(event) => dispatch({ type: "update-text", id: selectedText.id, patch: { fontSizeMm: Number(event.target.value) } })} /></label>
                <label className="color-row">文字色<input type="color" value={selectedText.color} onChange={(event) => dispatch({ type: "update-text", id: selectedText.id, patch: { color: event.target.value } })} /></label>
                <div className="mini-number-grid">
                  <NumberField label="横位置 X" value={roundMm(selectedText.xMm, 1)} min={0} max={geometry.bounds.widthMm} step={1} onChange={(value) => dispatch({ type: "update-text", id: selectedText.id, patch: { xMm: value } })} />
                  <NumberField label="縦位置 Y" value={roundMm(selectedText.yMm, 1)} min={0} max={geometry.bounds.heightMm} step={1} onChange={(value) => dispatch({ type: "update-text", id: selectedText.id, patch: { yMm: value } })} />
                </div>
                <p className="drag-hint">プレビュー上の文字を指やマウスで動かせます。</p>
                <button className="delete-button" type="button" onClick={() => dispatch({ type: "remove-text", id: selectedText.id })}>このテキストを削除</button>
              </div>
            )}
          </ControlSection>

          <ControlSection title="表示" icon="◉">
            <label className="toggle-row"><span><strong>ガイド表示</strong><small>面名と中心線。PDFには印刷しません</small></span><input type="checkbox" checked={state.showGuides} onChange={() => dispatch({ type: "toggle-guides" })} /></label>
          </ControlSection>
        </aside>

        <section className="editor-canvas-panel panel-card">
          <div className="canvas-toolbar">
            <div className="line-legend"><span className="cut-swatch">カット線</span><span className="fold-swatch">折り線</span><span className="glue-swatch">のりしろ</span></div>
            <span className="dimension-pill">{mm(geometry.bounds.widthMm)} × {mm(geometry.bounds.heightMm)}</span>
          </div>
          <div className="dieline-stage editor-stage">
            <DielineSvg
              geometry={geometry}
              pattern={state.pattern}
              texts={state.texts}
              showGuides={state.showGuides}
              selectedTextId={state.selectedTextId}
              exportMode={false}
              onSelectText={(id) => dispatch({ type: "select-text", id })}
              onMoveText={(id, xMm, yMm) => dispatch({ type: "update-text", id, patch: { xMm, yMm } })}
            />
          </div>
          <p className="canvas-caption">画面では見やすい大きさに拡大表示しています。印刷寸法は下のmm値とPDFの実寸座標が基準です。</p>
        </section>
      </div>

      <div className="sticky-actions">
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "go", screen: "size" })}>サイズに戻る</button>
        <button className="primary-button" type="button" onClick={() => dispatch({ type: "go", screen: "print" })}>プレビュー／印刷へ <span>▣</span></button>
      </div>
    </main>
  );
}

function PrintScreen({ state, dispatch, geometry, fit }: ScreenProps) {
  const dielineSvg = useRef<SVGSVGElement>(null);
  const calibrationSvg = useRef<SVGSVGElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");

  const handleExport = async () => {
    if (!dielineSvg.current) return;
    setExporting(true);
    setExportError("");
    setExportSuccess("");
    try {
      const result = await exportA4Pdf({
        dielineSvg: dielineSvg.current,
        calibrationSvg: state.includeCalibrationPage ? calibrationSvg.current : null,
        fit,
        fileName: `usapon-package-${state.box.widthMm}x${state.box.depthMm}x${state.box.heightMm}mm.pdf`,
      });
      setExportSuccess(`PDFを作成しました（${result.pageCount}ページ／${Math.max(1, Math.round(result.byteLength / 1024))}KB）`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDFを作成できませんでした。");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="tool-page print-page">
      <div className="page-heading horizontal-heading">
        <div><button className="back-button" type="button" onClick={() => dispatch({ type: "go", screen: "design" })}>← デザイン編集</button><p className="eyebrow">STEP 3</p><h1>印刷プレビュー</h1><p>A4実寸PDFを作成します。展開図の自動縮小は行いません。</p></div>
        <FitNotice geometry={geometry} fit={fit} compact />
      </div>

      <div className="print-layout">
        <section className={`paper-preview-wrap ${fit.orientation}`}>
          <div className="paper-label">A4 {fit.orientation === "portrait" ? "縦 210 × 297mm" : "横 297 × 210mm"}</div>
          <div className="paper-preview">
            <A4ExportSvg ref={dielineSvg} geometry={geometry} fit={fit} pattern={state.pattern} texts={state.texts} />
          </div>
        </section>

        <aside className="print-settings panel-card">
          <h2>A4 PDF出力</h2>
          <FitNotice geometry={geometry} fit={fit} />
          <div className="print-instruction">
            <span aria-hidden="true">!</span>
            <div><strong>印刷設定が重要です</strong><p>プリンター設定で<strong>「100%／実際のサイズ」</strong>を選び、<strong>「用紙に合わせる」をOFF</strong>にしてください。</p></div>
          </div>
          <label className="toggle-row calibration-toggle"><span><strong>50mm検寸ページを追加</strong><small>PDFの2ページ目で印刷倍率を確認できます</small></span><input type="checkbox" checked={state.includeCalibrationPage} onChange={(event) => dispatch({ type: "set-calibration", value: event.target.checked })} /></label>
          <div className="calibration-explanation"><b>実寸の確認方法</b><ol><li>2ページ目も同じ設定で印刷</li><li>検寸線を定規で測る</li><li>ちょうど50mmなら正しい倍率です</li></ol></div>
          {exportError && <p className="export-error">{exportError}</p>}
          {exportSuccess && <p className="export-success" role="status">{exportSuccess}</p>}
          <button className="pdf-button" type="button" disabled={fit.status === "overflow" || exporting} onClick={handleExport}>
            <span aria-hidden="true">⇩</span>{exporting ? "PDFを作成中…" : "A4 PDFをダウンロード"}
          </button>
          {fit.status === "overflow" && <p className="blocked-copy">A4に収まらないため出力を停止しています。サイズ設定へ戻って寸法を小さくしてください。</p>}
          <p className="privacy-copy">柄データと文字はサーバーへ送信されず、この端末内だけで処理されます。</p>
        </aside>
      </div>

      <div className="hidden-export-svg" aria-hidden="true"><CalibrationSvg ref={calibrationSvg} /></div>
      <div className="sticky-actions"><button className="secondary-button" type="button" onClick={() => dispatch({ type: "go", screen: "design" })}>デザインに戻る</button><button className="outline-button" type="button" onClick={() => dispatch({ type: "go", screen: "size" })}>寸法を変更</button></div>
    </main>
  );
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const geometry = useMemo(() => generateDieline(state.box), [state.box]);
  const fit = useMemo(() => evaluateA4Fit(geometry.bounds.widthMm, geometry.bounds.heightMm), [geometry.bounds.heightMm, geometry.bounds.widthMm]);

  return (
    <div className="app-shell">
      <AppHeader screen={state.screen} onGo={(screen) => dispatch({ type: "go", screen })} />
      {state.screen === "home" && <HomeScreen onStart={() => dispatch({ type: "go", screen: "size" })} />}
      {state.screen === "size" && <SizeScreen state={state} dispatch={dispatch} geometry={geometry} fit={fit} />}
      {state.screen === "design" && <DesignScreen state={state} dispatch={dispatch} geometry={geometry} fit={fit} />}
      {state.screen === "print" && <PrintScreen state={state} dispatch={dispatch} geometry={geometry} fit={fit} />}
      <footer className="app-footer"><strong>うさぽん パッケージメーカー</strong><span>MVP — データは端末内で処理されます</span></footer>
    </div>
  );
}

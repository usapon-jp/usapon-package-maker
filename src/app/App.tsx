import { useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";

import { A4ExportSvg, A4PreviewSvg, CalibrationSvg } from "../components/dieline/A4ExportSvg";
import { DielineSvg } from "../components/dieline/DielineSvg";
import { generateDieline } from "../domain/boxes/registry";
import type { BoxType, DielineGeometry } from "../domain/boxes/types";
import { evaluateA4Fit, type A4FitResult, type FitStatus } from "../domain/paper/a4";
import { roundMm } from "../domain/units";
import { exportA4Pdf } from "../lib/pdf/export-a4-pdf";
import { readPatternFile } from "../lib/uploads/read-pattern";
import { appReducer, DEFAULT_DIELINE_LINE_COLORS, initialState } from "./app-state";
import {
  addFavoriteColor,
  BASIC_DESIGN_COLORS,
  FAVORITE_COLORS_STORAGE_KEY,
  parseFavoriteColors,
  RECOMMENDED_DESIGN_COLORS,
  removeFavoriteColor,
} from "./design-colors";
import {
  artworkKindLabel,
  createDotPattern,
  createStamp,
  createStripePattern,
  createUploadedArtwork,
  POFUMOFU_STAMP_FILE,
  rotateQuarterTurn,
} from "./artwork";
import type { AppAction, AppState, DielineLineColors, EditorSection, Screen, TextItem } from "./app-types";
import { parseNumberDraft } from "./number-input";

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

const BOX_TYPE_COPY: Record<BoxType, { name: string; description: string; structure: string }> = {
  "straight-tuck-carton-v1": {
    name: "キャラメル箱",
    description: "細長い筒型で、上下のフタを差し込む定番の箱",
    structure: "straight-tuck-carton-v1",
  },
  "gift-box-v1": {
    name: "浅型差し込みギフト箱",
    description: "4か所を接着して組み立てる、シンプルな浅型ギフト箱",
    structure: "gift-box-v1（接着式一体型）",
  },
  "n-style-gift-box-v1": {
    name: "N式ギフト箱",
    description: "折り返しロックで組み立てる、のり不要の浅型ギフト箱",
    structure: "n-style-gift-box-v1（N式一体型）",
  },
};

const LINE_COLOR_PRESETS: Array<{ label: string; colors: DielineLineColors }> = [
  { label: "ベージュ", colors: DEFAULT_DIELINE_LINE_COLORS },
  { label: "薄いグレー", colors: { cut: "#9f9b95", fold: "#c1beb9" } },
  { label: "黒", colors: { cut: "#20262d", fold: "#666b70" } },
];

function isShallowBox(type: BoxType) {
  return type === "gift-box-v1" || type === "n-style-gift-box-v1";
}

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

function LineLegend({ geometry, lineColors }: { geometry: DielineGeometry; lineColors: DielineLineColors }) {
  const cutStyle = { "--swatch-color": lineColors.cut } as CSSProperties;
  const foldStyle = { "--swatch-color": lineColors.fold } as CSSProperties;
  return (
    <div className="line-legend">
      <span className="cut-swatch" style={cutStyle}>カット線</span>
      <span className="fold-swatch" style={foldStyle}>折り線</span>
      {geometry.layers.glue.length > 0
        ? <span className="glue-swatch">のりしろ</span>
        : <span className="no-glue-swatch">のり不要</span>}
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
  const [draft, setDraft] = useState(() => String(value));
  const isEditing = useRef(false);

  useEffect(() => {
    if (!isEditing.current) setDraft(String(value));
  }, [value]);

  const updateDraft = (nextDraft: string) => {
    setDraft(nextDraft);
    const nextValue = parseNumberDraft(nextDraft, min, max);
    if (nextValue !== null) onChange(nextValue);
  };

  const finishEditing = () => {
    isEditing.current = false;
    const nextValue = parseNumberDraft(draft, min, max);
    setDraft(nextValue === null ? String(value) : String(nextValue));
  };

  return (
    <label className="number-field">
      <span>{label}{shortLabel && <b>（{shortLabel}）</b>}</span>
      <div>
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={step}
          onFocus={() => { isEditing.current = true; }}
          onChange={(event) => updateDraft(event.target.value)}
          onBlur={finishEditing}
        />
        <em>mm</em>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function DesignColorControl({
  label,
  value,
  favoriteColors,
  className = "",
  onChange,
  onAddFavorite,
  onRemoveFavorite,
}: {
  label: string;
  value: string;
  favoriteColors: string[];
  className?: string;
  onChange: (color: string) => void;
  onAddFavorite: (color: string) => void;
  onRemoveFavorite: (color: string) => void;
}) {
  const palettes = [
    { label: "基本カラー", colors: BASIC_DESIGN_COLORS },
    { label: "参考画像・おすすめ", colors: RECOMMENDED_DESIGN_COLORS },
  ];
  return (
    <div className={`design-color-control ${className}`}>
      <label className="color-row">
        {label}
        <span className="current-color-value"><code>{value.toUpperCase()}</code><input aria-label={label} type="color" value={value} onChange={(event) => onChange(event.target.value)} /></span>
      </label>
      {palettes.map((palette) => (
        <div className="design-color-palette" key={palette.label}>
          <small>{palette.label}</small>
          <div className="design-color-swatches">
            {palette.colors.map((color) => (
              <button
                key={color.value}
                type="button"
                className={value.toLowerCase() === color.value ? "is-selected" : ""}
                style={{ "--design-color": color.value } as CSSProperties}
                aria-label={`${color.name} ${color.value}`}
                title={`${color.name} ${color.value}`}
                onClick={() => onChange(color.value)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="favorite-color-section">
        <div><small>お気に入り</small><button type="button" onClick={() => onAddFavorite(value)}>☆ 今の色を登録</button></div>
        {favoriteColors.length > 0 ? (
          <div className="favorite-color-swatches">
            {favoriteColors.map((color) => (
              <span key={color}>
                <button type="button" className={value.toLowerCase() === color ? "is-selected" : ""} style={{ "--design-color": color } as CSSProperties} aria-label={`お気に入り ${color}`} title={color} onClick={() => onChange(color)} />
                <button type="button" aria-label={`${color}をお気に入りから削除`} title="お気に入りから削除" onClick={() => onRemoveFavorite(color)}>×</button>
              </span>
            ))}
          </div>
        ) : <p>カラーピッカーで色を作り、「今の色を登録」を押してください。</p>}
      </div>
    </div>
  );
}

function SizeScreen({ state, dispatch, geometry, fit }: ScreenProps) {
  const boxCopy = BOX_TYPE_COPY[state.box.type];
  const shallowBox = isShallowBox(state.box.type);
  const nStyle = state.box.type === "n-style-gift-box-v1";
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
          <div className="card-title"><span>1</span><div><h2>箱形式</h2><p>{boxCopy.structure}</p></div></div>
          <div className="box-type-grid" role="group" aria-label="箱形式を選択">
            {(Object.entries(BOX_TYPE_COPY) as Array<[BoxType, (typeof BOX_TYPE_COPY)[BoxType]]>).map(([type, copy]) => (
              <button
                key={type}
                className={`box-type-button ${state.box.type === type ? "is-selected" : ""}`}
                type="button"
                aria-pressed={state.box.type === type}
                onClick={() => dispatch({ type: "set-box-type", boxType: type })}
              >
                <span aria-hidden="true">{type === "straight-tuck-carton-v1" ? "▯" : type === "gift-box-v1" ? "▭" : "⌑"}</span>
                <strong>{copy.name}</strong>
                <small>{copy.description}</small>
              </button>
            ))}
          </div>
          <div className="form-divider" />
          <div className="form-section-heading"><h3>仕上がり寸法</h3><p>{shallowBox ? "表面を W × H、箱の深さを D で指定" : "幅 W／奥行 D／高さ H を指定"}</p></div>
          <div className="dimension-grid">
            <NumberField label="幅" shortLabel="W" value={state.box.widthMm} min={10} max={400} onChange={(value) => dispatch({ type: "update-box", field: "widthMm", value })} />
            {shallowBox ? (
              <>
                <NumberField label="高さ" shortLabel="H" value={state.box.heightMm} min={10} max={500} onChange={(value) => dispatch({ type: "update-box", field: "heightMm", value })} />
                <NumberField label="深さ" shortLabel="D" value={state.box.depthMm} min={5} max={300} onChange={(value) => dispatch({ type: "update-box", field: "depthMm", value })} />
              </>
            ) : (
              <>
                <NumberField label="奥行" shortLabel="D" value={state.box.depthMm} min={5} max={300} onChange={(value) => dispatch({ type: "update-box", field: "depthMm", value })} />
                <NumberField label="高さ" shortLabel="H" value={state.box.heightMm} min={10} max={500} onChange={(value) => dispatch({ type: "update-box", field: "heightMm", value })} />
              </>
            )}
          </div>
          <div className="form-divider" />
          <div className="option-grid">
            <NumberField label="紙の厚み" value={state.box.paperThicknessMm} min={0.1} max={2} step={0.01} onChange={(value) => dispatch({ type: "update-box", field: "paperThicknessMm", value })} hint="コピー用紙の目安：0.09mm／厚紙：0.2〜0.4mm" />
            {nStyle ? (
              <div className="no-glue-field"><span>接着</span><strong>のり不要</strong><small>折り返しと差し込みロックで固定</small></div>
            ) : (
              <NumberField label="のりしろ幅" value={state.box.glueFlapMm} min={5} max={40} step={0.5} onChange={(value) => dispatch({ type: "update-box", field: "glueFlapMm", value })} hint={state.box.type === "gift-box-v1" ? "前後の壁と左右の壁を固定する幅" : "接着しやすい12〜15mmがおすすめ"} />
            )}
          </div>
          <div className="measurement-note">
            <strong>{shallowBox ? "1枚で組み立て" : "寸法の考え方"}</strong>
            <p>{nStyle
              ? "底面の上下側壁を立て、角ロックを内側へ折って側面を固定します。前面の折り返しを2つのノッチで留め、最後にフタの舌を差し込みます。"
              : state.box.type === "gift-box-v1"
                ? "底面・4側面・ヒンジフタはすべてつながっています。4つののりしろで浅いトレーを作り、左右フラップを内側へ折ってフタの舌を前面へ差し込みます。"
                : "紙厚は差し込み部の逃げに反映します。印刷後は実際の紙で一度試作してください。"}</p>
          </div>
        </section>

        <section className="panel-card size-preview-card">
          <div className="preview-card-head"><div><p className="eyebrow">LIVE PREVIEW</p><h2>A4配置プレビュー</h2></div><span>A4 {fit.orientation === "portrait" ? "縦" : "横"}</span></div>
          <div className="size-paper-stage">
            <div className={`size-paper-preview ${fit.orientation} fit-${fit.status}`}>
              <A4PreviewSvg
              geometry={geometry}
              fit={fit}
              backgroundColor={state.backgroundColor}
              artworkLayers={state.artworkLayers}
              stamps={state.stamps}
              texts={state.texts}
              lineColors={state.lineColors}
              showGuides={state.showGuides}
              />
            </div>
          </div>
          <p className="size-paper-caption">A4 {fit.orientation === "portrait" ? "縦 210 × 297mm" : "横 297 × 210mm"}との比率で表示。画面表示のみ縮小し、PDFの展開図は100%実寸です。</p>
          <LineLegend geometry={geometry} lineColors={state.lineColors} />
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

function AccordionSection({
  section,
  openSection,
  title,
  icon,
  count,
  onOpen,
  children,
}: {
  section: EditorSection;
  openSection: EditorSection;
  title: string;
  icon: string;
  count?: number;
  onOpen: (section: EditorSection) => void;
  children: ReactNode;
}) {
  const open = section === openSection;
  return (
    <section className={`editor-control-section accordion-section ${open ? "is-open" : ""}`}>
      <button className="accordion-trigger" type="button" aria-expanded={open} onClick={() => onOpen(section)}>
        <span aria-hidden="true">{icon}</span>
        <strong>{title}</strong>
        {typeof count === "number" && <small>{count}</small>}
        <b aria-hidden="true">{open ? "−" : "＋"}</b>
      </button>
      {open && <div className="accordion-content">{children}</div>}
    </section>
  );
}

function DesignScreen({ state, dispatch, geometry, fit }: ScreenProps) {
  const artworkFileInput = useRef<HTMLInputElement>(null);
  const stampFileInput = useRef<HTMLInputElement>(null);
  const [artworkUploadError, setArtworkUploadError] = useState("");
  const [stampUploadError, setStampUploadError] = useState("");
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => {
    try {
      return parseFavoriteColors(window.localStorage.getItem(FAVORITE_COLORS_STORAGE_KEY));
    } catch {
      return [];
    }
  });
  const selectedArtwork = state.artworkLayers.find((item) => item.id === state.selectedArtworkId) ?? null;
  const selectedStamp = state.stamps.find((item) => item.id === state.selectedStampId) ?? null;
  const selectedText = state.texts.find((item) => item.id === state.selectedTextId) ?? null;

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITE_COLORS_STORAGE_KEY, JSON.stringify(favoriteColors));
    } catch {
      // 保存できない環境でも、現在の編集セッション内では利用できます。
    }
  }, [favoriteColors]);

  const addFavorite = (color: string) => setFavoriteColors((colors) => addFavoriteColor(colors, color));
  const removeFavorite = (color: string) => setFavoriteColors((colors) => removeFavoriteColor(colors, color));

  const handleArtworkFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setUploadingArtwork(true);
    setArtworkUploadError("");
    const errors: string[] = [];
    for (const file of files) {
      try {
        dispatch({ type: "add-artwork", item: createUploadedArtwork(await readPatternFile(file), geometry) });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "読み込めませんでした。"}`);
      }
    }
    setArtworkUploadError(errors.join("\n"));
    setUploadingArtwork(false);
  };

  const handleStampFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setUploadingStamp(true);
    setStampUploadError("");
    const errors: string[] = [];
    for (const file of files) {
      try {
        dispatch({ type: "add-stamp", item: createStamp(await readPatternFile(file), geometry) });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "読み込めませんでした。"}`);
      }
    }
    setStampUploadError(errors.join("\n"));
    setUploadingStamp(false);
  };

  const addPresetStamp = async () => {
    setUploadingStamp(true);
    setStampUploadError("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}assets/stamps/${POFUMOFU_STAMP_FILE}`);
      if (!response.ok) throw new Error("プリセット画像を読み込めませんでした。");
      const file = new File([await response.blob()], POFUMOFU_STAMP_FILE, { type: "image/png" });
      dispatch({ type: "add-stamp", item: createStamp(await readPatternFile(file), geometry, "Pofumofu friends") });
    } catch (error) {
      setStampUploadError(error instanceof Error ? error.message : "プリセット画像を読み込めませんでした。");
    } finally {
      setUploadingStamp(false);
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
          <AccordionSection section="artwork" openSection={state.openEditorSection} title="背景・柄" icon="▧" count={state.artworkLayers.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <DesignColorControl className="background-color-control" label="基本背景色" value={state.backgroundColor} favoriteColors={favoriteColors} onChange={(color) => dispatch({ type: "set-background-color", color })} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />
            <div className="preset-grid" aria-label="基本柄プリセット">
              <button type="button" onClick={() => dispatch({ type: "add-artwork", item: createStripePattern(crypto.randomUUID(), state.artworkLayers.filter((item) => item.kind === "stripe-pattern").length + 1) })}><i className="stripe-preview" /><strong>ストライプ</strong><small>幅・間隔・向きを調整</small></button>
              <button type="button" onClick={() => dispatch({ type: "add-artwork", item: createDotPattern(crypto.randomUUID(), state.artworkLayers.filter((item) => item.kind === "dot-pattern").length + 1) })}><i className="dot-preview" /><strong>水玉</strong><small>色・大きさ・間隔を調整</small></button>
            </div>
            <input ref={artworkFileInput} type="file" accept="image/png,image/svg+xml,.png,.svg" multiple hidden onChange={handleArtworkFiles} />
            <button className="upload-button compact-upload" type="button" disabled={uploadingArtwork} onClick={() => artworkFileInput.current?.click()}><span>↑</span>{uploadingArtwork ? "読み込み中…" : "自分の画像を追加"}</button>
            {artworkUploadError && <p className="field-error preserve-lines">{artworkUploadError}</p>}

            {state.artworkLayers.length > 0 && (
              <div className="layer-list" aria-label="背景・柄レイヤー">
                {state.artworkLayers.map((item) => (
                  <div key={item.id} className={`layer-row ${state.selectedArtworkId === item.id ? "is-selected" : ""}`}>
                    <button className="layer-select" type="button" onClick={() => dispatch({ type: "select-artwork", id: item.id })}><span>{artworkKindLabel(item)}</span><b>{item.name}</b></button>
                    <button className="visibility-button" type="button" aria-label={`${item.name}を${item.visible ? "非表示" : "表示"}`} onClick={() => dispatch({ type: "update-artwork", id: item.id, patch: { visible: !item.visible } })}>{item.visible ? "●" : "○"}</button>
                  </div>
                ))}
              </div>
            )}

            {selectedArtwork && (
              <div className="selected-layer-controls">
                <strong className="selected-layer-title">{selectedArtwork.name}</strong>
                <label className="range-control"><span>透明度 <output>{Math.round(selectedArtwork.opacity * 100)}%</output></span><input type="range" min="0.1" max="1" step="0.05" value={selectedArtwork.opacity} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { opacity: Number(event.target.value) } })} /></label>
                {selectedArtwork.kind === "stripe-pattern" && (
                  <>
                    <DesignColorControl label="ストライプ色" value={selectedArtwork.color} favoriteColors={favoriteColors} onChange={(color) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { color } })} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />
                    <div className="mini-number-grid"><NumberField label="線幅" value={selectedArtwork.stripeWidthMm} min={1} max={50} step={1} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { stripeWidthMm: value } })} /><NumberField label="間隔" value={selectedArtwork.gapMm} min={1} max={50} step={1} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { gapMm: value } })} /></div>
                    <label className="select-row">向き<select value={selectedArtwork.angleDeg} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { angleDeg: Number(event.target.value) as 0 | 45 | 90 | 135 } })}><option value="0">縦</option><option value="45">斜め 45°</option><option value="90">横</option><option value="135">斜め 135°</option></select></label>
                  </>
                )}
                {selectedArtwork.kind === "dot-pattern" && (
                  <>
                    <DesignColorControl label="水玉色" value={selectedArtwork.color} favoriteColors={favoriteColors} onChange={(color) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { color } })} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />
                    <label className="range-control"><span>水玉の大きさ <output>{mm(selectedArtwork.dotDiameterMm)}</output></span><input aria-label="水玉の大きさ" type="range" min="1" max="60" step="1" value={selectedArtwork.dotDiameterMm} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { dotDiameterMm: Number(event.target.value) } })} /></label>
                    <label className="range-control"><span>水玉の間隔 <output>{mm(selectedArtwork.spacingMm)}</output></span><input aria-label="水玉の間隔" type="range" min="2" max="100" step="1" value={selectedArtwork.spacingMm} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { spacingMm: Number(event.target.value) } })} /></label>
                  </>
                )}
                {selectedArtwork.kind === "uploaded-artwork" && (
                  <>
                    <label className="range-control"><span>画像の幅 <output>{mm(selectedArtwork.widthMm)}</output></span><input type="range" min="2" max="200" step="1" value={selectedArtwork.widthMm} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { widthMm: Number(event.target.value) } })} /></label>
                    <label className="toggle-row"><span><strong>リピート</strong><small>画像を繰り返して全面へ配置</small></span><input type="checkbox" checked={selectedArtwork.repeat} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { repeat: event.target.checked } })} /></label>
                    <button className="rotate-button" type="button" onClick={() => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { rotationDeg: rotateQuarterTurn(selectedArtwork.rotationDeg) } })}>↻ 90°回転 <span>{selectedArtwork.rotationDeg}°</span></button>
                  </>
                )}
                <div className="mini-number-grid"><NumberField label="横位置 X" value={roundMm(selectedArtwork.offsetXmm, 1)} min={-500} max={500} step={1} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { offsetXmm: value } })} /><NumberField label="縦位置 Y" value={roundMm(selectedArtwork.offsetYmm, 1)} min={-500} max={500} step={1} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { offsetYmm: value } })} /></div>
                <div className="layer-action-row"><button type="button" onClick={() => dispatch({ type: "move-artwork", id: selectedArtwork.id, direction: "backward" })}>← 背面</button><button type="button" onClick={() => dispatch({ type: "move-artwork", id: selectedArtwork.id, direction: "forward" })}>前面 →</button><button type="button" onClick={() => dispatch({ type: "duplicate-artwork", id: selectedArtwork.id, newId: crypto.randomUUID() })}>複製</button><button className="danger" type="button" onClick={() => dispatch({ type: "remove-artwork", id: selectedArtwork.id })}>削除</button></div>
              </div>
            )}
          </AccordionSection>

          <AccordionSection section="stamps" openSection={state.openEditorSection} title="スタンプ" icon="★" count={state.stamps.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <button className="stamp-preset-card" type="button" disabled={uploadingStamp} onClick={addPresetStamp}><img src={`${import.meta.env.BASE_URL}assets/stamps/${POFUMOFU_STAMP_FILE}`} alt="Pofumofu friends" /><span><strong>Pofumofu friends</strong><small>プリセットを追加</small></span><b>＋</b></button>
            <input ref={stampFileInput} type="file" accept="image/png,image/svg+xml,.png,.svg" multiple hidden onChange={handleStampFiles} />
            <button className="upload-button compact-upload" type="button" disabled={uploadingStamp} onClick={() => stampFileInput.current?.click()}><span>↑</span>{uploadingStamp ? "読み込み中…" : "自分のスタンプを追加"}</button>
            {stampUploadError && <p className="field-error preserve-lines">{stampUploadError}</p>}
            {state.stamps.length > 0 && <div className="layer-list" aria-label="スタンプレイヤー">{state.stamps.map((item) => <div key={item.id} className={`layer-row ${state.selectedStampId === item.id ? "is-selected" : ""}`}><button className="layer-select" type="button" onClick={() => dispatch({ type: "select-stamp", id: item.id })}><span>STAMP</span><b>{item.name}</b></button><button className="visibility-button" type="button" aria-label={`${item.name}を${item.visible ? "非表示" : "表示"}`} onClick={() => dispatch({ type: "update-stamp", id: item.id, patch: { visible: !item.visible } })}>{item.visible ? "●" : "○"}</button></div>)}</div>}
            {selectedStamp && (
              <div className="selected-layer-controls">
                <strong className="selected-layer-title">{selectedStamp.name}</strong>
                <label className="range-control"><span>スタンプの幅 <output>{mm(selectedStamp.widthMm)}</output></span><input type="range" min="2" max="200" step="1" value={selectedStamp.widthMm} onChange={(event) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { widthMm: Number(event.target.value) } })} /></label>
                <label className="range-control"><span>透明度 <output>{Math.round(selectedStamp.opacity * 100)}%</output></span><input type="range" min="0.1" max="1" step="0.05" value={selectedStamp.opacity} onChange={(event) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { opacity: Number(event.target.value) } })} /></label>
                <button className="rotate-button" type="button" onClick={() => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { rotationDeg: rotateQuarterTurn(selectedStamp.rotationDeg) } })}>↻ 90°回転 <span>{selectedStamp.rotationDeg}°</span></button>
                <div className="mini-number-grid"><NumberField label="横位置 X" value={roundMm(selectedStamp.xMm, 1)} min={0} max={geometry.bounds.widthMm} step={1} onChange={(value) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { xMm: value } })} /><NumberField label="縦位置 Y" value={roundMm(selectedStamp.yMm, 1)} min={0} max={geometry.bounds.heightMm} step={1} onChange={(value) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { yMm: value } })} /></div>
                <p className="drag-hint">プレビュー上でも移動できます。</p>
                <div className="layer-action-row"><button type="button" onClick={() => dispatch({ type: "move-stamp", id: selectedStamp.id, direction: "backward" })}>← 背面</button><button type="button" onClick={() => dispatch({ type: "move-stamp", id: selectedStamp.id, direction: "forward" })}>前面 →</button><button type="button" onClick={() => dispatch({ type: "duplicate-stamp", id: selectedStamp.id, newId: crypto.randomUUID() })}>複製</button><button className="danger" type="button" onClick={() => dispatch({ type: "remove-stamp", id: selectedStamp.id })}>削除</button></div>
              </div>
            )}
          </AccordionSection>

          <AccordionSection section="text" openSection={state.openEditorSection} title="テキスト" icon="T" count={state.texts.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
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
                <DesignColorControl label="文字色" value={selectedText.color} favoriteColors={favoriteColors} onChange={(color) => dispatch({ type: "update-text", id: selectedText.id, patch: { color } })} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />
                <div className="mini-number-grid">
                  <NumberField label="横位置 X" value={roundMm(selectedText.xMm, 1)} min={0} max={geometry.bounds.widthMm} step={1} onChange={(value) => dispatch({ type: "update-text", id: selectedText.id, patch: { xMm: value } })} />
                  <NumberField label="縦位置 Y" value={roundMm(selectedText.yMm, 1)} min={0} max={geometry.bounds.heightMm} step={1} onChange={(value) => dispatch({ type: "update-text", id: selectedText.id, patch: { yMm: value } })} />
                </div>
                <p className="drag-hint">プレビュー上の文字を指やマウスで動かせます。</p>
                <button className="delete-button" type="button" onClick={() => dispatch({ type: "remove-text", id: selectedText.id })}>このテキストを削除</button>
              </div>
            )}
          </AccordionSection>

          <AccordionSection section="display" openSection={state.openEditorSection} title="表示" icon="◉" onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <label className="toggle-row"><span><strong>ガイド表示</strong><small>面名と中心線。PDFには印刷しません</small></span><input type="checkbox" checked={state.showGuides} onChange={() => dispatch({ type: "toggle-guides" })} /></label>
          </AccordionSection>

          <AccordionSection section="lines" openSection={state.openEditorSection} title="線の色" icon="／" onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <p className="control-help">カット線（実線）と折り線（点線）は、画面とPDFに同じ色で反映されます。</p>
            <div className="line-color-grid">
              <label className="line-color-row">
                <span><strong>カット線</strong><small>実線</small></span>
                <input aria-label="カット線の色" type="color" value={state.lineColors.cut} onChange={(event) => dispatch({ type: "set-line-color", layer: "cut", color: event.target.value })} />
              </label>
              <label className="line-color-row">
                <span><strong>折り線</strong><small>点線</small></span>
                <input aria-label="折り線の色" type="color" value={state.lineColors.fold} onChange={(event) => dispatch({ type: "set-line-color", layer: "fold", color: event.target.value })} />
              </label>
            </div>
            <div className="line-color-presets" aria-label="線色プリセット">
              {LINE_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  className={state.lineColors.cut === preset.colors.cut && state.lineColors.fold === preset.colors.fold ? "is-selected" : ""}
                  onClick={() => dispatch({ type: "set-line-colors", colors: preset.colors })}
                >
                  <i style={{ background: preset.colors.cut }} /><i style={{ background: preset.colors.fold }} />
                  {preset.label}
                </button>
              ))}
            </div>
          </AccordionSection>
        </aside>

        <section className="editor-canvas-panel panel-card">
          <div className="canvas-toolbar">
            <LineLegend geometry={geometry} lineColors={state.lineColors} />
            <span className="dimension-pill">{mm(geometry.bounds.widthMm)} × {mm(geometry.bounds.heightMm)}</span>
          </div>
          <div className="dieline-stage editor-stage">
            <DielineSvg
              geometry={geometry}
              backgroundColor={state.backgroundColor}
              artworkLayers={state.artworkLayers}
              stamps={state.stamps}
              texts={state.texts}
              lineColors={state.lineColors}
              showGuides={state.showGuides}
              selectedArtworkId={state.selectedArtworkId}
              selectedStampId={state.selectedStampId}
              selectedTextId={state.selectedTextId}
              exportMode={false}
              onSelectArtwork={(id) => { dispatch({ type: "select-artwork", id }); if (id) dispatch({ type: "set-open-editor-section", section: "artwork" }); }}
              onMoveArtwork={(id, xMm, yMm) => dispatch({ type: "update-artwork", id, patch: { offsetXmm: xMm, offsetYmm: yMm } })}
              onSelectStamp={(id) => { dispatch({ type: "select-stamp", id }); if (id) dispatch({ type: "set-open-editor-section", section: "stamps" }); }}
              onMoveStamp={(id, xMm, yMm) => dispatch({ type: "update-stamp", id, patch: { xMm, yMm } })}
              onRotateStamp={(id) => {
                const stamp = state.stamps.find((item) => item.id === id);
                if (stamp) dispatch({ type: "update-stamp", id, patch: { rotationDeg: rotateQuarterTurn(stamp.rotationDeg) } });
              }}
              onSelectText={(id) => { dispatch({ type: "select-text", id }); if (id) dispatch({ type: "set-open-editor-section", section: "text" }); }}
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
        fileName: `usapon-${state.box.type}-${state.box.widthMm}x${state.box.heightMm}x${state.box.depthMm}mm.pdf`,
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
            <A4ExportSvg
              ref={dielineSvg}
              geometry={geometry}
              fit={fit}
              backgroundColor={state.backgroundColor}
              artworkLayers={state.artworkLayers}
              stamps={state.stamps}
              texts={state.texts}
              lineColors={state.lineColors}
            />
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
          <p className="privacy-copy">画像・スタンプ・文字はサーバーへ送信されず、この端末内だけで処理されます。</p>
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

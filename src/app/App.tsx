import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";

import { A4ExportSvg, A4PreviewSvg, CalibrationSvg } from "../components/dieline/A4ExportSvg";
import { DielineSvg } from "../components/dieline/DielineSvg";
import { BoxTypeIcon } from "../components/icons/BoxTypeIcon";
import { MyBoxesScreen } from "../components/cloud/MyBoxesScreen";
import { InstallGuide } from "../components/pwa/InstallGuide";
import { generateDielineDocument } from "../domain/boxes/registry";
import type { BoxType, DielineGeometry, DielinePage, DielinePageId } from "../domain/boxes/types";
import { evaluateA4Fit, type A4FitResult, type FitStatus } from "../domain/paper/a4";
import { printImposition } from "../domain/paper/imposition";
import { clamp, roundMm } from "../domain/units";
import { downloadPdfBlob } from "../lib/pdf/download-pdf";
import { canSharePdfFile, createPdfShareFile, createTimestampedPdfFileName, sharePdfFile } from "../lib/pdf/share-pdf";
import { detectClientContext, type ClientContext } from "../lib/browser/client-context";
import { readPatternFile } from "../lib/uploads/read-pattern";
import { clearLocalDraft, loadLocalDraft, saveLocalDraft } from "../lib/drafts/local-draft";
import {
  currentUser,
  deleteCloudAccount,
  openCloudProject,
  ProjectConflictError,
  saveCloudProject,
  signInWithGoogle,
  signOutLocally,
} from "../cloud/box-repository";
import { isCloudConfigured, supabase } from "../cloud/supabase-client";
import type { ProjectWorkspace, SaveState } from "../cloud/types";
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
  BUILT_IN_STAMPS,
  createDotPattern,
  createStamp,
  createStripePattern,
  createUploadedArtwork,
  markAsBuiltInStamp,
  rotateByDegrees,
  rotateQuarterTurn,
} from "./artwork";
import type { AppAction, AppState, DielineLineColors, EditorSection, Screen, TextItem } from "./app-types";
import { serializeBoxDocument } from "./box-document";
import { parseNumberDraft } from "./number-input";
import { FAVORITE_SIZES_STORAGE_KEY, parseFavoriteSizes, registerFavoriteSize } from "./favorite-sizes";
import { AutoLayoutPanel } from "../features/auto-layout/AutoLayoutPanel";
import { arrangeDesign, autoLayoutElementCount } from "../features/auto-layout/layout-engine";
import { createTextItem } from "../features/auto-layout/text-layout";
import { DEFAULT_AUTO_LAYOUT_SETTINGS, type AutoLayoutResult, type AutoLayoutSettings } from "../features/auto-layout/types";
import { targetIncludesRole } from "../features/auto-layout/element-roles";
import { canOfferInstallGuide, detectInstallContext, INSTALL_GUIDE_HIDDEN_KEY } from "../lib/pwa/install-guide";
import { TemplateScreen } from "../features/templates/TemplateScreen";
import { stampSetsForTemplate, templateById, type PackageTemplate } from "../features/templates/template-catalog";

// 既存のクラウド保存利用者がいるため、端末内下書き保存と併用して提供する。
const CLOUD_SYNC_UI_ENABLED = true;

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
  "two-piece-gift-box-v1": {
    name: "ツーピースギフトBOX",
    description: "蓋と本体をA4 2枚で作る、上端二重の四隅接着箱",
    structure: "two-piece-gift-box-v1（蓋・本体分離／側面二重型）",
  },
  "letter-paper-v1": { name: "便箋", description: "A4で印刷できる便箋", structure: "letter-paper-v1" },
  "envelope-v1": { name: "封筒", description: "A4で作る封筒展開図", structure: "envelope-v1" },
  "mini-card-v1": { name: "ミニカード", description: "A4にまとめて印刷するカード", structure: "mini-card-v1" },
};

const SIZE_BOX_TYPES: BoxType[] = ["straight-tuck-carton-v1", "gift-box-v1", "two-piece-gift-box-v1"];

const LINE_COLOR_PRESETS: Array<{ label: string; colors: DielineLineColors }> = [
  { label: "ベージュ", colors: DEFAULT_DIELINE_LINE_COLORS },
  { label: "薄いグレー", colors: { cut: "#9f9b95", fold: "#c1beb9" } },
  { label: "黒", colors: { cut: "#20262d", fold: "#666b70" } },
];

function isShallowBox(type: BoxType) {
  return type === "gift-box-v1" || type === "two-piece-gift-box-v1";
}

type DielinePageView = DielinePage & { fit: A4FitResult };

function pageDesign(state: AppState, pageId: DielinePageId) {
  return {
    backgroundColor: state.backgroundColors[pageId],
    artworkLayers: state.artworkLayers.filter((item) => item.pageId === pageId),
    stamps: state.stamps.filter((item) => item.pageId === pageId),
    texts: state.texts.filter((item) => item.pageId === pageId),
  };
}

function PageTabs({ pages, activePageId, dispatch }: { pages: DielinePageView[]; activePageId: DielinePageId; dispatch: React.Dispatch<AppAction> }) {
  if (pages.length < 2) return null;
  return (
    <div className="page-part-tabs" role="tablist" aria-label="編集する箱パーツ">
      {pages.map((page) => (
        <button
          key={page.id}
          type="button"
          role="tab"
          aria-selected={page.id === activePageId}
          className={page.id === activePageId ? "is-selected" : ""}
          onClick={() => dispatch({ type: "set-active-page", pageId: page.id })}
        >
          {page.id === "lid" ? "蓋" : page.id === "base" ? "本体" : page.label}
        </button>
      ))}
    </div>
  );
}

function mm(value: number) {
  return `${roundMm(value, 1)}mm`;
}

function AppHeader({
  screen,
  templateId,
  user,
  saveState,
  saveMessage,
  onGo,
  onSave,
  onLogin,
  onLogout,
  onDeleteAccount,
}: {
  screen: Screen;
  templateId: string | null;
  user: User | null;
  saveState: SaveState;
  saveMessage: string;
  onGo: (screen: Screen) => void;
  onSave: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onDeleteAccount: () => void;
}) {
  const saveLabel = saveState === "saving" ? "保存中…" : saveState === "saved" ? "保存済み" : saveState === "error" ? "保存失敗" : saveState === "conflict" ? "更新あり" : "保存";
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
      {screen !== "home" && screen !== "my-boxes" && screen !== "templates" && (
        <nav className="step-nav" aria-label="作成ステップ">
          {([templateId ? "templates" : "size", "design", "print"] as const).map((step, index) => (
            <button
              key={step}
              type="button"
              className={screen === step ? "is-current" : ""}
              onClick={() => onGo(step)}
            >
              <span>{index + 1}</span>{step === "templates" ? "型を選ぶ" : step === "size" ? "サイズ" : step === "design" ? "デザイン" : "印刷"}
            </button>
          ))}
        </nav>
      )}
      {CLOUD_SYNC_UI_ENABLED && <div className="cloud-header-actions">
        {saveMessage && <small className={`save-indicator is-${saveState}`} role="status">{saveMessage}</small>}
        <button className="my-boxes-button" type="button" onClick={() => onGo("my-boxes")}>▦ <span>マイボックス</span></button>
        {screen !== "home" && screen !== "my-boxes" && screen !== "templates" && (
          <button className={`cloud-save-button is-${saveState}`} type="button" disabled={saveState === "saving"} onClick={onSave}>☁ {saveLabel}</button>
        )}
        {user ? (
          <details className="account-menu">
            <summary aria-label="アカウントメニュー">
              {user.user_metadata.avatar_url ? <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span>{(user.email ?? "U").slice(0, 1).toUpperCase()}</span>}
            </summary>
            <div>
              <strong>{user.user_metadata.full_name ?? "ログイン中"}</strong>
              <small>{user.email}</small>
              <button type="button" onClick={onLogout}>この端末からログアウト</button>
              <button className="danger" type="button" onClick={onDeleteAccount}>アカウントと全データを削除</button>
            </div>
          </details>
        ) : (
          <button className="google-login-button header-login" type="button" onClick={onLogin}><b>G</b> <span>Googleでログイン</span></button>
        )}
      </div>}
    </header>
  );
}

function InstagramBrowserNotice({ hasBrowserOnlyWork, onOpenGuide }: { hasBrowserOnlyWork: boolean; onOpenGuide: () => void }) {
  return (
    <aside className="instagram-browser-notice" role="alert">
      <span aria-hidden="true">!</span>
      <div>
        <strong>{hasBrowserOnlyWork ? "作業中の作品は、このブラウザだけにあります" : "作り始める前に、通常のブラウザで開くのがおすすめです"}</strong>
        <p>{hasBrowserOnlyWork ? "移動前に画面上部の「保存」を押してください。未保存の作品はInstagramからSafari・Chromeへ自動では移りません。" : "右上の「•••」から「外部ブラウザーで開く」を選ぶと、ホーム画面へ追加できます。"}</p>
        <button type="button" onClick={onOpenGuide}>開き方を見る</button>
      </div>
    </aside>
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

function FitNotice({ geometry, fit, compact = false, label }: { geometry: DielineGeometry; fit: A4FitResult; compact?: boolean; label?: string }) {
  const copy = FIT_COPY[fit.status];
  return (
    <div className={`fit-notice fit-${fit.status} ${compact ? "is-compact" : ""}`} role="status">
      <span className="fit-icon" aria-hidden="true">{fit.status === "safe" ? "✓" : fit.status === "paper-only" ? "!" : "×"}</span>
      <div>
        <strong>{label ? `${label}：${copy.title}` : copy.title}</strong>
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
      {geometry.layers.fold.length > 0 && <span className="fold-swatch" style={foldStyle}>折り線</span>}
      {geometry.layers.foldover.length > 0 && <span className="foldover-swatch" style={foldStyle}>折り返し補助線</span>}
      {geometry.layers.glue.length > 0
        ? <span className="glue-swatch">のりしろ</span>
        : <span className="no-glue-swatch">のり不要</span>}
    </div>
  );
}

function HomeScreen({ onStart, onTemplates, onResume, onMyBoxes }: { onStart: () => void; onTemplates: () => void; onResume: (() => void) | null; onMyBoxes: () => void }) {
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
            <span>実寸mm設計</span><span>A4自動判定</span><span>クラウド保存対応</span>
          </div>
        </div>
      </section>

      <section className="choice-section" aria-labelledby="choice-title">
        <div className="section-heading">
          <p className="eyebrow">LET'S MAKE</p>
          <h2 id="choice-title">つくりかたを選んでください</h2>
        </div>
        <div className="choice-grid">
          {onResume && <button className="choice-card is-active resume-choice-card" type="button" onClick={onResume}>
            <span className="choice-icon" aria-hidden="true">↩</span>
            <strong>前回の作品を続ける</strong>
            <p>この端末に復元した、未保存の編集内容を開きます</p>
            <b>編集を再開する　→</b>
          </button>}
          <button className="choice-card is-active" type="button" onClick={onStart}>
            <span className="choice-icon" aria-hidden="true">⌑</span>
            <strong>サイズから作る</strong>
            <p>W・D・Hをmmで入力して、ぴったりの展開図を作成</p>
            <b>この方法ではじめる　→</b>
          </button>
          <button className="choice-card is-active template-choice-card" type="button" onClick={onTemplates}>
            <span className="choice-icon" aria-hidden="true">▦</span>
            <strong>テンプレートから作る</strong>
            <p>便箋・封筒・ミニカードなど、作りたい型から選んで自由にデザイン</p>
            <b>テンプレートを見る　→</b>
          </button>
          {CLOUD_SYNC_UI_ENABLED && <button className="choice-card cloud-choice-card" type="button" onClick={onMyBoxes}>
            <span className="choice-icon" aria-hidden="true">☁</span>
            <strong>保存した箱を開く</strong>
            <p>Googleログインして、別の端末で作った作品を続きから編集</p>
            <b>マイボックスを見る　→</b>
          </button>}
        </div>
      </section>

      {CLOUD_SYNC_UI_ENABLED && <section className="cloud-data-notice">
        <strong>Googleログインとデータ保存について</strong>
        <p>ログインにはGoogleの氏名・メールアドレス・プロフィール画像だけを使用します。未保存の作品は端末内、保存した作品JSONとアップロード画像は非公開のSupabaseへ保存します。Google DriveやGmailにはアクセスしません。</p>
        <a href={`${import.meta.env.BASE_URL}privacy.html`}>プライバシーポリシー</a>
      </section>}

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

function FineTuneControl({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const update = (next: number) => onChange(roundMm(clamp(next, min, max), 1));
  return (
    <div className="fine-tune-control">
      <div><strong>{label}</strong><output>{mm(value)}</output></div>
      <div>
        <button type="button" aria-label={`${label}を${step}mm小さく`} onClick={() => update(value - step)}>−</button>
        <input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={(event) => update(Number(event.target.value))} />
        <button type="button" aria-label={`${label}を${step}mm大きく`} onClick={() => update(value + step)}>＋</button>
      </div>
    </div>
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

function SizeScreen({ state, dispatch, pages, activePage }: ScreenProps) {
  const boxCopy = BOX_TYPE_COPY[state.box.type];
  const shallowBox = isShallowBox(state.box.type);
  const twoPiece = state.box.type === "two-piece-gift-box-v1";
  const [favoriteSizes, setFavoriteSizes] = useState(() => {
    try {
      return parseFavoriteSizes(window.localStorage.getItem(FAVORITE_SIZES_STORAGE_KEY));
    } catch {
      return [];
    }
  });
  const [favoriteSizeName, setFavoriteSizeName] = useState("");
  const [favoriteSizeMessage, setFavoriteSizeMessage] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITE_SIZES_STORAGE_KEY, JSON.stringify(favoriteSizes));
    } catch {
      // 保存できない環境でも現在の画面内では利用できます。
    }
  }, [favoriteSizes]);

  const saveFavoriteSize = () => {
    const name = favoriteSizeName.trim();
    if (!name) {
      setFavoriteSizeMessage("寸法名を入力してください。");
      return;
    }
    setFavoriteSizes((sizes) => registerFavoriteSize(sizes, name, state.box, crypto.randomUUID()));
    setFavoriteSizeName("");
    setFavoriteSizeMessage(`「${name.slice(0, 40)}」を登録しました。`);
  };

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
            {SIZE_BOX_TYPES.map((type) => {
              const copy = BOX_TYPE_COPY[type];
              return (
              <button
                key={type}
                className={`box-type-button ${state.box.type === type ? "is-selected" : ""}`}
                type="button"
                aria-pressed={state.box.type === type}
                onClick={() => dispatch({ type: "set-box-type", boxType: type })}
              >
                <span aria-hidden="true"><BoxTypeIcon className="box-type-icon" type={type} /></span>
                <strong>{copy.name}</strong>
                <small>{copy.description}</small>
              </button>
              );
            })}
          </div>
          <div className="form-divider" />
          <div className="form-section-heading"><h3>仕上がり寸法</h3><p>{twoPiece ? "幅 W／奥行 D／高さ H を指定" : shallowBox ? "表面を W × H、箱の深さを D で指定" : "幅 W／奥行 D／高さ H を指定"}</p></div>
          <div className="dimension-grid">
            <NumberField label="幅" shortLabel="W" value={state.box.widthMm} min={10} max={400} onChange={(value) => dispatch({ type: "update-box", field: "widthMm", value })} />
            {twoPiece ? (
              <>
                <NumberField label="奥行" shortLabel="D" value={state.box.heightMm} min={10} max={500} onChange={(value) => dispatch({ type: "update-box", field: "heightMm", value })} />
                <NumberField label="高さ" shortLabel="H" value={state.box.depthMm} min={10} max={300} onChange={(value) => dispatch({ type: "update-box", field: "depthMm", value })} />
              </>
            ) : shallowBox ? (
              <>
                <NumberField label="高さ" shortLabel="H" value={state.box.heightMm} min={10} max={500} onChange={(value) => dispatch({ type: "update-box", field: "heightMm", value })} />
                <NumberField label="深さ" shortLabel="D" value={state.box.depthMm} min={twoPiece ? 10 : 5} max={300} onChange={(value) => dispatch({ type: "update-box", field: "depthMm", value })} />
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
            <NumberField label="紙の厚み" value={state.box.paperThicknessMm} min={0.1} max={2} step={0.01} onChange={(value) => dispatch({ type: "update-box", field: "paperThicknessMm", value })} hint={twoPiece ? "300gsm厚紙の試作目安：0.4mm（プリンター対応を確認）" : "コピー用紙の目安：0.09mm／厚紙：0.2〜0.4mm"} />
            <NumberField label="のりしろ幅" value={state.box.glueFlapMm} min={5} max={40} step={0.5} onChange={(value) => dispatch({ type: "update-box", field: "glueFlapMm", value })} hint={twoPiece ? "四隅に8〜10mm幅の強粘着両面テープを貼れる12mm推奨" : state.box.type === "gift-box-v1" ? "前後の壁と左右の壁を固定する幅" : "接着しやすい12〜15mmがおすすめ"} />
          </div>
          <div className="form-divider" />
          <section className="favorite-size-section" aria-labelledby="favorite-size-title">
            <div className="form-section-heading"><h3 id="favorite-size-title">お気に入り寸法</h3><p>現在の箱形式と寸法一式を、名前を付けて端末内へ登録</p></div>
            <div className="favorite-size-register">
              <label>寸法名<input type="text" maxLength={40} value={favoriteSizeName} placeholder="例：プレゼント用の箱" onChange={(event) => setFavoriteSizeName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveFavoriteSize(); }} /></label>
              <button type="button" onClick={saveFavoriteSize}>☆ 現在の寸法を登録</button>
            </div>
            {favoriteSizeMessage && <p className="favorite-size-message" role="status">{favoriteSizeMessage}</p>}
            {favoriteSizes.length > 0 ? (
              <div className="favorite-size-list">
                {favoriteSizes.map((favorite) => (
                  <article key={favorite.id}>
                    <button type="button" className="favorite-size-apply" onClick={() => { dispatch({ type: "replace-box", box: favorite.box }); setFavoriteSizeMessage(`「${favorite.name}」を呼び出しました。`); }}>
                      <strong>{favorite.name}</strong>
                      <small>{BOX_TYPE_COPY[favorite.box.type].name}／W {favorite.box.widthMm} × D {favorite.box.depthMm} × H {favorite.box.heightMm}mm</small>
                    </button>
                    <button type="button" className="favorite-size-delete" aria-label={`${favorite.name}を削除`} onClick={() => { setFavoriteSizes((sizes) => sizes.filter((item) => item.id !== favorite.id)); setFavoriteSizeMessage(`「${favorite.name}」を削除しました。`); }}>×</button>
                  </article>
                ))}
              </div>
            ) : <p className="favorite-size-empty">よく使う寸法を登録すると、次回からワンタップで呼び出せます。</p>}
          </section>
          {twoPiece && (
            <>
              <div className="form-divider" />
              <div className="form-section-heading"><h3>蓋の調整</h3><p>本体寸法は変えず、蓋だけの深さと嵌合余裕を調整</p></div>
              <div className="option-grid">
                <NumberField label="蓋の深さ" value={state.box.lidDepthMm ?? state.box.depthMm} min={10} max={state.box.depthMm} step={1} onChange={(value) => dispatch({ type: "update-box", field: "lidDepthMm", value })} hint="全かぶせは本体深さと同じ40mm。浅蓋にも変更できます" />
                <NumberField label="蓋の片側余裕" value={state.box.lidClearanceMm ?? 0.6} min={0.1} max={2} step={0.1} onChange={(value) => dispatch({ type: "update-box", field: "lidClearanceMm", value })} hint="試作初期値0.6mm。きつい時0.8mm、緩い時0.4mm" />
              </div>
              <div className="form-divider" />
              <div className="form-section-heading"><h3>二重側面</h3><p>側面上端を内側へ折り返す長さ</p></div>
              <div className="option-grid">
                <NumberField label="折り返し" value={state.box.foldoverMm ?? 25} min={5} max={40} step={1} onChange={(value) => dispatch({ type: "update-box", field: "foldoverMm", value })} hint="基準25mm。4cm側面の上側25mmが二重になります" />
              </div>
            </>
          )}
          <div className="measurement-note">
            <strong>{twoPiece ? "A4 2枚で組み立て" : shallowBox ? "1枚で組み立て" : "寸法の考え方"}</strong>
            <p>{twoPiece
              ? "1ページ目が蓋、2ページ目が本体です。両方の四隅を接着し、側面上端を内側へ折り返して切断面を隠します。蓋内寸には紙厚と片側余裕を加えています。"
              : state.box.type === "gift-box-v1"
                ? "底面・4側面・ヒンジフタはすべてつながっています。4つののりしろで浅いトレーを作り、左右フラップを内側へ折ってフタの舌を前面へ差し込みます。"
                : "紙厚は差し込み部の逃げに反映します。印刷後は実際の紙で一度試作してください。"}</p>
          </div>
        </section>

        <section className="panel-card size-preview-card">
          <div className="preview-card-head"><div><p className="eyebrow">LIVE PREVIEW</p><h2>A4配置プレビュー</h2></div><span>A4 {pages.length}枚</span></div>
          <div className={`size-page-preview-grid ${pages.length > 1 ? "is-multiple" : ""}`}>
            {pages.map((page) => {
              const design = pageDesign(state, page.id);
              return (
                <div className="size-page-preview-item" key={page.id}>
                  <strong>{page.label}</strong>
                  <div className="size-paper-stage">
                    <div className={`size-paper-preview ${page.fit.orientation} fit-${page.fit.status}`}>
                      <A4PreviewSvg
                        pageId={page.id}
                        geometry={page.geometry}
                        fit={page.fit}
                        {...design}
                        lineColors={state.lineColors}
                      />
                    </div>
                  </div>
                  <small>A4 {page.fit.orientation === "portrait" ? "縦" : "横"}／{mm(page.geometry.bounds.widthMm)} × {mm(page.geometry.bounds.heightMm)}</small>
                </div>
              );
            })}
          </div>
          <p className="size-paper-caption">A4用紙との比率で表示。画面表示のみ縮小し、PDFの展開図は100%実寸です。</p>
          <LineLegend geometry={activePage.geometry} lineColors={state.lineColors} />
          <div className="fit-notice-stack">{pages.map((page) => <FitNotice key={page.id} geometry={page.geometry} fit={page.fit} label={page.label} />)}</div>
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
  pages: DielinePageView[];
  activePage: DielinePageView;
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

function DesignScreen({ state, dispatch, pages, activePage }: ScreenProps) {
  const geometry = activePage.geometry;
  const fit = activePage.fit;
  const design = pageDesign(state, activePage.id);
  const template = templateById(state.templateId);
  const recommendedStampSets = stampSetsForTemplate(template);
  const recommendedKeys = new Set(recommendedStampSets.flatMap((set) => set.stampKeys));
  const otherStamps = BUILT_IN_STAMPS.filter((preset) => !recommendedKeys.has(preset.key));
  const pageArtworkLayers = design.artworkLayers;
  const pageStamps = design.stamps;
  const pageTexts = design.texts;
  const artworkFileInput = useRef<HTMLInputElement>(null);
  const stampFileInput = useRef<HTMLInputElement>(null);
  const [artworkUploadError, setArtworkUploadError] = useState("");
  const [stampUploadError, setStampUploadError] = useState("");
  const [uploadingArtwork, setUploadingArtwork] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const [backgroundCopyMessage, setBackgroundCopyMessage] = useState("");
  const [autoLayoutSettings, setAutoLayoutSettings] = useState<AutoLayoutSettings>(DEFAULT_AUTO_LAYOUT_SETTINGS);
  const [autoLayoutResult, setAutoLayoutResult] = useState<AutoLayoutResult | null>(null);
  const autoLayoutRun = useRef(0);
  const [favoriteColors, setFavoriteColors] = useState<string[]>(() => {
    try {
      return parseFavoriteColors(window.localStorage.getItem(FAVORITE_COLORS_STORAGE_KEY));
    } catch {
      return [];
    }
  });
  const selectedArtwork = pageArtworkLayers.find((item) => item.id === state.selectedArtworkId) ?? null;
  const selectedStamp = pageStamps.find((item) => item.id === state.selectedStampId) ?? null;
  const selectedText = pageTexts.find((item) => item.id === state.selectedTextId) ?? null;
  const autoLayoutDisabled = autoLayoutElementCount(design, autoLayoutSettings.target) === 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(FAVORITE_COLORS_STORAGE_KEY, JSON.stringify(favoriteColors));
    } catch {
      // 保存できない環境でも、現在の編集セッション内では利用できます。
    }
  }, [favoriteColors]);

  useEffect(() => {
    setAutoLayoutResult(null);
    autoLayoutRun.current = 0;
  }, [activePage.id]);

  const addFavorite = (color: string) => setFavoriteColors((colors) => addFavoriteColor(colors, color));
  const removeFavorite = (color: string) => setFavoriteColors((colors) => removeFavoriteColor(colors, color));

  const copyLidBackgroundToBase = () => {
    const copies = state.artworkLayers
      .filter((item) => item.pageId === "lid")
      .map((item) => ({ ...item, id: crypto.randomUUID(), pageId: "base" as const }));
    dispatch({ type: "replace-page-background", sourcePageId: "lid", targetPageId: "base", items: copies });
    setBackgroundCopyMessage(`本体へ背景色と背景・柄 ${copies.length}件をコピーしました。`);
  };

  const handleArtworkFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!files.length) return;
    setUploadingArtwork(true);
    setArtworkUploadError("");
    const errors: string[] = [];
    for (const file of files) {
      try {
        dispatch({ type: "add-artwork", item: createUploadedArtwork(await readPatternFile(file), geometry, activePage.id) });
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
        dispatch({ type: "add-stamp", item: createStamp(await readPatternFile(file), geometry, file.name, activePage.id) });
      } catch (error) {
        errors.push(`${file.name}: ${error instanceof Error ? error.message : "読み込めませんでした。"}`);
      }
    }
    setStampUploadError(errors.join("\n"));
    setUploadingStamp(false);
  };

  const addPresetStamp = async (preset: (typeof BUILT_IN_STAMPS)[number]) => {
    setUploadingStamp(true);
    setStampUploadError("");
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}assets/stamps/${preset.fileName}`);
      if (!response.ok) throw new Error("プリセット画像を読み込めませんでした。");
      const file = new File([await response.blob()], preset.fileName, { type: "image/png" });
      dispatch({ type: "add-stamp", item: createStamp(markAsBuiltInStamp(await readPatternFile(file), preset.key), geometry, preset.name, activePage.id) });
    } catch (error) {
      setStampUploadError(error instanceof Error ? error.message : "プリセット画像を読み込めませんでした。");
    } finally {
      setUploadingStamp(false);
    }
  };

  const addText = () => {
    const front = geometry.panels[0];
    const item: TextItem = createTextItem(crypto.randomUUID(), activePage.id, "ありがとう", front.x + front.width / 2, front.y + front.height / 2);
    dispatch({ type: "add-text", item });
  };

  const runAutoLayout = (again: boolean) => {
    const run = again ? autoLayoutRun.current + 1 : 0;
    autoLayoutRun.current = run;
    const result = arrangeDesign({
      geometry,
      design,
      settings: autoLayoutSettings,
      seed: JSON.stringify({
        pageId: activePage.id,
        ids: [...pageArtworkLayers, ...pageStamps, ...pageTexts].map((item) => item.id),
        settings: autoLayoutSettings,
        run,
      }),
      previousSignature: again ? autoLayoutResult?.signature : null,
    });
    const includesBackground = targetIncludesRole(autoLayoutSettings.target, "background");
    const includesStamps = targetIncludesRole(autoLayoutSettings.target, "stamp");
    const includesTexts = targetIncludesRole(autoLayoutSettings.target, "text") || targetIncludesRole(autoLayoutSettings.target, "logoText");
    dispatch({
      type: "apply-auto-layout",
      pageId: activePage.id,
      artworkLayers: includesBackground ? result.artworkLayers : undefined,
      stamps: includesStamps ? result.stamps : undefined,
      texts: includesTexts ? result.texts : undefined,
    });
    setAutoLayoutResult(result);
  };

  return (
    <main className="tool-page design-page">
      <div className="page-heading horizontal-heading">
        <div><button className="back-button" type="button" onClick={() => dispatch({ type: "go", screen: template ? "templates" : "size" })}>← {template ? "テンプレート一覧" : "サイズ設定"}</button><p className="eyebrow">STEP 2{template ? ` · ${template.seriesName}` : ""}</p><h1>{template ? `${template.categoryLabel}をデザイン` : "デザイン編集"}</h1></div>
        <FitNotice geometry={geometry} fit={fit} compact />
      </div>
      <PageTabs pages={pages} activePageId={activePage.id} dispatch={dispatch} />

      <div className={`editor-layout ${state.openEditorSection === "artwork" ? "is-background-editing" : ""}`}>
        <aside className="editor-controls panel-card">
          <AccordionSection section="auto-layout" openSection={state.openEditorSection} title="いい感じに配置" icon="✦" onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <AutoLayoutPanel
              settings={autoLayoutSettings}
              result={autoLayoutResult}
              disabled={autoLayoutDisabled}
              onSettingsChange={(settings) => {
                setAutoLayoutSettings(settings);
                setAutoLayoutResult(null);
                autoLayoutRun.current = 0;
              }}
              onArrange={() => runAutoLayout(false)}
              onArrangeAgain={() => runAutoLayout(true)}
            />
          </AccordionSection>
          <AccordionSection section="artwork" openSection={state.openEditorSection} title="背景・柄" icon="▧" count={pageArtworkLayers.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <DesignColorControl className="background-color-control" label="基本背景色" value={design.backgroundColor} favoriteColors={favoriteColors} onChange={(color) => dispatch({ type: "set-background-color", pageId: activePage.id, color })} onAddFavorite={addFavorite} onRemoveFavorite={removeFavorite} />
            {state.box.type === "two-piece-gift-box-v1" && activePage.id === "lid" && (
              <div className="background-copy-control">
                <button className="outline-button full-button" type="button" onClick={copyLidBackgroundToBase}>背景を本体にもコピー</button>
                <small>本体の背景色と背景・柄を置き換えます。スタンプと文字はコピーも削除もしません。</small>
                {backgroundCopyMessage && <p role="status">{backgroundCopyMessage}</p>}
              </div>
            )}
            <div className="preset-grid" aria-label="基本柄プリセット">
              <button type="button" onClick={() => dispatch({ type: "add-artwork", item: createStripePattern(crypto.randomUUID(), pageArtworkLayers.filter((item) => item.kind === "stripe-pattern").length + 1, activePage.id) })}><i className="stripe-preview" /><strong>ストライプ</strong><small>幅・間隔・向きを調整</small></button>
              <button type="button" onClick={() => dispatch({ type: "add-artwork", item: createDotPattern(crypto.randomUUID(), pageArtworkLayers.filter((item) => item.kind === "dot-pattern").length + 1, activePage.id) })}><i className="dot-preview" /><strong>水玉</strong><small>色・大きさ・間隔を調整</small></button>
            </div>
            <input ref={artworkFileInput} type="file" accept="image/png,image/svg+xml,.png,.svg" multiple hidden onChange={handleArtworkFiles} />
            <button className="upload-button compact-upload" type="button" disabled={uploadingArtwork} onClick={() => artworkFileInput.current?.click()}><span>↑</span>{uploadingArtwork ? "読み込み中…" : "自分の画像を追加"}</button>
            {artworkUploadError && <p className="field-error preserve-lines">{artworkUploadError}</p>}

            {pageArtworkLayers.length > 0 && (
              <div className="layer-list" aria-label="背景・柄レイヤー">
                {pageArtworkLayers.map((item) => (
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
                    <FineTuneControl label="画像の幅" value={selectedArtwork.widthMm} min={2} max={200} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { widthMm: value } })} />
                    <label className="toggle-row"><span><strong>リピート</strong><small>画像を繰り返して全面へ配置</small></span><input type="checkbox" checked={selectedArtwork.repeat} onChange={(event) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { repeat: event.target.checked } })} /></label>
                    <button className="rotate-button" type="button" onClick={() => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { rotationDeg: rotateQuarterTurn(selectedArtwork.rotationDeg) } })}>↻ 90°回転 <span>{selectedArtwork.rotationDeg}°</span></button>
                  </>
                )}
                <div className="background-position-controls">
                  <FineTuneControl label="横位置 X" value={roundMm(selectedArtwork.offsetXmm, 1)} min={-geometry.bounds.widthMm} max={geometry.bounds.widthMm} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { offsetXmm: value } })} />
                  <FineTuneControl label="縦位置 Y" value={roundMm(selectedArtwork.offsetYmm, 1)} min={-geometry.bounds.heightMm} max={geometry.bounds.heightMm} onChange={(value) => dispatch({ type: "update-artwork", id: selectedArtwork.id, patch: { offsetYmm: value } })} />
                </div>
                <div className="layer-action-row"><button type="button" onClick={() => dispatch({ type: "move-artwork", id: selectedArtwork.id, direction: "backward" })}>← 背面</button><button type="button" onClick={() => dispatch({ type: "move-artwork", id: selectedArtwork.id, direction: "forward" })}>前面 →</button><button type="button" onClick={() => dispatch({ type: "duplicate-artwork", id: selectedArtwork.id, newId: crypto.randomUUID() })}>複製</button><button className="danger" type="button" onClick={() => dispatch({ type: "remove-artwork", id: selectedArtwork.id })}>削除</button></div>
              </div>
            )}
          </AccordionSection>

          <AccordionSection section="stamps" openSection={state.openEditorSection} title="スタンプ" icon="★" count={pageStamps.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            {recommendedStampSets.map((set) => (
              <div className="recommended-stamp-set" key={set.id}>
                <div className="recommended-stamp-heading"><span>おすすめ素材</span><strong>{set.name}</strong><small>{set.description}</small></div>
                <div className="stamp-preset-grid">
                  {set.stampKeys.map((key) => {
                    const preset = BUILT_IN_STAMPS.find((item) => item.key === key);
                    if (!preset) return null;
                    return <button key={preset.key} className="stamp-preset-card is-recommended" type="button" disabled={uploadingStamp} onClick={() => { void addPresetStamp(preset); }}><img src={`${import.meta.env.BASE_URL}assets/stamps/${preset.fileName}`} alt={preset.name} /><span><strong>{preset.name}</strong><small>自由に動かして使えます</small></span><b>＋</b></button>;
                  })}
                </div>
              </div>
            ))}
            {recommendedStampSets.length > 0 && <p className="other-stamps-heading">ほかのスタンプ</p>}
            <div className="stamp-preset-grid">
              {otherStamps.map((preset) => (
                <button key={preset.key} className="stamp-preset-card" type="button" disabled={uploadingStamp} onClick={() => { void addPresetStamp(preset); }}>
                  <img src={`${import.meta.env.BASE_URL}assets/stamps/${preset.fileName}`} alt={preset.name} />
                  <span><strong>{preset.name}</strong><small>プリセットを追加</small></span><b>＋</b>
                </button>
              ))}
            </div>
            <input ref={stampFileInput} type="file" accept="image/png,image/svg+xml,.png,.svg" multiple hidden onChange={handleStampFiles} />
            <button className="upload-button compact-upload" type="button" disabled={uploadingStamp} onClick={() => stampFileInput.current?.click()}><span>↑</span>{uploadingStamp ? "読み込み中…" : "自分のスタンプを追加"}</button>
            {stampUploadError && <p className="field-error preserve-lines">{stampUploadError}</p>}
            {pageStamps.length > 0 && <div className="layer-list" aria-label="スタンプレイヤー">{pageStamps.map((item) => <div key={item.id} className={`layer-row ${state.selectedStampId === item.id ? "is-selected" : ""}`}><button className="layer-select" type="button" onClick={() => dispatch({ type: "select-stamp", id: item.id })}><span>STAMP</span><b>{item.name}</b></button><button className="visibility-button" type="button" aria-label={`${item.name}を${item.visible ? "非表示" : "表示"}`} onClick={() => dispatch({ type: "update-stamp", id: item.id, patch: { visible: !item.visible } })}>{item.visible ? "●" : "○"}</button></div>)}</div>}
            {selectedStamp && (
              <div className="selected-layer-controls">
                <strong className="selected-layer-title">{selectedStamp.name}</strong>
                <label className="range-control"><span>スタンプの幅 <output>{mm(selectedStamp.widthMm)}</output></span><input type="range" min="2" max="200" step="1" value={selectedStamp.widthMm} onChange={(event) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { widthMm: Number(event.target.value) } })} /></label>
                <label className="range-control"><span>透明度 <output>{Math.round(selectedStamp.opacity * 100)}%</output></span><input type="range" min="0.1" max="1" step="0.05" value={selectedStamp.opacity} onChange={(event) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { opacity: Number(event.target.value) } })} /></label>
                <button className="rotate-button" type="button" onClick={() => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { rotationDeg: rotateByDegrees(selectedStamp.rotationDeg) } })}>↻ 90°回転 <span>{Math.round(selectedStamp.rotationDeg)}°</span></button>
                <div className="mini-number-grid"><NumberField label="横位置 X" value={roundMm(selectedStamp.xMm, 1)} min={0} max={geometry.bounds.widthMm} step={1} onChange={(value) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { xMm: value } })} /><NumberField label="縦位置 Y" value={roundMm(selectedStamp.yMm, 1)} min={0} max={geometry.bounds.heightMm} step={1} onChange={(value) => dispatch({ type: "update-stamp", id: selectedStamp.id, patch: { yMm: value } })} /></div>
                <p className="drag-hint">プレビュー上でも移動できます。</p>
                <div className="layer-action-row"><button type="button" onClick={() => dispatch({ type: "move-stamp", id: selectedStamp.id, direction: "backward" })}>← 背面</button><button type="button" onClick={() => dispatch({ type: "move-stamp", id: selectedStamp.id, direction: "forward" })}>前面 →</button><button type="button" onClick={() => dispatch({ type: "duplicate-stamp", id: selectedStamp.id, newId: crypto.randomUUID() })}>複製</button><button className="danger" type="button" onClick={() => dispatch({ type: "remove-stamp", id: selectedStamp.id })}>削除</button></div>
              </div>
            )}
          </AccordionSection>

          <AccordionSection section="text" openSection={state.openEditorSection} title="テキスト" icon="T" count={pageTexts.length} onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <button className="outline-button full-button" type="button" onClick={addText}>＋ テキストを追加</button>
            {pageTexts.length > 0 && (
              <div className="text-list">
                {pageTexts.map((item) => <button key={item.id} className={state.selectedTextId === item.id ? "is-selected" : ""} type="button" onClick={() => dispatch({ type: "select-text", id: item.id })}>{item.text || "（空のテキスト）"}</button>)}
              </div>
            )}
            {selectedText && (
              <div className="selected-text-controls">
                <label className="text-input-label">文字<textarea rows={2} maxLength={80} value={selectedText.text} onChange={(event) => dispatch({ type: "update-text", id: selectedText.id, patch: { text: event.target.value } })} /></label>
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
            {state.box.type === "letter-paper-v1" && <label className="toggle-row"><span><strong>便箋の罫線</strong><small>印刷される横罫線をON/OFF</small></span><input type="checkbox" checked={state.showWritingLines} onChange={(event) => dispatch({ type: "set-writing-lines", value: event.target.checked })} /></label>}
            <label className="toggle-row"><span><strong>ガイド表示</strong><small>面名と中心線。PDFには印刷しません</small></span><input type="checkbox" checked={state.showGuides} onChange={() => dispatch({ type: "toggle-guides" })} /></label>
          </AccordionSection>

          <AccordionSection section="lines" openSection={state.openEditorSection} title="線の色" icon="／" onOpen={(section) => dispatch({ type: "set-open-editor-section", section })}>
            <p className="control-help">カット線（実線）と通常の折り線（点線）は、画面とPDFに同じ色で反映されます。折り返し補助線は印刷画面でPDFだけ非表示にできます。</p>
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
              {...design}
              lineColors={state.lineColors}
              showGuides={state.showGuides}
              selectedArtworkId={state.selectedArtworkId}
              selectedStampId={state.selectedStampId}
              selectedTextId={state.selectedTextId}
              exportMode={false}
              showWritingLines={state.showWritingLines}
              onSelectArtwork={(id) => { dispatch({ type: "select-artwork", id }); if (id) dispatch({ type: "set-open-editor-section", section: "artwork" }); }}
              onMoveArtwork={(id, xMm, yMm) => dispatch({ type: "update-artwork", id, patch: { offsetXmm: xMm, offsetYmm: yMm } })}
              onSelectStamp={(id) => { dispatch({ type: "select-stamp", id }); if (id) dispatch({ type: "set-open-editor-section", section: "stamps" }); }}
              onMoveStamp={(id, xMm, yMm) => dispatch({ type: "update-stamp", id, patch: { xMm, yMm } })}
              onRotateStamp={(id) => {
                const stamp = pageStamps.find((item) => item.id === id);
                if (stamp) dispatch({ type: "update-stamp", id, patch: { rotationDeg: rotateByDegrees(stamp.rotationDeg) } });
              }}
              onSelectText={(id) => { dispatch({ type: "select-text", id }); if (id) dispatch({ type: "set-open-editor-section", section: "text" }); }}
              onMoveText={(id, xMm, yMm) => dispatch({ type: "update-text", id, patch: { xMm, yMm } })}
            />
          </div>
          <p className="canvas-caption">画面では見やすい大きさに拡大表示しています。印刷寸法は下のmm値とPDFの実寸座標が基準です。</p>
        </section>
      </div>

      <div className="sticky-actions">
        <button className="secondary-button" type="button" onClick={() => dispatch({ type: "go", screen: template ? "templates" : "size" })}>{template ? "型を選び直す" : "サイズに戻る"}</button>
        <button className="primary-button" type="button" onClick={() => dispatch({ type: "go", screen: "print" })}>PDFを確認 <span>▣</span></button>
      </div>
    </main>
  );
}

function PrintScreen({ state, dispatch, pages, activePage, clientContext, onSuccessfulExport }: ScreenProps & { clientContext: ClientContext; onSuccessfulExport: () => void }) {
  const dielineSvgs = useRef<Record<string, SVGSVGElement | null>>({});
  const calibrationSvg = useRef<SVGSVGElement>(null);
  const printablePdfUrl = useRef<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSuccess, setExportSuccess] = useState("");
  const [printablePdf, setPrintablePdf] = useState<{ url: string; file: File; fileName: string; canShare: boolean } | null>(null);
  const hasOverflow = pages.some((page) => page.fit.status === "overflow");
  const calibrationPageNumber = pages.length + 1;
  const twoPiece = state.box.type === "two-piece-gift-box-v1";
  const hasFoldoverLines = pages.some((page) => page.geometry.layers.foldover.length > 0);
  const imposition = printImposition(activePage.geometry);

  const clearPrintablePdf = useCallback(() => {
    if (printablePdfUrl.current) URL.revokeObjectURL(printablePdfUrl.current);
    printablePdfUrl.current = null;
    setPrintablePdf(null);
  }, []);

  useEffect(() => () => {
    if (printablePdfUrl.current) URL.revokeObjectURL(printablePdfUrl.current);
  }, []);

  useEffect(() => {
    clearPrintablePdf();
    setExportSuccess("");
  }, [clearPrintablePdf, state.includeCalibrationPage, state.printFoldoverLines, state.showWritingLines]);

  const handleExport = async () => {
    const exportPages = pages.flatMap((page) => {
      const svg = dielineSvgs.current[page.id];
      return svg ? [{ svg, fit: page.fit }] : [];
    });
    if (exportPages.length !== pages.length) return;
    setExporting(true);
    setExportError("");
    setExportSuccess("");
    clearPrintablePdf();
    try {
      // jsPDF / svg2pdf / opentype はPDF作成時だけ必要なので、編集画面の
      // 初回読み込みには含めない。
      const { exportA4Pdf } = await import("../lib/pdf/export-a4-pdf");
      const fileName = createTimestampedPdfFileName(`usapon-${state.box.type}-${state.box.widthMm}x${state.box.heightMm}x${state.box.depthMm}mm.pdf`);
      const result = await exportA4Pdf({
        pages: exportPages,
        calibrationSvg: state.includeCalibrationPage ? calibrationSvg.current : null,
      });
      const url = URL.createObjectURL(result.blob);
      const file = createPdfShareFile(result.blob, fileName);
      printablePdfUrl.current = url;
      setPrintablePdf({ url, file, fileName, canShare: canSharePdfFile(file) });
      setExportSuccess(`PDFを作成しました（${result.pageCount}ページ／${Math.max(1, Math.round(result.byteLength / 1024))}KB）。下のボタンから共有・印刷または保存へ進んでください。`);
      onSuccessfulExport();
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "PDFを作成できませんでした。");
    } finally {
      setExporting(false);
    }
  };

  const handleShare = async () => {
    if (!printablePdf) return;
    setExportError("");
    try {
      await sharePdfFile(printablePdf.file);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setExportError(error instanceof Error ? error.message : "共有画面を開けませんでした。下のダウンロードをお試しください。");
    }
  };

  return (
    <main className="tool-page print-page">
      <div className="page-heading horizontal-heading">
        <div><button className="back-button" type="button" onClick={() => dispatch({ type: "go", screen: "design" })}>← デザイン編集</button><p className="eyebrow">STEP 3</p><h1>PDFレビュー</h1><p>下のレビューが保存されるPDFと同じ内容です。確認後、その下の設定から共有・印刷またはダウンロードできます。</p></div>
        <FitNotice geometry={activePage.geometry} fit={activePage.fit} compact />
      </div>

      <div className="print-layout">
        <div className={`print-page-grid ${pages.length > 1 ? "is-multiple" : ""}`}>
          {pages.map((page) => {
            const design = pageDesign(state, page.id);
            return (
              <section className={`paper-preview-wrap ${page.fit.orientation}`} key={page.id}>
                <div className="paper-label">{page.label}／A4 {page.fit.orientation === "portrait" ? "縦 210 × 297mm" : "横 297 × 210mm"}</div>
                <div className="paper-preview">
                  <A4ExportSvg
                    ref={(element) => { dielineSvgs.current[page.id] = element; }}
                    pageId={page.id}
                    geometry={page.geometry}
                    fit={page.fit}
                    {...design}
                    lineColors={state.lineColors}
                    includeFoldoverLines={state.printFoldoverLines}
                    showWritingLines={state.showWritingLines}
                  />
                </div>
              </section>
            );
          })}
        </div>

        <aside className="print-settings panel-card">
          <p className="eyebrow">PRINT SETTINGS</p>
          <h2>PDF出力設定</h2>
          <div className="fit-notice-stack">{pages.map((page) => <FitNotice key={page.id} geometry={page.geometry} fit={page.fit} label={page.label} />)}</div>
          {imposition.count > 1 && <div className="template-imposition-note"><strong>A4に{imposition.count}枚を自動配置</strong><span>{imposition.columns}列 × {imposition.rows}段。編集した同じカードを実寸でまとめて印刷します。</span></div>}
          <div className="print-instruction">
            <span aria-hidden="true">!</span>
            <div><strong>印刷設定が重要です</strong><p>プリンター設定で<strong>「100%／実際のサイズ」</strong>を選び、<strong>「用紙に合わせる」をOFF</strong>にしてください。</p></div>
          </div>
          <label className="toggle-row calibration-toggle"><span><strong>50mm検寸ページを追加</strong><small>PDFの{calibrationPageNumber}ページ目で印刷倍率を確認できます</small></span><input type="checkbox" checked={state.includeCalibrationPage} onChange={(event) => dispatch({ type: "set-calibration", value: event.target.checked })} /></label>
          {hasFoldoverLines && (
            <label className="toggle-row print-line-toggle"><span><strong>折り返し線を印刷する</strong><small>側面上端{mm(state.box.foldoverMm ?? 25)}の補助点線だけをPDFレビューと保存PDFで切り替えます</small></span><input type="checkbox" checked={state.printFoldoverLines} onChange={(event) => dispatch({ type: "set-print-foldover-lines", value: event.target.checked })} /></label>
          )}
          <div className="guide-print-status"><span aria-hidden="true">✓</span><div><strong>面名・中心ガイドは印刷しません</strong><small>編集画面のガイド表示とは別管理です。カット線と通常の折り線は常に残ります。</small></div></div>
          <div className="calibration-explanation"><b>実寸の確認方法</b><ol><li>{calibrationPageNumber}ページ目も同じ設定で印刷</li><li>検寸線を定規で測る</li><li>ちょうど50mmなら正しい倍率です</li></ol></div>
          {twoPiece && (
            <div className="two-piece-shipping-guide">
              <h3>組み立て・茶封筒配送ガイド</h3>
              <ol>
                <li>切る前に全折り線へ筋入れし、蓋と本体の四隅を強粘着両面テープで固定</li>
                <li>4側面の上端を補助点線で内側へ折り返し、上側{mm(state.box.foldoverMm ?? 25)}を二重にする</li>
                <li>商品を薄紙で動かないようにし、蓋を対向する2か所の剥がせるシールで固定</li>
                <li>箱を厚さ約3mmの気泡緩衝材で一周包む</li>
                <li>内寸160×120mm以上・マチ約50mmのクラフト封筒へ入れ、封入口を梱包テープで補強</li>
              </ol>
              <p>軽く壊れにくい内容物向けです。水濡れ対策が必要な場合は、箱を透明袋へ入れてから包んでください。</p>
            </div>
          )}
          {exportError && <p className="export-error">{exportError}</p>}
          {exportSuccess && <p className="export-success" role="status">{exportSuccess}</p>}
          <div className="pdf-action-stack">
            <button className="pdf-button" type="button" disabled={hasOverflow || exporting} onClick={handleExport}>
              <span aria-hidden="true">▣</span>{exporting ? "PDFを作成中…" : printablePdf ? "PDFを作り直す" : "PDFを作成"}
            </button>
            {printablePdf?.canShare && <button className="pdf-button share-pdf-button" type="button" onClick={() => { void handleShare(); }}><span aria-hidden="true">↗</span>{clientContext.isIPhone ? "iPhoneの共有画面を開く" : clientContext.isAndroid ? "印刷アプリで開く" : "共有・印刷"}</button>}
            {clientContext.isAndroid && printablePdf?.canShare && <small className="android-share-fallback">印刷画面が真っ白になる場合は、PDFを保存してから、印刷アプリの「文書印刷」で開いてください。</small>}
            {printablePdf && <button className="outline-button download-pdf-button" type="button" onClick={() => { downloadPdfBlob(printablePdf.file, printablePdf.fileName); setExportSuccess(`${printablePdf.fileName} を保存しました。エプソン印刷アプリでは、この新しいファイル名のPDFを選んでください。`); }}><span aria-hidden="true">⇩</span>{clientContext.isAndroid ? "新しいPDFを保存（確実）" : "PDFをダウンロード"}</button>}
            {printablePdf && !clientContext.isAndroid && <a className="outline-button print-pdf-button" href={printablePdf.url} target="_blank" rel="noopener noreferrer" onClick={() => setExportSuccess(`${printablePdf.fileName} を開きます。PDF画面の印刷ボタン、または共有メニューの「プリント」へ進んでください。`)}><span aria-hidden="true">▣</span>PDFを開いて印刷</a>}
            {clientContext.isIPhone && (
              <div className="iphone-print-guide">
                <strong>iPhoneで印刷する手順</strong>
                <ol>
                  <li>「PDFを作成」を押す</li>
                  <li>表示された「iPhoneの共有画面を開く」を押す</li>
                  <li>共有画面を下へスクロールし「プリント」を選ぶ</li>
                </ol>
                <small>保存する場合は、共有画面の「“ファイル”に保存」を選んでください。</small>
              </div>
            )}
            {!clientContext.isIPhone && !clientContext.isAndroid && printablePdf?.canShare && <small className="pdf-share-help">共有画面が開いたら「プリント」または「“ファイル”に保存」を選んでください。</small>}
          </div>
          <p className="privacy-copy">PDFはこの端末内で作成します。作品をクラウド保存した場合だけ、作品JSONと追加画像を非公開のSupabaseへ送信します。</p>
          {hasOverflow && <p className="blocked-copy">蓋または本体がA4に収まらないため出力を停止しています。サイズ設定へ戻って寸法を小さくしてください。</p>}
        </aside>
      </div>

      <div className="hidden-export-svg" aria-hidden="true"><CalibrationSvg ref={calibrationSvg} /></div>
      <div className="sticky-actions"><button className="secondary-button" type="button" onClick={() => dispatch({ type: "go", screen: "design" })}>デザインに戻る</button><button className="outline-button" type="button" onClick={() => dispatch({ type: "go", screen: "size" })}>寸法を変更</button></div>
    </main>
  );
}

function SaveNameDialog({ initialName, onCancel, onSave }: { initialName: string; onCancel: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onCancel(); }}>
      <section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="save-name-title">
        <p className="eyebrow">CLOUD SAVE</p>
        <h2 id="save-name-title">作品名を付けて保存</h2>
        <p>マイボックスで見つけやすい名前を入力してください。</p>
        <label>作品名<input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && name.trim()) onSave(name.trim()); }} /></label>
        <small>{name.length} / 80文字</small>
        <div className="modal-actions"><button type="button" onClick={onCancel}>キャンセル</button><button className="primary-button" type="button" disabled={!name.trim()} onClick={() => onSave(name.trim())}>保存する</button></div>
      </section>
    </div>
  );
}

function ConflictDialog({ onLoadLatest, onSaveCopy, onCancel }: { onLoadLatest: () => void; onSaveCopy: () => void; onCancel: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="app-modal" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
        <p className="eyebrow">NEWER VERSION FOUND</p>
        <h2 id="conflict-title">別の端末で更新されています</h2>
        <p>クラウドの最新版を開くか、今の編集内容を別作品として残してください。無言で上書きはしません。</p>
        <div className="modal-actions stacked"><button type="button" onClick={onLoadLatest}>クラウドの最新版を開く</button><button className="primary-button" type="button" onClick={onSaveCopy}>今の内容を別作品として保存</button><button type="button" onClick={onCancel}>編集に戻る</button></div>
      </section>
    </div>
  );
}

function cloudErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes("PROJECT_LIMIT_REACHED")) return "保存できる作品は20件までです。不要な作品を削除してください。";
    if (error.message.includes("STORAGE_LIMIT_REACHED")) return "クラウド画像が100MBに達しました。不要な作品を削除してください。";
    return error.message;
  }
  return "クラウド操作を完了できませんでした。";
}

export function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [user, setUser] = useState<User | null>(null);
  const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [hasRestoredLocalDraft, setHasRestoredLocalDraft] = useState(false);
  const [shouldPersistLocalDraft, setShouldPersistLocalDraft] = useState(false);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const clientContext = useMemo(() => detectClientContext(), []);
  const installContext = useMemo(() => detectInstallContext(), []);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);
  const [installGuideHidden, setInstallGuideHidden] = useState(() => {
    try { return window.localStorage.getItem(INSTALL_GUIDE_HIDDEN_KEY) === "1"; } catch { return false; }
  });
  const installOfferShown = useRef(false);
  const pendingSaveHandled = useRef(false);
  const oauthRedirecting = useRef(false);
  const lastSavedSignature = useRef(JSON.stringify(serializeBoxDocument(initialState)));
  const documentSignature = useMemo(() => JSON.stringify(serializeBoxDocument(state)), [state]);
  const document = useMemo(() => generateDielineDocument(state.box), [state.box]);
  const pages = useMemo<DielinePageView[]>(() => document.pages.map((page) => {
    const imposition = printImposition(page.geometry);
    return { ...page, fit: evaluateA4Fit(imposition.widthMm, imposition.heightMm) };
  }), [document]);
  const activePage = pages.find((page) => page.id === state.activePageId) ?? pages[0];

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("install") === "1" && !installContext.isStandalone) {
      setInstallGuideOpen(true);
    }
  }, [installContext.isStandalone]);

  useEffect(() => {
    let mounted = true;
    if (CLOUD_SYNC_UI_ENABLED && isCloudConfigured) {
      void currentUser().then((nextUser) => { if (mounted) setUser(nextUser); }).catch(() => undefined);
    }
    const authSubscription = CLOUD_SYNC_UI_ENABLED ? supabase?.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    }).data.subscription : undefined;
    void loadLocalDraft()
      .then((draft) => {
        if (!mounted || !draft) return;
        dispatch({ type: "replace-state", state: {
          ...draft.state,
          screen: !CLOUD_SYNC_UI_ENABLED && draft.state.screen === "my-boxes" ? "home" : draft.state.screen,
        } });
        setWorkspace(draft.workspace);
        setShouldPersistLocalDraft(true);
        const hasEditedDocument = JSON.stringify(serializeBoxDocument(draft.state)) !== JSON.stringify(serializeBoxDocument(initialState));
        lastSavedSignature.current = hasEditedDocument ? "" : JSON.stringify(serializeBoxDocument(initialState));
        setHasRestoredLocalDraft(hasEditedDocument);
        setSaveState(hasEditedDocument ? "dirty" : "idle");
        setSaveMessage(hasEditedDocument ? "端末内の前回作業を復元しました" : "");
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setDraftReady(true); });
    return () => {
      mounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!draftReady || saveState === "saving" || saveState === "conflict") return;
    if (documentSignature !== lastSavedSignature.current && saveState !== "dirty") {
      setSaveState("dirty");
      setSaveMessage("未保存の変更があります");
    }
  }, [documentSignature, draftReady, saveState]);

  useEffect(() => {
    if (!draftReady || !shouldPersistLocalDraft) return;
    const timer = window.setTimeout(() => { void saveLocalDraft(state, workspace).catch(() => undefined); }, 400);
    return () => window.clearTimeout(timer);
  }, [state, workspace, draftReady]);

  useEffect(() => {
    if (!CLOUD_SYNC_UI_ENABLED) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (oauthRedirecting.current) return;
      if (saveState === "dirty" || saveState === "error" || saveState === "conflict") event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

  const confirmDiscard = useCallback(() => {
    if (saveState !== "dirty" && saveState !== "error" && saveState !== "conflict") return true;
    if (!CLOUD_SYNC_UI_ENABLED) return window.confirm("現在の端末内作業は、新しい作品で上書きされます。移動しますか？");
    return window.confirm("クラウドへ保存していない変更があります。今の編集内容から移動しますか？\n端末内の下書きは残ります。");
  }, [saveState]);

  const login = useCallback(async () => {
    try {
      if (!isCloudConfigured) throw new Error("クラウド接続がまだ設定されていません。");
      await saveLocalDraft(state, workspace);
      oauthRedirecting.current = true;
      await signInWithGoogle();
    } catch (error) {
      oauthRedirecting.current = false;
      setSaveState("error");
      setSaveMessage(cloudErrorMessage(error));
    }
  }, [state, workspace]);

  const commitSave = useCallback(async (name: string, target: ProjectWorkspace | null = workspace) => {
    setSaveState("saving");
    setSaveMessage("クラウドへ保存しています…");
    try {
      const saved = await saveCloudProject(state, name, target);
      setWorkspace(saved);
      lastSavedSignature.current = JSON.stringify(serializeBoxDocument(state));
      setSaveState("saved");
      setSaveMessage(`保存済み ${new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date())}`);
      await saveLocalDraft(state, saved);
      if (!installOfferShown.current && canOfferInstallGuide(installContext, installGuideHidden)) {
        installOfferShown.current = true;
        setInstallGuideOpen(true);
      }
    } catch (error) {
      if (error instanceof ProjectConflictError) {
        setSaveState("conflict");
        setSaveMessage("別の端末に新しい更新があります");
      } else {
        setSaveState("error");
        setSaveMessage(cloudErrorMessage(error));
      }
    }
  }, [state, workspace, installContext, installGuideHidden]);

  const offerInstallAfterSuccess = useCallback(() => {
    if (installOfferShown.current || !canOfferInstallGuide(installContext, installGuideHidden)) return;
    installOfferShown.current = true;
    setInstallGuideOpen(true);
  }, [installContext, installGuideHidden]);

  const hideInstallGuide = useCallback(() => {
    try { window.localStorage.setItem(INSTALL_GUIDE_HIDDEN_KEY, "1"); } catch { /* 現在の表示だけ閉じる */ }
    setInstallGuideHidden(true);
    setInstallGuideOpen(false);
  }, []);

  const save = useCallback(async () => {
    if (!isCloudConfigured) {
      setSaveState("error");
      setSaveMessage("クラウド接続がまだ設定されていません");
      return;
    }
    if (!user) {
      window.sessionStorage.setItem("usapon-package-maker.pending-save", "1");
      await login();
      return;
    }
    if (!workspace) {
      setNameDialogOpen(true);
      return;
    }
    await commitSave(workspace.name);
  }, [commitSave, login, user, workspace]);

  useEffect(() => {
    if (!user || !draftReady || pendingSaveHandled.current || window.sessionStorage.getItem("usapon-package-maker.pending-save") !== "1") return;
    pendingSaveHandled.current = true;
    window.sessionStorage.removeItem("usapon-package-maker.pending-save");
    void save();
  }, [user, draftReady, save]);

  const openProject = useCallback(async (project: ProjectWorkspace, skipDiscardConfirmation = false) => {
    if (!skipDiscardConfirmation && !confirmDiscard()) return;
    setSaveMessage("クラウド作品を読み込んでいます…");
    try {
      const loaded = await openCloudProject(project.id);
      dispatch({ type: "replace-state", state: loaded.state });
      setHasRestoredLocalDraft(false);
      setShouldPersistLocalDraft(true);
      const nextWorkspace = { id: loaded.project.id, name: loaded.project.name, revision: loaded.project.revision, updatedAt: loaded.project.updatedAt };
      setWorkspace(nextWorkspace);
      lastSavedSignature.current = JSON.stringify(serializeBoxDocument(loaded.state));
      setSaveState("saved");
      setSaveMessage(`「${loaded.project.name}」を開きました`);
      await saveLocalDraft(loaded.state, nextWorkspace);
    } catch (error) {
      setSaveState("error");
      setSaveMessage(cloudErrorMessage(error));
    }
  }, [confirmDiscard]);

  const startNew = useCallback(() => {
    if (!confirmDiscard()) return;
    const next = { ...initialState, screen: "size" as const };
    dispatch({ type: "replace-state", state: next });
    setHasRestoredLocalDraft(false);
    setShouldPersistLocalDraft(true);
    setWorkspace(null);
    lastSavedSignature.current = "";
    setSaveState("dirty");
    setSaveMessage("新しい作品（未保存）");
  }, [confirmDiscard]);

  const startTemplate = useCallback((template: PackageTemplate) => {
    if (!confirmDiscard()) return;
    const next: AppState = {
      ...initialState,
      screen: "design",
      box: { ...template.box },
      templateId: template.id,
      showWritingLines: template.writingLines,
      openEditorSection: "stamps",
      includeCalibrationPage: false,
    };
    dispatch({ type: "replace-state", state: next });
    setHasRestoredLocalDraft(false);
    setShouldPersistLocalDraft(true);
    setWorkspace(null);
    lastSavedSignature.current = "";
    setSaveState("dirty");
    setSaveMessage(`${template.name}（未保存）`);
  }, [confirmDiscard]);

  const logout = useCallback(async () => {
    if (!confirmDiscard()) return;
    try {
      await signOutLocally();
      await clearLocalDraft();
      dispatch({ type: "replace-state", state: initialState });
      setWorkspace(null);
      lastSavedSignature.current = JSON.stringify(serializeBoxDocument(initialState));
      setSaveState("idle");
      setSaveMessage("この端末からログアウトしました");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(cloudErrorMessage(error));
    }
  }, [confirmDiscard]);

  const deleteAccount = useCallback(async () => {
    const confirmation = window.prompt("作品・画像・ログイン情報をすべて完全に削除します。続ける場合は「削除」と入力してください。");
    if (confirmation !== "削除") return;
    if (!window.confirm("本当に全データを削除しますか？この操作は取り消せません。")) return;
    setSaveMessage("アカウントデータを削除しています…");
    try {
      await deleteCloudAccount();
      await clearLocalDraft();
      dispatch({ type: "replace-state", state: initialState });
      setUser(null);
      setWorkspace(null);
      setSaveState("idle");
      setSaveMessage("アカウントとクラウドデータを削除しました");
    } catch (error) {
      setSaveState("error");
      setSaveMessage(cloudErrorMessage(error));
    }
  }, []);

  return (
    <div className="app-shell">
      <AppHeader
        screen={state.screen}
        templateId={state.templateId}
        user={user}
        saveState={saveState}
        saveMessage={saveMessage}
        onGo={(screen) => dispatch({ type: "go", screen })}
        onSave={() => { void save(); }}
        onLogin={() => { void login(); }}
        onLogout={() => { void logout(); }}
        onDeleteAccount={() => { void deleteAccount(); }}
      />
      {clientContext.isInstagramInAppBrowser && <InstagramBrowserNotice hasBrowserOnlyWork={saveState === "dirty" || saveState === "error" || saveState === "conflict"} onOpenGuide={() => setInstallGuideOpen(true)} />}
      {state.screen === "home" && <HomeScreen onStart={startNew} onTemplates={() => dispatch({ type: "go", screen: "templates" })} onResume={hasRestoredLocalDraft ? () => dispatch({ type: "go", screen: "design" }) : null} onMyBoxes={() => dispatch({ type: "go", screen: "my-boxes" })} />}
      {state.screen === "templates" && <TemplateScreen onBack={() => dispatch({ type: "go", screen: "home" })} onSelect={startTemplate} />}
      {state.screen === "size" && <SizeScreen state={state} dispatch={dispatch} pages={pages} activePage={activePage} />}
      {state.screen === "design" && <DesignScreen state={state} dispatch={dispatch} pages={pages} activePage={activePage} />}
      {state.screen === "print" && <PrintScreen state={state} dispatch={dispatch} pages={pages} activePage={activePage} clientContext={clientContext} onSuccessfulExport={offerInstallAfterSuccess} />}
      {CLOUD_SYNC_UI_ENABLED && state.screen === "my-boxes" && (
        <MyBoxesScreen
          user={user}
          onLogin={() => { void login(); }}
          onBack={() => dispatch({ type: "go", screen: "home" })}
          onNew={startNew}
          onOpen={openProject}
          onWorkspaceChange={(updated) => { if (workspace?.id === updated.id) setWorkspace(updated); }}
        />
      )}
      <footer className="app-footer"><strong>うさぽん パッケージメーカー</strong><span>未保存は端末内／保存作品は非公開クラウド</span><button type="button" onClick={() => setInstallGuideOpen(true)}>ホーム画面に追加する</button><a href={`${import.meta.env.BASE_URL}privacy.html`}>プライバシーポリシー</a></footer>
      <InstallGuide
        open={installGuideOpen}
        context={installContext}
        hasBrowserOnlyWork={saveState === "dirty" || saveState === "error" || saveState === "conflict"}
        cloudSaved={saveState === "saved"}
        onClose={() => setInstallGuideOpen(false)}
        onNeverShow={hideInstallGuide}
      />
      {CLOUD_SYNC_UI_ENABLED && nameDialogOpen && <SaveNameDialog initialName={workspace?.name ?? templateById(state.templateId)?.name ?? "無題のボックス"} onCancel={() => setNameDialogOpen(false)} onSave={(name) => { setNameDialogOpen(false); void commitSave(name, null); }} />}
      {CLOUD_SYNC_UI_ENABLED && saveState === "conflict" && workspace && (
        <ConflictDialog
          onLoadLatest={() => { setSaveState("dirty"); void openProject(workspace, true); }}
          onSaveCopy={() => { setSaveState("dirty"); void commitSave(`${workspace.name.slice(0, 76)} コピー`, null); }}
          onCancel={() => { setSaveState("dirty"); setSaveMessage("未保存の変更があります"); }}
        />
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

import {
  emptyUIEditorConfig,
  sanitizeUIEditorConfig,
  updateComponentPatch,
  withoutComponentPatch,
  withoutScreenPatches,
} from "./config";
import type {
  UIEditorAuth,
  UIEditorBreakpoint,
  UIEditorConfig,
  UIEditorRegistry,
  UIEditorSelection,
  UIEditorStorage,
  UIEditorStoredState,
  UIStylePatch,
  UITokenPatch,
} from "./types";
import "./editor.css";

const MESSAGE_SOURCE = "usapon-ui-editor";
const EDITOR_RETURN_KEY = "usapon-ui-editor.return";
const PREVIEW_WIDTHS = { mobile: 390, tablet: 768, desktop: 1440 } as const;
const PREVIEW_HEIGHTS = { mobile: 844, tablet: 1024, desktop: 900 } as const;
const SHEET_CLOSE_DISTANCE = 72;
const SHEET_FLICK_DISTANCE = 24;
const SHEET_FLICK_VELOCITY = 0.45;

export function shouldCloseEditorSheet(distanceY: number, elapsedMs: number) {
  const distance = Math.max(0, distanceY);
  return distance >= SHEET_CLOSE_DISTANCE
    || (distance >= SHEET_FLICK_DISTANCE && distance / Math.max(1, elapsedMs) >= SHEET_FLICK_VELOCITY);
}

type ShellProps = {
  registry: UIEditorRegistry;
  storage: UIEditorStorage;
  auth: UIEditorAuth;
  previewUrl: string;
};

type HistoryState = { items: UIEditorConfig[]; index: number };

function cloneConfig(config: UIEditorConfig) {
  return structuredClone(config);
}

function NumberInput({ label, value, min, max, step = 1, onChange }: { label: string; value?: number; min: number; max: number; step?: number; onChange: (value: number | undefined) => void }) {
  return (
    <label className="uie-field">
      <span>{label}</span>
      <input type="number" inputMode="decimal" value={value ?? ""} min={min} max={max} step={step} placeholder="標準" onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} />
    </label>
  );
}

function SliderInput({ label, value, defaultValue, min, max, step = 1, onChange }: { label: string; value?: number; defaultValue: number; min: number; max: number; step?: number; onChange: (value: number | undefined) => void }) {
  const current = value ?? defaultValue;
  return <label className="uie-slider-field"><span>{label}<output>{value === undefined ? "標準" : current}</output></span><div><input type="range" value={current} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /><input type="number" inputMode="decimal" value={value ?? ""} min={min} max={max} step={step} placeholder={String(defaultValue)} onChange={(event) => onChange(event.target.value === "" ? undefined : Number(event.target.value))} /></div></label>;
}

function SelectInput({ label, value, options, onChange }: { label: string; value?: string; options: Array<[string, string]>; onChange: (value: string | undefined) => void }) {
  return <label className="uie-field"><span>{label}</span><select value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}><option value="">標準</option>{options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>;
}

function ColorInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string | undefined) => void }) {
  return <label className="uie-color-field"><span>{label}</span><input type="color" value={value && value.startsWith("#") ? value : "#ffffff"} onChange={(event) => onChange(event.target.value)} /><button type="button" onClick={() => onChange(undefined)}>標準へ</button></label>;
}

function SpacingGrid({ prefix, patch, update }: { prefix: "margin" | "padding"; patch: UIStylePatch; update: (patch: Partial<UIStylePatch>) => void }) {
  const labels = { Top: "上", Right: "右", Bottom: "下", Left: "左" } as const;
  return <div className="uie-spacing-grid">{Object.entries(labels).map(([side, label]) => {
    const key = `${prefix}${side}` as keyof UIStylePatch;
    return <NumberInput key={key} label={label} value={patch[key] as number | undefined} min={0} max={prefix === "margin" ? 400 : 240} onChange={(value) => update({ [key]: value })} />;
  })}</div>;
}

function ComponentInspector({ registry, config, selection, breakpoint, onChange, onReset, onResetScreen }: { registry: UIEditorRegistry; config: UIEditorConfig; selection: UIEditorSelection | null; breakpoint: UIEditorBreakpoint; onChange: (config: UIEditorConfig) => void; onReset: () => void; onResetScreen: () => void }) {
  const target = registry.targets.find((item) => item.id === selection?.id);
  if (!selection || !target) return <div className="uie-empty-selection"><span>☝</span><strong>画面のパーツをタップ</strong><p>選んだ場所の余白・サイズ・文字・色・配置を調整できます。</p></div>;
  const patch = config.components[target.id]?.[breakpoint] ?? {};
  const mergePatch = (id: string, current: UIStylePatch, value: Partial<UIStylePatch>) => {
    const cleaned = Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
    const merged = { ...current, ...cleaned };
    for (const key of Object.keys(value) as Array<keyof UIStylePatch>) if (value[key] === undefined) delete merged[key];
    onChange(updateComponentPatch(config, id, breakpoint, merged));
  };
  const update = (value: Partial<UIStylePatch>) => mergePatch(target.id, patch, value);
  const layoutParent = registry.targets.find((item) => item.id === target.layoutParentId);
  const parentPatch = layoutParent ? config.components[layoutParent.id]?.[breakpoint] ?? {} : {};
  const updateParent = (value: Partial<UIStylePatch>) => layoutParent && mergePatch(layoutParent.id, parentPatch, value);
  const cap = target.capabilities;
  return <div className="uie-inspector">
    <div className="uie-selected-title"><span>選択中</span><strong>{target.label}</strong><code>{target.id}</code></div>
    {cap.size && <details open><summary>サイズ</summary><div className="uie-fields-2"><NumberInput label="幅" value={patch.width} min={24} max={2400} onChange={(width) => update({ width })} /><NumberInput label="最小幅" value={patch.minWidth} min={0} max={2400} onChange={(minWidth) => update({ minWidth })} /><NumberInput label="最大幅" value={patch.maxWidth} min={24} max={2400} onChange={(maxWidth) => update({ maxWidth })} /><NumberInput label="高さ" value={patch.height} min={24} max={2400} onChange={(height) => update({ height })} /><NumberInput label="最小高" value={patch.minHeight} min={0} max={2400} onChange={(minHeight) => update({ minHeight })} /></div></details>}
    {cap.spacing && <details><summary>余白</summary><h4>外側</h4><SpacingGrid prefix="margin" patch={patch} update={update} /><h4>内側</h4><SpacingGrid prefix="padding" patch={patch} update={update} /><NumberInput label="項目間の間隔" value={patch.gap} min={0} max={160} onChange={(gap) => update({ gap })} /></details>}
    {cap.typography && <details><summary>文字</summary><div className="uie-fields-2"><NumberInput label="文字サイズ" value={patch.fontSize} min={8} max={96} onChange={(fontSize) => update({ fontSize })} /><NumberInput label="太さ" value={patch.fontWeight} min={100} max={900} step={100} onChange={(fontWeight) => update({ fontWeight })} /><NumberInput label="行間" value={patch.lineHeight} min={0.8} max={3} step={0.1} onChange={(lineHeight) => update({ lineHeight })} /><SelectInput label="揃え" value={patch.textAlign} options={[["left", "左"], ["center", "中央"], ["right", "右"]]} onChange={(textAlign) => update({ textAlign: textAlign as UIStylePatch["textAlign"] })} /></div></details>}
    {cap.appearance && <details><summary>色・角・透明度</summary><ColorInput label="背景" value={patch.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} /><ColorInput label="文字" value={patch.color} onChange={(color) => update({ color })} /><ColorInput label="枠線" value={patch.borderColor} onChange={(borderColor) => update({ borderColor })} /><div className="uie-fields-2"><NumberInput label="枠の太さ" value={patch.borderWidth} min={0} max={24} onChange={(borderWidth) => update({ borderWidth })} /><NumberInput label="角丸" value={patch.borderRadius} min={0} max={200} onChange={(borderRadius) => update({ borderRadius })} /></div><SliderInput label="透明度" value={patch.opacity} defaultValue={1} min={0} max={1} step={0.05} onChange={(opacity) => update({ opacity })} /></details>}
    {cap.layout && <details><summary>配置</summary><h4>このパーツの位置</h4><div className="uie-layout-presets"><button type="button" className={patch.horizontalPosition === "left" ? "is-active" : ""} onClick={() => update({ horizontalPosition: "left" })}>左寄せ</button><button type="button" className={patch.horizontalPosition === "center" ? "is-active" : ""} onClick={() => update({ horizontalPosition: "center" })}>中央</button><button type="button" className={patch.horizontalPosition === "right" ? "is-active" : ""} onClick={() => update({ horizontalPosition: "right" })}>右寄せ</button></div>{layoutParent && <div className="uie-related-layout"><h4>周りのパネルとの並び</h4><p>{layoutParent.label}を安全に組み替えます。幅を超える場合は自動で次の段へ送ります。</p><div className="uie-layout-presets"><button type="button" className={parentPatch.flexDirection === "column" ? "is-active" : ""} onClick={() => updateParent({ flexDirection: "column", flexWrap: "wrap", gridColumns: undefined })}>縦並び</button><button type="button" className={parentPatch.flexDirection === "row" ? "is-active" : ""} onClick={() => updateParent({ flexDirection: "row", flexWrap: "wrap", gridColumns: undefined })}>横並び</button><button type="button" className={parentPatch.gridColumns === 2 ? "is-active" : ""} onClick={() => updateParent({ gridColumns: 2, flexDirection: undefined, flexWrap: undefined })}>2列</button><button type="button" className={parentPatch.gridColumns === 3 ? "is-active" : ""} onClick={() => updateParent({ gridColumns: 3, flexDirection: undefined, flexWrap: undefined })}>3列</button></div><NumberInput label="パネル間のすき間" value={parentPatch.gap} min={0} max={160} onChange={(gap) => updateParent({ gap })} /></div>}<h4>このパーツ内の並び</h4><div className="uie-fields-2"><SelectInput label="並び方向" value={patch.flexDirection} options={[["row", "横（自動折返し）"], ["column", "縦"]]} onChange={(flexDirection) => update({ flexDirection: flexDirection as UIStylePatch["flexDirection"], flexWrap: "wrap" })} /><NumberInput label="グリッド列数" value={patch.gridColumns} min={1} max={12} onChange={(gridColumns) => update({ gridColumns })} /><SelectInput label="横方向" value={patch.justifyContent} options={[["flex-start", "先頭"], ["center", "中央"], ["flex-end", "末尾"], ["space-between", "両端"], ["space-around", "均等"]]} onChange={(justifyContent) => update({ justifyContent: justifyContent as UIStylePatch["justifyContent"] })} /><SelectInput label="縦方向" value={patch.alignItems} options={[["stretch", "いっぱい"], ["flex-start", "先頭"], ["center", "中央"], ["flex-end", "末尾"]]} onChange={(alignItems) => update({ alignItems: alignItems as UIStylePatch["alignItems"] })} /></div>{cap.reorder && <div className="uie-order-controls"><span>並び順（スライド可）</span><button type="button" onClick={() => update({ order: (patch.order ?? 0) - 1 })}>←</button><input aria-label="並び順" type="range" min="-20" max="20" value={patch.order ?? 0} onChange={(event) => update({ order: Number(event.target.value) })} /><output>{patch.order ?? 0}</output><button type="button" onClick={() => update({ order: (patch.order ?? 0) + 1 })}>→</button></div>}</details>}
    {cap.visibility && !target.protected && <details><summary>表示</summary><label className="uie-toggle"><input type="checkbox" checked={!patch.hidden} onChange={(event) => update({ hidden: !event.target.checked })} /><span>このパーツを表示</span></label></details>}
    {target.protected && <p className="uie-protected-note">保存・移動に必要なパーツのため、非表示と危険な並び替えはできません。</p>}
    <div className="uie-reset-actions"><button type="button" onClick={onReset}>このパーツを標準へ</button><button type="button" onClick={onResetScreen}>この画面を標準へ</button></div>
  </div>;
}

function TokenInspector({ config, breakpoint, onChange }: { config: UIEditorConfig; breakpoint: UIEditorBreakpoint; onChange: (config: UIEditorConfig) => void }) {
  const patch = config.tokens[breakpoint] ?? {};
  const update = (value: Partial<UITokenPatch>) => {
    const merged = { ...patch, ...value };
    for (const key of Object.keys(value) as Array<keyof UITokenPatch>) if (value[key] === undefined) delete merged[key];
    onChange({ ...config, tokens: { ...config.tokens, [breakpoint]: merged } });
  };
  return <div className="uie-inspector"><div className="uie-selected-title"><span>アプリ全体</span><strong>デザイントークン</strong><p>同じ種類のカードやボタンをまとめて調整します。</p></div><details open><summary>基本カラー</summary><ColorInput label="メイン" value={patch.mainColor} onChange={(mainColor) => update({ mainColor })} /><ColorInput label="サブ" value={patch.subColor} onChange={(subColor) => update({ subColor })} /><ColorInput label="背景" value={patch.backgroundColor} onChange={(backgroundColor) => update({ backgroundColor })} /><ColorInput label="文字" value={patch.textColor} onChange={(textColor) => update({ textColor })} /></details><details open><summary>共通サイズ</summary><SliderInput label="文字倍率" value={patch.fontScale} defaultValue={1} min={0.75} max={1.6} step={0.05} onChange={(fontScale) => update({ fontScale })} /><SliderInput label="基本間隔" value={patch.baseGap} defaultValue={16} min={0} max={48} onChange={(baseGap) => update({ baseGap })} /><div className="uie-fields-2"><NumberInput label="カード内余白" value={patch.cardPadding} min={0} max={64} onChange={(cardPadding) => update({ cardPadding })} /><NumberInput label="カード角丸" value={patch.cardRadius} min={0} max={64} onChange={(cardRadius) => update({ cardRadius })} /><NumberInput label="ボタン角丸" value={patch.buttonRadius} min={0} max={64} onChange={(buttonRadius) => update({ buttonRadius })} /><NumberInput label="影の強さ" value={patch.shadowStrength} min={0} max={1} step={0.1} onChange={(shadowStrength) => update({ shadowStrength })} /></div></details></div>;
}

export function UIEditorShell({ registry, storage, auth, previewUrl }: ShellProps) {
  const [access, setAccess] = useState<"loading" | "signin" | "forbidden" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [stored, setStored] = useState<UIEditorStoredState | null>(null);
  const [history, setHistory] = useState<HistoryState>(() => ({ items: [emptyUIEditorConfig(registry.appId)], index: 0 }));
  const [breakpoint, setBreakpoint] = useState<UIEditorBreakpoint>(() => window.innerWidth <= 600 ? "mobile" : window.innerWidth <= 1023 ? "tablet" : "desktop");
  const [previewBreakpoint, setPreviewBreakpoint] = useState<Exclude<UIEditorBreakpoint, "common">>(() => window.innerWidth <= 600 ? "mobile" : window.innerWidth <= 1100 ? "tablet" : "desktop");
  const [selection, setSelection] = useState<UIEditorSelection | null>(null);
  const [selectionMode, setSelectionMode] = useState(true);
  const [panelMode, setPanelMode] = useState<"part" | "tokens">("part");
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelDragY, setPanelDragY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const draggedPanelHandle = useRef(false);
  const config = history.items[history.index];

  const initialize = useCallback(async () => {
    setAccess("loading"); setError("");
    if (!auth.configured) { setError("クラウド接続が設定されていません。"); setAccess("error"); return; }
    try {
      const user = await auth.getUser();
      if (!user) { setAccess("signin"); return; }
      if (!await storage.isAdmin()) { setAccess("forbidden"); return; }
      const next = await storage.loadState();
      const clean = sanitizeUIEditorConfig(next.draft, registry);
      setStored({ ...next, draft: clean });
      setHistory({ items: [cloneConfig(clean)], index: 0 });
      setAccess("ready");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "UI設定を読み込めませんでした。");
      setAccess("error");
    }
  }, [auth, registry, storage]);

  useEffect(() => { void initialize(); }, [initialize]);

  const send = useCallback((type: string, payload?: unknown) => {
    iframeRef.current?.contentWindow?.postMessage({ source: MESSAGE_SOURCE, type, payload }, window.location.origin);
  }, []);
  useEffect(() => { if (access === "ready") send("config", config); }, [access, config, send]);
  useEffect(() => { send("mode", selectionMode ? "select" : "interact"); }, [selectionMode, send]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { source?: string; type?: string; payload?: UIEditorSelection };
      if (data.source !== MESSAGE_SOURCE) return;
      if (data.type === "ready") { send("config", config); send("mode", selectionMode ? "select" : "interact"); }
      if (data.type === "selection" && data.payload) { setSelection(data.payload); setPanelMode("part"); }
      if (data.type === "interaction-blocked") setMessage("アプリ内のボタンを使うには、上の「アプリを操作」を選んでください。");
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [config, selectionMode, send]);

  const changeConfig = (next: UIEditorConfig) => setHistory((current) => {
    const items = [...current.items.slice(0, current.index + 1), sanitizeUIEditorConfig(next, registry)].slice(-51);
    return { items, index: items.length - 1 };
  });
  const undo = () => setHistory((current) => ({ ...current, index: Math.max(0, current.index - 1) }));
  const redo = () => setHistory((current) => ({ ...current, index: Math.min(current.items.length - 1, current.index + 1) }));
  const isDirty = Boolean(stored && JSON.stringify(config) !== JSON.stringify(stored.draft));
  const draftDiffersFromPublished = Boolean(stored && JSON.stringify(stored.draft) !== JSON.stringify(stored.published));

  const acceptStored = (next: UIEditorStoredState, text: string, resetHistory = false) => {
    const clean = sanitizeUIEditorConfig(next.draft, registry);
    setStored({ ...next, draft: clean });
    if (resetHistory) setHistory({ items: [cloneConfig(clean)], index: 0 });
    setMessage(text);
  };
  const saveDraft = async () => {
    if (!stored) return; setBusy(true); setMessage(""); setError("");
    try { acceptStored(await storage.saveDraft(sanitizeUIEditorConfig(config, registry), stored.revision), "下書きを保存しました。一般画面にはまだ反映されません。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  };
  const publish = async () => {
    if (!stored || isDirty || !draftDiffersFromPublished || !window.confirm("保存済みの下書きを本番UIへ反映しますか？\n現在の公開設定は「前のUI」として残ります。")) return;
    setBusy(true); setMessage(""); setError("");
    try { acceptStored(await storage.publishDraft(stored.revision), "本番UIへ反映しました。通常画面は再読み込み後に切り替わります。"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "公開できませんでした。"); }
    finally { setBusy(false); }
  };
  const rollback = async () => {
    if (!stored?.previous || !window.confirm("公開中のUIをひとつ前の状態へ戻しますか？")) return;
    setBusy(true); setMessage(""); setError("");
    try { acceptStored(await storage.rollbackPublished(stored.revision), "ひとつ前の公開UIへ戻しました。", true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "元に戻せませんでした。"); }
    finally { setBusy(false); }
  };

  const startResize = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!selection) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { x: event.clientX, y: event.clientY, width: selection.rect.width, height: selection.rect.height };
    const onMove = (move: PointerEvent) => {
      const width = Math.round(Math.max(24, start.width + move.clientX - start.x));
      const height = Math.round(Math.max(24, start.height + move.clientY - start.y));
      const next = updateComponentPatch(config, selection.id, breakpoint, { width, height });
      send("config", sanitizeUIEditorConfig(next, registry));
    };
    const onUp = (up: PointerEvent) => {
      document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp);
      const width = Math.round(Math.max(24, start.width + up.clientX - start.x));
      const height = Math.round(Math.max(24, start.height + up.clientY - start.y));
      changeConfig(updateComponentPatch(config, selection.id, breakpoint, { width, height }));
    };
    document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp);
  };

  const startPanelSwipe = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!panelOpen || !window.matchMedia("(max-width:900px)").matches) return;
    event.preventDefault();
    const startY = event.clientY;
    const startedAt = performance.now();
    draggedPanelHandle.current = false;
    const onMove = (move: PointerEvent) => {
      const distance = Math.max(0, move.clientY - startY);
      if (distance > 6) draggedPanelHandle.current = true;
      setPanelDragY(distance);
    };
    const finish = (end: PointerEvent) => {
      const distance = Math.max(0, end.clientY - startY);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", finish);
      document.removeEventListener("pointercancel", finish);
      if (distance <= 6 || shouldCloseEditorSheet(distance, performance.now() - startedAt)) setPanelOpen(false);
      setPanelDragY(0);
      window.setTimeout(() => { draggedPanelHandle.current = false; }, 0);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
  };

  if (access === "loading") return <main className="uie-access-page"><div className="uie-loader" /><h1>UI編集モードを確認しています</h1></main>;
  if (access === "signin") return <main className="uie-access-page"><div className="uie-access-card"><span className="uie-lock">🔐</span><h1>管理者用 UI編集モード</h1><p>通常利用者には表示されない管理画面です。登録済みのGoogleアカウントで確認します。</p><button type="button" onClick={() => { window.sessionStorage.setItem(EDITOR_RETURN_KEY, "1"); void auth.signIn(); }}>Googleで管理者ログイン</button><a href={new URL(previewUrl, window.location.href).pathname} onClick={() => window.sessionStorage.removeItem(EDITOR_RETURN_KEY)}>通常画面へ戻る</a></div></main>;
  if (access === "forbidden") return <main className="uie-access-page"><div className="uie-access-card"><strong className="uie-error-code">403</strong><h1>この画面を開く権限がありません</h1><p>管理者として登録されたアカウントだけが利用できます。</p><button type="button" onClick={() => { void auth.signOut().then(initialize); }}>別のGoogleアカウントで確認</button><a href={new URL(previewUrl, window.location.href).pathname} onClick={() => window.sessionStorage.removeItem(EDITOR_RETURN_KEY)}>通常画面へ戻る</a></div></main>;
  if (access === "error" || !stored) return <main className="uie-access-page"><div className="uie-access-card"><strong className="uie-error-code">!</strong><h1>UI編集モードを開けませんでした</h1><p>{error}</p><button type="button" onClick={() => void initialize()}>再読み込み</button></div></main>;

  const previewWidth = PREVIEW_WIDTHS[previewBreakpoint];
  const previewHeight = PREVIEW_HEIGHTS[previewBreakpoint];
  const overlayStyle = selection ? { left: selection.rect.x, top: selection.rect.y, width: selection.rect.width, height: selection.rect.height } : undefined;
  const normalUrl = new URL(previewUrl, window.location.href);
  normalUrl.search = "";
  normalUrl.hash = "";
  const panelStyle = panelDragY > 0 ? ({ "--uie-sheet-drag": `${panelDragY}px` } as CSSProperties) : undefined;
  return <div className={`uie-shell ${panelOpen ? "is-panel-open" : ""} ${panelDragY > 0 ? "is-sheet-dragging" : ""}`}>
    <header className="uie-header"><div><strong>{registry.appName}</strong><span>UI編集モード</span></div><a className="uie-exit-button" href={normalUrl.toString()} aria-label="編集を終了して通常画面へ戻る" onClick={(event) => { if (isDirty && !window.confirm("未保存の調整があります。保存せず通常画面へ戻りますか？")) { event.preventDefault(); return; } window.sessionStorage.removeItem(EDITOR_RETURN_KEY); }}>← <span className="uie-exit-wide">通常画面</span><span className="uie-exit-short">終了</span></a><div className="uie-history"><button type="button" disabled={history.index === 0} onClick={undo}>↶ <span>戻す</span></button><button type="button" disabled={history.index >= history.items.length - 1} onClick={redo}>↷ <span>やり直す</span></button></div><div className="uie-save-actions"><span className={isDirty ? "is-dirty" : ""}>{isDirty ? "未保存" : draftDiffersFromPublished ? `公開待ち v${stored.revision}` : `公開済み v${stored.publishedRevision}`}</span><button type="button" disabled={busy || !isDirty} onClick={() => void saveDraft()}>下書き保存</button><button className="is-publish" type="button" disabled={busy || isDirty || !draftDiffersFromPublished} onClick={() => void publish()}>本番へ反映</button><button type="button" disabled={busy || !stored.previous} onClick={() => void rollback()}>前のUIへ戻す</button></div></header>
    {(error || message) && <div className={`uie-message ${error ? "is-error" : ""}`} role="status">{error || message}<button type="button" onClick={() => { setError(""); setMessage(""); }}>×</button></div>}
    <main className="uie-workspace">
      <section className="uie-preview-area"><div className="uie-preview-toolbar"><div className="uie-segment">{(["mobile", "tablet", "desktop"] as const).map((item) => <button key={item} type="button" className={previewBreakpoint === item ? "is-active" : ""} onClick={() => { setPreviewBreakpoint(item); setBreakpoint(item); setSelection(null); }}>{item === "mobile" ? "スマホ 390" : item === "tablet" ? "iPad 768" : "PC 1440"}</button>)}</div><div className="uie-segment uie-mode-segment"><button type="button" className={selectionMode ? "is-active" : ""} onClick={() => setSelectionMode(true)}>パーツ選択</button><button type="button" className={!selectionMode ? "is-active" : ""} onClick={() => { setSelectionMode(false); setMessage("操作モードです。プレビュー内のボタンを通常どおり使えます。"); }}>アプリを操作</button></div><button type="button" className="uie-panel-toggle" onClick={() => setPanelOpen((open) => !open)}>{panelOpen ? "編集欄を閉じる" : "編集欄を開く"}</button></div>
        <div className="uie-preview-scroll"><div className="uie-preview-frame" style={{ width: previewWidth, height: previewHeight }}><iframe ref={iframeRef} title={`${previewBreakpoint}プレビュー`} src={previewUrl} width={previewWidth} height={previewHeight} />{selection && selectionMode && <div className="uie-selection-overlay" style={overlayStyle}><span>{registry.targets.find((target) => target.id === selection.id)?.label}</span>{registry.targets.find((target) => target.id === selection.id)?.capabilities.size && <button type="button" aria-label="ドラッグして幅と高さを変更" onPointerDown={startResize} />}</div>}</div></div>
      </section>
      <aside className="uie-panel" style={panelStyle}><div className="uie-panel-handle"><button type="button" aria-label="下へスワイプして編集欄を閉じる" onPointerDown={startPanelSwipe} onClick={() => { if (!draggedPanelHandle.current) setPanelOpen(false); }} /></div><div className="uie-panel-tabs"><button type="button" className={panelMode === "part" ? "is-active" : ""} onClick={() => setPanelMode("part")}>選択パーツ</button><button type="button" className={panelMode === "tokens" ? "is-active" : ""} onClick={() => setPanelMode("tokens")}>アプリ全体</button></div><div className="uie-breakpoints"><span>調整先</span>{(["common", "mobile", "tablet", "desktop"] as const).map((item) => <button key={item} type="button" className={breakpoint === item ? "is-active" : ""} onClick={() => setBreakpoint(item)}>{item === "common" ? "共通" : item === "mobile" ? "スマホ" : item === "tablet" ? "iPad" : "PC"}</button>)}</div><div className="uie-panel-scroll">{panelMode === "tokens" ? <TokenInspector config={config} breakpoint={breakpoint} onChange={changeConfig} /> : <ComponentInspector registry={registry} config={config} selection={selection} breakpoint={breakpoint} onChange={changeConfig} onReset={() => selection && changeConfig(withoutComponentPatch(config, selection.id, breakpoint))} onResetScreen={() => selection && window.confirm("この画面の現在の調整先をすべて標準へ戻しますか？") && changeConfig(withoutScreenPatches(config, registry, selection.screen, breakpoint))} />}</div></aside>
    </main>
  </div>;
}

import { PrintSettingsButton } from "./PrintLineSettings";
import { zipSync } from "fflate";
import { useEffect, useId, useRef, useState, type Dispatch } from "react";
import type { AppAction, AppState } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { evaluateA4Fit } from "../../domain/paper/a4";
import { printImposition } from "../../domain/paper/imposition";
import { A4ExportSvg } from "../../components/dieline/A4ExportSvg";
import { CardDesignSvg } from "./CardDesignSvg";
import { loadCardLibrary, saveLibraryCard, type SavedCard } from "./card-library";
import { downloadPdfBlob } from "../../lib/pdf/download-pdf";
import { createTimestampedPdfFileName, canSharePdfFile, createPdfShareFile, sharePdfFile } from "../../lib/pdf/share-pdf";

type Props = { state: AppState; dispatch: Dispatch<AppAction>; geometry: DielineGeometry; owner: string; onOpenSettings?: () => void };
export function CardWorkflowNav({ state, dispatch }: Pick<Props, "state" | "dispatch">) {
  const step = state.screen === "print" ? "save" : state.miniCardProject?.step;
  return <nav className="card-workflow-nav" aria-label="ミニカードの制作工程">{([["layout", "割り付け"], ["design", "デザイン"], ["arrange", "並べる"], ["save", "保存"]] as const).map(([value, label], index) => <button key={value} type="button" aria-current={step === value ? "step" : undefined} onClick={() => value === "save" ? dispatch({ type: "go", screen: "print" }) : dispatch({ type: "card-step", step: value })}><small>{index + 1}</small>{label}</button>)}</nav>;
}

export function CardDesignPicker({ state, dispatch, geometry, owner, showTabs = true }: Props & { showTabs?: boolean }) {
  const project = state.miniCardProject!;
  const active = project.designs.find((item) => item.id === project.activeId)!;
  const [library, setLibrary] = useState<SavedCard[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const uid = useId().replaceAll(":", "");
  useEffect(() => { let current = true; setLibrary([]); void loadCardLibrary(owner).then((cards) => { if (current) setLibrary(cards); }).catch(() => { if (current) setMessage("保存したカードを読み込めませんでした。"); }); return () => { current = false; }; }, [owner]);
  const save = async (copy = false) => {
    setBusy(true); setMessage("");
    try {
      const id = !copy && active.libraryId ? active.libraryId : crypto.randomUUID();
      await saveLibraryCard(owner, { id, name: active.name, data: active.data });
      dispatch({ type: "card-library-id", id: active.id, libraryId: id });
      setLibrary(await loadCardLibrary(owner)); setMessage("この端末のカード一覧に保存しました。");
    } catch { setMessage("保存できませんでした。編集中のカードは残っています。"); }
    finally { setBusy(false); }
  };
  return <section className="card-design-picker" aria-label="編集するカード">
    {showTabs && <div className="card-design-tabs">{project.designs.map((design, index) => <button key={design.id} type="button" aria-pressed={design.id === project.activeId} onClick={() => dispatch({ type: "card-select", id: design.id })}><CardDesignSvg data={design.data} geometry={geometry} prefix={`picker-${uid}-${design.id}`} /><span>{String.fromCharCode(65 + index)}</span><span className="sr-only">{design.name}</span></button>)}</div>}
    <details className="card-library-menu"><summary>保存・再利用</summary><div className="card-library-body">
      <label>カード名<input maxLength={60} value={active.name} aria-label="カード名" onChange={(event) => dispatch({ type: "card-rename", id: active.id, name: event.target.value })} /></label>
      <div className="card-action-row"><button type="button" disabled={busy} onClick={() => { void save(); }}>{active.libraryId ? "更新保存" : "カードを保存"}</button>{active.libraryId && <button type="button" disabled={busy} onClick={() => { void save(true); }}>別名で保存</button>}<button type="button" disabled={project.designs.length >= 26} onClick={() => dispatch({ type: "card-add", id: crypto.randomUUID(), duplicate: true })}>複製</button></div>
      <small>カード一覧はこのブラウザ・アカウント内に保存されます。作品全体は画面上部の「保存」から保存できます。</small>
      <strong>保存したカード</strong>
      <div className="saved-card-grid">{library.map((card) => <button type="button" key={card.id} disabled={project.designs.length >= 26} onClick={() => { dispatch({ type: "card-add", id: crypto.randomUUID(), data: structuredClone(card.data), name: card.name, libraryId: card.id }); setMessage("作業コピーを追加しました。割り付けで枚数を指定できます。"); }}><CardDesignSvg data={card.data} geometry={geometry} prefix={`saved-${uid}-${card.id}`} /><span>{card.name}</span></button>)}</div>
      {!library.length && <small>保存したカードがここに並びます。</small>}
      {message && <p role="status">{message}</p>}
    </div></details>
  </section>;
}

export function CardLayoutScreen(props: Props) {
  const { state, dispatch, geometry, onOpenSettings } = props;
  const project = state.miniCardProject!;
  const [pageIndex, setPageIndex] = useState(0);
  const [paintId, setPaintId] = useState<string | null>(project.activeId);
  const imposition = printImposition(geometry);
  const pages = Math.max(1, Math.ceil(project.slots.length / imposition.count));
  const page = Math.min(pageIndex, pages - 1);
  const arrange = project.step === "arrange";
  const total = project.slots.filter(Boolean).length;
  const uid = useId().replaceAll(":", "");
  return <main className="tool-page mini-card-layout-page">
    <CardWorkflowNav state={state} dispatch={dispatch} />
    <div className="page-heading"><h1>{arrange ? "カードを並べる" : "何種類、何枚つくる？"}</h1><p>A4 {pages}ページ · 合計 {total}枚</p></div>
    <div className="mini-card-layout-grid">
      <section className="card-sheet-preview" aria-label="A4の割り付け"><div className="print-preview-toolbar"><span>A4プレビュー</span><PrintSettingsButton onClick={onOpenSettings} /></div>
        <div className="card-sheet-slots" style={{ borderColor: state.lineColors.cut, gridTemplateColumns: `repeat(${imposition.columns}, minmax(0, 1fr))`, aspectRatio: `${imposition.columns * geometry.bounds.widthMm} / ${imposition.rows * geometry.bounds.heightMm}` }}>{Array.from({ length: imposition.count }, (_, index) => {
          const slotIndex = page * imposition.count + index;
          const id = project.slots[slotIndex];
          const design = project.designs.find((item) => item.id === id);
          return <button className="card-sheet-slot" style={{ borderColor: design?.data.lineColors.cut ?? state.lineColors.cut }} type="button" key={index} disabled={!arrange} aria-label={`${slotIndex + 1}枠目：${design?.name ?? "空白"}`} onClick={() => dispatch({ type: "card-place", index: slotIndex, id: paintId })}>{design ? <><CardDesignSvg data={design.data} geometry={geometry} prefix={`slot-${uid}-${index}`} /><span>{design.name}</span></> : <span>空白</span>}</button>;
        })}</div>
        {pages > 1 && <label className="card-page-select">ページ<select aria-label="割り付けのページ" value={page} onChange={(event) => setPageIndex(Number(event.target.value))}>{Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1} / {pages}</option>)}</select></label>}
      </section>
      <section className="panel-card card-plan-controls" aria-label={arrange ? "配置するデザイン" : "デザイン別の枚数"}>
        {arrange ? <><p>デザインを選んで、置きたい枠をタップ</p><div className="card-paint-options">{project.designs.map((design) => <button type="button" key={design.id} aria-pressed={paintId === design.id} onClick={() => setPaintId(design.id)}><CardDesignSvg data={design.data} geometry={geometry} prefix={`paint-${uid}-${design.id}`} /><span>{design.name}</span></button>)}<button type="button" aria-pressed={paintId === null} onClick={() => setPaintId(null)}>空白</button></div></> : <>
          {project.designs.map((design) => <div className="card-count-row" key={design.id}><button type="button" className="card-count-design" aria-label={`${design.name}を編集`} onClick={() => { dispatch({ type: "card-select", id: design.id }); dispatch({ type: "card-step", step: "design" }); }}><CardDesignSvg data={design.data} geometry={geometry} prefix={`count-${uid}-${design.id}`} /><span>{design.name}</span></button><label><input type="number" aria-label={`${design.name}の枚数`} min="0" max="100" value={design.copies} onChange={(event) => dispatch({ type: "card-copies", id: design.id, copies: Number(event.target.value) })} />枚</label></div>)}
          <button className="outline-button" type="button" disabled={project.designs.length >= 26} onClick={() => dispatch({ type: "card-add", id: crypto.randomUUID() })}>＋ デザイン</button>
          <small>0枚にすると印刷から外せます。デザインはそのまま残ります。</small>
        </>}
        <CardDesignPicker {...props} showTabs={false} />
      </section>
    </div>
    <div className="card-workflow-actions"><button type="button" className="secondary-button" onClick={() => dispatch({ type: "card-step", step: arrange ? "design" : "layout" })}>{arrange ? "デザインへ戻る" : "割り付け"}</button><button type="button" className="primary-button" onClick={() => arrange ? dispatch({ type: "go", screen: "print" }) : dispatch({ type: "card-step", step: "design" })}>{arrange ? "保存へ →" : "デザインする →"}</button></div>
  </main>;
}

export function MiniCardPrintScreen({ state, dispatch, geometry, owner, onOpenSettings }: Props) {
  const project = state.miniCardProject!;
  const imposition = printImposition(geometry);
  const fit = evaluateA4Fit(imposition.widthMm, imposition.heightMm);
  const pageCount = Math.max(1, Math.ceil(project.slots.length / imposition.count));
  const [pageIndex, setPageIndex] = useState(0);
  const [target, setTarget] = useState<"sheet" | "card">("sheet");
  const [format, setFormat] = useState<"pdf" | "png">("pdf");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const sources = useRef<Array<SVGSVGElement | null>>([]);
  const cardSvg = useRef<SVGSVGElement>(null);
  const active = project.designs.find((design) => design.id === project.activeId)!;
  const page = Math.min(pageIndex, pageCount - 1);
  const total = project.slots.filter(Boolean).length;
  const cards = (index: number) => project.slots.slice(index * imposition.count, (index + 1) * imposition.count).map((id) => project.designs.find((design) => design.id === id)?.data ?? null);
  const sheetProps = { geometry, fit, backgroundColor: "#ffffff", artworkLayers: [], stamps: [], texts: [], lineColors: state.lineColors, printGuideMode: "design" as const };
  useEffect(() => { setPdfFile(null); setMessage(""); }, [project, target, format]);
  const save = async () => {
    if (busy || (target === "sheet" && (total === 0 || fit.status === "overflow"))) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const { exportA4Pdf, exportSvgPng } = await import("../../lib/pdf/export-a4-pdf");
      if (target === "card") {
        if (!cardSvg.current) throw new Error("カードを準備できませんでした。");
        downloadPdfBlob(await exportSvgPng(cardSvg.current), `usapon-card-${Date.now()}.png`);
        setMessage("カード1枚をPNGで保存しました（300dpi）。");
      } else if (format === "pdf") {
        const pages = Array.from({ length: pageCount }, (_, index) => { const svg = sources.current[index]; if (!svg) throw new Error("印刷ページを準備できませんでした。"); return { svg, fit }; });
        const result = await exportA4Pdf({ pages });
        const fileName = createTimestampedPdfFileName("usapon-mini-cards-a4.pdf");
        const file = createPdfShareFile(result.blob, fileName); setPdfFile(file);
        downloadPdfBlob(result.blob, fileName); setMessage(`${total}枚・${pageCount}ページのPDFを保存しました。100%／実際のサイズで印刷してください。`);
      } else {
        const files: Record<string, Uint8Array> = {};
        for (let index = 0; index < pageCount; index++) { const svg = sources.current[index]; if (!svg) throw new Error("印刷ページを準備できませんでした。"); const blob = await exportSvgPng(svg); if (pageCount === 1) downloadPdfBlob(blob, `usapon-mini-cards-a4-${Date.now()}.png`); else files[`a4-${index + 1}.png`] = new Uint8Array(await blob.arrayBuffer()); }
        if (pageCount > 1) { downloadPdfBlob(new Blob([new Uint8Array(zipSync(files)).buffer], { type: "application/zip" }), `usapon-mini-cards-a4-${Date.now()}.zip`); }
        setMessage(`A4 ${pageCount}ページをPNGで保存しました（300dpi${pageCount > 1 ? "・ZIPにまとめました" : ""}）。`);
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存できませんでした。作品は残っています。"); }
    finally { setBusy(false); }
  };
  return <main className="tool-page mini-card-save-page"><CardWorkflowNav state={state} dispatch={dispatch} /><div className="page-heading"><h1>カードを保存・印刷</h1><p>A4 {pageCount}ページ · 合計 {total}枚</p></div>
    <div className="mini-card-save-grid"><section className="mini-card-output-preview" aria-label="保存する内容のプレビュー"><div className="print-preview-toolbar"><span>{target === "sheet" ? "A4プレビュー" : "カードプレビュー"}</span><PrintSettingsButton onClick={onOpenSettings} disabled={busy} /></div>{target === "card" ? <CardDesignSvg data={active.data} geometry={geometry} prefix="single-preview" /> : <A4ExportSvg {...sheetProps} pageId={`sheet-preview-${page}`} cardDesigns={cards(page)} />}{target === "sheet" && pageCount > 1 && <label className="card-page-select">ページ<select aria-label="保存プレビューのページ" value={page} onChange={(event) => setPageIndex(Number(event.target.value))}>{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} / {pageCount}</option>)}</select></label>}</section>
    <section className="panel-card mini-card-export-controls"><div className="print-settings-heading"><strong>保存・印刷</strong><PrintSettingsButton onClick={onOpenSettings} disabled={busy} /></div><label>保存するもの<select aria-label="保存するもの" value={target} onChange={(event) => setTarget(event.target.value as "sheet" | "card")}><option value="sheet">A4印刷シート</option><option value="card">カード1枚</option></select></label>{target === "sheet" ? <label>形式<select aria-label="保存形式" value={format} onChange={(event) => setFormat(event.target.value as "pdf" | "png")}><option value="pdf">PDF（実寸印刷）</option><option value="png">PNG画像</option></select></label> : <><label>カード<select aria-label="保存するカード" value={active.id} onChange={(event) => dispatch({ type: "card-select", id: event.target.value })}>{project.designs.map((design) => <option key={design.id} value={design.id}>{design.name}</option>)}</select></label><small>PNG画像・300dpiで保存します。</small></>}
      {target === "sheet" && format === "pdf" && <p>プリンター設定を「100%／実際のサイズ」にしてください。</p>}
      {target === "sheet" && total === 0 && <p role="status">「割り付け」で1枚以上指定してください。</p>}
      {fit.status === "overflow" && target === "sheet" && <p role="alert">A4に収まらないため保存を停止しています。</p>}
      <button type="button" className="primary-button" disabled={busy || (target === "sheet" && (total === 0 || fit.status === "overflow"))} onClick={() => { void save(); }}>{busy ? "保存を準備中…" : target === "card" || format === "png" ? "PNGを保存" : "PDFを保存"}</button>
      {pdfFile && canSharePdfFile(pdfFile) && <button type="button" className="outline-button" onClick={() => { void sharePdfFile(pdfFile).catch((cause) => { if (!(cause instanceof DOMException && cause.name === "AbortError")) setError("共有できませんでした。保存したPDFから印刷してください。"); }); }}>共有・印刷</button>}
      {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
      <CardDesignPicker state={state} dispatch={dispatch} geometry={geometry} owner={owner} showTabs={false} />
    </section></div>
    <div className="card-workflow-actions"><button type="button" className="secondary-button" onClick={() => dispatch({ type: "card-step", step: "arrange" })}>並べるへ戻る</button></div>
    <div hidden aria-hidden="true"><CardDesignSvg ref={cardSvg} data={active.data} geometry={geometry} prefix="single-export" />{Array.from({ length: pageCount }, (_, index) => <A4ExportSvg key={index} {...sheetProps} pageId={`sheet-export-${index}`} cardDesigns={cards(index)} ref={(element) => { sources.current[index] = element; }} />)}</div>
  </main>;
}

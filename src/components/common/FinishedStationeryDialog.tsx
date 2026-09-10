import { useEffect, useRef, useState } from "react";

import type { AppState } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { AssembledEnvelopePreview } from "./AssembledEnvelopePreview";
import { FinishedStationeryPreview } from "./FinishedStationeryPreview";
import { A4PrintPreview } from "./A4PrintPreview";

type Props = {
  state: AppState;
  pageId: DielinePageId;
  pageLabel: string;
  geometry: DielineGeometry;
  onClose: () => void;
};

export function FinishedStationeryDialog({ state, pageId, pageLabel, geometry, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [view, setView] = useState<"paper" | "finished">("paper");
  const isEnvelope = geometry.type === "envelope-v1";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);

  return (
    <dialog ref={dialog} className="finished-box-dialog finished-stationery-dialog" aria-label="完成プレビュー" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <header><h2>プレビュー</h2><button type="button" onClick={onClose} aria-label="プレビューを閉じる" autoFocus>×</button></header>
      <div className="preview-mode-tabs" role="group" aria-label="プレビューの表示"><button type="button" aria-pressed={view === "paper"} onClick={() => setView("paper")}>A4印刷</button><button type="button" aria-pressed={view === "finished"} onClick={() => setView("finished")}>完成イメージ</button></div>
      {view === "paper" ? <A4PrintPreview state={state} pageId={pageId} pageLabel={pageLabel} geometry={geometry} /> : isEnvelope ? (
          <AssembledEnvelopePreview state={state} showLabels />
        ) : (
          <FinishedStationeryPreview state={state} pageId={pageId} geometry={geometry} />
        )}
      <p className="finished-box-note">A4用紙との大きさと、模様・スタンプ・文字の見え方を確認できます。</p>
      <button className="primary-button full-button" type="button" onClick={onClose}>デザインへ戻る</button>
    </dialog>
  );
}

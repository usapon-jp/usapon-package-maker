import { useEffect, useRef } from "react";

import type { AppState } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { AssembledEnvelopePreview } from "./AssembledEnvelopePreview";
import { FinishedStationeryPreview } from "./FinishedStationeryPreview";

type Props = {
  state: AppState;
  pageId: DielinePageId;
  geometry: DielineGeometry;
  onClose: () => void;
};

export function FinishedStationeryDialog({ state, pageId, geometry, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isEnvelope = geometry.type === "envelope-v1";

  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.current?.showModal();
    return () => previous?.focus();
  }, []);

  return (
    <dialog ref={dialog} className="finished-box-dialog finished-stationery-dialog" aria-label="完成プレビュー" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <header><h2>プレビュー</h2><button type="button" onClick={onClose} aria-label="プレビューを閉じる" autoFocus>×</button></header>
      {isEnvelope ? (
        <AssembledEnvelopePreview state={state} showLabels />
      ) : (
        <FinishedStationeryPreview state={state} pageId={pageId} geometry={geometry} />
      )}
      <p className="finished-box-note">模様・スタンプ・文字の向きと、書き込み部分の見え方を確認できます。</p>
      <button className="primary-button full-button" type="button" onClick={onClose}>デザインへ戻る</button>
    </dialog>
  );
}

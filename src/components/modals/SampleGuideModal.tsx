import type { CSSProperties } from "react";
import type { AppState } from "../../app/app-types";
import type { DielineGeometry, EnvelopeFaceId } from "../../domain/boxes/types";
import { DielineSvg } from "../dieline/DielineSvg";

const FACE_LABELS: Record<EnvelopeFaceId, string> = { "envelope-front": "A 表", "envelope-flap": "B フタ", "envelope-back": "C 裏" };

export function SampleGuideModal({ geometry, state, onClose }: { geometry: DielineGeometry; state: AppState; onClose: () => void }) {
  const design = {
    backgroundColor: state.backgroundColors.main,
    surfaceBackgroundColors: state.surfaceBackgroundColors,
    artworkLayers: state.artworkLayers.filter((item) => item.pageId === "main"),
    stamps: state.stamps.filter((item) => item.pageId === "main"),
    texts: state.texts.filter((item) => item.pageId === "main"),
  };
  const faceColor = (face: EnvelopeFaceId) => state.surfaceBackgroundColors[face] ?? state.backgroundColors.main;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="app-modal sample-guide-modal" role="dialog" aria-modal="true" aria-labelledby="sample-guide-title">
      <div className="sample-guide-header"><div><p className="eyebrow">SAMPLE</p><h2 id="sample-guide-title">見本</h2></div><button type="button" onClick={onClose} aria-label="閉じる">×</button></div>
      <p>正式な洋形2号カマス貼り展開図を、折った後の面と見比べられます。</p>
      <div className="sample-compare-grid">
        <div><strong>展開図</strong><div className="sample-dieline"><DielineSvg geometry={geometry} {...design} lineColors={state.lineColors} showGuides selectedArtworkId={null} selectedStampId={null} selectedTextId={null} exportMode={false} envelopeDesign={state.envelopeDesign} activeEnvelopeFace={state.activeEnvelopeFace} onSelectArtwork={() => undefined} onMoveArtwork={() => undefined} onSelectStamp={() => undefined} onMoveStamp={() => undefined} onRotateStamp={() => undefined} onSelectText={() => undefined} onMoveText={() => undefined} /></div></div>
        <div><strong>組み立て後</strong><div className="assembled-envelope" style={{ "--front-color": faceColor("envelope-front"), "--back-color": faceColor("envelope-back"), "--flap-color": faceColor("envelope-flap") } as CSSProperties}><span className="assembled-flap">B フタ</span><span className="assembled-front">A 表</span><span className="assembled-back">C 裏</span></div></div>
      </div>
      <div className="sample-face-notes">{(["envelope-front", "envelope-flap", "envelope-back"] as EnvelopeFaceId[]).map((face) => <span key={face} className={state.activeEnvelopeFace === face ? "is-active" : ""}><b>{FACE_LABELS[face]}</b>{face === "envelope-front" ? "表面" : "完成時に180°折り返す面"}</span>)}</div>
      <p className="sample-orientation-note">BフタとC裏へ追加する文字・スタンプは、正式mainの面回転ルールにより展開図上で180°補正され、組み立て後に正しい向きになります。</p>
    </section>
  </div>;
}

import type { AppState } from "../../app/app-types";
import type { DielineGeometry } from "../../domain/boxes/types";
import { AssembledEnvelopePreview } from "../common/AssembledEnvelopePreview";
import { DielineSvg } from "../dieline/DielineSvg";

export function SampleGuideModal({ geometry, state, onClose }: { geometry: DielineGeometry; state: AppState; onClose: () => void }) {
  const design = {
    backgroundColor: state.backgroundColors.main,
    surfaceBackgroundColors: state.surfaceBackgroundColors,
    artworkLayers: state.artworkLayers.filter((item) => item.pageId === "main"),
    stamps: state.stamps.filter((item) => item.pageId === "main"),
    texts: state.texts.filter((item) => item.pageId === "main"),
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="app-modal sample-guide-modal compact-sample-modal" data-ui-id="design.sample-guide" role="dialog" aria-modal="true" aria-labelledby="sample-guide-title">
        <div className="sample-guide-header">
          <div>
            <p className="eyebrow">SAMPLE</p>
            <h2 id="sample-guide-title">組み立て見本</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="閉じる">×</button>
        </div>

        <div className="sample-compare-grid">
          <div className="sample-compare-col">
            <span className="compare-label">展開図（平面）</span>
            <div className="sample-dieline">
              <DielineSvg
                geometry={geometry}
                {...design}
                lineColors={state.lineColors}
                showGuides
                selectedArtworkId={null}
                selectedStampId={null}
                selectedTextId={null}
                exportMode={false}
                envelopeDesign={state.envelopeDesign}
                activeEnvelopeFace={state.activeEnvelopeFace}
                onSelectArtwork={() => undefined}
                onMoveArtwork={() => undefined}
                onSelectStamp={() => undefined}
                onMoveStamp={() => undefined}
                onRotateStamp={() => undefined}
                onSelectText={() => undefined}
                onMoveText={() => undefined}
              />
            </div>
          </div>

          <div className="sample-compare-col">
            <span className="compare-label">完成イメージ（立体）</span>
            <AssembledEnvelopePreview state={state} activeFace={state.activeEnvelopeFace} showLabels={false} />
          </div>
        </div>

        <p className="sample-orientation-note">
          Bフタ・C裏の要素は展開図で180°補正され、組み立て後に正立します。
        </p>

        <button className="primary-button full-button" type="button" onClick={onClose}>
          デザインへ戻る
        </button>
      </section>
    </div>
  );
}

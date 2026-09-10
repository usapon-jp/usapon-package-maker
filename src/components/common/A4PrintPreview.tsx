import type { AppState } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { evaluateA4Fit } from "../../domain/paper/a4";
import { printImposition } from "../../domain/paper/imposition";
import { A4PreviewSvg } from "../dieline/A4ExportSvg";

type Props = {
  state: AppState;
  pageId: DielinePageId;
  pageLabel: string;
  geometry: DielineGeometry;
};

export function A4PrintPreview({ state, pageId, pageLabel, geometry }: Props) {
  const imposition = printImposition(geometry);
  const fit = evaluateA4Fit(imposition.widthMm, imposition.heightMm);
  const isCard = geometry.type === "mini-card-v1";
  const finishedSize = geometry.type === "envelope-v1"
    ? `完成 ${geometry.input.widthMm} × ${geometry.input.heightMm}mm`
    : geometry.type === "letter-paper-v1" || isCard
      ? `仕上がり ${geometry.bounds.widthMm} × ${geometry.bounds.heightMm}mm`
      : `完成 W${geometry.input.widthMm} × D${geometry.input.depthMm} × H${geometry.input.heightMm}mm`;

  return (
    <section className="a4-print-preview" data-a4-print-preview={geometry.type}>
      <div className={`a4-print-sheet ${fit.orientation}`}>
        <A4PreviewSvg
          pageId={pageId}
          geometry={geometry}
          fit={fit}
          backgroundColor={state.backgroundColors[pageId] ?? state.backgroundColors.main}
          surfaceBackgroundColors={pageId === "main" ? state.surfaceBackgroundColors : {}}
          artworkLayers={state.artworkLayers.filter((item) => item.pageId === pageId)}
          stamps={state.stamps.filter((item) => item.pageId === pageId)}
          texts={state.texts.filter((item) => item.pageId === pageId)}
          lineColors={state.lineColors}
          includeFoldoverLines={state.printFoldoverLines}
          showWritingLines={isCard ? state.showCardWritingLines : state.showWritingLines}
          showWritingFrame={isCard ? state.showCardWritingFrame : state.showWritingFrame}
          writingLineCount={isCard ? state.cardWritingLineCount : state.writingLineCount}
          writingLineWidthPercent={isCard ? state.cardWritingLineWidthPercent : state.writingLineWidthPercent}
          envelopeDesign={state.envelopeDesign}
          printGuideMode={state.printGuideMode}
        />
      </div>
      <div className="a4-print-preview-meta"><strong>{pageLabel}・A4{fit.orientation === "portrait" ? "縦" : "横"}</strong>{geometry.type === "letter-paper-v1" && <span>A4に2面割り付け</span>}<span>{finishedSize}</span></div>
    </section>
  );
}

import { useId } from "react";

import type { AppState } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { ArtworkLayer } from "../dieline/layers/ArtworkLayer";
import { TextLayer } from "../dieline/layers/TextLayer";
import { centeredLineSpan, evenlySpacedLineYs } from "../../features/letter-set/writing-lines";

type Props = {
  state: AppState;
  pageId: DielinePageId;
  geometry: DielineGeometry;
};

/** A finished card or letter-paper preview, using the same artwork and text data as the PDF. */
export function FinishedStationeryPreview({ state, pageId, geometry }: Props) {
  const rawId = useId().replaceAll(":", "");
  const clipId = `finished-stationery-${rawId}`;
  const backgroundColor = state.backgroundColors[pageId];
  const artworkLayers = state.artworkLayers.filter((item) => item.pageId === pageId && item.visible);
  const stamps = state.stamps.filter((item) => item.pageId === pageId && item.visible);
  const texts = state.texts.filter((item) => item.pageId === pageId);
  const { x, y, widthMm, heightMm } = geometry.bounds;
  const isLetter = geometry.type === "letter-paper-v1";
  const showWritingFrame = isLetter ? state.showWritingFrame : state.showCardWritingFrame;
  const showWritingLines = isLetter ? state.showWritingLines : state.showCardWritingLines;
  const writingLineCount = isLetter ? state.writingLineCount : state.cardWritingLineCount;
  const writingLineWidthPercent = isLetter ? state.writingLineWidthPercent : state.cardWritingLineWidthPercent;

  return (
    <div className={`finished-stationery-card ${isLetter ? "is-letter" : "is-card"}`}>
      <svg
        className="finished-stationery-svg"
        viewBox={`${x} ${y} ${widthMm} ${heightMm}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={isLetter ? "完成した便箋" : "完成したミニカード"}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={x} y={y} width={widthMm} height={heightMm} rx="2" />
          </clipPath>
        </defs>
        <rect x={x} y={y} width={widthMm} height={heightMm} rx="2" fill={backgroundColor} stroke="#cfc1b8" strokeWidth="0.5" />
        <ArtworkLayer
          geometry={geometry}
          backgroundColor={backgroundColor}
          artworkLayers={artworkLayers}
          stamps={stamps}
          clipId={clipId}
          idPrefix={`finished-stationery-artwork-${rawId}`}
          selectedArtworkId={null}
          selectedStampId={null}
          exportMode
        />
        {showWritingFrame && <rect x={x + (isLetter ? 14 : 7)} y={y + (isLetter ? 20 : 7)} width={Math.max(1, widthMm - (isLetter ? 28 : 14))} height={Math.max(1, heightMm - (isLetter ? 40 : 14))} rx="4" fill="#ffffff" fillOpacity="0.92" stroke="#ead8d3" strokeWidth="0.55" />}
        <g clipPath={`url(#${clipId})`}>
          {showWritingLines && (
            <g fill="none" stroke="#c9b4a7" strokeWidth="0.22" opacity="0.72">
              {evenlySpacedLineYs(y, heightMm, writingLineCount, isLetter ? 0.12 : 0.3, isLetter ? 0.88 : 0.76).map((lineY) => {
                const span = centeredLineSpan(x, widthMm, writingLineWidthPercent);
                return <line key={lineY} x1={span.x1} y1={lineY} x2={span.x2} y2={lineY} />;
              })}
            </g>
          )}
          <TextLayer texts={texts} selectedTextId={null} exportMode />
        </g>
      </svg>
      {isLetter && <span className="finished-stationery-fold" aria-hidden="true" />}
    </div>
  );
}

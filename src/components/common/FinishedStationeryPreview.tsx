import { useId } from "react";

import type { AppState } from "../../app/app-types";
import type { DielineGeometry, DielinePageId } from "../../domain/boxes/types";
import { ArtworkLayer } from "../dieline/layers/ArtworkLayer";
import { TextLayer } from "../dieline/layers/TextLayer";

type Props = {
  state: AppState;
  pageId: Extract<DielinePageId, "letter" | "card">;
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
        <g clipPath={`url(#${clipId})`}>
          {isLetter && state.showWritingLines && (
            <g fill="none" stroke="#c9b4a7" strokeWidth="0.22" opacity="0.72">
              {Array.from({ length: Math.max(0, Math.floor((heightMm - 48) / 11)) }, (_, index) => {
                const lineY = y + 34 + index * 11;
                return <line key={lineY} x1={x + 17} y1={lineY} x2={x + widthMm - 17} y2={lineY} />;
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

import { useState } from "react";
import type { AppState } from "../../app/app-types";
import type { EnvelopeFaceId } from "../../domain/boxes/types";
import { generateDieline } from "../../domain/boxes/registry";
import { ArtworkLayer } from "../dieline/layers/ArtworkLayer";
import { TextLayer } from "../dieline/layers/TextLayer";

interface Props {
  state: AppState;
  activeFace?: EnvelopeFaceId;
  className?: string;
  showLabels?: boolean;
  showFaceMarkers?: boolean;
}

export function AssembledEnvelopePreview({ state, activeFace = state.activeEnvelopeFace, className = "", showLabels = true, showFaceMarkers = false }: Props) {
  const [viewSide, setViewSide] = useState<"front" | "back">(activeFace === "envelope-front" ? "front" : "back");
  const envelopeBox = state.box.type === "envelope-v1" ? state.box : { type: "envelope-v1" as const, widthMm: 162, depthMm: 0, heightMm: 114, paperThicknessMm: 0.1, glueFlapMm: 12 };
  const geometry = generateDieline(envelopeBox);

  const mainArtworks = state.artworkLayers.filter((item) => item.pageId === "main" && item.visible);
  const mainStamps = state.stamps.filter((item) => item.pageId === "main" && item.visible);
  const mainTexts = state.texts.filter((item) => item.pageId === "main");

  const frontPanel = geometry.panels.find((p) => p.id === "panel-envelope-front") ?? { x: 12, y: 42, width: 162, height: 114 };
  const flapPanel = geometry.panels.find((p) => p.id === "panel-envelope-flap") ?? { x: 12, y: 0, width: 162, height: 42 };
  const backPanel = geometry.panels.find((p) => p.id === "panel-envelope-back") ?? { x: 12, y: 156, width: 162, height: 114 };

  const frontBg = state.surfaceBackgroundColors["envelope-front"] ?? state.backgroundColors.main;
  const flapBg = state.surfaceBackgroundColors["envelope-flap"] ?? state.backgroundColors.main;
  const backBg = state.surfaceBackgroundColors["envelope-back"] ?? state.backgroundColors.main;

  const frontArtworks = mainArtworks.filter((item) => item.surfaceId === "envelope-front" || (!item.surfaceId));
  const frontStamps = mainStamps.filter((item) => item.surfaceId === "envelope-front" || (!item.surfaceId));
  const frontTexts = mainTexts.filter((item) => item.surfaceId === "envelope-front" || (!item.surfaceId));

  const flapArtworks = mainArtworks.filter((item) => item.surfaceId === "envelope-flap");
  const flapStamps = mainStamps.filter((item) => item.surfaceId === "envelope-flap");
  const flapTexts = mainTexts.filter((item) => item.surfaceId === "envelope-flap");

  const backArtworks = mainArtworks.filter((item) => item.surfaceId === "envelope-back");
  const backStamps = mainStamps.filter((item) => item.surfaceId === "envelope-back");
  const backTexts = mainTexts.filter((item) => item.surfaceId === "envelope-back");

  const flapCx = flapPanel.x + flapPanel.width / 2;
  const flapCy = flapPanel.y + flapPanel.height / 2;

  const backCx = backPanel.x + backPanel.width / 2;
  const backCy = backPanel.y + backPanel.height / 2;

  return (
    <div className={`single-assembled-envelope-card ${className}`}>
      {showLabels && (
        <div className="assembled-view-toggle">
          <button
            type="button"
            className={`toggle-tab ${viewSide === "front" ? "is-active" : ""}`}
            onClick={() => setViewSide("front")}
          >
            B
          </button>
          <button
            type="button"
            className={`toggle-tab ${viewSide === "back" ? "is-active" : ""}`}
            onClick={() => setViewSide("back")}
          >
            A / C
          </button>
        </div>
      )}

      <div className="assembled-envelope-stage">
        {viewSide === "front" ? (
          <svg
            className="assembled-single-svg face-front-svg"
            viewBox={`${frontPanel.x} ${frontPanel.y} ${frontPanel.width} ${frontPanel.height}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id="assembled-clip-front">
                <rect x={frontPanel.x} y={frontPanel.y} width={frontPanel.width} height={frontPanel.height} rx="2" />
              </clipPath>
            </defs>
            <rect x={frontPanel.x} y={frontPanel.y} width={frontPanel.width} height={frontPanel.height} fill={frontBg} rx="2" stroke="#d0c4b8" strokeWidth="0.5" />
            <g clipPath="url(#assembled-clip-front)">
              <ArtworkLayer
                geometry={geometry}
                backgroundColor={frontBg}
                artworkLayers={frontArtworks}
                stamps={frontStamps}
                clipId="assembled-clip-front"
                idPrefix="assembled-front"
                selectedArtworkId={null}
                selectedStampId={null}
                exportMode={true}
              />
              <TextLayer
                texts={frontTexts}
                selectedTextId={null}
                exportMode={true}
              />
            </g>
            {showFaceMarkers && <g className="assembled-face-marker" data-face-marker="B"><rect x={frontPanel.x + 5} y={frontPanel.y + 5} width="18" height="18" rx="9" /><text x={frontPanel.x + 14} y={frontPanel.y + 17}>B</text></g>}
          </svg>
        ) : (
          <svg
            className="assembled-single-svg face-back-svg"
            viewBox={`0 0 ${backPanel.width} ${backPanel.height}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id="assembled-clip-back-base">
                <rect x="0" y="0" width={backPanel.width} height={backPanel.height} rx="2" />
              </clipPath>
              <clipPath id="assembled-clip-flap-shape">
                <path d={`M 0,0 L ${backPanel.width},0 L ${backPanel.width * 0.9},${flapPanel.height} L ${backPanel.width * 0.1},${flapPanel.height} Z`} />
              </clipPath>

              {/* Source-coordinate clip paths for ArtworkLayer before translate/rotate */}
              <clipPath id="assembled-source-clip-back">
                <rect x={backPanel.x} y={backPanel.y} width={backPanel.width} height={backPanel.height} />
              </clipPath>
              <clipPath id="assembled-source-clip-flap">
                <polygon points={`${flapPanel.x},${flapPanel.y} ${flapPanel.x + flapPanel.width},${flapPanel.y} ${flapPanel.x + flapPanel.width * 0.9},${flapPanel.y + flapPanel.height} ${flapPanel.x + flapPanel.width * 0.1},${flapPanel.y + flapPanel.height}`} />
              </clipPath>
            </defs>

            {/* Back Panel (Face C) */}
            <g clipPath="url(#assembled-clip-back-base)">
              <rect x="0" y="0" width={backPanel.width} height={backPanel.height} fill={backBg} stroke="#d0c4b8" strokeWidth="0.5" />
              <g transform={`translate(${-backPanel.x} ${-backPanel.y})`}>
                <g transform={`rotate(180 ${backCx} ${backCy})`}>
                  <ArtworkLayer
                    geometry={geometry}
                    backgroundColor={backBg}
                    artworkLayers={backArtworks}
                    stamps={backStamps}
                    clipId="assembled-source-clip-back"
                    idPrefix="assembled-back"
                    selectedArtworkId={null}
                    selectedStampId={null}
                    exportMode={true}
                  />
                  <TextLayer
                    texts={backTexts}
                    selectedTextId={null}
                    exportMode={true}
                  />
                </g>
              </g>

              {/* Folded Top Flap (Face A) Overlay */}
              <g clipPath="url(#assembled-clip-flap-shape)">
                <rect x="0" y="0" width={flapPanel.width} height={flapPanel.height} fill={flapBg} stroke="#c0b4a8" strokeWidth="0.4" />
                <g transform={`translate(${-flapPanel.x} ${-flapPanel.y})`}>
                  <g transform={`rotate(180 ${flapCx} ${flapCy})`}>
                    <ArtworkLayer
                      geometry={geometry}
                      backgroundColor={flapBg}
                      artworkLayers={flapArtworks}
                      stamps={flapStamps}
                      clipId="assembled-source-clip-flap"
                      idPrefix="assembled-flap"
                      selectedArtworkId={null}
                      selectedStampId={null}
                      exportMode={true}
                    />
                    <TextLayer
                      texts={flapTexts}
                      selectedTextId={null}
                      exportMode={true}
                    />
                  </g>
                </g>
              </g>
            </g>
            {showFaceMarkers && <>
              <g className="assembled-face-marker" data-face-marker="A"><rect x="5" y="5" width="18" height="18" rx="9" /><text x="14" y="17">A</text></g>
              <g className="assembled-face-marker" data-face-marker="C"><rect x={backPanel.width - 23} y={backPanel.height - 23} width="18" height="18" rx="9" /><text x={backPanel.width - 14} y={backPanel.height - 11}>C</text></g>
            </>}
          </svg>
        )}
      </div>
    </div>
  );
}

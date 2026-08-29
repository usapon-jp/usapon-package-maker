import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BottomNavBar } from "../src/components/navigation/BottomNavBar";
import { LetterSetSelectScreen } from "../src/features/letter-set/LetterSetSelectScreen";
import { MobileSettingsSheet } from "../src/components/modals/MobileSettingsSheet";
import { ArtworkLayer } from "../src/components/dieline/layers/ArtworkLayer";
import { AssembledEnvelopePreview } from "../src/components/common/AssembledEnvelopePreview";
import { generateEnvelope, shouldShowAssemblyGuide } from "../src/domain/boxes/stationery";
import { createStamp } from "../src/app/artwork";
import type { UploadedAsset } from "../src/app/app-types";

describe("モバイル中心のレターセットUI", () => {
  it("4つの組み合わせだけをシンプルに表示する", () => {
    const markup = renderToStaticMarkup(<LetterSetSelectScreen onSelect={() => undefined} />);
    expect(markup).toContain("レターセットを選ぶ");
    expect(markup).toContain("封筒＋便箋");
    expect(markup).toContain("封筒＋ミニカード");
    expect(markup).toContain("フルセット");
    expect(markup).toContain("封筒のみ");
    expect(markup).toContain("洋形2号カマス貼り");
    expect(markup).not.toContain("ふりこみました");
    expect(markup).toContain('data-ui-id="letter.screen"');
    expect(markup).toContain('data-ui-id="letter.choice-grid"');
  });

  it("主要5項目の下部ナビを表示する", () => {
    const markup = renderToStaticMarkup(<BottomNavBar activeTab="letter-set" onChange={() => undefined} />);
    for (const label of ["BOX", "レターセット", "新規", "マイデザイン", "設定"]) expect(markup).toContain(label);
    expect(markup).not.toContain("購入");
    expect(markup).toContain('data-ui-id="global.bottom-nav"');
  });

  it("モバイル用詳細設定シートを表示する", () => {
    const markup = renderToStaticMarkup(
      <MobileSettingsSheet open={true} title="詳細設定・ツール" onClose={() => undefined}>
        <div>設定コンテンツ</div>
      </MobileSettingsSheet>
    );
    expect(markup).toContain("詳細設定・ツール");
    expect(markup).toContain("設定コンテンツ");
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('tabindex="-1"');
    expect(markup).toContain('data-ui-id="design.settings-sheet"');
  });

  it("下部ナビの各種アクティブ状態とクラス指定を検証する", () => {
    const markup = renderToStaticMarkup(<BottomNavBar activeTab="my-designs" onChange={() => undefined} />);
    expect(markup).toContain("is-active");
    expect(markup).toContain("マイデザイン");
  });

  it("ボックス展開図モードと封筒モードの組み立てガイド表示制御を検証する", () => {
    expect(shouldShowAssemblyGuide("envelope-v1", "main")).toBe(true);
    expect(shouldShowAssemblyGuide("gift-box-v1", "main")).toBe(false);
    expect(shouldShowAssemblyGuide("envelope-v1", "letter")).toBe(false);

    const envelopeFrontState = {
      box: { type: "envelope-v1" as const, widthMm: 162, depthMm: 1, heightMm: 114, paperThicknessMm: 0.12, glueFlapMm: 12 },
      activeEnvelopeFace: "envelope-front" as const,
      artworkLayers: [],
      stamps: [],
      texts: [],
      surfaceBackgroundColors: {},
      backgroundColors: { main: "#ffffff" },
    } as any;
    const envelopeBackState = {
      ...envelopeFrontState,
      activeEnvelopeFace: "envelope-back" as const,
    };

    const frontMarkup = renderToStaticMarkup(<AssembledEnvelopePreview state={envelopeFrontState} showLabels={true} />);
    expect(frontMarkup).toContain("face-front-svg");

    const backMarkup = renderToStaticMarkup(<AssembledEnvelopePreview state={envelopeBackState} showLabels={true} />);
    expect(backMarkup).toContain("face-back-svg");
  });

  it("ArtworkLayerが印字用dataUrl属性を正しく描画する", () => {
    const geometry = generateEnvelope({ type: "envelope-v1", widthMm: 162, heightMm: 114, depthMm: 1, glueFlapMm: 12, paperThicknessMm: 0.12 });
    const asset: UploadedAsset = {
      id: "asset-1",
      fileName: "test.png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      aspectRatio: 1,
      sourceType: "png",
    };
    const testStamp = createStamp(asset, geometry, "テストうさぽん", "main");

    const markup = renderToStaticMarkup(
      <svg>
        <ArtworkLayer
          geometry={geometry}
          backgroundColor="#ffffff"
          artworkLayers={[]}
          stamps={[testStamp]}
          clipId="test-clip"
          idPrefix="test"
          selectedArtworkId={null}
          selectedStampId={null}
          exportMode={true}
        />
      </svg>
    );
    expect(markup).toContain(`href="${asset.dataUrl}"`);
  });

  it("AssembledEnvelopePreviewが裏面・フタ面のソース座標クリップ領域とスタンプを描画する", () => {
    const geometry = generateEnvelope({ type: "envelope-v1", widthMm: 162, heightMm: 114, depthMm: 1, glueFlapMm: 12, paperThicknessMm: 0.12 });
    const asset: UploadedAsset = {
      id: "asset-1",
      fileName: "test.png",
      dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      aspectRatio: 1,
      sourceType: "png",
    };
    const backStamp = {
      ...createStamp(asset, geometry, "裏面うさぽん", "main"),
      surfaceId: "envelope-back" as const,
    };
    const mockState = {
      box: { type: "envelope-v1" as const, widthMm: 162, depthMm: 1, heightMm: 114, paperThicknessMm: 0.12, glueFlapMm: 12 },
      activeEnvelopeFace: "envelope-back" as const,
      artworkLayers: [],
      stamps: [backStamp],
      texts: [],
      surfaceBackgroundColors: {},
      backgroundColors: { main: "#ffffff" },
    } as any;

    const markup = renderToStaticMarkup(<AssembledEnvelopePreview state={mockState} activeFace="envelope-back" showLabels={true} />);
    expect(markup).toContain('id="assembled-source-clip-back"');
    expect(markup).toContain('id="assembled-source-clip-flap"');
    expect(markup).toContain(`href="${asset.dataUrl}"`);
    expect(markup).toContain('clip-path="url(#assembled-source-clip-back)"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BottomNavBar } from "../src/components/navigation/BottomNavBar";
import { AssemblyGuideModal } from "../src/components/modals/AssemblyGuideModal";
import { NewCreationSheet } from "../src/components/modals/NewCreationSheet";
import { SettingsSheetModal } from "../src/components/modals/SettingsSheetModal";
import { AssembledEnvelopePreview } from "../src/components/common/AssembledEnvelopePreview";
import { FinishedStationeryPreview } from "../src/components/common/FinishedStationeryPreview";
import { initialState } from "../src/app/app-state";
import { generateFlatStationery } from "../src/domain/boxes/stationery";

describe("Mobile Workspace Refactorings & Components", () => {
  it("BottomNavBar renders active tab and icons correctly", () => {
    const markup = renderToStaticMarkup(<BottomNavBar activeTab="letter-set" onChange={() => undefined} />);
    expect(markup).toContain("is-active");
    expect(markup).toContain("レターセット");
    expect(markup).toContain("BOX");
  });

  it("AssemblyGuideModal renders guide steps and usapon header icon", () => {
    const markup = renderToStaticMarkup(<AssemblyGuideModal onClose={() => undefined} />);
    expect(markup).toContain("封筒の作り方ガイド");
    expect(markup).toContain("1. 切る");
    expect(markup).toContain("2. 折る");
    expect(markup).toContain("assets/usapon-brand-icon.png");
  });

  it("NewCreationSheet renders BOX and Letter Set choices", () => {
    const markup = renderToStaticMarkup(
      <NewCreationSheet onSelectBox={() => undefined} onSelectLetterSet={() => undefined} onClose={() => undefined} />
    );
    expect(markup).toContain("新しく作品を作る");
    expect(markup).toContain("BOXを作る");
    expect(markup).toContain("レターセットを作る");
    expect(markup).toContain('data-ui-id="global.new-creation-sheet"');
  });

  it("SettingsSheetModal renders logged out and logged in account states", () => {
    const loggedOutMarkup = renderToStaticMarkup(
      <SettingsSheetModal
        user={null}
        onLogin={() => undefined}
        onLogout={() => undefined}
        onDeleteAccount={() => undefined}
        onOpenPwaGuide={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(loggedOutMarkup).toContain("設定・アカウント");
    expect(loggedOutMarkup).toContain("Googleでログイン");
    expect(loggedOutMarkup).toContain("プライバシーポリシー・利用規約");
    expect(loggedOutMarkup).toContain('data-ui-id="global.settings-sheet"');

    const loggedInMarkup = renderToStaticMarkup(
      <SettingsSheetModal
        user={{ id: "test-user", email: "test@example.com", user_metadata: { full_name: "Test User" } } as any}
        onLogin={() => undefined}
        onLogout={() => undefined}
        onDeleteAccount={() => undefined}
        onOpenPwaGuide={() => undefined}
        onClose={() => undefined}
      />
    );
    expect(loggedInMarkup).toContain("Test User");
    expect(loggedInMarkup).toContain("test@example.com");
    expect(loggedInMarkup).toContain("この端末からログアウト");
    expect(loggedInMarkup).toContain("クラウドデータを削除");
  });

  it("AssembledEnvelopePreview renders composite single SVG view with front/back tabs", () => {
    const testState = {
      ...initialState,
      stamps: [
        {
          id: "stamp-b",
          kind: "stamp" as const,
          role: "stamp" as const,
          pageId: "main" as const,
          name: "うさぎスタンプ",
          xMm: 50,
          yMm: 20,
          widthMm: 30,
          aspectRatio: 1,
          rotationDeg: 180,
          opacity: 1,
          visible: true,
          surfaceId: "envelope-flap" as const,
          assetRef: { kind: "builtin" as const, key: "usapon-box-rabbits" as const },
          fileName: "stamp.png",
          sourceType: "png" as const,
          dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        },
      ],
    };
    const markup = renderToStaticMarkup(<AssembledEnvelopePreview state={testState} />);
    expect(markup).toContain("single-assembled-envelope-card");
    expect(markup).toContain("assembled-single-svg");
    expect(markup).toContain("A 表（表面）");
    expect(markup).toContain("B/C フタ・裏面");
  });

  it("FinishedStationeryPreview renders the same artwork/text layers without dieline guides", () => {
    const geometry = generateFlatStationery({
      type: "mini-card-v1",
      widthMm: 100,
      heightMm: 148,
      depthMm: 0,
      paperThicknessMm: 0.1,
      glueFlapMm: 0,
    });
    const markup = renderToStaticMarkup(<FinishedStationeryPreview state={initialState} pageId="card" geometry={geometry} />);
    expect(markup).toContain("完成したミニカード");
    expect(markup).toContain("finished-stationery-card");
    expect(markup).not.toContain("data-layer=\"cut\"");
  });
});

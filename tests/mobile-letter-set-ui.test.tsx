import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BottomNavBar } from "../src/components/navigation/BottomNavBar";
import { LetterSetSelectScreen } from "../src/features/letter-set/LetterSetSelectScreen";
import { MobileSettingsSheet } from "../src/components/modals/MobileSettingsSheet";

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
  });

  it("主要5項目の下部ナビを表示する", () => {
    const markup = renderToStaticMarkup(<BottomNavBar activeTab="letter-set" onChange={() => undefined} />);
    for (const label of ["BOX", "レターセット", "新規", "マイデザイン", "設定"]) expect(markup).toContain(label);
    expect(markup).not.toContain("購入");
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
  });
});

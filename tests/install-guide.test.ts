import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InstallGuide } from "../src/components/pwa/InstallGuide";
import { canOfferInstallGuide, detectInstallContext } from "../src/lib/pwa/install-guide";

describe("ホーム画面追加案内", () => {
  it("iPhoneのInstagram内ブラウザを判定する", () => {
    expect(detectInstallContext("Mozilla/5.0 (iPhone) AppleWebKit Mobile Instagram 391.0", false, false)).toEqual({
      platform: "ios",
      isInstagramInAppBrowser: true,
      isStandalone: false,
    });
  });

  it("Androidの通常ブラウザを判定する", () => {
    expect(detectInstallContext("Mozilla/5.0 (Linux; Android 15) AppleWebKit Chrome/140 Mobile", false, false)).toEqual({
      platform: "android",
      isInstagramInAppBrowser: false,
      isStandalone: false,
    });
  });

  it("Mac表示のiPadOSもiOSとして判定する", () => {
    expect(detectInstallContext("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari", false, false, 5).platform).toBe("ios");
    expect(detectInstallContext("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit Safari", false, false, 0).platform).toBe("other");
  });

  it("ホーム画面起動中または非表示指定後は自動案内しない", () => {
    expect(canOfferInstallGuide({ platform: "ios", isInstagramInAppBrowser: false, isStandalone: true }, false)).toBe(false);
    expect(canOfferInstallGuide({ platform: "android", isInstagramInAppBrowser: false, isStandalone: false }, true)).toBe(false);
  });

  it("通常ブラウザではボタンから開ける案内を描画する", () => {
    const markup = renderToStaticMarkup(createElement(InstallGuide, {
      open: true,
      context: { platform: "ios", isInstagramInAppBrowser: false, isStandalone: false },
      hasBrowserOnlyWork: false,
      cloudSaved: false,
      onClose: () => undefined,
      onNeverShow: () => undefined,
    }));
    expect(markup).toContain("ホーム画面から、すぐ作れます");
    expect(markup).toContain("Safariの共有ボタンをタップ");
  });
});

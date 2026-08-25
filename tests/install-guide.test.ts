import { describe, expect, it } from "vitest";

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

  it("ホーム画面起動中または非表示指定後は自動案内しない", () => {
    expect(canOfferInstallGuide({ platform: "ios", isInstagramInAppBrowser: false, isStandalone: true }, false)).toBe(false);
    expect(canOfferInstallGuide({ platform: "android", isInstagramInAppBrowser: false, isStandalone: false }, true)).toBe(false);
  });
});

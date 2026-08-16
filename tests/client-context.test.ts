import { describe, expect, it } from "vitest";

import { detectClientContext } from "../src/lib/browser/client-context";

describe("ブラウザ環境判定", () => {
  it("iPhoneのInstagram内ブラウザを判定する", () => {
    const context = detectClientContext("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 391.0.0");

    expect(context).toEqual({ isIPhone: true, isInstagramInAppBrowser: true, shouldRecommendSafari: true });
  });

  it("iPhone SafariをInstagram内ブラウザとして扱わない", () => {
    const context = detectClientContext("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1");

    expect(context).toEqual({ isIPhone: true, isInstagramInAppBrowser: false, shouldRecommendSafari: false });
  });

  it("デスクトップブラウザをiPhoneとして扱わない", () => {
    const context = detectClientContext("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15");

    expect(context).toEqual({ isIPhone: false, isInstagramInAppBrowser: false, shouldRecommendSafari: false });
  });

  it("AndroidのInstagramにはSafari案内を出さない", () => {
    const context = detectClientContext("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Mobile Instagram 391.0.0");

    expect(context).toEqual({ isIPhone: false, isInstagramInAppBrowser: true, shouldRecommendSafari: false });
  });
});

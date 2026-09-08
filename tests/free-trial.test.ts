import { describe, expect, it } from "vitest";

import { AUTUMN_FREE_TRIAL_STAMP_ID } from "../src/features/theme-packs/autumn-stamp-catalog";
import { canUseAutumnStamp, FREE_TRIAL_RECEIPT_STORAGE_KEY, hasFreeTrialReceipt, isFreeTrialPassphrase, saveFreeTrialReceipt } from "../src/features/theme-packs/free-trial";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("秋スタンプ無料お試し", () => {
  it("候補合言葉だけを正規化して受け付ける", () => {
    expect(isFreeTrialPassphrase("  どんぐり ")).toBe(true);
    expect(isFreeTrialPassphrase("どんぐり！")).toBe(false);
  });

  it("端末内の無料受取は再読込後もIMG9803だけを許可する", () => {
    const storage = memoryStorage();
    expect(hasFreeTrialReceipt(storage)).toBe(false);
    saveFreeTrialReceipt(storage);
    expect(storage.getItem(FREE_TRIAL_RECEIPT_STORAGE_KEY)).toBe("1");
    expect(hasFreeTrialReceipt(storage)).toBe(true);
    expect(canUseAutumnStamp(AUTUMN_FREE_TRIAL_STAMP_ID, true, false)).toBe(true);
    expect(canUseAutumnStamp("autumn-stamp-9798", true, false)).toBe(false);
  });

  it("購入権利がある場合だけ全スタンプを許可する", () => {
    expect(canUseAutumnStamp("autumn-stamp-9798", false, true)).toBe(true);
  });
});

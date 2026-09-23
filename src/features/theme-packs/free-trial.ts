import { AUTUMN_FREE_TRIAL_STAMP_ID, AUTUMN_TRIAL_STAMP_IDS, type AutumnStampId, type AutumnTrialStampId } from "./autumn-stamp-catalog";

export const FREE_TRIAL_RECEIPT_STORAGE_KEY = "usapon-package-maker.autumn-free-trial.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function isFreeTrialPassphrase(value: string) {
  return value.trim().normalize("NFC") === "どんぐり";
}

export function hasFreeTrialReceipt(storage: Pick<Storage, "getItem"> | null | undefined) {
  return storage?.getItem(FREE_TRIAL_RECEIPT_STORAGE_KEY) === "1";
}

export function saveFreeTrialReceipt(storage: Pick<Storage, "setItem"> | null | undefined) {
  storage?.setItem(FREE_TRIAL_RECEIPT_STORAGE_KEY, "1");
}

// The local receipt only permits IMG9803. It never substitutes for an Auth purchase entitlement.
export function canUseAutumnStamp(stampId: AutumnStampId, hasFreeReceipt: boolean, hasPurchaseEntitlement: boolean) {
  return hasPurchaseEntitlement || (hasFreeReceipt && stampId === AUTUMN_FREE_TRIAL_STAMP_ID);
}

// All five trial PNGs are public. The old one-stamp receipt remains readable for
// existing documents, but no account or receipt is needed for the trial set.
export function canUseAutumnTrialStamp(stampId: AutumnTrialStampId) {
  return isAutumnTrialStamp(stampId);
}

export function isAutumnTrialStamp(stampId: string): stampId is AutumnTrialStampId {
  return (AUTUMN_TRIAL_STAMP_IDS as readonly string[]).includes(stampId);
}

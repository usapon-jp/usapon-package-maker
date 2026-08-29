export const INSTALL_GUIDE_HIDDEN_KEY = "usapon-package-maker.install-guide.hidden.v1";

export type InstallPlatform = "ios" | "android" | "other";

export type InstallContext = {
  platform: InstallPlatform;
  isInstagramInAppBrowser: boolean;
  isStandalone: boolean;
};

export function detectInstallContext(
  userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent,
  standaloneDisplay = typeof window !== "undefined" && window.matchMedia?.("(display-mode: standalone)").matches,
  navigatorStandalone = typeof navigator !== "undefined" && Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
  maxTouchPoints = typeof navigator === "undefined" ? 0 : navigator.maxTouchPoints,
): InstallContext {
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
  return {
    platform: isIOS ? "ios" : isAndroid ? "android" : "other",
    isInstagramInAppBrowser: /Instagram|FBAN\/Instagram/i.test(userAgent),
    isStandalone: Boolean(standaloneDisplay || navigatorStandalone),
  };
}
export function canOfferInstallGuide(context: InstallContext, permanentlyHidden: boolean) {
  return !context.isStandalone && !permanentlyHidden;
}

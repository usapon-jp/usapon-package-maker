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
): InstallContext {
  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  return {
    platform: isIOS ? "ios" : isAndroid ? "android" : "other",
    isInstagramInAppBrowser: /Instagram|FBAN\/Instagram/i.test(userAgent),
    isStandalone: Boolean(standaloneDisplay || navigatorStandalone),
  };
}

export function canOfferInstallGuide(context: InstallContext, permanentlyHidden: boolean) {
  return !context.isStandalone && !permanentlyHidden;
}


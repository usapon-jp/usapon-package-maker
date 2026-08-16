export type ClientContext = {
  isIPhone: boolean;
  isInstagramInAppBrowser: boolean;
  shouldRecommendSafari: boolean;
};

export function detectClientContext(userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent): ClientContext {
  const isIPhone = /iPhone|iPod/i.test(userAgent);
  const isInstagramInAppBrowser = /Instagram|FBAN\/Instagram/i.test(userAgent);
  return {
    isIPhone,
    isInstagramInAppBrowser,
    shouldRecommendSafari: isIPhone && isInstagramInAppBrowser,
  };
}

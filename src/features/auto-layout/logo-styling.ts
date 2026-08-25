import type { TextItem } from "../../app/app-types";
import { clamp } from "../../domain/units";
import { normalizeTextItem } from "./text-layout";
import type { AutoLayoutTaste, SeededRandom } from "./types";

export type LogoTextSelector = (item: TextItem) => boolean;

export function clearLogoStyling(texts: TextItem[], selector: LogoTextSelector = () => true) {
  return texts.map((rawItem) => {
    const item = normalizeTextItem(rawItem);
    return selector(item) ? {
      ...item,
      role: "text" as const,
      arcMm: 0,
      strokeColor: null,
      strokeWidthMm: 0,
      labelColor: null,
    } : item;
  });
}

export function applyLogoStyling(texts: TextItem[], taste: AutoLayoutTaste, random: SeededRandom, selector: LogoTextSelector = () => true) {
  return texts.map((rawItem) => {
    const item = normalizeTextItem(rawItem);
    if (!selector(item) || !item.text.trim()) return item;
    if (taste === "pop") {
      const useLabel = random.next() < 0.42;
      return {
        ...item,
        role: "logoText" as const,
        fontSizeMm: clamp(item.fontSizeMm * 1.14, 2.5, 18),
        fontWeight: 900 as const,
        letterSpacingMm: Math.max(0.02, item.letterSpacingMm * 0.55),
        arcMm: useLabel ? 0 : random.between(1.5, 4.2),
        strokeColor: useLabel ? null : "#fffdf9",
        strokeWidthMm: useLabel ? 0 : Math.max(0.45, item.fontSizeMm * 0.09),
        labelColor: useLabel ? random.pick(["#fff0a8", "#ffd8df", "#dff4ed"] as const) : null,
        labelPaddingMm: Math.max(1.8, item.fontSizeMm * 0.34),
      };
    }
    if (taste === "elegant") {
      const useLabel = random.next() < 0.2;
      return {
        ...item,
        role: "logoText" as const,
        fontWeight: 600 as const,
        letterSpacingMm: Math.max(0.45, item.letterSpacingMm * 1.25),
        arcMm: 0,
        strokeColor: null,
        strokeWidthMm: 0,
        labelColor: useLabel ? "#f2ede7" : null,
        labelPaddingMm: Math.max(2, item.fontSizeMm * 0.42),
      };
    }
    const useLabel = random.next() < 0.24;
    return {
      ...item,
      role: "logoText" as const,
      fontWeight: 700 as const,
      letterSpacingMm: Math.max(0.28, item.letterSpacingMm),
      arcMm: useLabel ? 0 : random.between(0, 1.4),
      strokeColor: null,
      strokeWidthMm: 0,
      labelColor: useLabel ? "#f7f0df" : null,
      labelPaddingMm: Math.max(1.8, item.fontSizeMm * 0.36),
    };
  });
}

import { UI_EDITOR_BREAKPOINTS, type UIEditorBreakpoint, type UIEditorConfig, type UIStylePatch, type UITokenPatch } from "./types";

const TOKEN_NAMES: Record<keyof UITokenPatch, string> = {
  mainColor: "--ui-main-color", subColor: "--ui-sub-color", backgroundColor: "--ui-background-color", textColor: "--ui-text-color",
  fontScale: "--ui-font-scale", cardRadius: "--ui-card-radius", buttonRadius: "--ui-button-radius", baseGap: "--ui-base-gap",
  cardPadding: "--ui-card-padding", shadowStrength: "--ui-shadow-strength",
};

const STYLE_NAMES: Partial<Record<keyof UIStylePatch, string>> = {
  width: "width", maxWidth: "max-width", minWidth: "min-width", height: "height", minHeight: "min-height",
  marginTop: "margin-top", marginRight: "margin-right", marginBottom: "margin-bottom", marginLeft: "margin-left",
  paddingTop: "padding-top", paddingRight: "padding-right", paddingBottom: "padding-bottom", paddingLeft: "padding-left",
  gap: "gap", fontSize: "font-size", fontWeight: "font-weight", lineHeight: "line-height", textAlign: "text-align",
  backgroundColor: "background-color", color: "color", borderColor: "border-color", borderWidth: "border-width", borderRadius: "border-radius",
  opacity: "opacity", flexDirection: "flex-direction", justifyContent: "justify-content", alignItems: "align-items", order: "order",
};

const UNIT_LESS = new Set<keyof UIStylePatch>(["fontWeight", "lineHeight", "opacity", "order"]);
const COLOR_TOKEN_KEYS = new Set<keyof UITokenPatch>(["mainColor", "subColor", "backgroundColor", "textColor"]);
const UNITLESS_TOKEN_KEYS = new Set<keyof UITokenPatch>(["fontScale", "shadowStrength"]);

function tokenRules(patch: UITokenPatch) {
  return Object.entries(patch).map(([rawKey, value]) => {
    const key = rawKey as keyof UITokenPatch;
    const suffix = COLOR_TOKEN_KEYS.has(key) || UNITLESS_TOKEN_KEYS.has(key) ? "" : "px";
    return `${TOKEN_NAMES[key]}:${value}${suffix}`;
  });
}

function styleRules(patch: UIStylePatch) {
  const rules: string[] = [];
  for (const [rawKey, value] of Object.entries(patch)) {
    const key = rawKey as keyof UIStylePatch;
    if (key === "width" && typeof value === "number") {
      if (patch.minWidth === undefined) rules.push("min-width:0!important");
      if (patch.maxWidth === undefined) rules.push("max-width:none!important");
      rules.push("flex-basis:auto!important", "flex-grow:0!important", "flex-shrink:0!important");
    }
    if (key === "height" && typeof value === "number") {
      if (patch.minHeight === undefined) rules.push("min-height:0!important");
      rules.push("max-height:none!important");
      rules.push("flex-basis:auto!important", "flex-grow:0!important", "flex-shrink:0!important");
    }
    if (key === "hidden") {
      if (value) rules.push("display:none!important");
      continue;
    }
    if (key === "gridColumns" && typeof value === "number") {
      rules.push("display:grid!important", `grid-template-columns:repeat(${value},minmax(0,1fr))!important`);
      continue;
    }
    if (key === "flexDirection" && typeof value === "string") rules.push("display:flex!important");
    const property = STYLE_NAMES[key];
    if (!property) continue;
    const needsPx = typeof value === "number" && !UNIT_LESS.has(key);
    rules.push(`${property}:${value}${needsPx ? "px" : ""}!important`);
  }
  return rules;
}

function layer(config: UIEditorConfig, breakpoint: UIEditorBreakpoint) {
  const rules: string[] = [];
  const tokens = config.tokens[breakpoint];
  if (tokens) rules.push(`:root{${tokenRules(tokens).join(";")}}`);
  for (const [id, overrides] of Object.entries(config.components)) {
    const patch = overrides[breakpoint];
    if (!patch) continue;
    const declarations = styleRules(patch);
    if (declarations.length) rules.push(`#root [data-ui-id="${id}"]{${declarations.join(";")}}`);
  }
  return rules.join("\n");
}

export function buildUIEditorStyles(config: UIEditorConfig) {
  const common = layer(config, "common");
  const mobile = layer(config, "mobile");
  const tablet = layer(config, "tablet");
  const desktop = layer(config, "desktop");
  return [
    common,
    mobile && `@media (max-width:600px){${mobile}}`,
    tablet && `@media (min-width:601px) and (max-width:1023px){${tablet}}`,
    desktop && `@media (min-width:1024px){${desktop}}`,
  ].filter(Boolean).join("\n");
}

export function ensureUIEditorStyleElement(config: UIEditorConfig) {
  let element = document.querySelector<HTMLStyleElement>("style[data-usapon-ui-config]");
  if (!element) {
    element = document.createElement("style");
    element.dataset.usaponUiConfig = config.appId;
    document.head.append(element);
  }
  element.textContent = buildUIEditorStyles(config);
}

export function currentResponsiveBreakpoint(width = window.innerWidth): Exclude<UIEditorBreakpoint, "common"> {
  if (width <= 600) return "mobile";
  if (width <= 1023) return "tablet";
  return "desktop";
}

export { UI_EDITOR_BREAKPOINTS };

import {
  UI_EDITOR_BREAKPOINTS,
  type UIEditorBreakpoint,
  type UIEditorConfig,
  type UIEditorRegistry,
  type UIEditorTarget,
  type UIStylePatch,
  type UITokenPatch,
} from "./types";

const STYLE_NUMBER_LIMITS: Record<string, [number, number]> = {
  width: [24, 2400], maxWidth: [24, 2400], minWidth: [0, 2400], height: [24, 2400], minHeight: [0, 2400],
  marginTop: [0, 400], marginRight: [0, 400], marginBottom: [0, 400], marginLeft: [0, 400],
  paddingTop: [0, 240], paddingRight: [0, 240], paddingBottom: [0, 240], paddingLeft: [0, 240], gap: [0, 160],
  fontSize: [8, 96], fontWeight: [100, 900], lineHeight: [0.8, 3], borderWidth: [0, 24], borderRadius: [0, 200], opacity: [0, 1],
  gridColumns: [1, 12], order: [-50, 50],
};

const TOKEN_NUMBER_LIMITS: Record<string, [number, number]> = {
  fontScale: [0.75, 1.6], cardRadius: [0, 64], buttonRadius: [0, 64], baseGap: [0, 48], cardPadding: [0, 64], shadowStrength: [0, 1],
};

const COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([0-9.,% ]+\)|transparent)$/i;
const STYLE_ENUMS: Record<string, readonly string[]> = {
  textAlign: ["left", "center", "right"], flexDirection: ["row", "column"], flexWrap: ["nowrap", "wrap"],
  justifyContent: ["flex-start", "center", "flex-end", "space-between", "space-around"],
  alignItems: ["stretch", "flex-start", "center", "flex-end"],
  horizontalPosition: ["left", "center", "right"],
};

function clampNumber(value: unknown, [minimum, maximum]: [number, number]) {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(maximum, Math.max(minimum, value));
}

function safeColor(value: unknown) {
  return typeof value === "string" && COLOR_PATTERN.test(value.trim()) ? value.trim() : undefined;
}

const STYLE_GROUPS: Record<string, keyof UIEditorTarget["capabilities"]> = {
  width: "size", maxWidth: "size", minWidth: "size", height: "size", minHeight: "size",
  marginTop: "spacing", marginRight: "spacing", marginBottom: "spacing", marginLeft: "spacing",
  paddingTop: "spacing", paddingRight: "spacing", paddingBottom: "spacing", paddingLeft: "spacing", gap: "spacing",
  fontSize: "typography", fontWeight: "typography", lineHeight: "typography", textAlign: "typography",
  backgroundColor: "appearance", color: "appearance", borderColor: "appearance", borderWidth: "appearance", borderRadius: "appearance", opacity: "appearance",
  flexDirection: "layout", flexWrap: "layout", justifyContent: "layout", alignItems: "layout", horizontalPosition: "layout", gridColumns: "layout",
  order: "reorder", hidden: "visibility",
};

function sanitizeStyle(value: unknown, target: UIEditorTarget): UIStylePatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, limits] of Object.entries(STYLE_NUMBER_LIMITS)) {
    if (!target.capabilities[STYLE_GROUPS[key]]) continue;
    const safe = clampNumber(source[key], limits);
    if (safe !== undefined) next[key] = safe;
  }
  for (const key of ["backgroundColor", "color", "borderColor"] as const) {
    if (!target.capabilities[STYLE_GROUPS[key]]) continue;
    const safe = safeColor(source[key]);
    if (safe !== undefined) next[key] = safe;
  }
  for (const [key, choices] of Object.entries(STYLE_ENUMS)) {
    if (!target.capabilities[STYLE_GROUPS[key]]) continue;
    if (typeof source[key] === "string" && choices.includes(source[key] as string)) next[key] = source[key];
  }
  if (!target.protected && target.capabilities.visibility && typeof source.hidden === "boolean") next.hidden = source.hidden;
  return next as UIStylePatch;
}

function sanitizeTokens(value: unknown): UITokenPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, limits] of Object.entries(TOKEN_NUMBER_LIMITS)) {
    const safe = clampNumber(source[key], limits);
    if (safe !== undefined) next[key] = safe;
  }
  for (const key of ["mainColor", "subColor", "backgroundColor", "textColor"] as const) {
    const safe = safeColor(source[key]);
    if (safe !== undefined) next[key] = safe;
  }
  return next as UITokenPatch;
}

export function emptyUIEditorConfig(appId: string): UIEditorConfig {
  return { schemaVersion: 1, appId, tokens: {}, components: {} };
}

export function sanitizeUIEditorConfig(value: unknown, registry: UIEditorRegistry): UIEditorConfig {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const targetMap = new Map(registry.targets.map((target) => [target.id, target]));
  const tokens: UIEditorConfig["tokens"] = {};
  const sourceTokens = source.tokens && typeof source.tokens === "object" ? source.tokens as Record<string, unknown> : {};
  for (const breakpoint of UI_EDITOR_BREAKPOINTS) {
    const patch = sanitizeTokens(sourceTokens[breakpoint]);
    if (Object.keys(patch).length) tokens[breakpoint] = patch;
  }
  const components: UIEditorConfig["components"] = {};
  const sourceComponents = source.components && typeof source.components === "object" ? source.components as Record<string, unknown> : {};
  for (const [id, rawOverrides] of Object.entries(sourceComponents)) {
    const target = targetMap.get(id);
    if (!target || !rawOverrides || typeof rawOverrides !== "object" || Array.isArray(rawOverrides)) continue;
    const overrides: Partial<Record<UIEditorBreakpoint, UIStylePatch>> = {};
    for (const breakpoint of UI_EDITOR_BREAKPOINTS) {
      const patch = sanitizeStyle((rawOverrides as Record<string, unknown>)[breakpoint], target);
      if (Object.keys(patch).length) overrides[breakpoint] = patch;
    }
    if (Object.keys(overrides).length) components[id] = overrides;
  }
  return { schemaVersion: 1, appId: registry.appId, tokens, components };
}

export function updateComponentPatch(config: UIEditorConfig, id: string, breakpoint: UIEditorBreakpoint, patch: Partial<UIStylePatch>) {
  return {
    ...config,
    components: {
      ...config.components,
      [id]: {
        ...config.components[id],
        [breakpoint]: { ...config.components[id]?.[breakpoint], ...patch },
      },
    },
  } satisfies UIEditorConfig;
}

export function withoutComponentPatch(config: UIEditorConfig, id: string, breakpoint: UIEditorBreakpoint) {
  const component = { ...config.components[id] };
  delete component[breakpoint];
  const components = { ...config.components };
  if (Object.keys(component).length) components[id] = component;
  else delete components[id];
  return { ...config, components };
}

export function withoutScreenPatches(config: UIEditorConfig, registry: UIEditorRegistry, screen: string, breakpoint: UIEditorBreakpoint) {
  return registry.targets.filter((target) => target.screen === screen).reduce((next, target) => withoutComponentPatch(next, target.id, breakpoint), config);
}

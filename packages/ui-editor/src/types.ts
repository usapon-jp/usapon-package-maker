import type { ReactNode } from "react";

export const UI_EDITOR_BREAKPOINTS = ["common", "mobile", "tablet", "desktop"] as const;
export type UIEditorBreakpoint = (typeof UI_EDITOR_BREAKPOINTS)[number];

export type UIStylePatch = {
  width?: number;
  maxWidth?: number;
  minWidth?: number;
  height?: number;
  minHeight?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  gap?: number;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  opacity?: number;
  flexDirection?: "row" | "column";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "stretch" | "flex-start" | "center" | "flex-end";
  gridColumns?: number;
  order?: number;
  hidden?: boolean;
};

export type UITokenPatch = {
  mainColor?: string;
  subColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontScale?: number;
  cardRadius?: number;
  buttonRadius?: number;
  baseGap?: number;
  cardPadding?: number;
  shadowStrength?: number;
};

export type UIEditorConfig = {
  schemaVersion: 1;
  appId: string;
  tokens: Partial<Record<UIEditorBreakpoint, UITokenPatch>>;
  components: Record<string, Partial<Record<UIEditorBreakpoint, UIStylePatch>>>;
};

export type UIEditorCapabilities = {
  size?: boolean;
  spacing?: boolean;
  typography?: boolean;
  appearance?: boolean;
  layout?: boolean;
  visibility?: boolean;
  reorder?: boolean;
};

export type UIEditorTarget = {
  id: string;
  label: string;
  screen: string;
  capabilities: UIEditorCapabilities;
  protected?: boolean;
};

export type UIEditorRegistry = {
  appId: string;
  appName: string;
  targets: UIEditorTarget[];
};

export type UIEditorStoredState = {
  draft: UIEditorConfig;
  published: UIEditorConfig;
  previous: UIEditorConfig | null;
  revision: number;
  publishedRevision: number;
  updatedAt: string | null;
  publishedAt: string | null;
};

export type UIEditorStorage = {
  isAdmin: () => Promise<boolean>;
  loadState: () => Promise<UIEditorStoredState>;
  loadPublished: () => Promise<UIEditorConfig | null>;
  saveDraft: (config: UIEditorConfig, expectedRevision: number) => Promise<UIEditorStoredState>;
  publishDraft: (expectedRevision: number) => Promise<UIEditorStoredState>;
  rollbackPublished: (expectedRevision: number) => Promise<UIEditorStoredState>;
};

export type UIEditorAuth = {
  configured: boolean;
  getUser: () => Promise<{ email?: string | null } | null>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

export type UIEditorProviderProps = {
  appId: string;
  registry: UIEditorRegistry;
  loadPublished: () => Promise<UIEditorConfig | null>;
  children: ReactNode;
};

export type UIEditorSelection = {
  id: string;
  screen: string;
  rect: { x: number; y: number; width: number; height: number };
};

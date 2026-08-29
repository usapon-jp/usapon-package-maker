import { useEffect, useState, type ReactNode } from "react";

import { emptyUIEditorConfig, sanitizeUIEditorConfig } from "./config";
import { ensureUIEditorStyleElement } from "./style";
import type { UIEditorConfig, UIEditorProviderProps, UIEditorRegistry, UIEditorSelection } from "./types";

const MESSAGE_SOURCE = "usapon-ui-editor";

function previewMode() {
  return new URLSearchParams(window.location.search).get("ui-preview") === "true";
}

function installPreviewBridge(registry: UIEditorRegistry, setConfig: (config: UIEditorConfig) => void) {
  let selectionEnabled = true;
  let selected: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;
  const previewStyle = document.createElement("style");
  previewStyle.dataset.usaponUiPreview = "true";
  previewStyle.textContent = '[data-ui-editor-selected="true"]{outline:3px solid #2f75dc!important;outline-offset:2px!important}';
  document.head.append(previewStyle);
  const targetIds = new Set(registry.targets.map((target) => target.id));

  const sendSelection = (element: HTMLElement) => {
    const id = element.dataset.uiId;
    if (!id || !targetIds.has(id)) return;
    if (selected !== element) {
      selected?.removeAttribute("data-ui-editor-selected");
      selected = element;
      resizeObserver?.disconnect();
      resizeObserver?.observe(element);
    }
    element.dataset.uiEditorSelected = "true";
    const rect = element.getBoundingClientRect();
    const target = registry.targets.find((item) => item.id === id);
    const payload: UIEditorSelection = { id, screen: target?.screen ?? "global", rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    window.parent.postMessage({ source: MESSAGE_SOURCE, type: "selection", payload }, window.location.origin);
  };

  const refreshSelection = () => {
    const id = selected?.dataset.uiId;
    if (!id) return;
    const current = document.querySelector<HTMLElement>(`[data-ui-id="${CSS.escape(id)}"]`);
    if (current) sendSelection(current);
  };

  const refreshSelectionAfterLayout = () => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(refreshSelection));
  };
  resizeObserver = new ResizeObserver(refreshSelectionAfterLayout);

  const onClick = (event: MouseEvent) => {
    if (!selectionEnabled) return;
    const clicked = event.target as HTMLElement | null;
    const interactive = clicked?.closest<HTMLElement>('button,a,input,select,textarea,[role="button"],[role="tab"]');
    const element = clicked?.closest<HTMLElement>("[data-ui-id]");
    if (!element || !targetIds.has(element.dataset.uiId ?? "")) return;
    event.preventDefault();
    event.stopPropagation();
    if (interactive) {
      window.parent.postMessage({ source: MESSAGE_SOURCE, type: "interaction-blocked" }, window.location.origin);
    }
    sendSelection(element);
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const message = event.data as { source?: string; type?: string; payload?: unknown };
    if (message.source !== MESSAGE_SOURCE) return;
    if (message.type === "mode") selectionEnabled = message.payload !== "interact";
    if (message.type === "config") {
      setConfig(sanitizeUIEditorConfig(message.payload, registry));
      refreshSelectionAfterLayout();
    }
    if (message.type === "refresh-selection") refreshSelection();
  };
  const onScroll = () => refreshSelection();
  const onResize = () => refreshSelectionAfterLayout();
  document.addEventListener("click", onClick, true);
  document.addEventListener("scroll", onScroll, true);
  window.addEventListener("message", onMessage);
  window.addEventListener("resize", onResize, { passive: true });
  window.parent.postMessage({ source: MESSAGE_SOURCE, type: "ready" }, window.location.origin);
  return () => {
    selected?.removeAttribute("data-ui-editor-selected");
    resizeObserver?.disconnect();
    previewStyle.remove();
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("scroll", onScroll, true);
    window.removeEventListener("message", onMessage);
    window.removeEventListener("resize", onResize);
  };
}

export function UIEditorProvider({ appId, registry, loadPublished, children }: UIEditorProviderProps) {
  const cacheKey = `usapon-ui-editor.published.${appId}.v1`;
  const [config, setConfig] = useState<UIEditorConfig>(() => {
    try {
      const cached: unknown = JSON.parse(window.localStorage.getItem(cacheKey) ?? "null");
      return cached ? sanitizeUIEditorConfig(cached, registry) : emptyUIEditorConfig(appId);
    } catch {
      return emptyUIEditorConfig(appId);
    }
  });
  useEffect(() => {
    let active = true;
    void loadPublished().then((value) => {
      if (active && value) {
        const clean = sanitizeUIEditorConfig(value, registry);
        setConfig(clean);
        try { window.localStorage.setItem(cacheKey, JSON.stringify(clean)); } catch { /* 公開設定は現在の表示だけへ適用する。 */ }
      }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [appId, cacheKey, loadPublished, registry]);
  useEffect(() => { ensureUIEditorStyleElement(config); }, [config]);
  useEffect(() => previewMode() ? installPreviewBridge(registry, setConfig) : undefined, [registry]);
  return children as ReactNode;
}

import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { UIEditorProvider } from "@usapon/ui-editor/runtime";

import { App } from "./app/App";
import { PACKAGE_UI_EDITOR_REGISTRY } from "./ui-editor/registry";
import { loadPublishedPackageUI } from "./ui-editor/repository";
import "./styles/global.css";

const PackageUIEditor = lazy(() => import("./ui-editor/PackageUIEditor").then((module) => ({ default: module.PackageUIEditor })));

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

const parameters = new URLSearchParams(window.location.search);
const returningToEditor = window.sessionStorage.getItem("usapon-ui-editor.return") === "1";
const editorRequested = parameters.get("ui-edit") === "true" || (returningToEditor && parameters.get("ui-preview") !== "true");

createRoot(document.querySelector("#root")!).render(<StrictMode>{editorRequested ? (
  <Suspense fallback={<main className="ui-editor-loading">UI編集モードを読み込んでいます…</main>}><PackageUIEditor /></Suspense>
) : (
  <UIEditorProvider appId={PACKAGE_UI_EDITOR_REGISTRY.appId} registry={PACKAGE_UI_EDITOR_REGISTRY} loadPublished={loadPublishedPackageUI}>
    <App />
  </UIEditorProvider>
)}</StrictMode>);

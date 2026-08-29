import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { emptyUIEditorConfig, UIEditorShell, type UIEditorStoredState } from "@usapon/ui-editor/editor";

import { PACKAGE_UI_EDITOR_REGISTRY } from "../src/ui-editor/registry";
import "../src/styles/global.css";

let state: UIEditorStoredState = {
  draft: emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId),
  published: emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId),
  previous: null,
  revision: 0,
  publishedRevision: 0,
  updatedAt: null,
  publishedAt: null,
};

const storage = {
  isAdmin: async () => true,
  loadState: async () => state,
  loadPublished: async () => state.published,
  saveDraft: async (draft: typeof state.draft) => state = { ...state, draft, revision: state.revision + 1 },
  publishDraft: async () => state = { ...state, previous: state.published, published: state.draft, revision: state.revision + 1, publishedRevision: state.publishedRevision + 1 },
  rollbackPublished: async () => {
    if (!state.previous) return state;
    const published = state.previous;
    return state = { ...state, draft: published, published, previous: state.published, revision: state.revision + 1, publishedRevision: state.publishedRevision + 1 };
  },
};

const auth = { configured: true, getUser: async () => ({ email: "local-qa" }), signIn: async () => undefined, signOut: async () => undefined };

createRoot(document.querySelector("#root")!).render(<StrictMode><UIEditorShell registry={PACKAGE_UI_EDITOR_REGISTRY} storage={storage} auth={auth} previewUrl="/?ui-preview=true" /></StrictMode>);

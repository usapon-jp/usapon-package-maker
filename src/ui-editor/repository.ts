import { emptyUIEditorConfig, sanitizeUIEditorConfig, type UIEditorConfig, type UIEditorStoredState } from "@usapon/ui-editor/runtime";

import { requirePackageDatabase } from "../cloud/supabase-client";
import { PACKAGE_UI_EDITOR_REGISTRY } from "./registry";

type RpcState = {
  draft?: unknown;
  published?: unknown;
  previous?: unknown;
  revision?: number;
  published_revision?: number;
  updated_at?: string | null;
  published_at?: string | null;
};

function config(value: unknown) {
  return sanitizeUIEditorConfig(value ?? emptyUIEditorConfig(PACKAGE_UI_EDITOR_REGISTRY.appId), PACKAGE_UI_EDITOR_REGISTRY);
}

function storedState(value: unknown): UIEditorStoredState {
  const row = (value && typeof value === "object" ? value : {}) as RpcState;
  return {
    draft: config(row.draft),
    published: config(row.published),
    previous: row.previous ? config(row.previous) : null,
    revision: typeof row.revision === "number" ? row.revision : 0,
    publishedRevision: typeof row.published_revision === "number" ? row.published_revision : 0,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
  };
}

async function rpc(name: string, args: Record<string, unknown> = {}) {
  const { data, error } = await requirePackageDatabase().rpc(name, args);
  if (error) throw error;
  return data;
}

export async function isPackageUIEditorAdmin() {
  return (await rpc("ui_editor_is_admin")) === true;
}

export async function loadPackageUIEditorState() {
  return storedState(await rpc("get_ui_editor_state", { p_app_id: PACKAGE_UI_EDITOR_REGISTRY.appId }));
}

export async function loadPublishedPackageUI(): Promise<UIEditorConfig | null> {
  try {
    const value = await rpc("get_published_ui_config", { p_app_id: PACKAGE_UI_EDITOR_REGISTRY.appId });
    if (!value) return null;
    const result = value as { payload?: unknown };
    return config(result.payload ?? value);
  } catch {
    return null;
  }
}

export async function savePackageUIEditorDraft(next: UIEditorConfig, expectedRevision: number) {
  return storedState(await rpc("save_ui_editor_draft", { p_app_id: PACKAGE_UI_EDITOR_REGISTRY.appId, p_payload: next, p_expected_revision: expectedRevision }));
}

export async function publishPackageUIEditorDraft(expectedRevision: number) {
  return storedState(await rpc("publish_ui_editor_draft", { p_app_id: PACKAGE_UI_EDITOR_REGISTRY.appId, p_expected_revision: expectedRevision }));
}

export async function rollbackPackageUIEditorPublished(expectedRevision: number) {
  return storedState(await rpc("rollback_ui_editor_published", { p_app_id: PACKAGE_UI_EDITOR_REGISTRY.appId, p_expected_revision: expectedRevision }));
}

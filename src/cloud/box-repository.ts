import type { User } from "@supabase/supabase-js";

import { collectUserAssetIds, hydrateBoxDocument, parseBoxDocument, serializeBoxDocument, type AssetResolver, type BoxDocumentV1 } from "../app/box-document";
import type { AppState, AssetRef, RuntimeAsset } from "../app/app-types";
import { builtInStampForKey } from "../app/artwork";
import { readStoredPatternBlob } from "../lib/uploads/read-pattern";
import {
  authRedirectUrl,
  PACKAGE_BOX_ASSETS_BUCKET,
  PACKAGE_THEME_PACK_ASSETS_BUCKET,
  requirePackageDatabase,
  requireSupabase,
} from "./supabase-client";
import type { CloudProject, CloudProjectSummary, ProjectWorkspace } from "./types";

type ProjectRow = {
  id: string;
  name: string;
  document: unknown;
  revision: number;
  created_at: string;
  updated_at: string;
};

type AssetRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: "image/png" | "image/svg+xml";
  byte_size: number;
  aspect_ratio: number;
};

function workspace(row: ProjectRow): ProjectWorkspace {
  return { id: row.id, name: row.name, revision: row.revision, updatedAt: row.updated_at };
}

function cloudProject(row: ProjectRow): CloudProject {
  return { ...workspace(row), document: parseBoxDocument(row.document), createdAt: row.created_at };
}

function projectSummary(row: ProjectRow): CloudProjectSummary {
  const document = parseBoxDocument(row.document);
  return {
    ...workspace(row),
    createdAt: row.created_at,
    boxType: document.box.type,
    widthMm: document.box.widthMm,
    depthMm: document.box.depthMm,
    heightMm: document.box.heightMm,
  };
}

export async function currentUser(): Promise<User | null> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user;
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: authRedirectUrl(), scopes: "openid email profile" },
  });
  if (error) throw error;
}

export async function signOutLocally() {
  const { error } = await requireSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function listCloudProjects(): Promise<CloudProjectSummary[]> {
  const { data, error } = await requirePackageDatabase()
    .from("box_projects")
    .select("id,name,document,revision,created_at,updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectRow[]).map(projectSummary);
}

async function assetRows(ids: string[]): Promise<Map<string, AssetRow>> {
  if (!ids.length) return new Map();
  const { data, error } = await requirePackageDatabase()
    .from("box_assets")
    .select("id,storage_path,file_name,mime_type,byte_size,aspect_ratio")
    .in("id", ids);
  if (error) throw error;
  return new Map((data as AssetRow[]).map((row) => [row.id, row]));
}

function builtInAssetUrl(ref: Extract<AssetRef, { kind: "builtin" }>) {
  return `${import.meta.env.BASE_URL}assets/stamps/${builtInStampForKey(ref.key).fileName}`;
}

export async function listThemePackEntitlements(): Promise<string[]> {
  const { data, error } = await requirePackageDatabase()
    .from("theme_pack_entitlements")
    .select("theme_pack_id");
  if (error) throw error;
  return (data as Array<{ theme_pack_id: string }>).map((row) => row.theme_pack_id);
}

export async function redeemThemePack(themePackId: string, passphrase: string): Promise<string[]> {
  const { data, error } = await requireSupabase().functions.invoke("package-redeem-theme-pack", {
    body: { themePackId, passphrase },
  });
  if (error) throw error;
  const value = data as { unlockedThemePackIds?: string[] };
  return value.unlockedThemePackIds ?? [themePackId];
}

export async function downloadThemeAsset(themePackId: string, fileName: string): Promise<Blob> {
  const { data, error } = await requireSupabase().storage.from(PACKAGE_THEME_PACK_ASSETS_BUCKET).download(`${themePackId}/${fileName}`);
  if (error) throw error;
  return data;
}

async function createAssetResolver(document: BoxDocumentV1): Promise<AssetResolver> {
  const rows = await assetRows(collectUserAssetIds(document));
  const cache = new Map<string, Promise<{ dataUrl: string; blob?: Blob }>>();
  return async (ref: AssetRef, metadata) => {
    const key = ref.kind === "user" ? ref.assetId : `builtin:${ref.key}`;
    const existing = cache.get(key);
    if (existing) return existing;
    const loading = (async () => {
      if (ref.kind === "builtin") {
        const preset = builtInStampForKey(ref.key);
        const blob = preset.themePackId
          ? await downloadThemeAsset(preset.themePackId, preset.fileName)
          : await (async () => {
              const response = await fetch(builtInAssetUrl(ref));
              if (!response.ok) throw new Error("内蔵スタンプを読み込めませんでした。");
              return response.blob();
            })();
        const loaded = await readStoredPatternBlob(blob, metadata.fileName, metadata.sourceType, key, ref);
        return { dataUrl: loaded.dataUrl, blob: loaded.blob };
      }
      const row = rows.get(ref.assetId);
      if (!row) throw new Error(`${metadata.fileName} のクラウド画像が見つかりません。`);
      const { data, error } = await requireSupabase().storage.from(PACKAGE_BOX_ASSETS_BUCKET).download(row.storage_path);
      if (error) throw error;
      const loaded = await readStoredPatternBlob(data, row.file_name, row.mime_type === "image/svg+xml" ? "svg" : "png", row.id, ref);
      return { dataUrl: loaded.dataUrl, blob: loaded.blob };
    })();
    cache.set(key, loading);
    return loading;
  };
}

export async function openCloudProject(id: string): Promise<{ project: CloudProject; state: AppState }> {
  const { data, error } = await requirePackageDatabase()
    .from("box_projects")
    .select("id,name,document,revision,created_at,updated_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  const project = cloudProject(data as ProjectRow);
  const state = await hydrateBoxDocument(project.document, await createAssetResolver(project.document));
  return { project, state };
}

function runtimeUserAssets(state: AppState): Map<string, RuntimeAsset> {
  const assets = [...state.artworkLayers, ...state.stamps].flatMap((item) => {
    if (!("assetRef" in item) || item.assetRef.kind !== "user") return [];
    return [[item.assetRef.assetId, item] as const];
  });
  return new Map(assets);
}

async function uploadMissingAssets(state: AppState, document: BoxDocumentV1) {
  const ids = collectUserAssetIds(document);
  const existing = await assetRows(ids);
  const runtime = runtimeUserAssets(state);
  for (const id of ids) {
    if (existing.has(id)) continue;
    const asset = runtime.get(id);
    if (!asset?.blob) throw new Error(`${asset?.fileName ?? "画像"} のアップロード元が端末に残っていません。`);
    const form = new FormData();
    form.set("assetId", id);
    form.set("aspectRatio", String(asset.aspectRatio));
    form.set("sourceType", asset.sourceType);
    form.set("file", new File([asset.blob], asset.fileName, { type: asset.sourceType === "svg" ? "image/svg+xml" : "image/png" }));
    const { error } = await requireSupabase().functions.invoke("package-upload-box-asset", { body: form });
    if (error) throw error;
  }
}

export class ProjectConflictError extends Error {
  constructor() {
    super("別の端末でこの作品が更新されています。");
    this.name = "ProjectConflictError";
  }
}

export async function saveCloudProject(state: AppState, name: string, existing: ProjectWorkspace | null): Promise<ProjectWorkspace> {
  const document = serializeBoxDocument(state);
  await uploadMissingAssets(state, document);
  const id = existing?.id ?? crypto.randomUUID();
  const { data, error } = await requirePackageDatabase().rpc("save_box_project", {
    p_id: id,
    p_name: name,
    p_document: document,
    p_expected_revision: existing?.revision ?? null,
    p_asset_ids: collectUserAssetIds(document),
  });
  if (error) {
    if (error.message.includes("BOX_PROJECT_CONFLICT") || error.code === "40001") throw new ProjectConflictError();
    throw error;
  }
  return workspace(data as ProjectRow);
}

export async function renameCloudProject(project: ProjectWorkspace, name: string): Promise<ProjectWorkspace> {
  const { data, error } = await requirePackageDatabase().rpc("rename_box_project", {
    p_id: project.id,
    p_name: name,
    p_expected_revision: project.revision,
  });
  if (error) {
    if (error.message.includes("BOX_PROJECT_CONFLICT") || error.code === "40001") throw new ProjectConflictError();
    throw error;
  }
  return workspace(data as ProjectRow);
}

export async function duplicateCloudProject(project: ProjectWorkspace): Promise<ProjectWorkspace> {
  const { data, error } = await requirePackageDatabase().rpc("duplicate_box_project", {
    p_source_id: project.id,
    p_name: `${project.name.slice(0, 76)} コピー`,
  });
  if (error) throw error;
  return workspace(data as ProjectRow);
}

export async function deleteCloudProject(id: string) {
  const { error } = await requireSupabase().functions.invoke("package-delete-box-project", { body: { projectId: id } });
  if (error) throw error;
}

export async function deletePackageCloudData() {
  const { error } = await requireSupabase().functions.invoke("package-delete-cloud-data", { body: { confirmation: "削除" } });
  if (error) throw error;
}

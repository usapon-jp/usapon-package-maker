import { clients, corsHeaders, json, PACKAGE_BOX_ASSETS_BUCKET, PACKAGE_SCHEMA } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);
  const expected = Deno.env.get("CLEANUP_SECRET");
  if (!expected || request.headers.get("x-cleanup-secret") !== expected) return json(request, { error: "AUTH_REQUIRED" }, 401);
  try {
    const { admin } = clients(request);
    const packageAdmin = admin.schema(PACKAGE_SCHEMA);
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: assets, error } = await packageAdmin.from("box_assets").select("id, storage_path").lt("created_at", cutoff);
    if (error) throw error;
    const candidates: Array<{ id: string; storage_path: string }> = [];
    for (const asset of assets ?? []) {
      const { count } = await packageAdmin.from("box_project_assets").select("asset_id", { count: "exact", head: true }).eq("asset_id", asset.id);
      if (!count) candidates.push(asset);
    }
    if (candidates.length) {
      const { error: storageError } = await admin.storage.from(PACKAGE_BOX_ASSETS_BUCKET).remove(candidates.map((item) => item.storage_path));
      if (storageError) throw storageError;
      await packageAdmin.from("box_assets").delete().in("id", candidates.map((item) => item.id));
    }
    return json(request, { deletedAssets: candidates.length });
  } catch (error) {
    return json(request, { error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

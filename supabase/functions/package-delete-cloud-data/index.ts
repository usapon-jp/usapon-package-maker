import { authenticatedUser, corsHeaders, json, PACKAGE_BOX_ASSETS_BUCKET } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const { scoped, admin } = await authenticatedUser(request);
    const { confirmation } = await request.json();
    if (confirmation !== "削除") return json(request, { error: "CONFIRMATION_REQUIRED" }, 400);
    const { data: assets, error: assetsError } = await scoped.from("box_assets").select("storage_path");
    if (assetsError) throw assetsError;
    const paths = (assets ?? []).map((item: { storage_path: string }) => item.storage_path);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from(PACKAGE_BOX_ASSETS_BUCKET).remove(paths);
      if (storageError) throw storageError;
    }
    const { error: deleteError } = await scoped.rpc("delete_package_cloud_data");
    if (deleteError) throw deleteError;
    return json(request, { deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(request, { error: message }, message === "AUTH_REQUIRED" ? 401 : 400);
  }
});

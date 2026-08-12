import { authenticatedUser, corsHeaders, json } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);
  try {
    const { user, scoped, admin } = await authenticatedUser(request);
    const { projectId } = await request.json();
    const { data: orphans, error } = await scoped.rpc("delete_box_project", { p_id: projectId });
    if (error) throw error;
    const paths = (orphans ?? []).map((item: { storage_path: string }) => item.storage_path);
    const ids = (orphans ?? []).map((item: { asset_id: string }) => item.asset_id);
    if (paths.length) {
      const { error: storageError } = await admin.storage.from("box-assets").remove(paths);
      if (storageError) throw storageError;
      await admin.from("box_assets").delete().eq("user_id", user.id).in("id", ids);
    }
    return json(request, { deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json(request, { error: message }, message === "AUTH_REQUIRED" ? 401 : 400);
  }
});

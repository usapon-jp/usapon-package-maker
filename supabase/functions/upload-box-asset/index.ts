import { authenticatedUser, clients, corsHeaders, json, safeFileName } from "../_shared/supabase.ts";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);

  let reservedId: string | null = null;
  let reservedPath: string | null = null;
  try {
    const { user, admin } = await authenticatedUser(request);
    const form = await request.formData();
    const file = form.get("file");
    const assetId = String(form.get("assetId") ?? "");
    const aspectRatio = Number(form.get("aspectRatio"));
    const sourceType = String(form.get("sourceType") ?? "");
    if (!(file instanceof File) || !UUID.test(assetId) || !Number.isFinite(aspectRatio) || aspectRatio <= 0 || aspectRatio > 1000) {
      return json(request, { error: "INVALID_ASSET" }, 400);
    }
    if (file.size < 1 || file.size > MAX_FILE_BYTES) return json(request, { error: "FILE_TOO_LARGE" }, 413);
    const mimeType = sourceType === "svg" ? "image/svg+xml" : sourceType === "png" ? "image/png" : "";
    if (!mimeType) return json(request, { error: "UNSUPPORTED_FILE_TYPE" }, 415);
    if (sourceType === "png") {
      const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const expected = [137, 80, 78, 71, 13, 10, 26, 10];
      if (!expected.every((byte, index) => signature[index] === byte)) {
        return json(request, { error: "INVALID_PNG" }, 400);
      }
    } else {
      const source = (await file.text()).toLowerCase();
      if (!source.includes("<svg") || /<script|<foreignobject|<iframe|<object|<embed|\son[a-z]+\s*=/.test(source)) {
        return json(request, { error: "UNSAFE_SVG" }, 400);
      }
    }

    const extension = sourceType === "svg" ? "svg" : "png";
    const storagePath = `${user.id}/${assetId}.${extension}`;
    reservedId = assetId;
    reservedPath = storagePath;
    const { data: reservation, error: reserveError } = await admin.rpc("reserve_box_asset_upload", {
      p_user_id: user.id,
      p_asset_id: assetId,
      p_storage_path: storagePath,
      p_file_name: safeFileName(file.name),
      p_mime_type: mimeType,
      p_byte_size: file.size,
      p_aspect_ratio: aspectRatio,
    });
    if (reserveError) throw reserveError;
    if (reservation.status === "ready") return json(request, { asset: reservation });

    const { error: uploadError } = await admin.storage.from("box-assets").upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) throw uploadError;
    const { data: asset, error: readyError } = await admin
      .from("box_assets")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", assetId)
      .eq("user_id", user.id)
      .select()
      .single();
    if (readyError) throw readyError;
    return json(request, { asset });
  } catch (error) {
    if (reservedId) {
      const { admin } = clients(request);
      if (reservedPath) await admin.storage.from("box-assets").remove([reservedPath]);
      await admin.from("box_assets").delete().eq("id", reservedId).eq("status", "pending");
    }
    const message = error instanceof Error ? error.message : String(error);
    return json(request, { error: message.includes("STORAGE_LIMIT_REACHED") ? "STORAGE_LIMIT_REACHED" : message }, message === "AUTH_REQUIRED" ? 401 : 400);
  }
});

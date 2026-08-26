import { authenticatedUser, corsHeaders, json } from "../_shared/supabase.ts";
import { constantTimeEqual, normalizePassphrase, sha256Hex } from "./passphrase.ts";

const AUTUMN_PACK_ID = "autumn-letter-set";
const FAILURE_LIMIT = 5;
const WINDOW_MINUTES = 15;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { user, admin } = await authenticatedUser(request);
    const body = await request.json() as { themePackId?: unknown; passphrase?: unknown };
    const themePackId = typeof body.themePackId === "string" ? body.themePackId : "";
    const passphrase = typeof body.passphrase === "string" ? normalizePassphrase(body.passphrase) : "";
    if (themePackId !== AUTUMN_PACK_ID || passphrase.length < 4 || passphrase.length > 120) {
      return json(request, { error: "INVALID_PASSPHRASE" }, 403);
    }

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count, error: countError } = await admin
      .from("theme_pack_redemption_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("theme_pack_id", themePackId)
      .eq("success", false)
      .gte("attempted_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= FAILURE_LIMIT) return json(request, { error: "TRY_LATER" }, 429);

    const expectedHash = Deno.env.get("AUTUMN_THEME_PASSPHRASE_SHA256")?.trim().toLowerCase() ?? "";
    if (!/^[0-9a-f]{64}$/.test(expectedHash)) return json(request, { error: "PACK_NOT_READY" }, 503);
    const accepted = constantTimeEqual(await sha256Hex(passphrase), expectedHash);

    const { error: attemptError } = await admin.from("theme_pack_redemption_attempts").insert({
      user_id: user.id,
      theme_pack_id: themePackId,
      success: accepted,
    });
    if (attemptError) throw attemptError;
    if (!accepted) return json(request, { error: "INVALID_PASSPHRASE" }, 403);

    const { error: entitlementError } = await admin.from("theme_pack_entitlements").upsert({
      user_id: user.id,
      theme_pack_id: themePackId,
      source: "passphrase",
    }, { onConflict: "user_id,theme_pack_id", ignoreDuplicates: true });
    if (entitlementError) throw entitlementError;

    const { data, error } = await admin.from("theme_pack_entitlements").select("theme_pack_id").eq("user_id", user.id);
    if (error) throw error;
    return json(request, { unlockedThemePackIds: data.map((row) => row.theme_pack_id) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return json(request, { error: "AUTH_REQUIRED" }, 401);
    console.error("redeem-theme-pack", error);
    return json(request, { error: "UNLOCK_FAILED" }, 500);
  }
});

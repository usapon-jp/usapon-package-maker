import { authenticatedUser, corsHeaders, json, PACKAGE_SCHEMA } from "../_shared/supabase.ts";
import { constantTimeEqual, normalizePassphrase, sha256Hex } from "./passphrase.ts";

const AUTUMN_PACK_ID = "autumn-letter-set";
const FAILURE_LIMIT = 5;
const WINDOW_MINUTES = 15;

function adminCredentials() {
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
  const apiKey = secretKeys.default ?? Object.values(secretKeys)[0] ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return { apiKey, url: Deno.env.get("SUPABASE_URL") ?? "" };
}

async function adminRest(path: string, init: RequestInit = {}) {
  const { apiKey, url } = adminCredentials();
  if (!apiKey || !url) throw new Error("ADMIN_NOT_CONFIGURED");
  const headers = new Headers(init.headers);
  headers.set("apikey", apiKey);
  headers.set("Content-Type", "application/json");
  headers.set("Accept-Profile", PACKAGE_SCHEMA);
  headers.set("Content-Profile", PACKAGE_SCHEMA);
  if (apiKey.split(".").length === 3) headers.set("Authorization", `Bearer ${apiKey}`);
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { code?: string; message?: string };
    throw new Error(`ADMIN_REQUEST_FAILED_${response.status}_${failure.code ?? failure.message ?? "UNKNOWN"}`);
  }
  return response;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { user } = await authenticatedUser(request);
    const body = await request.json() as { themePackId?: unknown; passphrase?: unknown };
    const themePackId = typeof body.themePackId === "string" ? body.themePackId : "";
    const passphrase = typeof body.passphrase === "string" ? normalizePassphrase(body.passphrase) : "";
    if (themePackId !== AUTUMN_PACK_ID || passphrase.length < 4 || passphrase.length > 120) {
      return json(request, { error: "INVALID_PASSPHRASE" }, 403);
    }

    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const filters = new URLSearchParams({
      select: "id",
      user_id: `eq.${user.id}`,
      theme_pack_id: `eq.${themePackId}`,
      success: "eq.false",
      attempted_at: `gte.${since}`,
    });
    const countResponse = await adminRest(`theme_pack_redemption_attempts?${filters}`, {
      method: "GET",
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    const count = Number(countResponse.headers.get("content-range")?.split("/")[1] ?? 0);
    if ((count ?? 0) >= FAILURE_LIMIT) return json(request, { error: "TRY_LATER" }, 429);

    const expectedHash = Deno.env.get("AUTUMN_THEME_PASSPHRASE_SHA256")?.trim().toLowerCase() ?? "";
    if (!/^[0-9a-f]{64}$/.test(expectedHash)) return json(request, { error: "PACK_NOT_READY" }, 503);
    const accepted = constantTimeEqual(await sha256Hex(passphrase), expectedHash);

    await adminRest("theme_pack_redemption_attempts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, theme_pack_id: themePackId, success: accepted }),
    });
    if (!accepted) return json(request, { error: "INVALID_PASSPHRASE" }, 403);

    await adminRest("theme_pack_entitlements?on_conflict=user_id%2Ctheme_pack_id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: user.id, theme_pack_id: themePackId, source: "passphrase" }),
    });

    const entitlementFilters = new URLSearchParams({ select: "theme_pack_id", user_id: `eq.${user.id}` });
    const entitlementResponse = await adminRest(`theme_pack_entitlements?${entitlementFilters}`);
    const data = await entitlementResponse.json() as Array<{ theme_pack_id: string }>;
    return json(request, { unlockedThemePackIds: data.map((row) => row.theme_pack_id) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return json(request, { error: "AUTH_REQUIRED" }, 401);
    console.error("redeem-theme-pack", error);
    return json(request, { error: "UNLOCK_FAILED" }, 500);
  }
});

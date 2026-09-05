import { authenticatedUser, corsHeaders, json, PACKAGE_SCHEMA } from "../_shared/supabase.ts";

const AUTUMN_PACK_ID = "autumn-letter-set";

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
    const body = await request.json() as { themePackId?: unknown };
    const themePackId = typeof body.themePackId === "string" ? body.themePackId : "";
    if (themePackId !== AUTUMN_PACK_ID) return json(request, { error: "PACK_NOT_FOUND" }, 404);

    const entitlementFilters = new URLSearchParams({ select: "theme_pack_id", user_id: `eq.${user.id}` });
    const entitlementResponse = await adminRest(`theme_pack_entitlements?${entitlementFilters}`);
    const data = await entitlementResponse.json() as Array<{ theme_pack_id: string }>;
    if (!data.some((row) => row.theme_pack_id === themePackId)) return json(request, { error: "PURCHASE_REQUIRED" }, 403);
    return json(request, { unlockedThemePackIds: data.map((row) => row.theme_pack_id) });
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_REQUIRED") return json(request, { error: "AUTH_REQUIRED" }, 401);
    console.error("redeem-theme-pack", error);
    return json(request, { error: "UNLOCK_FAILED" }, 500);
  }
});

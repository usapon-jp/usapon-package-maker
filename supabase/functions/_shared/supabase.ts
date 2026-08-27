import { createClient } from "npm:@supabase/supabase-js@2";

export const PACKAGE_SCHEMA = "package";
export const PACKAGE_BOX_ASSETS_BUCKET = "package-box-assets";

const ALLOWED_ORIGINS = new Set([
  "https://package.usa-pon.com",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:4174",
  "https://usapon-jp.github.io",
]);

export function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://package.usa-pon.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function json(request: Request, value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

export function clients(request: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = request.headers.get("Authorization") ?? "";
  return {
    user: createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } }),
    admin: createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}

export async function authenticatedUser(request: Request) {
  const { user: userClient, admin } = clients(request);
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("AUTH_REQUIRED");
  return {
    user: data.user,
    scoped: userClient.schema(PACKAGE_SCHEMA),
    admin,
    packageAdmin: admin.schema(PACKAGE_SCHEMA),
  };
}

export function safeFileName(value: string) {
  return value.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) || "image";
}

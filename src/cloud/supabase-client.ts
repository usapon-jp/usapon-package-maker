import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";

export const isCloudConfigured = Boolean(
  supabaseUrl.startsWith("https://")
  && supabasePublishableKey
  && !supabaseUrl.includes("your-project-ref")
  && !supabasePublishableKey.includes("your_key"),
);

export const supabase = isCloudConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error("クラウド保存はまだ設定されていません。");
  return supabase;
}

export function authRedirectUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.href).toString().split("?")[0].split("#")[0];
}

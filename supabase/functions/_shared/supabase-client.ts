// Shared Supabase admin client factory for Edge Functions.
//
// CORS: every browser call to an Edge Function from a different origin
// requires `Access-Control-Allow-*` headers on both the actual response
// and a preflight OPTIONS reply. Without these the browser blocks
// requests before they reach the function and the failure surfaces as
// an opaque "CORS error" with no body. Each function imports
// `handlePreflight` and short-circuits OPTIONS at the top of its handler.

// Deno's native npm specifier — avoids esm.sh, which intermittently 522s during
// `supabase functions deploy` ("Import failed: 522"). This is also the form
// current Supabase Edge Function templates use.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

/** Reply to a CORS preflight request. Returns null if `req` isn't OPTIONS. */
export function handlePreflight(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return null;
}

export function createAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function createUserClient(req: Request): SupabaseClient {
  const authHeader = req.headers.get("Authorization") ?? "";
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return data.user.id;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

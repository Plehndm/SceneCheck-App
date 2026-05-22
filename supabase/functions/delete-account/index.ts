// Edge Function: delete-account
// Deletes the caller's account while preserving the events + reviews they made
// (those belong to other users' history). Runs with the service role so it can
// reassign content + delete the auth user — things the client can't do.
//
// Flow (see migration 00020):
//   1. reassign_then_delete_account(userId) — a SECURITY DEFINER RPC that
//      re-points the user's events + reviews to the "[deleted user]"
//      placeholder profile, then DELETEs the user's real profiles row
//      (cascading their interests / friendships / chats / messages / etc.).
//   2. auth.admin.deleteUser(userId) — removes the login outright. Safe now
//      that no profiles row references it, and it frees the email for a fresh
//      re-registration. (Local drafts are cleared client-side; they never
//      reach the server.)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createAdminClient, getUserId, jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const admin = createAdminClient();

    // 1. Reassign events + reviews to the placeholder, delete the profile row.
    const { error: rpcErr } = await admin.rpc("reassign_then_delete_account", {
      p_user: userId,
    });
    if (rpcErr) return errorResponse(rpcErr.message, 500);

    // 2. Delete the auth user → removes the login and frees the email.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) return errorResponse(delErr.message, 500);

    return jsonResponse({ ok: true });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

// Edge Function: promote-waitlist — FR5.6 (Waitlist Promotion)
//
// Promotes the next person on the waitlist when capacity frees up.
//
// Round-3 fix (CODE_REVIEW_REPORT_3 C2): the previous version (a) authenticated
// the caller but never verified they own the event — any logged-in user could
// promote someone onto any event — and (b) did the promotion as three separate
// unguarded statements (subscription UPDATE, waitlist DELETE, notification
// INSERT) with no lock, so concurrent calls could double-promote or leave
// inconsistent state. We now check the caller is the event creator and delegate
// the whole mutation to the SECURITY DEFINER RPC `promote_waitlist_atomic`
// (migration 00028), which performs a per-event advisory-locked, capacity-
// checked transaction.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createAdminClient, getUserId, jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { event_id } = await req.json();
    const callerId = await getUserId(req);
    if (!callerId) return errorResponse("Unauthorized", 401);
    if (!event_id) return errorResponse("event_id is required");

    const admin = createAdminClient();

    // Authorization: only the event creator may promote off the waitlist.
    // (OWASP A01: an authenticated request is not an authorized request.)
    const { data: ev, error: evErr } = await admin
      .from("events")
      .select("creator_id")
      .eq("id", event_id)
      .single();

    if (evErr || !ev) return errorResponse("Event not found", 404);
    if (ev.creator_id !== callerId) return errorResponse("Forbidden", 403);

    // Single atomic mutation: re-checks capacity, picks the FIFO head,
    // flips the subscription, deletes the waitlist row, inserts the
    // notification — all under one advisory lock + transaction.
    const { data: promotedUserId, error: rpcErr } = await admin.rpc(
      "promote_waitlist_atomic",
      { p_event_id: event_id },
    );
    if (rpcErr) return errorResponse(rpcErr.message, 500);

    if (!promotedUserId) {
      return jsonResponse({
        promoted: false,
        message: "Waitlist is empty or event is still full",
      });
    }

    return jsonResponse({ promoted: true, user_id: promotedUserId });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

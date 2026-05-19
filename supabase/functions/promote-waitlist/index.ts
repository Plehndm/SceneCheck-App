// Edge Function: promote-waitlist — FR5.6 (Waitlist Promotion)
// Promotes the next person on the waitlist when capacity frees up.

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

    // Find the next person on the waitlist (FIFO by position)
    const { data: next } = await admin
      .from("waitlist")
      .select("user_id, position")
      .eq("event_id", event_id)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!next) return jsonResponse({ promoted: false, message: "Waitlist is empty" });

    // Promote: update subscription status to 'confirmed'
    await admin
      .from("event_subscriptions")
      .update({ status: "confirmed" })
      .eq("event_id", event_id)
      .eq("user_id", next.user_id);

    // Remove from waitlist
    await admin
      .from("waitlist")
      .delete()
      .eq("event_id", event_id)
      .eq("user_id", next.user_id);

    // Insert notification for the promoted user
    await admin.from("notifications").insert({
      user_id: next.user_id,
      type: "waitlist_promotion",
      payload_json: { event_id, deep_link: `/event/${event_id}` },
    });

    return jsonResponse({ promoted: true, user_id: next.user_id });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

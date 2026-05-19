// Edge Function: organizer-remove — FR11.3 (Moderation)
// Event creator removes a user from their event and its group chat.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createAdminClient, getUserId, jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { event_id, user_id: targetUserId } = await req.json();
    const callerId = await getUserId(req);
    if (!callerId) return errorResponse("Unauthorized", 401);
    if (!event_id || !targetUserId) return errorResponse("event_id and user_id are required");

    const admin = createAdminClient();

    // Verify caller is the event creator
    const { data: event } = await admin
      .from("events")
      .select("creator_id")
      .eq("id", event_id)
      .single();

    if (!event || event.creator_id !== callerId) {
      return errorResponse("Only the event creator can remove attendees", 403);
    }

    // Update subscription to 'removed'
    await admin
      .from("event_subscriptions")
      .update({ status: "removed" })
      .eq("event_id", event_id)
      .eq("user_id", targetUserId);

    // Remove from event group chat
    const { data: chat } = await admin
      .from("chats")
      .select("id")
      .eq("event_id", event_id)
      .eq("type", "group")
      .maybeSingle();

    if (chat) {
      await admin
        .from("chat_members")
        .delete()
        .eq("chat_id", chat.id)
        .eq("user_id", targetUserId);
    }

    // Remove from waitlist if present
    await admin
      .from("waitlist")
      .delete()
      .eq("event_id", event_id)
      .eq("user_id", targetUserId);

    return jsonResponse({ removed: true });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

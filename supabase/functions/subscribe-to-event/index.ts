// Edge Function: subscribe-to-event — FR7 (Event Subscription)
//
// Calls the atomic RPC `subscribe_to_event_atomic` (migration 00015)
// which makes the capacity check + insert a single serialized
// operation. Prior version interleaved a SELECT and an INSERT, which
// let two concurrent subscribers both grab the last seat.
//
// Side-effects after the seat decision (chat opt-in, publish gate)
// remain in the Edge Function — they don't race the seat allocation.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createAdminClient, getUserId,
  jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { event_id, join_chat = false } = await req.json();
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    if (!event_id) return errorResponse("event_id is required");

    const admin = createAdminClient();

    // Atomic seat decision. The RPC takes a per-event advisory lock,
    // checks capacity, inserts the subscription, and (if full) appends
    // the waitlist row + returns the position — all in one transaction.
    const { data: rpcResult, error: rpcErr } = await admin.rpc(
      "subscribe_to_event_atomic",
      { p_event_id: event_id, p_user_id: userId },
    );
    if (rpcErr) return errorResponse(rpcErr.message, 500);

    const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
    if (!row) return errorResponse("subscribe RPC returned no row", 500);

    const subStatus = row.status as "confirmed" | "waitlisted" | "already";
    const waitlistPosition = row.waitlist_position as number | null;

    // Verify the event exists (for the 404 response shape callers expect).
    // We do this AFTER the RPC since the RPC's first SELECT against events
    // would already error in a way the client can't easily distinguish.
    if (subStatus === "already") {
      return jsonResponse({
        status: "already",
        message: "Already subscribed",
        waitlist_position: waitlistPosition,
      });
    }

    // Group chat opt-in. Uses the same admin client; the chat is
    // shared across all attendees so we get-or-create per event.
    let chatId: string | null = null;
    if (join_chat) {
      const { data: existingChat } = await admin
        .from("chats")
        .select("id")
        .eq("event_id", event_id)
        .eq("type", "group")
        .maybeSingle();

      if (existingChat) {
        chatId = existingChat.id;
      } else {
        const { data: newChat } = await admin
          .from("chats")
          .insert({ type: "group", event_id })
          .select("id")
          .single();
        chatId = newChat?.id ?? null;
      }

      if (chatId) {
        await admin.from("chat_members").insert({
          chat_id: chatId,
          user_id: userId,
        });
      }
    }

    // Publish gate may fire (subscriber_count trigger has updated).
    await admin.rpc("check_publish_gate", { p_event_id: event_id });

    return jsonResponse({
      status: subStatus,
      chat_id: chatId,
      waitlist_position: waitlistPosition,
    }, 201);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

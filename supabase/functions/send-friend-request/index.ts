// Edge Function: send-friend-request — FR8 (Social Features) + FR10.1
// (notify recipient that a friend request arrived).
//
// Previous version created the friendship row but never invoked
// dispatch-notification — the recipient saw the request only when they
// opened the inbox. Per FR10.1 they should get a push the moment the
// request lands. We fire the dispatch as a side-effect *after* the row
// commits, and we never block the request response on its result —
// notification failures shouldn't prevent the friend request itself.

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
    const { target_id } = await req.json();
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    if (!target_id) return errorResponse("target_id is required");
    if (target_id === userId) return errorResponse("Cannot friend yourself");

    const admin = createAdminClient();

    // Check if blocked (either direction)
    const { data: blocked } = await admin.rpc("is_blocked", {
      a: userId,
      b: target_id,
    });
    if (blocked) return errorResponse("Cannot send request to this user", 403);

    // Existing friendship row — idempotent.
    const { data: existing } = await admin
      .from("friendships")
      .select("id, status")
      .or(`and(from_id.eq.${userId},to_id.eq.${target_id}),and(from_id.eq.${target_id},to_id.eq.${userId})`)
      .maybeSingle();

    if (existing) {
      return jsonResponse({
        status: existing.status,
        message: existing.status === "accepted" ? "Already friends" : "Request already sent",
      });
    }

    // If target is public, auto-accept; if private, stay pending.
    const { data: targetProfile } = await admin
      .from("profiles")
      .select("visibility, name")
      .eq("user_id", target_id)
      .single();

    const friendshipStatus = targetProfile?.visibility === "public" ? "accepted" : "pending";

    const { data: friendship, error } = await admin
      .from("friendships")
      .insert({
        from_id: userId,
        to_id: target_id,
        status: friendshipStatus,
      })
      .select("id, status")
      .single();

    if (error) return errorResponse(error.message, 500);

    // Notification dispatch (FR10.1). Best-effort: we don't await the
    // promise — even if push delivery fails the friend row is committed.
    // The recipient also sees the request next time they open the app
    // via the `notifications` table, which dispatch-notification writes.
    const { data: sender } = await admin
      .from("profiles")
      .select("name")
      .eq("user_id", userId)
      .single();

    const notifType = friendshipStatus === "accepted"
      ? "friend.added"
      : "friend.requested";
    const senderName = sender?.name ?? "Someone";

    // Fire-and-forget. The dispatch function takes care of its own
    // logging on failure.
    void admin.functions.invoke("dispatch-notification", {
      body: {
        type: notifType,
        recipient_ids: [target_id],
        payload: {
          title: friendshipStatus === "accepted" ? "New friend" : "Friend request",
          body: friendshipStatus === "accepted"
            ? `${senderName} is now your friend on SceneCheck.`
            : `${senderName} wants to add you on SceneCheck.`,
          deep_link: friendshipStatus === "accepted"
            ? `/profile/${userId}`
            : "/requests",
          actor_id: userId,
        },
      },
    });

    return jsonResponse({ friendship_id: friendship.id, status: friendship.status }, 201);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

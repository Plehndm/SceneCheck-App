// Edge Function: dispatch-notification — FR10 (Notifications)
// Selects recipients, inserts notification records, sends Expo push.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient, jsonResponse, errorResponse, handlePreflight } from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { type, payload, recipient_ids, event_id } = await req.json();
    if (!type) return errorResponse("type is required");

    const admin = createAdminClient();
    let recipients: string[] = recipient_ids || [];

    // If no explicit recipients, determine them by type
    if (!recipients.length && event_id) {
      const { data: subs } = await admin
        .from("event_subscriptions")
        .select("user_id")
        .eq("event_id", event_id)
        .eq("status", "confirmed");
      recipients = (subs || []).map((s: { user_id: string }) => s.user_id);
    }

    if (!recipients.length) {
      return jsonResponse({ sent: 0, message: "No recipients" });
    }

    // Insert notification records
    const notifRows = recipients.map((user_id: string) => ({
      user_id,
      type,
      payload_json: payload || {},
    }));
    await admin.from("notifications").insert(notifRows);

    // Fetch push tokens for recipients who have push enabled
    const { data: tokens } = await admin
      .from("user_preferences")
      .select("user_id, push_token")
      .in("user_id", recipients)
      .eq("push_enabled", true)
      .not("push_token", "is", null);

    // Send Expo push notifications (if tokens exist)
    if (tokens?.length) {
      const pushMessages = tokens.map((t: { push_token: string }) => ({
        to: t.push_token,
        title: payload?.title || "SceneCheck",
        body: payload?.body || "You have a new notification",
        data: { deep_link: payload?.deep_link || "/notifications", type },
      }));

      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pushMessages),
        });
      } catch (pushErr) {
        console.error("Expo push failed:", pushErr);
      }
    }

    return jsonResponse({ sent: recipients.length });
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

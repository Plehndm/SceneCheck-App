// Edge Function: rollup-rating — FR5.11 (Event Ratings)
// Inserts a rating and recomputes the host's avg_rating.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createUserClient, createAdminClient, getUserId, jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";
import { validateStars } from "../_shared/validators.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { event_id, stars, text } = await req.json();
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);
    if (!event_id) return errorResponse("event_id is required");
    if (!validateStars(stars)) return errorResponse("stars must be an integer 1-5");

    const supabase = createUserClient(req);
    const admin = createAdminClient();

    // Insert rating (UNIQUE constraint prevents double-rating)
    const { error: ratingErr } = await supabase
      .from("ratings")
      .insert({
        event_id,
        user_id: userId,
        stars,
        text: text || "",
      });

    if (ratingErr) {
      if (ratingErr.code === "23505") {
        return errorResponse("You have already rated this event", 409);
      }
      return errorResponse(ratingErr.message, 500);
    }

    // Look up the event's creator to rollup their rating
    const { data: event } = await admin
      .from("events")
      .select("creator_id")
      .eq("id", event_id)
      .single();

    if (event?.creator_id) {
      await admin.rpc("rollup_host_rating", { p_host_id: event.creator_id });
    }

    return jsonResponse({ rated: true }, 201);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

// Edge Function: create-event — FR5 (User-Created Events)
// Creates an event with PostGIS point, interest tags, and publish gate check.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createUserClient, getUserId, jsonResponse, errorResponse, handlePreflight,
} from "../_shared/supabase-client.ts";
import { requireFields, validateLocation } from "../_shared/validators.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const missing = requireFields(body, ["title", "start_at", "location"]);
    if (missing) return errorResponse(missing);

    if (!validateLocation(body.location)) {
      return errorResponse("location must have valid lat and lng");
    }

    const supabase = createUserClient(req);
    const { lat, lng } = body.location;

    // Insert event with PostGIS point
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .insert({
        creator_id: userId,
        title: body.title,
        description: body.description || "",
        geog: `SRID=4326;POINT(${lng} ${lat})`,
        location_name: body.location_name || "",
        start_at: body.start_at,
        end_at: body.end_at || null,
        capacity: body.capacity || null,
        status: "draft",
        source: "user",
        min_subscribers: body.min_subscribers || Math.max(1, Math.ceil((body.capacity || 10) / 5)),
      })
      .select("id")
      .single();

    if (eventErr) return errorResponse(eventErr.message, 500);

    // Insert interest tags
    if (body.interests?.length) {
      const rows = body.interests.map((interest_id: string) => ({
        event_id: event.id,
        interest_id,
      }));
      const { error: tagErr } = await supabase
        .from("event_interests")
        .insert(rows);
      if (tagErr) console.error("Failed to insert event_interests:", tagErr);
    }

    // Check publish gate — if min_subscribers <= 1, publish immediately
    if ((body.min_subscribers || 1) <= 1) {
      await supabase
        .from("events")
        .update({ status: "published" })
        .eq("id", event.id);
    }

    return jsonResponse({ event_id: event.id }, 201);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

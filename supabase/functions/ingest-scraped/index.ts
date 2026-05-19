// Edge Function: ingest-scraped — FR6 (App-Created Events)
// Validates scraped event data, auto-tags, and inserts with source='scraped'.
// Called by GitHub Actions scraper with service_role_key auth.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient, jsonResponse, errorResponse, handlePreflight } from "../_shared/supabase-client.ts";
import { requireFields, validateLocation } from "../_shared/validators.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const body = await req.json();

    // Validate required fields (FR6.3)
    const missing = requireFields(body, ["title", "start_at", "location"]);
    if (missing) {
      console.warn(`Skipping scraped event: ${missing}`, { title: body.title });
      return errorResponse(missing);
    }

    if (!validateLocation(body.location)) {
      return errorResponse("location must have valid lat and lng");
    }

    const admin = createAdminClient();
    const { lat, lng } = body.location;

    // Insert the scraped event
    const { data: event, error: eventErr } = await admin
      .from("events")
      .insert({
        creator_id: null, // scraped events have no creator
        title: body.title,
        description: body.description || "",
        geog: `SRID=4326;POINT(${lng} ${lat})`,
        location_name: body.location_name || "",
        start_at: body.start_at,
        end_at: body.end_at || null,
        capacity: body.capacity || null,
        status: "published", // scraped events go live immediately
        source: "scraped",
        min_subscribers: 1,
      })
      .select("id")
      .single();

    if (eventErr) return errorResponse(eventErr.message, 500);

    // Auto-tag: match description keywords against interest names (FR6.2)
    if (body.description) {
      const { data: allInterests } = await admin
        .from("interests")
        .select("id, name");

      if (allInterests) {
        const desc = body.description.toLowerCase();
        const matchedIds = allInterests
          .filter((i: { name: string }) => desc.includes(i.name.toLowerCase()))
          .map((i: { id: string }) => ({ event_id: event.id, interest_id: i.id }));

        if (matchedIds.length) {
          await admin.from("event_interests").insert(matchedIds);
        }
      }
    }

    return jsonResponse({ event_id: event.id }, 201);
  } catch (err) {
    // FR6.4: Log failure and return error without disrupting other operations
    console.error("ingest-scraped error:", err);
    return errorResponse(String(err), 500);
  }
});

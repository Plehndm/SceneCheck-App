// Edge Function: create-event — FR5 (User-Created Events)
// Creates an event with PostGIS point, interest tags, and publish gate check.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import {
  createAdminClient, createUserClient, getUserId,
  jsonResponse, errorResponse, handlePreflight,
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

    // Price validation mirrors the migration 00040 CHECK constraint so
    // a malformed body errors with a 400 + clear message instead of a
    // 500 Postgres violation. Either all three fields null (default —
    // host didn't specify a price) or all three set with non-negative
    // bounds and max >= min.
    const priceMin: number | null = body.price_min ?? null;
    const priceMax: number | null = body.price_max ?? null;
    const priceCurrency: string | null = body.price_currency ?? null;
    if ((priceMin === null) !== (priceMax === null)) {
      return errorResponse("price_min and price_max must both be set or both null");
    }
    if (priceMin !== null && priceMax !== null) {
      if (!Number.isFinite(priceMin) || !Number.isFinite(priceMax)) {
        return errorResponse("price_min and price_max must be numbers");
      }
      if (priceMin < 0) return errorResponse("price_min must be >= 0");
      if (priceMax < priceMin) return errorResponse("price_max must be >= price_min");
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
        // Optional price triple from the create-event form. Both bounds
        // 0 = FREE; both equal nonzero = fixed; min < max = range.
        price_min: priceMin,
        price_max: priceMax,
        price_currency: priceCurrency,
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

    // Publish gate (FR5.4). Rule lives in SQL (`check_publish_gate`, migration
    // 00012) — call it instead of re-implementing inline so the two paths
    // can't drift (CODE_REVIEW_REPORT_3 M1). The SQL function is a no-op when
    // the gate isn't met, so it's safe to always call.
    const admin = createAdminClient();
    await admin.rpc("check_publish_gate", { p_event_id: event.id });

    // Notify nearby/interested users that a new event was published
    // (FR10.3). Fire-and-forget: a notification dispatch failure must
    // not fail the create itself (CODE_REVIEW_REPORT_3 H1). dispatch-notification
    // resolves recipients by `event_id` when `recipient_ids` is omitted.
    void admin.functions.invoke("dispatch-notification", {
      body: {
        type: "event.published",
        event_id: event.id,
        payload: {
          title: "New event",
          body: body.title,
          deep_link: `/event/${event.id}`,
        },
      },
    });

    return jsonResponse({ event_id: event.id }, 201);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

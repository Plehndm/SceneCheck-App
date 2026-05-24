// Edge Function: ingest-scraped — FR6 (App-Created Events)
// Validates scraped event data, auto-tags, and inserts with source='scraped'.
//
// Auth: deploy with `--no-verify-jwt` (the new sb_secret_… key isn't a JWT, so
// it can't satisfy the default JWT gate). The caller is instead authorized by a
// shared `INGEST_TOKEN` secret it sends in the `x-ingest-token` header — set it
// with `supabase secrets set INGEST_TOKEN=…`. The privileged insert still uses
// the function's platform-injected service key via createAdminClient().

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createAdminClient, jsonResponse, errorResponse, handlePreflight } from "../_shared/supabase-client.ts";
import { requireFields, validateLocation } from "../_shared/validators.ts";
import { analyzeInterests, type CatalogInterest } from "../_shared/interest-matching.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  // Shared-secret gate. Fail closed: if INGEST_TOKEN isn't configured (or the
  // header doesn't match), reject — the function is --no-verify-jwt, so this is
  // the only thing standing between the public internet and an insert.
  const expectedToken = Deno.env.get("INGEST_TOKEN");
  if (!expectedToken || req.headers.get("x-ingest-token") !== expectedToken) {
    return errorResponse("Unauthorized", 401);
  }

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

    // Dedupe: the daily scraper re-sees the same source events, so skip if a
    // scraped event with the same title + start already exists (idempotent
    // re-runs). `.limit(1)` instead of `.maybeSingle()` so pre-existing dupes
    // don't error here. Title + start_at is a good natural key for these.
    const { data: dupes } = await admin
      .from("events")
      .select("id")
      .eq("source", "scraped")
      .eq("title", body.title)
      .eq("start_at", body.start_at)
      .limit(1);
    if (dupes && dupes.length > 0) {
      return jsonResponse({ event_id: dupes[0].id, deduped: true }, 200);
    }

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
        source_url: body.source_url || null, // original listing the scraper pulled from
        min_subscribers: 1,
      })
      .select("id")
      .single();

    if (eventErr) return errorResponse(eventErr.message, 500);

    // Auto-tag (FR6.2): analyze the title + description against the interest
    // catalog. Existing interests whose name (or a `similar_tags` alias) appears
    // as a whole word get attached; when NOTHING matches, derive a new interest
    // from the text, create it, and attach that — so a scraped event about
    // something the catalog doesn't cover yet is still labeled, and the new
    // interest enters the catalog for everyone. (The old version only scanned
    // the description, matched on a raw substring, and never created a tag.)
    const { data: catalog } = await admin
      .from("interests")
      .select("id, name, similar_tags");

    const rows = (catalog ?? []) as { id: string; name: string; similar_tags: string[] | null }[];
    const { matched, suggested } = analyzeInterests(
      body.title,
      body.description || "",
      rows as CatalogInterest[],
    );

    const idByName = new Map(rows.map((r) => [r.name, r.id]));
    let interestIds = matched
      .map((name) => idByName.get(name))
      .filter((id): id is string => Boolean(id));

    if (interestIds.length === 0 && suggested) {
      // No catalog interest matched — mint one from the text. Re-select on
      // conflict so a concurrent insert (or a tag added since the SELECT) is
      // reused instead of failing the whole ingest on a UNIQUE violation.
      const { data: created, error: createErr } = await admin
        .from("interests")
        .insert({ name: suggested })
        .select("id")
        .single();
      if (created) {
        interestIds = [created.id];
      } else {
        const { data: existing } = await admin
          .from("interests").select("id").eq("name", suggested).maybeSingle();
        if (existing) interestIds = [existing.id];
        else console.error("Failed to create interest:", createErr);
      }
    }

    if (interestIds.length) {
      const tagRows = interestIds.map((interest_id) => ({ event_id: event.id, interest_id }));
      const { error: tagErr } = await admin.from("event_interests").insert(tagRows);
      if (tagErr) console.error("Failed to insert event_interests:", tagErr);
    }

    return jsonResponse({ event_id: event.id }, 201);
  } catch (err) {
    // FR6.4: Log failure and return error without disrupting other operations
    console.error("ingest-scraped error:", err);
    return errorResponse(String(err), 500);
  }
});

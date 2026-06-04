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

    // Price validation mirrors the migration's CHECK constraint so a
    // mismatched body errors with a 400 + clear message instead of a
    // 500 Postgres constraint violation. Both null is fine (the column
    // default); both set requires non-negative + max >= min.
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

    // Optional cover image (hot-linked from the source CDN, e.g. Eventbrite's
    // img.evbuc.com). Accept only an http(s) URL; anything else stores NULL.
    const imageUrl: string | null =
      typeof body.image_url === "string" && /^https?:\/\//i.test(body.image_url)
        ? body.image_url
        : null;

    const admin = createAdminClient();
    const { lat, lng } = body.location;

    // Dedupe: the daily scraper re-sees the same source events, so skip if a
    // scraped event with the same identity already exists.
    //
    // Identity priority:
    //   1. source_url  — the partial unique index on events(source_url)
    //      WHERE source='scraped' (migration 00033) makes this the
    //      authoritative key. Looking it up here lets us self-heal stale
    //      fields (notably start_at/end_at) on subsequent scrapes, which
    //      matters when the scraper switches time-resolution paths (e.g.
    //      from broken UTC-midnight under date-only JSON-LD to the
    //      detail-page's real timezone-aware value).
    //   2. title + start_at — kept as a fallback for FALLBACK_EVENTS in
    //      the scraper, which have source_url=NULL and are exempt from
    //      the partial index.
    type DupeRow = {
      id: string;
      start_at: string | null;
      end_at: string | null;
      price_min: number | null;
      price_max: number | null;
      price_currency: string | null;
      image_url: string | null;
    };
    const DUPE_COLS = "id, start_at, end_at, price_min, price_max, price_currency, image_url";
    let dupeRow: DupeRow | null = null;
    if (body.source_url) {
      const { data } = await admin
        .from("events")
        .select(DUPE_COLS)
        .eq("source", "scraped")
        .eq("source_url", body.source_url)
        .limit(1);
      if (data && data.length > 0) dupeRow = data[0] as DupeRow;
    }
    if (!dupeRow) {
      const { data } = await admin
        .from("events")
        .select(DUPE_COLS)
        .eq("source", "scraped")
        .eq("title", body.title)
        .eq("start_at", body.start_at)
        .limit(1);
      if (data && data.length > 0) dupeRow = data[0] as DupeRow;
    }
    if (dupeRow) {
      // Self-heal: patch start_at/end_at/price fields in place when the
      // scraper has since resolved better values for the same source
      // event. Two cases this covers:
      //   - Times: the scraper used to write date-only-parsed-as-UTC-
      //     midnight for Eventbrite listings; the new resolver follows
      //     the detail page and ships a real PT timestamp instead.
      //   - Prices: pre-migration-00040 rows have NULL price fields;
      //     the next scrape populates them.
      // Without this heal, the dedup short-circuits and the existing
      // row keeps its old fields forever.
      const wantStart = body.start_at;
      const wantEnd: string | null = body.end_at ?? null;
      const patch: Record<string, unknown> = {};
      if (dupeRow.start_at !== wantStart) patch.start_at = wantStart;
      if (dupeRow.end_at !== wantEnd) patch.end_at = wantEnd;
      // Price comparison uses != (loose) because the DB returns
      // NUMERIC as JS number (or sometimes string) — coerce both sides.
      const numEq = (a: unknown, b: unknown): boolean => {
        if (a === null || b === null) return a === b;
        return Number(a) === Number(b);
      };
      if (!numEq(dupeRow.price_min, priceMin)) patch.price_min = priceMin;
      if (!numEq(dupeRow.price_max, priceMax)) patch.price_max = priceMax;
      if ((dupeRow.price_currency ?? null) !== (priceCurrency ?? null)) {
        patch.price_currency = priceCurrency;
      }
      // Backfill/refresh the cover image (older rows predate the column; the
      // source may also swap its image).
      if ((dupeRow.image_url ?? null) !== imageUrl) patch.image_url = imageUrl;
      if (Object.keys(patch).length > 0) {
        const { error: updErr } = await admin
          .from("events")
          .update(patch)
          .eq("id", dupeRow.id);
        if (updErr) {
          console.error(`Failed to self-heal scraped event ${dupeRow.id}:`, updErr.message);
        }
      }
      return jsonResponse({ event_id: dupeRow.id, deduped: true }, 200);
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
        // Price triple. Validated above; either all three null or all
        // three set with max >= min >= 0. The migration's CHECK
        // constraint enforces the same invariant.
        price_min: priceMin,
        price_max: priceMax,
        price_currency: priceCurrency,
        status: "published", // scraped events go live immediately
        source: "scraped",
        source_url: body.source_url || null, // original listing the scraper pulled from
        image_url: imageUrl, // hot-linked cover image from the source CDN
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

    if (interestIds.length === 0 && suggested.length) {
      // No catalog interest matched — mint each derived tag (the analyzer
      // returns up to MAX_DERIVED_TAGS meaningful ones) and attach them all.
      // Re-select on conflict so a concurrent insert (or a tag added since the
      // SELECT) is reused instead of failing the ingest on a UNIQUE violation.
      for (const name of suggested) {
        let id = idByName.get(name);
        if (!id) {
          const { data: created, error: createErr } = await admin
            .from("interests").insert({ name }).select("id").single();
          if (created) id = created.id;
          else {
            const { data: existing } = await admin
              .from("interests").select("id").eq("name", name).maybeSingle();
            if (existing) id = existing.id;
            else console.error(`Failed to create interest "${name}":`, createErr);
          }
        }
        if (id) interestIds.push(id);
      }
    }

    // Dedupe ids so a coincidental overlap can't violate the event_interests PK.
    interestIds = [...new Set(interestIds)];
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

// Edge Function: rank-events — FR4 (Event Discovery)
// Thin wrapper calling the rank_events_query Postgres function (PostGIS).

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createUserClient, jsonResponse, errorResponse, handlePreflight } from "../_shared/supabase-client.ts";

serve(async (req: Request) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("Method not allowed", 405);

  try {
    const { user_lat, user_lng, radius_m, user_id } = await req.json();

    if (typeof user_lat !== "number" || typeof user_lng !== "number") {
      return errorResponse("user_lat and user_lng are required numbers");
    }
    if (typeof radius_m !== "number" || radius_m <= 0) {
      return errorResponse("radius_m must be a positive number");
    }

    const supabase = createUserClient(req);
    const { data, error } = await supabase.rpc("rank_events_query", {
      p_lat: user_lat,
      p_lng: user_lng,
      p_radius: radius_m,
      p_user_id: user_id,
    });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse(data);
  } catch (err) {
    return errorResponse(String(err), 500);
  }
});

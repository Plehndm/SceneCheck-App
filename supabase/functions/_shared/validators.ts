// Input validation helpers shared across Edge Functions

export function requireFields(
  body: Record<string, unknown>,
  fields: string[],
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return `Missing required field: ${field}`;
    }
  }
  return null;
}

export function validateStars(stars: unknown): stars is number {
  return typeof stars === "number" && Number.isInteger(stars) && stars >= 1 && stars <= 5;
}

export function validateLocation(loc: unknown): loc is { lat: number; lng: number } {
  if (!loc || typeof loc !== "object") return false;
  const { lat, lng } = loc as Record<string, unknown>;
  return typeof lat === "number" && typeof lng === "number"
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180;
}

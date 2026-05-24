// Unit tests for the scraped-event auto-tagger (analyzeInterests / deriveTag).
// Run with: deno test supabase/functions/_shared/interest-matching.test.ts

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { analyzeInterests, deriveTag, type CatalogInterest } from "./interest-matching.ts";

const CATALOG: CatalogInterest[] = [
  { name: "biking", similar_tags: ["cycling", "spin"] },
  { name: "cooking", similar_tags: ["baking"] },
  { name: "board-games", similar_tags: ["catan"] },
];

Deno.test("matches an interest by its canonical name in the description", () => {
  const r = analyzeInterests("Morning ride", "Casual biking around the bay", CATALOG);
  assertEquals(r.matched, ["biking"]);
  assertEquals(r.suggested, null);
});

Deno.test("matches via a similar_tags alias (cycling → biking)", () => {
  const r = analyzeInterests("Cycling meetup", "", CATALOG);
  assertEquals(r.matched, ["biking"]);
  assertEquals(r.suggested, null);
});

Deno.test("matches multiple interests, in catalog order, incl. hyphenated phrase", () => {
  const r = analyzeInterests("Cooking + board games", "", CATALOG);
  assertEquals(r.matched, ["cooking", "board-games"]);
  assertEquals(r.suggested, null);
});

Deno.test("matches whole words only — 'spinning' does not hit the 'spin' alias", () => {
  const r = analyzeInterests("Spinning class", "", CATALOG);
  assertEquals(r.matched, []);
  // Nothing matched, so a tag is derived from the text instead.
  assertEquals(r.suggested, "spinning");
});

Deno.test("derives a new tag from the title when nothing in the catalog matches", () => {
  const r = analyzeInterests("Pottery night", "Throw clay on the wheel", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested, "pottery"); // "night" is filler; "pottery" wins
});

Deno.test("deriveTag prefers a repeated, specific word over filler", () => {
  // "kayak" appears in title + description, so frequency lifts it over "river".
  assertEquals(deriveTag("Kayak trip", "Beginner kayak session on the river"), "kayak");
});

Deno.test("deriveTag skips stop/format words and bare numbers", () => {
  assertEquals(deriveTag("Free weekly meetup 2024", ""), null);
});

Deno.test("deriveTag returns null for empty text", () => {
  assertEquals(deriveTag("", ""), null);
});

Deno.test("falls back to description words when the title is all filler", () => {
  const r = analyzeInterests("Weekly meetup", "Bring your astronomy questions — astronomy for all", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested, "astronomy"); // repeated → highest frequency wins
});

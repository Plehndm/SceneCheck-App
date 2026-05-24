// Unit tests for the scraped-event auto-tagger (analyzeInterests / deriveTag(s)).
// Run with: deno test supabase/functions/_shared/interest-matching.test.ts

import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  analyzeInterests, deriveTag, deriveTags, UNKNOWN_TAG, MAX_DERIVED_TAGS,
  type CatalogInterest,
} from "./interest-matching.ts";

const CATALOG: CatalogInterest[] = [
  { name: "biking", similar_tags: ["cycling", "spin"] },
  { name: "cooking", similar_tags: ["baking", "dinner-club"] },
  { name: "board-games", similar_tags: ["catan"] },
  { name: "running", similar_tags: ["jogging", "5k"] },
];

Deno.test("matches an interest by its canonical name in the description", () => {
  const r = analyzeInterests("Morning ride", "Casual biking around the bay", CATALOG);
  assertEquals(r.matched, ["biking"]);
  assertEquals(r.suggested, []); // matched → nothing new minted
});

Deno.test("matches via a similar_tags alias (cycling → biking)", () => {
  assertEquals(analyzeInterests("Cycling tour downtown", "", CATALOG).matched, ["biking"]);
});

Deno.test("fuzzy: every inflected form of 'bike' reuses the 'biking' interest", () => {
  // The whole point of stem matching — none of these mint a near-duplicate.
  for (const v of ["bike", "bikes", "biked", "biker", "bikers"]) {
    assertEquals(analyzeInterests(`Sunday ${v} ride`, "", CATALOG).matched, ["biking"], v);
  }
});

Deno.test("fuzzy: run / runs / running / runner all reuse 'running'", () => {
  for (const v of ["run", "runs", "running", "runner", "runners", "jogging"]) {
    assertEquals(analyzeInterests(`Morning ${v} by the pier`, "", CATALOG).matched, ["running"], v);
  }
});

Deno.test("fuzzy: 'Spinning class' reuses 'biking' via its 'spin' alias", () => {
  assertEquals(analyzeInterests("Spinning class", "", CATALOG).matched, ["biking"]);
});

Deno.test("distinct roots are NOT merged ('hiking' ≠ 'biking')", () => {
  // The point is that hiking doesn't falsely match the biking interest; it
  // derives its own tag (alongside any other meaningful word in the title).
  const r = analyzeInterests("Hiking trail", "", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested.includes("hiking"), true);
});

Deno.test("matches multiple CATALOG interests, in catalog order (uncapped), incl. phrase", () => {
  const r = analyzeInterests("Cooking + board games + a casual bike ride", "", CATALOG);
  assertEquals(r.matched, ["biking", "cooking", "board-games"]);
  assertEquals(r.suggested, []);
});

Deno.test("a multi-word alias needs all its words (dinner without club ≠ cooking)", () => {
  assertEquals(analyzeInterests("Dinner by the bay", "", CATALOG).matched, []);
});

Deno.test("derives a new tag from the title when nothing in the catalog matches", () => {
  const r = analyzeInterests("Pottery night", "Throw clay on the wheel", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested, ["pottery"]); // "night" is filler; "pottery" wins
});

Deno.test("derives MULTIPLE meaningful tags when the text has several topics", () => {
  // None of these are in CATALOG, so all become new tags (title words win).
  const r = analyzeInterests("Pottery and Knitting", "Beginner knitting circle", CATALOG);
  assertEquals(r.matched, []);
  assertEquals([...r.suggested].sort(), ["knitting", "pottery"]); // both, order-agnostic
});

Deno.test("deriveTags is capped at MAX_DERIVED_TAGS and deduped by stem", () => {
  const many = deriveTags("Yoga Pottery Knitting Surfing Climbing", "");
  assertEquals(many.length, MAX_DERIVED_TAGS);
  // "running" + "runners" share a stem → only one tag.
  assertEquals(deriveTags("Running with runners", ""), ["running"]);
});

Deno.test("a derived tag is singularized for a clean catalog label", () => {
  assertEquals(analyzeInterests("Taco crawl", "tasty tacos", CATALOG).suggested, ["taco"]);
  assertEquals(deriveTag("Puppies", ""), "puppy");
});

Deno.test("deriveTag prefers a repeated, specific word over filler", () => {
  assertEquals(deriveTag("Kayak trip", "Beginner kayak session on the river"), "kayak");
});

Deno.test("deriveTag skips stop/format words and bare numbers", () => {
  assertEquals(deriveTag("Free weekly meetup 2024", ""), null);
});

Deno.test("deriveTag returns null for empty text", () => {
  assertEquals(deriveTag("", ""), null);
});

Deno.test("falls back to description words when the title is all filler", () => {
  const r = analyzeInterests("Weekly meetup", "Bring your astronomy questions, astronomy for all", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested[0], "astronomy"); // repeated → highest stem frequency leads
});

Deno.test("text with no usable word falls back to the 'unknown' tag", () => {
  const r = analyzeInterests("Grand Opening Sale", "Networking mixer in Orange County", CATALOG);
  assertEquals(r.matched, []);
  assertEquals(r.suggested, [UNKNOWN_TAG]);
  assertEquals(UNKNOWN_TAG, "unknown");
});

Deno.test("a real topic word still survives the expanded stop list", () => {
  assertEquals(analyzeInterests("Summer Pottery Sale", "", CATALOG).suggested, ["pottery"]);
});

// Auto-tagging for scraped events (FR6, "App-Created Events"). Given an event's
// title + description, decide which interest tags should label it:
//
//   - existing catalog interests whose name — or one of its `similar_tags`
//     aliases — appears in the text, OR
//   - when the text matches NOTHING in the catalog, up to MAX_DERIVED_TAGS
//     tags derived primarily from the TITLE (its lead words, in order — that's
//     where the keywords people care about usually are). Adjacent words in a run
//     combine into a single ≤2-word compound ("cold brew", "natural medicine");
//     the description is only a fallback when the title has no usable word. The
//     caller mints these as new interests and attaches them, so an event about
//     something the catalog doesn't cover yet is still labeled. If neither title
//     nor description has a usable word — only stop words / filler / numbers —
//     we don't mint a junk interest; we fall back to the catch-all `unknown` tag.
//
// Note: an event matching several CATALOG interests already carries all of them
// (the matched path is uncapped); the cap only limits how many brand-new
// interests one event can coin.
//
// Matching is FUZZY: words are compared by a morphological stem, so "bike",
// "biking", "bikes" and "biker" all collapse to one key — and an event saying
// "Sunday bike ride" reuses the existing "biking" interest instead of minting a
// near-duplicate "bike". The same stem comparison runs against an interest's
// `similar_tags`, so "Spinning class" reuses "biking" via its "spin" alias.
// (Stemming is intentionally morphology-only — it never merges distinct roots
// the way an edit-distance match would wrongly fuse "biking"/"hiking".)
//
// This is the pure, side-effect-free core so the matching is unit-testable; the
// DB I/O (fetch the catalog, persist a derived interest, attach event_interests)
// lives in the ingest-scraped function.

export interface CatalogInterest {
  name: string;
  similar_tags?: string[] | null;
}

export interface InterestAnalysis {
  // Canonical catalog names that match the event text, in catalog order.
  matched: string[];
  // The NEW tags to mint + apply when `matched` is empty: up to
  // MAX_DERIVED_TAGS meaningful words derived from the text (so a rich title
  // like "Yoga & Meditation Retreat" yields several), or `[UNKNOWN_TAG]` when
  // the text has no usable word. Empty when something matched (the event
  // already has tags from the catalog, so nothing new is minted).
  suggested: string[];
}

// Cap on how many new tags one event can mint, so a wordy title can't flood the
// catalog. The matched-catalog path is uncapped (an event can carry as many
// existing interests as it genuinely matches).
export const MAX_DERIVED_TAGS = 3;

// Catch-all label for an event whose text yields no real interest word — better
// than coining a junk tag from listing filler ("experience", "orange", …) or
// leaving the event untagged entirely.
export const UNKNOWN_TAG = "unknown";

// Words too generic to match an interest on, or to mint one from. Anything here
// is skipped when picking a tag, so an event built only from these falls back to
// UNKNOWN_TAG instead of coining a low-signal interest.
const STOP_WORDS = new Set<string>([
  // Function words.
  "the", "and", "for", "you", "your", "our", "out", "are", "was", "will",
  "from", "this", "that", "these", "those", "here", "there", "into", "over",
  "what", "when", "where", "who", "how", "why", "come", "join", "lets", "let",
  "get", "got", "all", "any", "new", "off", "too", "not", "but", "about", "with",
  "is", "no", "longer", "optional",
  // Event-format filler.
  "event", "events", "night", "nights", "day", "days", "week", "weekend",
  "weekends", "morning", "evening", "afternoon", "meetup", "meet", "session",
  "sessions", "group", "groups", "club", "clubs", "hangout", "gathering",
  "free", "open", "public", "private", "weekly", "monthly", "daily", "annual",
  "everyone", "people", "welcome", "workshop", "workshops", "class", "classes",
  "seminar", "webinar", "masterclass", "bootcamp", "demo", "popup",
  // Marketing / commercial / listing filler.
  "experience", "experiences", "sale", "sales", "drop", "launch", "grand",
  "opening", "enrolling", "enroll", "briefing", "conference", "summit", "expo",
  "fair", "fairs", "networking", "mixer", "social", "party", "parties", "bash",
  "crawl", "tour", "tours", "stroll", "strolls", "scavenger", "hunt", "show",
  "shows", "showcase", "kickoff", "gala", "fundraiser", "celebration", "deal",
  "deals", "special", "featuring", "presents", "edition", "series", "official",
  // Generic / topic-less nouns.
  "business", "businesses", "professional", "professionals", "lunch", "brunch",
  "breakfast", "career", "careers", "industry", "leadership", "growth", "market",
  "markets", "meeting", "talk", "talks", "panel",
  // Place / time tokens (locale-specific filler for the Irvine/OC scraper).
  "orange", "county", "irvine", "tustin", "summer", "spring", "fall", "winter",
  "autumn", "saturday", "sunday", "monday", "tuesday", "wednesday", "thursday",
  "friday", "ages", "age",
]);

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// Lowercase and collapse every run of non-alphanumeric characters to a single
// space: "Board-Games & Pizza!" → "board games pizza".
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

// Reduce a word to a coarse morphological key so inflected forms of the same
// root collide: bike / biking / bikes → "bik"; run / running / runs → "run".
// These keys are for comparison only and need not be real words. Order matters:
// strip the plural / 3rd-person ending, then a verb/agentive suffix, then a
// doubled final consonant (runn→run), then a silent trailing e.
//
// The `-er` strip is gated to longer words (>6 chars) so it collapses
// derivations like "designer"→"design" / "teacher"→"teach" WITHOUT over-reducing
// short words: "career" stays "career" (not "car", which would wrongly match
// "care"/"cars"), and "water" stays "water". The trade-off is that short
// agentive forms ("biker", "runner") no longer collapse to their verb stem —
// an acceptable edge case vs. the false matches the aggressive form caused.
function stemKey(word: string): string {
  let w = word.toLowerCase();

  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);

  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 6 && w.endsWith("er")) w = w.slice(0, -2);

  if (w.length > 2 && w[w.length - 1] === w[w.length - 2] && !VOWELS.has(w[w.length - 1])) {
    w = w.slice(0, -1);
  }
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);

  return w;
}

// The stem keys of a term that may be one or more words ("trail-running",
// "board games"). A term matches when ALL of its keys are present in the text.
function termKeys(term: string): string[] {
  return words(term).map(stemKey).filter((k) => k.length >= 2);
}

function interestMatches(
  interest: CatalogInterest,
  textKeys: Set<string>,
): boolean {
  const matchesTerm = (term: string): boolean => {
    const keys = termKeys(term);
    return keys.length > 0 && keys.every((k) => textKeys.has(k));
  };
  if (matchesTerm(interest.name)) return true;
  return (interest.similar_tags ?? []).some(matchesTerm);
}

// A word worth matching on / minting a tag from: at least 3 characters, not a
// stop word, and not a bare number ("2024"; "5k" survives — it has a letter).
function isCandidate(w: string): boolean {
  return w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w);
}

// Light singularizer for a NEW tag's stored label — keeps it a readable word
// ("tacos" → "taco", "parties" → "party") rather than the coarse stemKey
// ("bik"). Dedup across future events doesn't rely on this (it stems both
// sides); this is just so the catalog entry reads naturally.
function singularize(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && /(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !/(ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

// Split a title into segments on punctuation that separates list items, so
// words on opposite sides of a comma / dash / slash / pipe aren't fused into a
// two-word phrase. (A spaced hyphen "A - B" is a separator; an intra-word
// hyphen is left alone.)
function titleSegments(title: string): string[] {
  return title.replace(/\s[-–—]\s/g, " | ").split(/[,;:|/()&+]+/);
}

// Runs of CONSECUTIVE candidate words within the title. A non-candidate token
// (stop word, number, short word) or a segment boundary breaks a run — so
// "Pottery and Knitting" is two runs (the stop "and" splits them) while
// "Natural Medicine" / "Cold Brew" each stay a single run.
function titleRuns(title: string): string[][] {
  const runs: string[][] = [];
  for (const seg of titleSegments(title)) {
    let run: string[] = [];
    for (const w of words(seg)) {
      if (isCandidate(w)) run.push(w);
      else if (run.length) { runs.push(run); run = []; }
    }
    if (run.length) runs.push(run);
  }
  return runs;
}

// Title phrases, emphasizing the lead words. Within a run the first two words
// combine into ONE ≤2-word tag — so a related adjacent compound like
// "cold brew" / "natural medicine" becomes a single interest — and any further
// words in the run stay as unigrams.
function titlePhrases(title: string): string[] {
  const out: string[] = [];
  for (const run of titleRuns(title)) {
    if (run.length >= 2) {
      out.push(`${run[0]} ${run[1]}`);
      for (let i = 2; i < run.length; i++) out.push(run[i]);
    } else {
      out.push(run[0]);
    }
  }
  return out;
}

// Take up to `max` tags, one per stem-key (first wins). A 2-word phrase is kept
// verbatim; a single word is singularized for a clean label.
function takeTags(phrases: string[], max: number): string[] {
  const out: string[] = [];
  const used = new Set<string>();
  for (const p of phrases) {
    const parts = p.split(" ");
    const key = parts.map(stemKey).join(" ");
    if (used.has(key)) continue;
    used.add(key);
    out.push(parts.length === 1 ? singularize(p) : p);
    if (out.length >= max) break;
  }
  return out;
}

// Mint up to `max` tags from the text when the catalog has nothing for it. MOST
// emphasis on the TITLE: its phrases (lead words in reading order, with adjacent
// pairs combined into ≤2-word compounds) become the tags — a word the
// description merely repeats can't displace them. The description is used only
// as a fallback when the title has no usable word, ranked there by stem
// frequency (then length, then order). Returns [] when neither has a usable word.
export function deriveTags(title: string, description: string, max = MAX_DERIVED_TAGS): string[] {
  const phrases = titlePhrases(title);
  if (phrases.length) return takeTags(phrases, max);

  const descWords = words(description).filter(isCandidate);
  if (!descWords.length) return [];
  const freq = new Map<string, number>();
  for (const w of descWords) {
    const k = stemKey(w);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  const ranked = descWords
    .map((w, i) => ({ w, i }))
    .sort((a, b) =>
      freq.get(stemKey(b.w))! - freq.get(stemKey(a.w))! || b.w.length - a.w.length || a.i - b.i)
    .map((r) => r.w);
  return takeTags(ranked, max);
}

// Single best derived tag, or null. Thin wrapper over deriveTags for callers
// (and tests) that only want one.
export function deriveTag(title: string, description: string): string | null {
  return deriveTags(title, description, 1)[0] ?? null;
}

// Analyze an event's title + description against the interest catalog. See
// InterestAnalysis for the shape; `suggested` is only populated when nothing in
// `catalog` fuzzily matched the text.
export function analyzeInterests(
  title: string,
  description: string,
  catalog: CatalogInterest[],
): InterestAnalysis {
  const textKeys = new Set(words(`${title} ${description}`).map(stemKey));
  const matched: string[] = [];
  const seen = new Set<string>();
  for (const interest of catalog) {
    if (seen.has(interest.name)) continue;
    if (interestMatches(interest, textKeys)) {
      seen.add(interest.name);
      matched.push(interest.name);
    }
  }
  if (matched.length) return { matched, suggested: [] };
  // Nothing matched — derive up to MAX_DERIVED_TAGS meaningful tags from the
  // text, or fall back to [UNKNOWN_TAG] when it has no usable word.
  const derived = deriveTags(title, description);
  return { matched, suggested: derived.length ? derived : [UNKNOWN_TAG] };
}

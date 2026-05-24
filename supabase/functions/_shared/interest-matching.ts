// Auto-tagging for scraped events (FR6, "App-Created Events"). Given an event's
// title + description, decide which interest tags should label it:
//
//   - existing catalog interests whose name — or one of its `similar_tags`
//     aliases — appears in the text, OR
//   - when the text matches NOTHING in the catalog, a single tag derived from
//     the text's most salient word, which the caller mints as a new interest
//     and attaches. So an event about something the catalog doesn't cover yet
//     is still labeled (and a brand new interest is born from it). If the text
//     has no usable word — only stop words / event filler / numbers — we don't
//     mint a junk interest; we fall back to the catch-all `unknown` tag.
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
  // The tag to apply when `matched` is empty: a word derived from the text, or
  // `UNKNOWN_TAG` when the text has no usable word. null only when something
  // matched (so the caller already has a tag and shouldn't mint one).
  suggested: string | null;
}

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
// root collide: bike / biking / bikes / biker → "bik"; run / running / runner /
// runs → "run". These keys are for comparison only and need not be real words.
// Order matters: strip the plural / 3rd-person ending, then a verb/agentive
// suffix, then a doubled final consonant (runn→run), then a silent trailing e.
function stemKey(word: string): string {
  let w = word.toLowerCase();

  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);

  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("er")) w = w.slice(0, -2);

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

// Mint a candidate tag from free text when the catalog has nothing for it.
// Title words win over description words (the title is the strongest signal);
// among the candidates the most frequent across the whole text wins, breaking
// ties toward the longer (more specific) word and then the earliest. The chosen
// word is singularized for a clean label. Returns null when the text has no
// usable word (empty, or all stop words / digits).
export function deriveTag(title: string, description: string): string | null {
  const titleWords = words(title).filter(isCandidate);
  const descWords = words(description).filter(isCandidate);
  const pool = titleWords.length ? titleWords : descWords;
  if (!pool.length) return null;

  // Count by stem so inflected repeats reinforce each other ("taco" + "tacos"
  // both lift the "taco" topic), consistent with how matching compares words.
  const freq = new Map<string, number>();
  for (const w of [...titleWords, ...descWords]) {
    const k = stemKey(w);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }

  let best = pool[0];
  for (const w of pool) {
    const fw = freq.get(stemKey(w))!;
    const fb = freq.get(stemKey(best))!;
    if (fw > fb || (fw === fb && w.length > best.length)) best = w;
  }
  return singularize(best);
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
  if (matched.length) return { matched, suggested: null };
  // Nothing matched — derive a tag from the text, or fall back to UNKNOWN_TAG
  // when the text has no usable (non-stop, non-numeric) word.
  return { matched, suggested: deriveTag(title, description) ?? UNKNOWN_TAG };
}

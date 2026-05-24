// Auto-tagging for scraped events (FR6, "App-Created Events"). Given an event's
// title + description, decide which interest tags should label it:
//
//   - existing catalog interests whose name — or one of its `similar_tags`
//     aliases — appears as a whole word in the text, OR
//   - when the text matches NOTHING in the catalog, a single tag derived from
//     the text's most salient word, which the caller mints as a new interest
//     and attaches. So an event about something the catalog doesn't cover yet
//     is still labeled (and a brand new interest is born from it).
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
  // A new tag derived from the text. Set ONLY when `matched` is empty (nothing
  // in the catalog matched); null when something matched, or when the text has
  // no usable word to mint a tag from.
  suggested: string | null;
}

// Words too generic to match an interest on, or to mint one from: stop words
// plus event-listing filler ("night", "meetup", "free", …) that would otherwise
// become a low-signal tag.
const STOP_WORDS = new Set<string>([
  "the", "and", "for", "you", "your", "our", "out", "are", "was", "will",
  "from", "this", "that", "these", "those", "here", "there", "into", "over",
  "what", "when", "where", "who", "how", "why", "come", "join", "lets", "let",
  "get", "got", "all", "any", "new", "off", "too", "not", "but", "about",
  "event", "events", "night", "nights", "day", "days", "week", "morning",
  "evening", "afternoon", "meetup", "meet", "session", "sessions", "group",
  "groups", "club", "clubs", "hangout", "gathering", "free", "open", "public",
  "private", "weekly", "monthly", "daily", "everyone", "people", "welcome",
  "workshop", "workshops", "class", "classes",
]);

// Lowercase and collapse every run of non-alphanumeric characters to a single
// space: "Board-Games & Pizza!" → "board games pizza". Padding the result with
// spaces (done at the call sites) turns a substring test into a whole-word /
// contiguous-phrase test.
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

// Does `term` (an interest name or alias) occur as a whole word / contiguous
// phrase in the already-normalized, space-padded text? Multi-word or hyphenated
// terms ("trail-running", "board games") match as a phrase. Single-letter terms
// are ignored as too noisy.
function termInText(term: string, paddedText: string): boolean {
  const t = normalize(term);
  if (t.length < 2) return false;
  return paddedText.includes(` ${t} `);
}

function interestMatches(interest: CatalogInterest, paddedText: string): boolean {
  if (termInText(interest.name, paddedText)) return true;
  return (interest.similar_tags ?? []).some((alias) => termInText(alias, paddedText));
}

// A word worth matching on / minting a tag from: at least 3 characters, not a
// stop word, and not a bare number ("2024"; "5k" survives — it has a letter).
function isCandidate(w: string): boolean {
  return w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w);
}

// Mint a candidate tag from free text when the catalog has nothing for it.
// Title words win over description words (the title is the strongest signal);
// among the candidates the most frequent across the whole text wins, breaking
// ties toward the longer (more specific) word and then the earliest. Returns
// null when the text has no usable word (empty, or all stop words / digits).
export function deriveTag(title: string, description: string): string | null {
  const titleWords = words(title).filter(isCandidate);
  const descWords = words(description).filter(isCandidate);
  const pool = titleWords.length ? titleWords : descWords;
  if (!pool.length) return null;

  const freq = new Map<string, number>();
  for (const w of [...titleWords, ...descWords]) {
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }

  let best = pool[0];
  for (const w of pool) {
    const fw = freq.get(w)!;
    const fb = freq.get(best)!;
    if (fw > fb || (fw === fb && w.length > best.length)) best = w;
  }
  return best;
}

// Analyze an event's title + description against the interest catalog. See
// InterestAnalysis for the shape; `suggested` is only populated when nothing in
// `catalog` matched the text.
export function analyzeInterests(
  title: string,
  description: string,
  catalog: CatalogInterest[],
): InterestAnalysis {
  const paddedText = ` ${normalize(`${title} ${description}`)} `;
  const matched: string[] = [];
  const seen = new Set<string>();
  for (const interest of catalog) {
    if (seen.has(interest.name)) continue;
    if (interestMatches(interest, paddedText)) {
      seen.add(interest.name);
      matched.push(interest.name);
    }
  }
  if (matched.length) return { matched, suggested: null };
  return { matched, suggested: deriveTag(title, description) };
}

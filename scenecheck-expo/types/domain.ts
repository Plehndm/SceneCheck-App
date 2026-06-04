// Domain types shared across the app. These are the in-memory shapes the
// UI consumes; `lib/api.ts` is responsible for translating Supabase rows
// into these shapes (mock-mode returns them directly).

// EventKind drives the bucket the event lands in for color + label. The
// classifier in lib/events.ts (eventCategory) produces these values plus
// 'other' for an event that isn't yours/friend/recommended. `'other'` used
// to be off this union (assigned only by the classifier), but
// `transformEventRow` now also uses it as the conservative fallback when
// the RPC can't tell us whether the creator is a friend — see review item
// M-01. The proper server-side fix is an `is_friend_creator` flag from
// `rank_events_query` so we can stamp `'friend'` only when the join says
// so; until then a fallback of `'other'` is safer than mislabelling every
// stranger's event as "FRIEND HOSTING".
export type EventKind = 'yours' | 'friend' | 'recommended' | 'other';
export type Visibility = 'public' | 'private';
export type AccountType = 'person' | 'org';

export interface Account {
  id: string;
  type: AccountType;
  name: string;
  handle?: string;
  username?: string;
  age?: number;
  bio?: string;
  interests?: string[];
  rating?: number;
  events_hosted?: number;
  events_attended?: number;
  city?: string;
  picture?: string | null;
  privacy?: Visibility;
  followers?: number;
  // person-only
  dist?: number;
  mutual?: number;
  color1?: string;
  color2?: string;
  blockedYou?: boolean;
}

export interface Interest {
  tag: string;
  others: number;
  desc: string;
  similar: string[];
}

export interface SCEvent {
  id: string;
  kind: EventKind;
  hostId: string | null;
  title: string;
  host?: string;
  interests: string[];
  when: string;
  endTime?: string;
  where: string;
  attendees: number;
  cap: number;
  rating: number | null;
  // Normalized 0–1 coords used by the legacy SVG map fixtures (mock-mode).
  // Live mode populates lat/lng directly and leaves these at sensible defaults.
  x: number;
  y: number;
  // Real-world coordinates from the database; preferred by the Map component
  // when present. Optional because the mock fixtures only have x/y.
  lat?: number;
  lng?: number;
  // Raw ISO start timestamp (live mode), used to split past vs upcoming.
  // Mock fixtures only carry the friendly `when` string, so this is optional.
  startAt?: string;
  desc?: string;
  // For scraped (App-created) events: the original listing page the event was
  // scraped from. The event-detail screen links to it in place of a host.
  // Absent for user-created events and mock fixtures.
  sourceUrl?: string;
  // Preview/cover image URL. Populated for scraped events from the source's
  // schema.org JSON-LD `image` (e.g. Eventbrite's img.evbuc.com CDN); null for
  // user-created events without an uploaded image. Cards/detail show a
  // placeholder when null.
  image?: string | null;
  // Ticket price range. All three fields are either ALL null (price not
  // specified — hides the affordance) or ALL set. priceMin = priceMax = 0
  // renders as FREE. priceMin = priceMax > 0 renders as "$N". priceMin <
  // priceMax renders as "$min–$max". Currency NULL is treated as USD
  // (matches the migration column comment and lib/price.formatPrice).
  // The DB CHECK constraint (migration 00040) enforces the same invariant.
  priceMin?: number | null;
  priceMax?: number | null;
  priceCurrency?: string | null;
}

export interface PastEvent {
  id: string;
  hostId: string;
  title: string;
  when: string;
  interests: string[];
}

export interface Review {
  id: string;
  eventId: string;
  hostId: string;
  reviewerId: string;
  rating: number;
  when: string;
  text: string;
  // Live mode resolves these via the ratings ⨝ profiles / events joins so the
  // screen doesn't need a client-side mock lookup. Absent in mock fixtures
  // (the screen falls back to SC_* under isMock()).
  reviewerName?: string;
  reviewerPicture?: string | null;
  eventTitle?: string;
  // ISO timestamp from `ratings.created_at` in live mode; absent in mock
  // fixtures. The host-ratings screen sorts by this when present, falling back
  // to the (insertion-ordered) `id` for mocks. Without this the live sort
  // collapsed to UUID lexicographic order, which has no chronological meaning.
  createdAt?: string;
}

export type ChatKind = 'event' | 'dm';

// A trimmed Account-shaped record carrying just what the chat-list
// avatars need. Live mode populates this from the chat_members
// embedded profile join; mock mode leaves it undefined and the screen
// falls back to SC_ACCOUNT_BY_ID lookups. Capped to the first few
// members per chat — the chat list only renders up to two avatars
// (stacked, Instagram-style) for group chats anyway.
export type ChatMember = Pick<Account, 'id' | 'name' | 'picture' | 'type'>;

export interface Chat {
  id: string;
  kind: ChatKind;
  eventId?: string;
  personId?: string;
  title?: string;
  last: string;
  time: string;
  unread: number;
  // OPTIONAL: first ~4 members (excluding self for DMs). Used by the
  // chat-list avatar rendering. Not always populated — see the type
  // comment above.
  members?: ChatMember[];
}

// FR9.5: messages carry a discriminator so the chat thread can render
// host-only announcements differently (badge + emphasized bubble) from
// normal chatter. Default is 'normal'; only the event creator can post
// 'announcement' rows — the backend RLS policy (migration 00038) enforces
// the actual permission, the client just passes the flag through.
export type MessageType = 'normal' | 'announcement';

export interface Message {
  from: 'host' | 'them';
  who: string;
  text: string;
  time: string;
  id?: string;
  // Optional so legacy fixtures + mock SC_THREADS rows (which don't
  // carry the field) still type-check; consumers should treat absent
  // as 'normal'.
  messageType?: MessageType;
}

// Result shape for analytics RPCs (FR5.3). Returned by
// host_analytics_by_city / host_analytics_by_venue: one row per interest
// tag, with the count of events tied to that tag in the scope (city or
// venue). Sorted client-side by event_count desc when needed.
export interface HostAnalyticsRow {
  interest_name: string;
  event_count: number;
}

export interface FriendRequest {
  id: string;
  personId: string;
  when: string;
  note: string | null;
}

export interface DraftForm {
  title: string;
  desc: string;
  date: string;
  timeStart: string;
  timeEnd: string;
  location: string;
  // Optional map-picked coordinates for the event. When set (via the
  // location picker), publish uses these; otherwise it falls back to the
  // host's current location. Optional so older drafts stay valid.
  lat?: number;
  lng?: number;
  cap: number;
  interests: string[];
  visibility: Visibility;
  minSubs: number;
  addToCalendar: boolean;
  autoGroupChat: boolean;
  // Ticket price. `priceMode === 'none'` (default for legacy drafts that
  // pre-date this field) leaves the columns NULL and hides the price
  // affordance. 'free' stamps 0/0. 'paid' uses the priceMin/priceMax
  // inputs. Optional so older saved drafts stay valid; the create
  // screen treats missing as 'none' on load.
  priceMode?: 'none' | 'free' | 'paid';
  priceMin?: string;
  priceMax?: string;
}

export interface Draft {
  id: string;
  savedAt: string;
  lastStep: number;
  form: DraftForm;
}

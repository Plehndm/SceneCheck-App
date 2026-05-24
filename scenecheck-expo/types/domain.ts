// Domain types shared across the app. These are the in-memory shapes the
// UI consumes; `lib/api.ts` is responsible for translating Supabase rows
// into these shapes (mock-mode returns them directly).

export type EventKind = 'yours' | 'friend' | 'org' | 'recommended';
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
}

export type ChatKind = 'event' | 'dm';

export interface Chat {
  id: string;
  kind: ChatKind;
  eventId?: string;
  personId?: string;
  title?: string;
  last: string;
  time: string;
  unread: number;
}

export interface Message {
  from: 'host' | 'them';
  who: string;
  text: string;
  time: string;
  id?: string;
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
}

export interface Draft {
  id: string;
  savedAt: string;
  lastStep: number;
  form: DraftForm;
}

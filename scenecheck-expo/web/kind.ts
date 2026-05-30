// Web-only helpers that derive an event's color/label bucket from its
// kind plus the active user's subscribed interests. Ports of
// `wIsRecommended`, `wKindMeta`, and `wHostAccount` from the design's
// `web-shared.jsx`. Server-side, the same scoring lives in the
// recommendation RPC (`rank_events`) — keep these in sync if the
// scoring changes.
//
// The original web prototype hardcoded `SC_ME.interests` and
// `SC_ACCOUNT_BY_ID` for host lookups. Both fixtures leak in live
// mode (the persona's interests pollute the recommended bucket, and
// any live UUID misses the fixture map, silently blanking the host).
// Callers must now supply the active user's `subscribedInterests`
// (read from the Zustand store) and, when a host lookup is needed,
// an explicit `lookup` map (typically derived from `useProfile` or a
// batched `getProfilesByIds`).

import type { SCEvent, Account } from '@/types/domain';
import type { Tokens } from '@/theme/tokens';

// EventKind in `@/types/domain` only covers the three production
// values. The desktop design also tags App-sourced events as
// 'scraped' and managed-org events as 'org', purely for UI bucketing.
// We accept those extras here as a permissive string.
export type WebEventKind = SCEvent['kind'] | 'org' | 'scraped';

export interface WebEvent extends Omit<SCEvent, 'kind'> {
  kind: WebEventKind;
}

/**
 * Returns true when the event should be shown with the "Recommended"
 * accent: either the event was explicitly classified as recommended,
 * or it carries at least one interest tag the user is subscribed to.
 *
 * `subs` must come from the caller (typically `useStore(s =>
 * s.subscribedInterests)`). When omitted we default to an empty set
 * so live mode never falls back to mock-persona interests.
 */
export function wIsRecommended(
  e: Pick<WebEvent, 'kind' | 'interests'>,
  subs?: ReadonlySet<string> | string[],
): boolean {
  if (e.kind === 'recommended') return true;
  const set =
    subs instanceof Set
      ? subs
      : new Set(Array.isArray(subs) ? subs : []);
  return (e.interests || []).some(t => set.has(t));
}

export interface KindMeta {
  /** CSS-ready accent color. Pass tokens to get themed values. */
  accent: string;
  /** Short uppercase label rendered above the event title on cards. */
  label: string;
  /** Whether the event matches a subscribed interest. */
  rec: boolean;
}

/**
 * Resolve the accent color + uppercase label for an event card / pin.
 *
 * Pass the active theme tokens to get themed colors; passing `null`
 * (or omitting them) falls back to raw CSS-variable strings, which is
 * useful inside contexts that already have CSS variables set (e.g. the
 * legacy prototype). The "yours" bucket is the only one that does NOT
 * flip on interest match — owning an event always wins.
 */
export function wKindMeta(
  e: Pick<WebEvent, 'kind' | 'interests'>,
  tokens?: Tokens | null,
  subs?: ReadonlySet<string> | string[],
): KindMeta {
  const rec = wIsRecommended(e, subs);
  const primary = tokens?.primary ?? 'var(--primary)';
  const accentBlue = tokens?.accentBlue ?? 'var(--accent-blue)';
  const accentFriend = tokens?.accentFriend ?? 'var(--accent-friend)';
  const mapPinMute = tokens?.mapPinMute ?? 'var(--map-pin-mute)';
  let accent: string;
  let label: string;
  if (e.kind === 'yours') {
    accent = primary;
    label = 'YOUR EVENT';
  } else if (e.kind === 'friend') {
    accent = rec ? accentFriend : mapPinMute;
    label = rec ? 'FRIEND · FOR YOU' : 'FRIEND HOSTING';
  } else if (rec) {
    accent = accentBlue;
    label = 'RECOMMENDED';
  } else {
    accent = mapPinMute;
    label = 'NEARBY EVENT';
  }
  return { accent, label, rec };
}

/**
 * Look up the host account (person or org) for an event, or null.
 *
 * The helper is sync and called from render bodies, so the caller
 * must seed `lookup` (typically from `useProfile(hostId)` or a batched
 * profile fetch). Returning `null` when no lookup is provided keeps
 * the helper safe: in live mode a missing host renders the same way
 * it would if the profile request hadn't resolved yet.
 */
export function wHostAccount(
  e: Pick<WebEvent, 'hostId'>,
  lookup?: Record<string, Account>,
): Account | null {
  if (!e.hostId) return null;
  return lookup?.[e.hostId] ?? null;
}

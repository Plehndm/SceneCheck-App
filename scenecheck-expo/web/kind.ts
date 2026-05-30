// Web-only helpers that derive an event's color/label bucket from its
// kind plus the active user's subscribed interests.
//
// CLASSIFICATION DELEGATES TO `@/lib/events` so the web map / cards
// agree with the native map / cards and the legend / event-card label
// can't drift between platforms. Previously this module owned a
// parallel implementation that diverged on friend events:
//   • Friend events without an interest match rendered with the
//     "Other" gray pin instead of the friend accent.
//   • Labels were "FRIEND · FOR YOU" / "FRIEND HOSTING" instead of the
//     canonical "FRIEND HOSTING" + separate "RECOMMENDED" badge.
// Now `wKindMeta` reads the same `eventCategory` bucket the native
// `pinColor` + `EVENT_CATEGORY_LABEL` use, and `wIsRecommended` is a
// thin wrapper around `isRecommendedFor` so both platforms classify
// identically. `isAlsoRecommended` is surfaced via the `rec` flag so
// callers can render the "+ RECOMMENDED" badge on friend events.

import type { SCEvent, Account } from '@/types/domain';
import type { Tokens } from '@/theme/tokens';
import {
  eventCategory,
  EVENT_CATEGORY_LABEL,
  isAlsoRecommended,
  isRecommendedFor,
} from '@/lib/events';

// EventKind in `@/types/domain` only covers the three production
// values. The desktop design also tags App-sourced events as
// 'scraped' and managed-org events as 'org', purely for UI bucketing.
// We accept those extras here as a permissive string.
export type WebEventKind = SCEvent['kind'] | 'org' | 'scraped';

export interface WebEvent extends Omit<SCEvent, 'kind'> {
  kind: WebEventKind;
}

/**
 * Returns true when the event matches at least one of the user's
 * subscribed interest tags. Thin wrapper around `isRecommendedFor`
 * (mobile + web share the same recommendation rule).
 *
 * `subs` must come from the caller (typically `useStore(s =>
 * s.subscribedInterests)`). When omitted we default to an empty set
 * so live mode never falls back to mock-persona interests.
 */
export function wIsRecommended(
  e: Pick<WebEvent, 'kind' | 'interests'>,
  subs?: ReadonlySet<string> | string[],
): boolean {
  const meInterests =
    subs instanceof Set
      ? Array.from(subs)
      : Array.isArray(subs)
        ? subs
        : [];
  // Cast: isRecommendedFor only reads `interests`, which our `WebEvent`
  // shape always carries (it widens SCEvent['kind'] to include 'org' /
  // 'scraped' but otherwise matches).
  return isRecommendedFor(e as SCEvent, meInterests);
}

export interface KindMeta {
  /** CSS-ready accent color. Pass tokens to get themed values. */
  accent: string;
  /** Short uppercase label rendered above the event title on cards. */
  label: string;
  /**
   * True only when the event is a friend's AND it also matches one of
   * the user's subscribed interests. Drives the optional "+ RECOMMENDED"
   * badge alongside the "FRIEND HOSTING" label (same semantics as
   * `lib/events.isAlsoRecommended`). Plain recommended events already
   * get the "RECOMMENDED" label, so the flag stays false for them to
   * avoid a duplicate badge.
   */
  rec: boolean;
}

/**
 * Resolve the accent color + uppercase label for an event card / pin.
 * Delegates to `eventCategory` from `@/lib/events` so the web map +
 * cards agree with native. The "yours" bucket always wins; a friend
 * event keeps the friend accent regardless of interest match (caller
 * uses the `rec` flag to render an extra "+ RECOMMENDED" badge).
 *
 * Pass the active theme tokens to get themed colors; passing `null`
 * (or omitting them) falls back to raw CSS-variable strings, which is
 * useful inside contexts that already have CSS variables set.
 */
export function wKindMeta(
  e: Pick<WebEvent, 'kind' | 'interests'>,
  tokens?: Tokens | null,
  subs?: ReadonlySet<string> | string[],
): KindMeta {
  const meInterests =
    subs instanceof Set
      ? Array.from(subs)
      : Array.isArray(subs)
        ? subs
        : [];
  // `eventCategory` already short-circuits in the priority order
  // yours > friend > recommended > other, matching the mobile pin
  // color + label exactly.
  const category = eventCategory(e as SCEvent, meInterests);
  const primary = tokens?.primary ?? 'var(--primary)';
  const accentBlue = tokens?.accentBlue ?? 'var(--accent-blue)';
  const accentFriend = tokens?.accentFriend ?? 'var(--accent-friend)';
  const mapPinMute = tokens?.mapPinMute ?? 'var(--map-pin-mute)';
  const accent =
    category === 'yours' ? primary
    : category === 'friend' ? accentFriend
    : category === 'recommended' ? accentBlue
    : mapPinMute;
  return {
    accent,
    label: EVENT_CATEGORY_LABEL[category],
    rec: isAlsoRecommended(e as SCEvent, meInterests),
  };
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

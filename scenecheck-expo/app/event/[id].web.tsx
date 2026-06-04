// Event detail (web overlay) — slides in over the current screen via
// <WebSlideOver/>. Visual layout follows `WEventDetail` from the
// design's `web-screens-a.jsx`: hero block + host row + JOIN CTA at
// the top, then facts grid, description, tags, attendee preview, and
// recent reviews. All data flows through the same hooks the native
// `app/event/[id].tsx` uses, so the live/mock parity is identical.
//
// Closing the overlay: the slide-over backdrop / ESC / explicit close
// button all call `router.back()`. The route's existence is the open
// state, so `open` is hard-coded to `true` while the route is mounted.
//
// JOIN flow: routes through the shared `useJoinEventHandler` hook so
// the optimistic-commit + 5-second UNDO grace + waitlist toast match
// every other web caller (home, map, search, list pages) and the
// native event detail. The Google Calendar handoff is wired here at
// the call site (not in the hook) because the hook is generic across
// list pages; calendar insert is overlay-specific UX.

import { useMemo } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useEvent } from '@/hooks/useEvent';
import { useAttendees } from '@/hooks/useAttendees';
import { useProfile } from '@/hooks/useProfile';
import { useRatings } from '@/hooks/useRatings';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { useStore } from '@/store/useStore';
import { whenRange, parseTime } from '@/lib/date-time';
import { formatPrice, priceState } from '@/lib/price';
import * as googleCalendar from '@/lib/google-calendar';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';
import { WebSlideOver } from '@/web/WebSlideOver';
import { WebOverlaySkeleton } from '@/web/WebSkeleton';
import { WebAvatar } from '@/web/WebAvatar';
import { WebTag } from '@/web/WebTag';
import { WebTip } from '@/web/WebTip';
import { WebIcon, type WebIconName } from '@/web/WebIcon';
import { WebStars } from '@/web/WebStars';
import { WebJoinButton } from '@/web/WebJoinButton';
import { wKindMeta } from '@/web/kind';

export default function EventDetailWeb() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event, loading } = useEvent(id);
  const { attendees } = useAttendees(id);
  const { profile: hostProfile } = useProfile(event?.hostId ?? undefined);
  const { ratings } = useRatings(event?.hostId ?? undefined);
  const me = useStore(s => s.me);
  // Subscribe to the joined + pending-leave SETS (not the stable `isJoined`
  // fn reference) so the JOIN/JOINED button re-renders on join AND on leave;
  // a row mid-undo-grace (in pendingLeave) reads as not-joined so the button
  // flips back to JOIN immediately instead of staying stuck on JOINED.
  const joinedSet = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const joined = id ? joinedSet.has(id) && !pendingLeave.has(id) : false;
  const showToast = useStore(s => s.showToast);
  // FR7.2 — used by the post-join calendar side effect below. Only
  // Google is wired in this iteration; other providers stay no-op.
  const linkedCalendar = useStore(s => s.linkedCalendar);
  const onJoin = useJoinEventHandler();

  const close = () => router.back();

  const subscribedInterests = useStore(s => s.subscribedInterests);

  // Derive the event end Date from startAt (ISO) + endTime (display
  // string). Same logic as native (`app/event/[id].tsx:161-173`) —
  // used here to feed Google Calendar's `endISO`. Returns null when
  // either piece is missing (e.g. scraped events without end time),
  // in which case the calendar insert is skipped.
  const endAt = useMemo(() => {
    if (!event?.startAt || !event?.endTime) return null;
    const start = new Date(event.startAt);
    if (Number.isNaN(start.getTime())) return null;
    const { h, m, ap } = parseTime(event.endTime);
    let hr = h % 12;
    if (ap === 'PM') hr += 12;
    const end = new Date(start);
    end.setHours(hr, m, 0, 0);
    if (end.getTime() < start.getTime()) end.setDate(end.getDate() + 1);
    return end;
  }, [event?.startAt, event?.endTime]);

  // Still fetching (live mode) — show a shape-matched skeleton rather than the
  // unavailable state, so a real event doesn't flash "isn't available" before
  // its row resolves. The unavailable message only renders once loading
  // settles and the event is still missing.
  if (!event && loading) {
    return (
      <WebSlideOver open onClose={close} width={640} ariaLabel="Loading event">
        <WebOverlaySkeleton />
      </WebSlideOver>
    );
  }

  if (!event) {
    return (
      <WebSlideOver open onClose={close} width={640} ariaLabel="Event details">
        <Unavailable text="This event isn't available." onClose={close} />
      </WebSlideOver>
    );
  }

  const km = wKindMeta(event, t, subscribedInterests);
  // `useProfile(hostId)` is the canonical source for live + mock
  // host data; no fixture fallback needed here.
  const host = hostProfile;
  // Merge self into the attendee preview when we've joined but the
  // server fetch hasn't refreshed yet — mirrors the native screen.
  const goingPeople = (joined && !attendees.some(a => a.id === me.id))
    ? [me, ...attendees]
    : attendees;
  const goingCount = goingPeople.length;
  const previewAttendees = goingPeople.slice(0, 6);
  const recentReviews = ratings.slice(0, 2);
  // FR5.5 — waitlist branch on the CTA label. capUnknown means a
  // scraped event with no listed capacity; never gate joining behind
  // a waitlist in that case. Otherwise full = goingCount >= cap.
  const capUnknown = event.cap <= 0;
  const isFull = !capUnknown && goingCount >= event.cap;
  const joinLabel = event.kind === 'yours'
    ? 'MANAGE EVENT'
    : (isFull ? 'JOIN WAITLIST' : 'JOIN EVENT');

  const handleJoinToggle = async () => {
    if (!id || !event) return;
    const wasJoined = joined;
    await onJoin(event);
    // FR7.2 — Google Calendar handoff fires only on a confirmed
    // join (wasJoined === false → we just attempted to JOIN). The
    // hook already toasted success/error/waitlist; we add the
    // calendar insert as a fire-and-forget side effect when the
    // user has linked Google and the event has real start/end.
    // Errors swallow into a soft info toast — the join itself
    // succeeded; calendar sync is secondary.
    if (
      !wasJoined &&
      linkedCalendar === 'google' &&
      googleCalendar.isConfigured() &&
      event.startAt &&
      endAt
    ) {
      googleCalendar.insertEvent({
        summary: event.title,
        description: event.desc ?? '',
        location: event.where,
        startISO: event.startAt,
        endISO: endAt.toISOString(),
      }).catch(() => {
        showToast({
          message: "Joined, but couldn't add to your Calendar.",
          kind: 'info',
        });
      });
    }
  };

  const openHost = () => {
    if (!host) return;
    if (host.id === me.id) router.push('/(tabs)/profile' as never);
    else router.push(`/profile/${host.id}` as never);
  };

  return (
    <WebSlideOver
      open
      onClose={close}
      width={640}
      ariaLabel={`Event details: ${event.title}`}
    >
      <div className="scroll" style={{ height: '100%', overflowY: 'auto' }}>
        {/* Hero */}
        <div
          style={{
            position: 'relative',
            padding: '20px 24px 22px',
            background: t.card,
            borderBottom: `1px solid ${t.line}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: km.accent,
                }}
              />
              <span
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  fontWeight: 600,
                  color: km.accent,
                }}
              >
                {km.label}
              </span>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <WebTip title="Close" side="bottom">
                <button type="button" onClick={close} style={iconBtn(t)}>
                  <WebIcon name="x" size={17} />
                </button>
              </WebTip>
            </div>
          </div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 30,
              lineHeight: 1.0,
              marginBottom: 14,
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: t.ink,
            }}
          >
            {event.title}
          </div>
          {host && (
            <button
              type="button"
              onClick={openHost}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
              }}
            >
              <WebAvatar person={host} size={38} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: t.ink }}>
                  {host.name}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10.5,
                    color: t.ink3,
                  }}
                >
                  {host.handle ?? (host.username ? `@${host.username}` : 'Hosting')} · view profile
                </div>
              </div>
            </button>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <WebJoinButton
              joined={joined}
              onToggle={handleJoinToggle}
              size="lg"
              full
              label={joinLabel}
            />
            <WebTip title="Group chat" side="top">
              <button
                type="button"
                onClick={() => router.push(`/chat/${event.id}` as never)}
                style={{ ...iconBtn(t), width: 52, height: 52 }}
                aria-label="Open group chat"
              >
                <WebIcon name="chat" size={20} />
              </button>
            </WebTip>
            <WebTip title="Add to calendar" side="top">
              <button
                type="button"
                onClick={() =>
                  showToast({
                    message: 'Calendar sync available on native.',
                    kind: 'info',
                  })
                }
                style={{ ...iconBtn(t), width: 52, height: 52 }}
                aria-label="Add to calendar"
              >
                <WebIcon name="calendar-plus" size={20} />
              </button>
            </WebTip>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            <Fact icon="clock" label="When" value={whenRange(event)} />
            {/* Where → open the Map tab focused on this event (selected +
                centered), mirroring native `app/event/[id].tsx`. */}
            <Fact
              icon="pin"
              label="Where"
              value={event.where || 'See listing'}
              onClick={() => router.push(`/(tabs)/map?focus=${event.id}` as never)}
            />
            <Fact
              icon="people"
              label="Going"
              // capUnknown (scraped, no listed capacity) shows "N/unk going"
              // — matches native so the unknown cap reads the same on both.
              value={
                capUnknown
                  ? `${goingCount}/unk going`
                  : `${goingCount} of ${event.cap} spots`
              }
            />
            <Fact
              icon="star"
              label="Host rating"
              value={event.rating != null ? `${event.rating.toFixed(1)} ★` : 'New host'}
            />
            {/* Price — only when the event carries explicit pricing.
                priceState returns 'none' for events with no price data
                (hides the affordance); 'free' shows the FREE label. */}
            {priceState(event) !== 'none' && (
              <Fact
                icon="tag"
                label={priceState(event) === 'free' ? 'Free to attend' : 'Ticket price'}
                value={formatPrice(event) ?? ''}
              />
            )}
            {/* Scraped events have no host — link to the original listing
                the info was pulled from, same as native. */}
            {event.sourceUrl && (
              <Fact
                icon="globe"
                label="Scraped event"
                value="View original listing →"
                onClick={() => window.open(event.sourceUrl!, '_blank', 'noopener,noreferrer')}
              />
            )}
          </div>

          {event.desc && (
            <div>
              <LabelCap>About</LabelCap>
              <p
                style={{
                  margin: '8px 0 0',
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: t.ink2,
                }}
              >
                {event.desc}
              </p>
            </div>
          )}

          {!!event.interests.length && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {event.interests.map(tag => (
                <WebTag
                  key={tag}
                  tag={tag}
                  size="md"
                  tone="soft"
                  onClick={() => router.push(`/interests/${tag}` as never)}
                />
              ))}
            </div>
          )}

          {previewAttendees.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <LabelCap>Who&rsquo;s going</LabelCap>
                <button
                  type="button"
                  onClick={() => router.push(`/attendees/${event.id}` as never)}
                  style={linkBtn(t)}
                >
                  SEE ALL →
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {previewAttendees.map((p, i) => (
                  <div
                    key={p.id}
                    style={{ marginLeft: i === 0 ? 0 : -10 }}
                    title={p.name}
                  >
                    <WebAvatar person={p} size={40} />
                  </div>
                ))}
                {goingCount > previewAttendees.length && (
                  <div
                    style={{
                      marginLeft: -10,
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: t.subtle,
                      border: `2px solid ${t.card}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.ink2,
                    }}
                  >
                    +{goingCount - previewAttendees.length}
                  </div>
                )}
              </div>
            </div>
          )}

          {recentReviews.length > 0 && event.hostId && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <LabelCap>Recent reviews of this host</LabelCap>
                <button
                  type="button"
                  onClick={() => router.push(`/ratings/${event.hostId}` as never)}
                  style={linkBtn(t)}
                >
                  ALL →
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentReviews.map(r => {
                  // Mock-leak gate (inventory item): live ratings rows
                  // already carry `reviewerName`/`reviewerPicture`. Only
                  // consult the SC fixture in mock mode so live UUIDs
                  // can't accidentally hit a fixture entry.
                  const fixture = api.isMock()
                    ? SC_ACCOUNT_BY_ID[r.reviewerId]
                    : undefined;
                  const rv =
                    fixture ?? {
                      id: r.reviewerId,
                      type: 'person' as const,
                      name: r.reviewerName ?? 'Anonymous',
                      picture: r.reviewerPicture ?? null,
                    };
                  return (
                    <div
                      key={r.id}
                      style={{
                        background: t.card,
                        border: `1px solid ${t.line}`,
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          marginBottom: 8,
                        }}
                      >
                        <WebAvatar person={rv} size={28} />
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                          {rv.name}
                        </span>
                        <span style={{ marginLeft: 'auto' }}>
                          <WebStars value={r.rating} size={12} showNum={false} />
                        </span>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          color: t.ink2,
                        }}
                      >
                        {r.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </WebSlideOver>
  );
}

function Fact({
  icon,
  label,
  value,
  onClick,
}: {
  icon: WebIconName;
  label: string;
  value: string;
  // When set the fact becomes an interactive button (location → map,
  // scraped event → original listing), tinted with the primary accent
  // so the affordance reads as tappable — same signal the native
  // `DetailRow.onPress` carries (primary text + chevron).
  onClick?: () => void;
}) {
  const t = useTokens();
  const inner = (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 7,
          color: onClick ? t.primary : t.ink3,
        }}
      >
        <WebIcon name={icon} size={15} />
        <LabelCap>{label}</LabelCap>
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 14.5,
          fontWeight: 700,
          lineHeight: 1.2,
          color: onClick ? t.primary : t.ink,
        }}
      >
        {value}
      </div>
    </>
  );
  const base = {
    background: t.card,
    border: `1px solid ${onClick ? t.primarySoft : t.line}`,
    borderRadius: 14,
    padding: 14,
  } as const;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...base,
          cursor: 'pointer',
          textAlign: 'left',
          display: 'block',
          width: '100%',
        }}
      >
        {inner}
      </button>
    );
  }
  return <div style={base}>{inner}</div>;
}

function LabelCap({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: t.ink3,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function iconBtn(t: ReturnType<typeof useTokens>) {
  return {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${t.line}`,
    background: t.card,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: t.ink,
  } as const;
}

function linkBtn(t: ReturnType<typeof useTokens>) {
  return {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: t.ink3,
  } as const;
}

function Unavailable({ text, onClose }: { text: string; onClose: () => void }) {
  const t = useTokens();
  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <WebTip title="Close" side="right">
        <button
          type="button"
          onClick={onClose}
          style={{ ...iconBtn(t), marginBottom: 24 }}
        >
          <WebIcon name="x" size={18} />
        </button>
      </WebTip>
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: t.subtle,
          margin: '0 auto 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.ink3,
        }}
      >
        <WebIcon name="lock" size={28} />
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 19,
          fontWeight: 700,
          marginBottom: 6,
          color: t.ink,
        }}
      >
        Unavailable
      </div>
      <div style={{ fontSize: 13.5, color: t.ink3 }}>{text}</div>
    </div>
  );
}

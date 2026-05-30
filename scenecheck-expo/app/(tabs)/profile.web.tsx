// Profile tab (web) — sticky-left profile card + right-column tab strip
// (Hosting / Joined / Friends / Following / Drafts / Reviews). Replaces
// the native single-column scroll layout while still consuming the same
// hooks so live + mock parity stays intact.
//
// Wiring (all Supabase-backed in live mode, deterministic in mock mode):
//   • useStore.me, .picture, .friends, .following, .joined, .drafts
//   • useHostedEvents(meId)   → events.creator_id = me
//   • useJoinedEvents()       → event_subscriptions ⨝ events, confirmed
//   • useFriends()            → friendships joined to profiles
//   • useFollowedOrgs()       → org_follows resolved to profiles
//   • useRatings(meId)        → ratings written about me
//   • useUserInterests(meId)  → user_interests (public)
//   • useFriendRequests(), useOutgoingRequests()
//
// Action surfaces use the existing pure web atoms (no native React-Native
// primitives), so the entire tree is desktop-DOM and inherits the
// WebShell scale transform from app/_layout.tsx.

import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { useJoinedEvents } from '@/hooks/useJoinedEvents';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { useFriends } from '@/hooks/useFriends';
import { useFollowedOrgs } from '@/hooks/useFollowedOrgs';
import { useRatings } from '@/hooks/useRatings';
import { useUserInterests } from '@/hooks/useUserInterests';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useOutgoingRequests } from '@/hooks/useOutgoingRequests';
import { summarizeRatings } from '@/lib/ratings';
import { WebAvatar } from '@/web/WebAvatar';
import { WebButton } from '@/web/WebButton';
import { WebTag } from '@/web/WebTag';
import { WebIcon } from '@/web/WebIcon';
import { WebStars } from '@/web/WebStars';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebPersonRow } from '@/web/WebPersonRow';
import { WebOrgRow } from '@/web/WebOrgRow';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { SC_ACCOUNT_BY_ID, SC_ME } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

type Tab = 'hosting' | 'joined' | 'friends' | 'following' | 'drafts' | 'reviews';

export default function ProfileWeb() {
  const t = useTokens();
  const me = useStore(s => s.me);
  const picture = useStore(s => s.picture);
  const isOrg = me.type === 'org';

  // Same hooks the native screen uses — single source of truth so live
  // mode hits the right Supabase endpoints.
  const { events: hosted } = useHostedEvents(me.id);
  const { events: joinedEvents } = useJoinedEvents();
  const { friends } = useFriends();
  const { orgs: followed } = useFollowedOrgs();
  const { ratings } = useRatings(me.id);
  const { interests } = useUserInterests(me.id);
  const { requests: incomingReq } = useFriendRequests();
  const { people: outgoingReq } = useOutgoingRequests();
  const drafts = useStore(s => s.drafts);
  const removeDraft = useStore(s => s.removeDraft);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);
  const isJoined = useStore(s => s.isJoined);
  // Routed through the shared hook so optimistic-commit + waitlist
  // toast + UNDO grace match every other web caller.
  const onJoin = useJoinEventHandler();

  // The rail's Friends / Following pills push `/profile?tab=...` so the
  // social graph opens in the same sticky-left-card layout as Hosting /
  // Joined / Drafts / Reviews. We also re-sync if the user navigates
  // from the rail again while already on the Profile tab (URL changes
  // without unmounting the screen).
  const params = useLocalSearchParams<{ tab?: string }>();
  const initialTab: Tab =
    params.tab === 'friends' || params.tab === 'following' ||
    params.tab === 'joined' || params.tab === 'drafts' ||
    params.tab === 'reviews' || params.tab === 'hosting'
      ? params.tab
      : 'hosting';
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => {
    if (
      params.tab === 'friends' || params.tab === 'following' ||
      params.tab === 'joined' || params.tab === 'drafts' ||
      params.tab === 'reviews' || params.tab === 'hosting'
    ) {
      setTab(params.tab);
    }
  }, [params.tab]);
  const [editOpen, setEditOpen] = useState(false);

  // Live-derived; matches the live "events you've joined" / ratings calls
  // the native sibling renders.
  const ratingSummary = summarizeRatings(ratings);
  const accountWithPic = { ...me, picture: picture ?? me.picture };
  // Interests: prefer the live `user_interests` rows; fall back to the
  // store's `me.interests` (which is what the onboarding picker wrote).
  const interestTags = interests.length > 0 ? interests : (me.interests ?? SC_ME.interests ?? []);

  const tabs: Array<{ k: Tab; label: string; n: number; hide?: boolean }> = [
    { k: 'hosting', label: 'Hosting', n: hosted.length },
    { k: 'joined', label: 'Joined', n: joinedEvents.length },
    { k: 'friends', label: 'Friends', n: friends.length, hide: isOrg },
    { k: 'following', label: 'Following', n: followed.length },
    { k: 'drafts', label: 'Drafts', n: drafts.length },
    { k: 'reviews', label: 'Reviews', n: ratings.length },
  ];
  const visibleTabs = tabs.filter(x => !x.hide);

  const stats: Array<{ label: string; value: string }> = [
    {
      label: 'Rating',
      value: ratingSummary.average != null ? ratingSummary.average.toFixed(1) : '—',
    },
    { label: isOrg ? 'Events' : 'Hosted', value: String(hosted.length) },
    { label: 'Friends', value: String(friends.length) },
    { label: 'Following', value: String(followed.length) },
    ...(me.followers != null
      ? [{ label: 'Followers', value: String(me.followers) }]
      : []),
  ];

  return (
    <div
      className="scroll"
      style={{ height: '100%', overflowY: 'auto', background: t.surface }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: '0 auto',
          padding: '34px 40px 60px',
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* ── LEFT: sticky profile card ── */}
        <div style={{ position: 'sticky', top: 0 }}>
          <div
            style={{
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 22,
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 18,
              }}
            >
              <WebAvatar person={accountWithPic} size={84} ring={!isOrg} />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 26,
                    lineHeight: 1,
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    color: t.ink,
                  }}
                >
                  {me.name || 'Set your name'}
                </div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    color: t.ink3,
                    marginTop: 4,
                  }}
                >
                  {me.username ? `@${me.username}` : me.handle ?? ''}
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    marginTop: 7,
                    padding: '3px 9px',
                    borderRadius: 999,
                    background: t.subtle,
                    fontFamily: FONT.mono,
                    fontSize: 9.5,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    color: t.ink2,
                  }}
                >
                  <WebIcon name={me.privacy === 'private' ? 'lock' : 'globe'} size={11} />
                  {(me.privacy ?? 'public').toUpperCase()} ·{' '}
                  {isOrg ? 'ORG' : 'PERSONAL'}
                </div>
              </div>
            </div>

            {me.bio && (
              <p
                style={{
                  margin: '0 0 18px',
                  fontSize: 13.5,
                  lineHeight: 1.5,
                  color: t.ink2,
                }}
              >
                {me.bio}
              </p>
            )}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
                gap: 8,
                marginBottom: 18,
              }}
            >
              {stats.map(s => (
                <div
                  key={s.label}
                  style={{
                    textAlign: 'center',
                    padding: '10px 4px',
                    background: t.surface,
                    borderRadius: 12,
                  }}
                >
                  <div
                    style={{
                      fontFamily: FONT.display,
                      fontWeight: 800,
                      fontSize: 20,
                      lineHeight: 1,
                      color: t.ink,
                    }}
                  >
                    {s.value}
                  </div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 8.5,
                      fontFamily: FONT.mono,
                      letterSpacing: '0.1em',
                      color: t.ink3,
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Edit profile spans the row on its own; the friend-requests
                affordance moved into the Friends tab (opposite "Find more
                friends") where it reads clearly, instead of an unlabeled
                icon button here that wasn't obviously "requests". */}
            <WebButton
              tone="dark"
              size="md"
              icon="edit"
              style={{ width: '100%' }}
              onClick={() => setEditOpen(true)}
            >
              Edit profile
            </WebButton>

            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: `1px solid ${t.line}`,
              }}
            >
              <div
                style={{
                  marginBottom: 10,
                  fontFamily: FONT.mono,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: t.ink3,
                  textTransform: 'uppercase',
                }}
              >
                Your interests
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {interestTags.map(tag => (
                  <WebTag
                    key={tag}
                    tag={tag}
                    size="sm"
                    tone="soft"
                    onClick={() => router.push(`/interests/${tag}` as never)}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => router.push('/search' as never)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: `1px dashed ${t.line}`,
                    background: 'transparent',
                    cursor: 'pointer',
                    fontFamily: FONT.mono,
                    fontSize: 11,
                    color: t.ink3,
                  }}
                >
                  <WebIcon name="plus" size={12} /> Add
                </button>
              </div>
            </div>

            {/* Outgoing request count, when you have any. */}
            {outgoingReq.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: `1px solid ${t.line}`,
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  color: t.ink3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <WebIcon name="clock" size={12} />
                {outgoingReq.length} friend {outgoingReq.length === 1 ? 'request' : 'requests'} pending
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: tab strip + tab content ── */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              gap: 4,
              borderBottom: `1px solid ${t.line}`,
              marginBottom: 22,
              // The tab selectors wrap onto a second row when they don't fit
              // rather than getting their own horizontal scrollbar — only the
              // rendered tab content scrolls (via the screen's own overflowY).
              flexWrap: 'wrap',
            }}
          >
            {visibleTabs.map(x => {
              const on = tab === x.k;
              return (
                <button
                  key={x.k}
                  type="button"
                  onClick={() => setTab(x.k)}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    whiteSpace: 'nowrap',
                    fontFamily: FONT.mono,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: on ? t.ink : t.ink3,
                  }}
                >
                  {x.label}{' '}
                  <span style={{ opacity: 0.5 }}>{x.n}</span>
                  {on && (
                    <span
                      style={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        bottom: -1,
                        height: 2.5,
                        background: t.primary,
                        borderRadius: 2,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {(tab === 'hosting' || tab === 'joined') && (
            <EventGrid
              events={tab === 'hosting' ? hosted : joinedEvents}
              isJoined={isJoined}
              onJoin={onJoin}
              empty={
                tab === 'hosting'
                  ? "You're not hosting anything yet."
                  : "You haven't joined any events yet."
              }
            />
          )}

          {tab === 'friends' && (
            <>
              {/* Friend actions as a pair: View requests on the left,
                  Find more friends on the right. "Find more friends" lands on
                  Discover's People section (?tab=people) so the friends/people
                  filter is pre-selected. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <WebButton
                  tone="ghost"
                  size="sm"
                  icon="user-check"
                  onClick={() => router.push('/requests' as never)}
                >
                  {`View requests${incomingReq.length ? ` · ${incomingReq.length}` : ''}`}
                </WebButton>
                <WebButton
                  tone="primary"
                  size="sm"
                  icon="user-plus"
                  onClick={() => router.push('/search?tab=people' as never)}
                >
                  Find more friends
                </WebButton>
              </div>
              <PersonGrid
                people={friends}
                empty="No friends yet — tap Find more friends to browse Discover."
              />
            </>
          )}

          {tab === 'following' && (
            <>
              {/* Find more organizations lands on Discover's Organizations
                  section (?tab=orgs) so that filter is pre-selected. */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginBottom: 12,
                }}
              >
                <WebButton
                  tone="primary"
                  size="sm"
                  icon="building"
                  onClick={() => router.push('/search?tab=orgs' as never)}
                >
                  Find more organizations
                </WebButton>
              </div>
              <OrgGrid
                orgs={followed}
                empty="Not following any organizations yet."
              />
            </>
          )}

          {tab === 'drafts' && (
            <DraftsList
              onDelete={(id, title) => {
                showConfirm({
                  title: `Delete "${title || 'this draft'}"?`,
                  body: "This can't be undone.",
                  confirmLabel: 'DELETE',
                  tone: 'danger',
                  onConfirm: () => {
                    removeDraft(id);
                    showToast({ message: 'Draft deleted.', kind: 'info' });
                  },
                });
              }}
            />
          )}

          {tab === 'reviews' && <ReviewsList ratings={ratings} />}
        </div>
      </div>
      <EditProfileSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

// ── Sub-views ────────────────────────────────────────────────

function EmptyCard({ text }: { text: string }) {
  const t = useTokens();
  return (
    <div
      style={{
        padding: 40,
        textAlign: 'center',
        border: `1px dashed ${t.line}`,
        borderRadius: 18,
        color: t.ink3,
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 17,
          color: t.ink2,
          marginBottom: 4,
          fontWeight: 700,
        }}
      >
        Nothing here yet
      </div>
      <div style={{ fontSize: 13 }}>{text}</div>
    </div>
  );
}

function EventGrid({
  events,
  isJoined,
  onJoin,
  empty,
}: {
  events: SCEvent[];
  isJoined: (id: string) => boolean;
  onJoin: (event: SCEvent) => void;
  empty: string;
}) {
  if (!events.length) return <EmptyCard text={empty} />;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {events.map(e => (
        <WebEventListCard
          key={e.id}
          event={e}
          joined={isJoined(e.id)}
          onOpen={(id) => router.push(`/event/${id}` as never)}
          onJoin={() => onJoin(e)}
        />
      ))}
    </div>
  );
}

function PersonGrid({
  people,
  empty,
}: {
  people: ReturnType<typeof useFriends>['friends'];
  empty: string;
}) {
  if (!people.length) return <EmptyCard text={empty} />;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {people.map(p => (
        <WebPersonRow key={p.id} person={p} message />
      ))}
    </div>
  );
}

function OrgGrid({
  orgs,
  empty,
}: {
  orgs: ReturnType<typeof useFollowedOrgs>['orgs'];
  empty: string;
}) {
  if (!orgs.length) return <EmptyCard text={empty} />;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      {orgs.map(o => (
        <WebOrgRow key={o.id} org={o} />
      ))}
    </div>
  );
}

function DraftsList({
  onDelete,
}: {
  onDelete: (id: string, title: string) => void;
}) {
  const t = useTokens();
  const drafts = useStore(s => s.drafts);
  if (!drafts.length) return <EmptyCard text="No saved drafts." />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {drafts.map(d => (
        <div
          key={d.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: t.card,
            border: `1px solid ${t.line}`,
            borderRadius: 16,
            padding: 16,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: t.subtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: t.ink3,
              flexShrink: 0,
            }}
          >
            <WebIcon name="edit" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 16, color: t.ink }}>
              {d.form.title || 'Untitled event'}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                color: t.ink3,
                marginTop: 3,
              }}
            >
              Saved {d.savedAt} · step {d.lastStep + 1}
            </div>
          </div>
          <WebButton
            tone="ghost"
            size="sm"
            onClick={() =>
              router.push({
                pathname: '/create-event',
                params: { draftId: d.id },
              } as never)
            }
          >
            Continue
          </WebButton>
          <WebButton
            tone="ghost"
            size="sm"
            icon="x"
            onClick={() => onDelete(d.id, d.form.title)}
          >
            Delete
          </WebButton>
        </div>
      ))}
    </div>
  );
}

function ReviewsList({ ratings }: { ratings: ReturnType<typeof useRatings>['ratings'] }) {
  const t = useTokens();
  const summary = summarizeRatings(ratings);
  if (!ratings.length)
    return (
      <EmptyCard text="No reviews yet — host an event and ask attendees to leave one." />
    );
  return (
    <div>
      {/* Summary header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 18,
          padding: 18,
          background: t.card,
          border: `1px solid ${t.line}`,
          borderRadius: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 28,
              fontWeight: 800,
              color: t.ink,
              letterSpacing: '-0.02em',
            }}
          >
            {summary.average != null ? summary.average.toFixed(1) : '—'}
          </div>
          <div style={{ marginTop: 4 }}>
            <WebStars value={summary.average} size={14} showNum={false} />
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            color: t.ink3,
            marginLeft: 4,
          }}
        >
          {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 12,
        }}
      >
        {ratings.map(r => {
          const reviewer = SC_ACCOUNT_BY_ID[r.reviewerId] ?? {
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
                borderRadius: 16,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <WebAvatar person={reviewer} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {reviewer.name}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      color: t.ink3,
                    }}
                  >
                    {r.when}
                  </div>
                </div>
                <WebStars value={r.rating} size={13} showNum={false} />
              </div>
              <p
                style={{
                  margin: '0 0 10px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: t.ink2,
                }}
              >
                {r.text}
              </p>
              {r.eventTitle && (
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    color: t.ink3,
                    borderTop: `1px solid ${t.line}`,
                    paddingTop: 8,
                  }}
                >
                  on {r.eventTitle}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

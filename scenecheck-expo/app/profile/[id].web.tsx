// Other profile (web overlay) — wraps WPersonProfile / WOrgProfile in
// a slide-over. Branches on the loaded profile's `type` (person vs
// org) so persons get Add Friend + Message and orgs get Follow +
// Message. Hosted-events row + a short reviews list at the bottom
// link out to the deeper overlays.
//
// Self-redirect: if the routed id matches the active account, push to
// the main profile tab instead of opening this overlay. Mirrors the
// native sibling's Redirect-on-self.

import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { useProfile } from '@/hooks/useProfile';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { useRatings } from '@/hooks/useRatings';
import { useUserInterests } from '@/hooks/useUserInterests';
import { summarizeRatings } from '@/lib/ratings';
import { whenRange } from '@/lib/date-time';
import { api } from '@/lib/api';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';
import { WebSlideOver } from '@/web/WebSlideOver';
import { WebAvatar } from '@/web/WebAvatar';
import { WebButton } from '@/web/WebButton';
import { WebTag } from '@/web/WebTag';
import { WebTip } from '@/web/WebTip';
import { WebIcon } from '@/web/WebIcon';
import { WebStars } from '@/web/WebStars';
import { WebFriendButton } from '@/web/WebFriendButton';
import { WebFollowButton } from '@/web/WebFollowButton';
import type { Account } from '@/types/domain';

export default function OtherProfileWeb() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const meId = useStore(s => s.me.id);
  const friends = useStore(s => s.friends);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);
  const blockUserStore = useStore(s => s.blockUser);
  const unblockUserStore = useStore(s => s.unblockUser);
  // H-08 — Shared-interest diff against the signed-in user's real
  // subscribed tags (AuthBootstrap hydrates `me.interests` from
  // `useUserInterests(meId)`). Previously sourced from `SC_ME.interests`
  // which leaked the mock persona into live mode.
  const myInterestsRaw = useStore(s => s.me.interests);
  const { profile, loading } = useProfile(id);
  const { events: hosted } = useHostedEvents(id);
  const { ratings } = useRatings(id);
  const { interests } = useUserInterests(id);

  const close = () => router.back();

  if (id && id === meId) {
    return <Redirect href={'/(tabs)/profile' as never} />;
  }

  if (!profile) {
    if (loading) {
      return (
        <WebSlideOver open onClose={close} width={520} ariaLabel="Loading profile">
          <div style={{ padding: 40, color: t.ink3 }}>Loading…</div>
        </WebSlideOver>
      );
    }
    return (
      <WebSlideOver open onClose={close} width={520} ariaLabel="Profile">
        <Unavailable onClose={close} text="This profile isn't available." />
      </WebSlideOver>
    );
  }

  const isOrg = profile.type === 'org';
  const summary = summarizeRatings(ratings);
  const myInterests = myInterestsRaw ?? [];
  const shared = interests.filter(tag => myInterests.includes(tag));
  // M-07 — Mirror the native `privateLocked` gate
  // (`app/profile/[id].tsx:110`). Hide bio, hosted events, ratings, and
  // social actions when the viewer isn't an accepted friend; keep
  // interests + the friend-request button so the user can request
  // access. Defense-in-depth on top of server-side RLS (mock mode has
  // no RLS, and joined queries can bypass profile-row visibility).
  const isFriend = id ? friends.has(id) : false;
  const isSelf = !!id && id === meId;
  const privateLocked =
    profile.privacy === 'private' && !isFriend && !isSelf;

  // H-07 — Block + Report safety actions. Mirrors native
  // (`app/profile/[id].tsx:313-358`): each is a confirm dialog → real
  // API call (`api.blockUser` / `api.submitReport`) with toast feedback
  // on success/failure. Block is optimistic-then-commit so Settings →
  // Blocked updates immediately; rollback on server error.
  const handleBlock = () => {
    if (isSelf || !id) return;
    showConfirm({
      title: `Block ${profile.name}?`,
      body: `They won't see you in the app, and you won't see them. You can unblock from Settings.`,
      confirmLabel: 'BLOCK',
      tone: 'danger',
      onConfirm: async () => {
        blockUserStore(id, profile.name);
        showToast({ message: `Blocked ${profile.name}.`, kind: 'info' });
        router.back();
        try {
          await api.blockUser(id);
        } catch {
          unblockUserStore(id);
          showToast({
            message: "Couldn't save block. Try again.",
            kind: 'error',
          });
        }
      },
    });
  };
  const handleReport = () => {
    if (isSelf || !id) return;
    showConfirm({
      title: `Report ${profile.name}?`,
      body: 'Our team will review.',
      confirmLabel: 'SUBMIT REPORT',
      tone: 'danger',
      icon: 'flag',
      onConfirm: async () => {
        try {
          await api.submitReport(id, null, 'profile-report');
          showToast({
            message: 'Report submitted. Thanks.',
            kind: 'success',
          });
        } catch {
          showToast({
            message: "Couldn't submit report. Try again.",
            kind: 'error',
          });
        }
      },
    });
  };

  return (
    <WebSlideOver
      open
      onClose={close}
      width={520}
      ariaLabel={`${profile.name}'s profile`}
    >
      <div className="scroll" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
            }}
          >
            <WebTip title="Close" side="bottom">
              <button type="button" onClick={close} style={iconBtn(t)}>
                <WebIcon name="x" size={18} />
              </button>
            </WebTip>
            {/*
              H-07 — Block + Report safety actions. Both wired to real
              API calls via showConfirm. Hidden on self (the Redirect
              above takes us out before this point, but defense-in-depth
              with isSelf is consistent with the native sibling).
            */}
            {!isSelf && (
              <div style={{ display: 'flex', gap: 8 }}>
                <WebButton
                  tone="ghost"
                  size="sm"
                  icon="lock"
                  onClick={handleBlock}
                >
                  Block
                </WebButton>
                <WebButton
                  tone="ghost"
                  size="sm"
                  icon="flag"
                  onClick={handleReport}
                >
                  Report
                </WebButton>
              </div>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              marginBottom: 18,
            }}
          >
            <WebAvatar person={profile} size={88} ring={!isOrg} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 28,
                  lineHeight: 1,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: t.ink,
                }}
              >
                {profile.name}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 12,
                  color: t.ink3,
                  marginTop: 5,
                }}
              >
                {profile.handle ?? (profile.username ? `@${profile.username}` : '')}
                {!isOrg && profile.mutual != null ? ` · ${profile.mutual} mutual` : ''}
                {isOrg && profile.followers != null ? ` · ${profile.followers} followers` : ''}
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  marginTop: 8,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: t.subtle,
                  fontFamily: FONT.mono,
                  fontSize: 9.5,
                  fontWeight: 600,
                  color: t.ink2,
                }}
              >
                <WebIcon
                  name={profile.privacy === 'private' ? 'lock' : isOrg ? 'building' : 'globe'}
                  size={11}
                />
                {(profile.privacy ?? 'public').toUpperCase()}
                {isOrg ? ' · ORG' : ''}
              </div>
            </div>
          </div>

          {profile.bio && !privateLocked && (
            <p
              style={{
                margin: '0 0 18px',
                fontSize: 14,
                lineHeight: 1.55,
                color: t.ink2,
              }}
            >
              {profile.bio}
            </p>
          )}

          {/* Stats row for orgs — orgs aren't subject to the private gate */}
          {isOrg && !privateLocked && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 8,
                marginBottom: 18,
              }}
            >
              <Stat label="EVENTS" value={String(hosted.length)} />
              <Stat
                label="FOLLOWERS"
                value={profile.followers?.toLocaleString() ?? '0'}
              />
              <Stat
                label="RATING"
                value={summary.average != null ? `${summary.average.toFixed(1)}★` : '—'}
                onPress={
                  ratings.length > 0
                    ? () => router.push(`/ratings/${profile.id}` as never)
                    : undefined
                }
              />
            </div>
          )}

          {/*
            M-07 — Private-account note. Mirrors native (`app/profile/[id].tsx:202-215`):
            when locked, render a short explainer card in place of the bio so the
            viewer understands they're seeing the minimal request surface.
          */}
          {privateLocked && (
            <div
              style={{
                background: t.card,
                border: `1px solid ${t.line}`,
                borderRadius: 14,
                padding: 14,
                marginBottom: 18,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  background: t.subtle,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: t.ink3,
                  flexShrink: 0,
                }}
              >
                <WebIcon name="lock" size={18} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
                  This account is private
                </div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: t.ink3,
                    marginTop: 2,
                    lineHeight: 1.4,
                  }}
                >
                  Send a friend request to see {profile.name.split(' ')[0]}&apos;s
                  bio, events and reviews once they accept.
                </div>
              </div>
            </div>
          )}

          {/* Action row — Message button is hidden when private-locked */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 22 }}>
            {isOrg ? (
              <WebFollowButton orgId={profile.id} size="lg" full />
            ) : (
              <WebFriendButton personId={profile.id} size="lg" full />
            )}
            {!privateLocked && (
              <WebButton
                tone="ghost"
                size="lg"
                icon="chat"
                onClick={() => router.push(`/new-chat?to=${profile.id}` as never)}
              >
                Message
              </WebButton>
            )}
          </div>

          {interests.length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <LabelCap>
                Interests
                {shared.length ? ` · ${shared.length} shared` : ''}
              </LabelCap>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {interests.map(tag => (
                  <WebTag
                    key={tag}
                    tag={tag}
                    size="md"
                    tone={shared.includes(tag) ? 'primary' : 'soft'}
                    onClick={() => router.push(`/interests/${tag}` as never)}
                  />
                ))}
              </div>
            </div>
          )}

          {hosted.length > 0 && !privateLocked && (
            <div style={{ marginBottom: 22 }}>
              <LabelCap>
                {isOrg ? 'Upcoming & past events' : 'Hosting & past events'}
              </LabelCap>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 10,
                }}
              >
                {hosted.map(e => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => router.push(`/event/${e.id}` as never)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: t.card,
                      border: `1px solid ${t.line}`,
                      borderRadius: 14,
                      padding: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 11,
                        background: t.subtle,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: t.ink3,
                        flexShrink: 0,
                      }}
                    >
                      <WebIcon name="pin" size={17} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: t.ink }}>
                        {e.title}
                      </div>
                      <div
                        style={{
                          fontFamily: FONT.mono,
                          fontSize: 10.5,
                          color: t.ink3,
                          marginTop: 2,
                        }}
                      >
                        {whenRange(e)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {ratings.length > 0 && !privateLocked && (
            <ReviewsInline
              ratings={ratings.slice(0, 3)}
              hostId={profile.id}
              total={ratings.length}
            />
          )}
        </div>
      </div>
    </WebSlideOver>
  );
}

function Stat({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const t = useTokens();
  const content = (
    <div
      style={{
        textAlign: 'center',
        padding: '10px 4px',
        background: t.surface,
        borderRadius: 12,
        border: `1px solid ${t.line}`,
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: 18,
          lineHeight: 1,
          color: t.ink,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 8.5,
          fontFamily: FONT.mono,
          letterSpacing: '0.1em',
          color: onPress ? t.primary : t.ink3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
  if (!onPress) return content;
  return (
    <button
      type="button"
      onClick={onPress}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {content}
    </button>
  );
}

function ReviewsInline({
  ratings,
  hostId,
  total,
}: {
  ratings: { id: string; reviewerId: string; rating: number; text: string; reviewerName?: string; reviewerPicture?: string | null }[];
  hostId: string;
  total: number;
}) {
  const t = useTokens();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <LabelCap>Reviews · {total}</LabelCap>
        <button
          type="button"
          onClick={() => router.push(`/ratings/${hostId}` as never)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: FONT.mono,
            fontSize: 10.5,
            fontWeight: 600,
            color: t.ink3,
            letterSpacing: '0.08em',
          }}
        >
          ALL →
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ratings.map(r => {
          // Mock-leak gate (inventory item): in live mode the joined
          // ratings query already returns `reviewerName` / `reviewerPicture`
          // — falling back to the SC fixture was only meaningful in mock
          // mode and was leaking when a live UUID happened to miss the
          // lookup. Prefer the live fields; fall back to the fixture
          // ONLY in mock mode.
          const fixture = api.isMock()
            ? SC_ACCOUNT_BY_ID[r.reviewerId]
            : undefined;
          const rv: Account =
            fixture ?? {
              id: r.reviewerId,
              type: 'person',
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
                  marginBottom: 7,
                }}
              >
                <WebAvatar person={rv} size={26} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{rv.name}</span>
                <span style={{ marginLeft: 'auto' }}>
                  <WebStars value={r.rating} size={11} showNum={false} />
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
  );
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

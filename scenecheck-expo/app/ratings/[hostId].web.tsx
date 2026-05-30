// Ratings (web overlay) — host review history. Header shows avatar +
// average WebStars + the 5-row histogram (count per star value);
// scrollable review list follows underneath. Each row links the rater
// to /profile/{id} (overlay) and the linked event to /event/{id}
// (also an overlay).
//
// Hooks: useProfile(hostId) for the header identity, useRatings(hostId)
// for the rows. Both already split mock vs live, so the overlay just
// renders what they hand back.

import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useProfile } from '@/hooks/useProfile';
import { useRatings } from '@/hooks/useRatings';
import { summarizeRatings } from '@/lib/ratings';
import { SC_ACCOUNT_BY_ID, SC_ANY_EVENT_BY_ID } from '@/data/mocks';
import { WebSlideOver } from '@/web/WebSlideOver';
import { WebAvatar } from '@/web/WebAvatar';
import { WebStars } from '@/web/WebStars';
import { WebTip } from '@/web/WebTip';
import { WebIcon } from '@/web/WebIcon';
import type { Account, Review } from '@/types/domain';

export default function RatingsWeb() {
  const t = useTokens();
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  const { profile: host } = useProfile(hostId);
  const { ratings } = useRatings(hostId);

  const summary = summarizeRatings(ratings);
  // 5,4,3,2,1 — descending so the bar chart reads top-to-bottom.
  const dist = [5, 4, 3, 2, 1].map(n => ({
    n,
    c: ratings.filter(r => r.rating === n).length,
  }));
  const max = ratings.length || 1;
  const close = () => router.back();

  return (
    <WebSlideOver
      open
      onClose={close}
      width={520}
      ariaLabel={`Reviews for ${host?.name ?? 'host'}`}
    >
      <div className="scroll" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 22,
            }}
          >
            <WebTip title="Back" side="bottom">
              <button type="button" onClick={close} style={iconBtn(t)}>
                <WebIcon name="back" size={18} />
              </button>
            </WebTip>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: t.ink3,
                textTransform: 'uppercase',
              }}
            >
              Host reviews
            </div>
          </div>

          {/* Summary header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              marginBottom: 24,
              background: t.card,
              border: `1px solid ${t.line}`,
              borderRadius: 18,
              padding: 20,
            }}
          >
            <WebAvatar person={host ?? undefined} size={64} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: t.ink,
                }}
              >
                {host?.name ?? 'This host'}
              </div>
              <div style={{ marginTop: 6 }}>
                {summary.average != null ? (
                  <WebStars value={summary.average} size={16} />
                ) : (
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 12,
                      color: t.ink3,
                    }}
                  >
                    No ratings
                  </span>
                )}
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  color: t.ink3,
                  marginTop: 4,
                }}
              >
                {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
              </div>
            </div>
            <div style={{ width: 150 }}>
              {dist.map(d => (
                <div
                  key={d.n}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 10,
                      width: 10,
                      color: t.ink3,
                    }}
                  >
                    {d.n}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 999,
                      background: t.subtle,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${(d.c / max) * 100}%`,
                        height: '100%',
                        background: t.warn,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reviews list */}
          {ratings.length === 0 ? (
            <div
              style={{
                padding: 28,
                textAlign: 'center',
                border: `1px dashed ${t.line}`,
                borderRadius: 16,
                color: t.ink3,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 16,
                  color: t.ink2,
                  marginBottom: 4,
                  fontWeight: 700,
                }}
              >
                No reviews yet
              </div>
              <div style={{ fontSize: 12.5 }}>
                Reviews appear after attendees rate an event this host ran.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ratings.map(r => (
                <ReviewCard key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </WebSlideOver>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const t = useTokens();
  const reviewer: Account =
    SC_ACCOUNT_BY_ID[review.reviewerId] ?? {
      id: review.reviewerId,
      type: 'person',
      name: review.reviewerName ?? 'Anonymous',
      picture: review.reviewerPicture ?? null,
    };
  const eventTitle =
    review.eventTitle ?? SC_ANY_EVENT_BY_ID[review.eventId]?.title;

  return (
    <div
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
          gap: 10,
          marginBottom: 8,
        }}
      >
        <button
          type="button"
          onClick={() =>
            router.push(`/profile/${review.reviewerId}` as never)
          }
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flex: 1,
            minWidth: 0,
            textAlign: 'left',
          }}
        >
          <WebAvatar person={reviewer} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.ink }}>
              {reviewer.name}
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 9.5,
                color: t.ink3,
              }}
            >
              {review.when}
            </div>
          </div>
        </button>
        <WebStars value={review.rating} size={13} showNum={false} />
      </div>
      <p
        style={{
          margin: '0 0 8px',
          fontSize: 13,
          lineHeight: 1.5,
          color: t.ink2,
        }}
      >
        {review.text}
      </p>
      {eventTitle && (
        <button
          type="button"
          onClick={() => router.push(`/event/${review.eventId}` as never)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            paddingTop: 8,
            // L-03 fix — the `border: 'none'` button reset previously
            // followed `borderTop` and clobbered it (shorthand wins over
            // longhand when declared later). Splitting the top border
            // into its three longhand properties bypasses the
            // shorthand-vs-longhand collision so the divider actually
            // renders.
            background: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            borderBottom: 'none',
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: t.line,
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
            fontFamily: FONT.mono,
            fontSize: 10.5,
            color: t.ink3,
          }}
        >
          <WebIcon name="calendar" size={11} /> on {eventTitle}
        </button>
      )}
    </div>
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

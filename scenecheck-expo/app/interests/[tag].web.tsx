// Interest detail (web overlay) — slide-over view of a single hashtag.
// Mirrors WInterestDetail from the design: big hashtag + subscriber
// count, description, Subscribe / Subscribed pill (toggles
// user_interests via the store + api side effect), Related tags row,
// and the list of events tagged with this hashtag (each rendered with
// the shared WebEventListCard).
//
// Hooks: useInterest(tag) → SC_INTERESTS_DETAILS / interests table.
// Tag subscription state comes from useStore.subscribedInterests, and
// the toggle uses the same `toggleInterestSub` mutator the native
// screen uses (which also commits to api.setInterestSubscribed when
// not in mock mode).

import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useInterest } from '@/hooks/useInterest';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { SC_EVENTS } from '@/data/mocks';
import { WebSlideOver } from '@/web/WebSlideOver';
import { WebButton } from '@/web/WebButton';
import { WebTag } from '@/web/WebTag';
import { WebTip } from '@/web/WebTip';
import { WebIcon } from '@/web/WebIcon';
import { WebEventListCard } from '@/web/WebEventListCard';

export default function InterestDetailWeb() {
  const t = useTokens();
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const { interest } = useInterest(tag);
  const subscribed = useStore(s => s.subscribedInterests);
  const toggleStore = useStore(s => s.toggleInterestSub);
  const showToast = useStore(s => s.showToast);
  const isJoined = useStore(s => s.isJoined);
  // Routed through the shared hook so optimistic-commit + waitlist
  // toast + UNDO grace match every other web caller.
  const onJoin = useJoinEventHandler();

  const close = () => router.back();
  const i = interest ?? {
    tag: tag ?? '',
    others: 0,
    desc: 'A user-created interest tag.',
    similar: [],
  };
  // Events tagged with this interest. Mock mode filters the in-memory
  // fixture client-side; live mode returns an empty list until a
  // server-side `?tag=` parameter is added to `rank_events_query` (or a
  // dedicated `/events?tag=` endpoint lands). Showing nothing is honest;
  // returning SC_EVENTS in live mode silently injects fixture rows into
  // a real signed-in user's feed and is the original H-03 finding.
  const events = api.isMock()
    ? SC_EVENTS.filter(e => (e.interests ?? []).includes(i.tag))
    : [];
  const isSub = subscribed.has(i.tag);

  const toggle = () => {
    const next = !isSub;
    toggleStore(i.tag);
    if (!api.isMock()) {
      api.setInterestSubscribed(i.tag, next).catch(() => {
        showToast({
          message: "Couldn't save that interest. Try again.",
          kind: 'error',
        });
      });
    }
  };

  return (
    <WebSlideOver
      open
      onClose={close}
      width={520}
      ariaLabel={`Interest details: #${i.tag}`}
    >
      <div className="scroll" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 22,
            }}
          >
            <WebTip title="Close" side="bottom">
              <button
                type="button"
                onClick={close}
                style={{
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
                }}
              >
                <WebIcon name="x" size={18} />
              </button>
            </WebTip>
          </div>

          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 40,
              lineHeight: 0.95,
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: t.ink,
            }}
          >
            <span style={{ color: t.ink3 }}>#</span>
            {i.tag}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 12,
              color: t.ink3,
              margin: '8px 0 16px',
            }}
          >
            {i.others.toLocaleString()} {i.others === 1 ? 'person' : 'people'} nearby share this
          </div>
          {i.desc && (
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.6,
                color: t.ink2,
                margin: '0 0 18px',
              }}
            >
              {i.desc}
            </p>
          )}

          <WebButton
            tone={isSub ? 'dark' : 'primary'}
            size="lg"
            icon={isSub ? 'check' : 'plus'}
            style={{ width: '100%', marginBottom: 22 }}
            onClick={toggle}
          >
            {isSub ? 'Subscribed' : 'Subscribe to this interest'}
          </WebButton>

          {(i.similar ?? []).length > 0 && (
            <div style={{ marginBottom: 22 }}>
              <LabelCap>Related</LabelCap>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {i.similar.map(s => (
                  <WebTag
                    key={s}
                    tag={s}
                    size="md"
                    tone="outline"
                    // Pushing onto the same overlay route swaps the visible
                    // panel content seamlessly (Expo Router replaces the
                    // top route in the stack).
                    onClick={() => router.push(`/interests/${s}` as never)}
                  />
                ))}
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div>
              <LabelCap>Events tagged #{i.tag}</LabelCap>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  marginTop: 10,
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
            </div>
          )}
        </div>
      </div>
    </WebSlideOver>
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

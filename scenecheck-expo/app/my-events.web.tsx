// My-Events (web) — the events the active user has joined (confirmed
// subscriptions). Same hook as native (useJoinedEvents), rendered as
// a 2-col WebEventListCard grid.

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useJoinedEvents } from '@/hooks/useJoinedEvents';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebButton } from '@/web/WebButton';

export default function MyEventsWeb() {
  const t = useTokens();
  const { events, loading } = useJoinedEvents();
  const pendingLeave = useStore(s => s.pendingLeave);
  const isJoined = useStore(s => s.isJoined);
  // Routed through the shared hook so optimistic-commit + waitlist
  // toast + UNDO grace match every other web caller.
  const onJoin = useJoinEventHandler();

  // Hide events you're mid-leave on so the list matches the join button.
  const visible = events.filter(e => !pendingLeave.has(e.id));

  return (
    <div
      className="scroll"
      style={{ height: '100%', overflowY: 'auto', background: t.surface }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 40px 60px',
        }}
      >
        <WebSecondaryHeader
          subtitle="Attending"
          title="Events you've joined"
          hint={`${visible.length} ${visible.length === 1 ? 'event' : 'events'}`}
        />

        {loading && visible.length === 0 ? (
          <div style={{ color: t.ink3, padding: 16 }}>Loading…</div>
        ) : visible.length === 0 ? (
          <Empty
            text="You haven't joined anything yet."
            cta="Browse events"
            onCta={() => router.push('/(tabs)' as never)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {visible.map(e => (
              <WebEventListCard
                key={e.id}
                event={e}
                joined={isJoined(e.id)}
                onOpen={(id) => router.push(`/event/${id}` as never)}
                onJoin={() => onJoin(e)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Empty({
  text,
  cta,
  onCta,
}: {
  text: string;
  cta?: string;
  onCta?: () => void;
}) {
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
      <div style={{ fontSize: 14, color: t.ink2, marginBottom: 14 }}>{text}</div>
      {cta && (
        <WebButton tone="primary" size="md" onClick={onCta}>
          {cta}
        </WebButton>
      )}
    </div>
  );
}

// My-Hosting (web) — desktop content column listing every event the
// active user hosts (published + past + cancelled). Same hook as
// native (useHostedEvents(meId), backed by api.fetchEventsByHost in
// live mode), rendered as a two-column WebEventListCard grid.

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { useHostedEvents } from '@/hooks/useHostedEvents';
import { useJoinEventHandler } from '@/hooks/useJoinEventHandler';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebButton } from '@/web/WebButton';

export default function MyHostingWeb() {
  const t = useTokens();
  const meId = useStore(s => s.me.id);
  const { events, loading } = useHostedEvents(meId);
  // Subscribe to the joined + pending-leave SETS (not the stable `isJoined`
  // fn reference) so any JOIN button re-renders on join/leave.
  const joinedSet = useStore(s => s.joined);
  const pendingLeave = useStore(s => s.pendingLeave);
  const isJoined = (eid: string) => joinedSet.has(eid) && !pendingLeave.has(eid);
  // Routed through the shared hook so optimistic-commit + waitlist
  // toast + UNDO grace match every other web caller.
  const onJoin = useJoinEventHandler();

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
          subtitle="Hosting"
          title="Events you're hosting"
          hint={`${events.length} ${events.length === 1 ? 'event' : 'events'}`}
          right={
            <WebButton
              tone="primary"
              size="md"
              icon="plus"
              onClick={() => router.push('/create-event' as never)}
            >
              New event
            </WebButton>
          }
        />

        {loading && events.length === 0 ? (
          <div style={{ color: t.ink3, padding: 16 }}>Loading…</div>
        ) : events.length === 0 ? (
          <EmptyState
            text="You haven't hosted anything yet."
            cta="Create your first event"
            onCta={() => router.push('/create-event' as never)}
          />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
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
        )}
      </div>
    </div>
  );
}

function EmptyState({
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

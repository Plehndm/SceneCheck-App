// Attendees (web overlay) — slide-over roster for an event. Each row
// shows avatar, name, @handle + mutual-friend count when known, with a
// WebFriendButton wired through to the shared social store. Tap the
// row to open that person's profile (which itself is an overlay).
//
// Hooks: useEvent for the title in the header, useAttendees for the
// confirmed list (event_subscriptions ⨝ profiles in live mode, mock
// fixture roster otherwise).

import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useEvent } from '@/hooks/useEvent';
import { useAttendees } from '@/hooks/useAttendees';
import { WebSlideOver } from '@/web/WebSlideOver';
import { WebTip } from '@/web/WebTip';
import { WebIcon } from '@/web/WebIcon';
import { WebPersonRow } from '@/web/WebPersonRow';

export default function AttendeesWeb() {
  const t = useTokens();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { event } = useEvent(id);
  const { attendees, loading } = useAttendees(id);

  const close = () => router.back();

  return (
    <WebSlideOver
      open
      onClose={close}
      width={440}
      ariaLabel={`Attendees of ${event?.title ?? 'event'}`}
    >
      <div className="scroll" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: '24px 28px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <WebTip title="Back" side="bottom">
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
                <WebIcon name="back" size={18} />
              </button>
            </WebTip>
            <div>
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
                Who&rsquo;s going
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontSize: 19,
                  fontWeight: 800,
                  color: t.ink,
                  letterSpacing: '-0.01em',
                  marginTop: 2,
                }}
              >
                {event?.title ?? 'This event'}
              </div>
            </div>
          </div>

          {loading && attendees.length === 0 ? (
            <div style={{ color: t.ink3, fontSize: 13 }}>Loading…</div>
          ) : attendees.length === 0 ? (
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
                No one&rsquo;s joined yet
              </div>
              <div style={{ fontSize: 12.5 }}>
                Be the first — open the event to RSVP.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attendees.map(p => (
                <WebPersonRow key={p.id} person={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </WebSlideOver>
  );
}

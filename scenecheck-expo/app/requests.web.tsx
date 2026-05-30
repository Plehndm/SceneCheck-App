// Requests (web) — both directions of pending friend requests in one
// content column. Incoming (Accept / Decline) uses the same store +
// api round-trip the native sibling uses; outgoing (Cancel) likewise.
//
// Hooks: useFriendRequests (incoming pending; friendships where
// to_id = me) + useOutgoingRequests (outgoing pending).

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useOutgoingRequests } from '@/hooks/useOutgoingRequests';
import { api } from '@/lib/api';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebAvatar } from '@/web/WebAvatar';
import { WebButton } from '@/web/WebButton';
import { WebIcon } from '@/web/WebIcon';

export default function RequestsWeb() {
  const t = useTokens();
  const acceptStore = useStore(s => s.acceptFriendRequest);
  const declineStore = useStore(s => s.declineFriendRequest);
  const cancelStore = useStore(s => s.cancelOutgoingRequest);
  const showToast = useStore(s => s.showToast);
  const { requests: incoming, reload: reloadIn } = useFriendRequests();
  const { people: outgoing, reload: reloadOut } = useOutgoingRequests();
  const total = incoming.length + outgoing.length;

  const accept = async (id: string, personId: string, name: string) => {
    acceptStore(id, personId);
    showToast({ message: `${name} added as a friend.`, kind: 'success' });
    try {
      await api.acceptFriendRequest(id);
      reloadIn();
    } catch (e) {
      showToast({
        message:
          e instanceof Error ? `Couldn't accept: ${e.message}` : "Couldn't accept.",
        kind: 'error',
      });
    }
  };

  const decline = async (id: string) => {
    declineStore(id);
    showToast({ message: 'Request declined.', kind: 'info' });
    try {
      await api.declineFriendRequest(id);
      reloadIn();
    } catch (e) {
      showToast({
        message:
          e instanceof Error ? `Couldn't decline: ${e.message}` : "Couldn't decline.",
        kind: 'error',
      });
    }
  };

  const cancel = async (id: string, name: string) => {
    cancelStore(id);
    showToast({ message: `Request to ${name} canceled.`, kind: 'info' });
    try {
      // Use the explicit cancel-pending alias (M-05). Today it forwards to
      // the same DELETE as `removeFriend`, but the call site intent is
      // "cancel a pending request" not "remove an existing friend".
      await api.cancelFriendRequest(id);
      reloadOut();
    } catch (e) {
      showToast({
        message:
          e instanceof Error ? `Couldn't cancel: ${e.message}` : "Couldn't cancel.",
        kind: 'error',
      });
    }
  };

  return (
    <div
      className="scroll"
      style={{ height: '100%', overflowY: 'auto', background: t.surface }}
    >
      <div
        style={{
          maxWidth: 920,
          margin: '0 auto',
          padding: '0 40px 60px',
        }}
      >
        <WebSecondaryHeader
          subtitle="Requests"
          title="Friend requests"
          hint={`${incoming.length} TO APPROVE · ${outgoing.length} SENT`}
        />

        {total === 0 ? (
          <div
            style={{
              padding: 60,
              textAlign: 'center',
              border: `1px dashed ${t.line}`,
              borderRadius: 18,
              color: t.ink3,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: t.subtle,
                margin: '0 auto 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: t.ink3,
              }}
            >
              <WebIcon name="user-check" size={28} />
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 18,
                fontWeight: 700,
                color: t.ink2,
                marginBottom: 6,
              }}
            >
              You&rsquo;re all caught up
            </div>
            <div style={{ fontSize: 13 }}>
              Requests you send and receive will show here.
            </div>
          </div>
        ) : (
          <>
            {incoming.length > 0 && (
              <div style={{ marginBottom: 26 }}>
                <SectionLabel>Requests for you · {incoming.length}</SectionLabel>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {incoming.map(r => (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: t.card,
                        border: `1px solid ${t.line}`,
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/profile/${r.person.id}` as never)
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                        }}
                      >
                        <WebAvatar person={r.person} size={46} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: FONT.display,
                              fontSize: 15,
                              fontWeight: 700,
                              color: t.ink,
                            }}
                          >
                            {r.person.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: t.ink3,
                              marginTop: 2,
                            }}
                          >
                            {r.note ?? `Wants to connect · ${r.when}`}
                          </div>
                        </div>
                      </button>
                      <WebButton
                        tone="primary"
                        size="sm"
                        onClick={() => accept(r.id, r.person.id, r.person.name)}
                      >
                        Accept
                      </WebButton>
                      <WebButton
                        tone="ghost"
                        size="sm"
                        onClick={() => decline(r.id)}
                      >
                        Ignore
                      </WebButton>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {outgoing.length > 0 && (
              <div>
                <SectionLabel>Sent by you · {outgoing.length}</SectionLabel>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {outgoing.map(p => (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: t.card,
                        border: `1px solid ${t.line}`,
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => router.push(`/profile/${p.id}` as never)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          flex: 1,
                          minWidth: 0,
                          textAlign: 'left',
                        }}
                      >
                        <WebAvatar person={p} size={46} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: FONT.display,
                              fontSize: 15,
                              fontWeight: 700,
                              color: t.ink,
                            }}
                          >
                            {p.name}
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: t.ink3,
                              marginTop: 2,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <WebIcon name="clock" size={12} /> Pending · awaiting their approval
                          </div>
                        </div>
                      </button>
                      <WebButton
                        tone="ghost"
                        size="sm"
                        icon="x"
                        onClick={() => cancel(p.id, p.name)}
                      >
                        Cancel
                      </WebButton>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <div
      style={{
        marginBottom: 12,
        fontFamily: FONT.mono,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: t.ink3,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  );
}

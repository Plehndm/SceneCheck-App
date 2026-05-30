// Drafts (web) — unpublished events the user has saved on this device.
// Reads from useStore.drafts (local persistence; the native sibling
// has the same source of truth). Resume opens /create-event with the
// draftId param; Delete confirms then drops the row from the store.

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebButton } from '@/web/WebButton';
import { WebIcon } from '@/web/WebIcon';

export default function DraftsWeb() {
  const t = useTokens();
  const drafts = useStore(s => s.drafts);
  const removeDraft = useStore(s => s.removeDraft);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);

  const handleDelete = (id: string, title: string) => {
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
          subtitle="Drafts"
          title="Drafts"
          hint={`${drafts.length} ${drafts.length === 1 ? 'draft' : 'drafts'} saved to this device`}
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

        {drafts.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              border: `1px dashed ${t.line}`,
              borderRadius: 18,
              color: t.ink3,
            }}
          >
            <div style={{ fontSize: 14, color: t.ink2 }}>
              When you start an event but don&rsquo;t publish, it lands here.
            </div>
          </div>
        ) : (
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
                    background: t.primarySoft,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: t.primary,
                    flexShrink: 0,
                  }}
                >
                  <WebIcon name="edit" size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: FONT.display,
                      fontSize: 16,
                      fontWeight: 700,
                      color: t.ink,
                    }}
                  >
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
                  {d.form.desc && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: t.ink2,
                        marginTop: 8,
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {d.form.desc}
                    </div>
                  )}
                </div>
                <WebButton
                  tone="primary"
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
                  onClick={() => handleDelete(d.id, d.form.title)}
                >
                  Delete
                </WebButton>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

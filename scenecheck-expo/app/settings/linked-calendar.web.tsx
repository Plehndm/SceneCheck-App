// Settings → Linked calendar (WEB).
//
// The native screen (`linked-calendar.tsx`) drives Google Calendar through
// `expo-auth-session`'s `Google.useAuthRequest(...)` hook, which is called at
// render. That hook isn't wired for the static web build and throws when the
// route mounts in the browser — which is the "calendar link button gives an
// error when pressed" report (pressing the row routes here, and the screen
// crashes on render).
//
// This web variant skips OAuth entirely. It renders the provider picker the
// user expects, and selecting a provider surfaces a friendly "not set up yet"
// toast instead of attempting a sync that can't complete on web. We do NOT set
// the store's functional `linkedCalendar` to a connected value, since that
// would make create-event / event-detail fire calendar side-effects that would
// themselves fail — the selection here is purely a visual + informational
// affordance until the sync is built. Native keeps `linked-calendar.tsx`.

import { useState } from 'react';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { WebIcon } from '@/web/WebIcon';

const PROVIDERS = [
  { k: 'google', label: 'Google Calendar', desc: 'Sync events to your Google account' },
  { k: 'apple', label: 'Apple Calendar', desc: 'Sync to iCloud across your devices' },
  { k: 'outlook', label: 'Outlook', desc: 'Microsoft 365 / Outlook.com' },
] as const;

export default function LinkedCalendarWeb() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const [selected, setSelected] = useState<string | null>(null);

  const pick = (k: string, label: string) => {
    setSelected(k);
    showToast({
      message: `${label} sync isn't fully set up yet — it's coming soon.`,
      kind: 'info',
      duration: 4200,
    });
  };

  return (
    <div
      className="scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        background: t.surface,
        color: t.ink,
        fontFamily: FONT.body,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 40px 60px' }}>
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
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
            marginBottom: 20,
          }}
        >
          <WebIcon name="back" size={18} />
        </button>

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
          Settings
        </div>
        <h1
          style={{
            margin: '6px 0 0',
            fontFamily: FONT.display,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            fontSize: 30,
            lineHeight: 1.05,
            color: t.ink,
          }}
        >
          Linked calendar
        </h1>
        <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.5, color: t.ink3 }}>
          Pick where SceneCheck should mirror events you join or create.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          {PROVIDERS.map(p => {
            const on = selected === p.k;
            return (
              <button
                key={p.k}
                type="button"
                onClick={() => pick(p.k, p.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 16,
                  cursor: 'pointer',
                  background: t.card,
                  border: `1.5px solid ${on ? t.primary : t.line}`,
                  color: t.ink,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    flexShrink: 0,
                    background: t.subtle,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: on ? t.primary : t.ink2,
                  }}
                >
                  <WebIcon name="calendar" size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: t.ink }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: t.ink3, marginTop: 1 }}>{p.desc}</div>
                </div>
                {on && (
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: t.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <WebIcon name="check" size={12} color={t.primaryInk} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            border: `1px dashed ${t.line}`,
            fontFamily: FONT.mono,
            fontSize: 11,
            lineHeight: 1.5,
            color: t.ink3,
          }}
        >
          Calendar sync is still in progress — selecting a provider here won&rsquo;t
          push events to your calendar yet. We&rsquo;ll enable it in an upcoming update.
        </div>
      </div>
    </div>
  );
}

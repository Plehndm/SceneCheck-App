// Settings (web) — single scrollable column (~720 px max) of
// collapsible cards. Each card's header carries an inline summary
// chip (e.g. "Discovery · 10 mi", "Notifications · 4 of 6 on") so the
// user can see every current value at a glance without expanding.
//
// Reuses the same store slices the native settings.tsx reads from —
// nothing here is duplicated state. Sign-out calls api.signOut() and
// then router.replace('/auth/sign-in'); calendar + blocked + help
// rows push to the existing sub-screens (which already have native
// implementations and don't need their own .web.tsx variants for
// this wave).

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT, PALETTES, type PaletteName } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import type { Visibility } from '@/types/domain';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebSettingsSection } from '@/web/WebSettingsSection';
import { WebToggleRow } from '@/web/WebToggleRow';
import { WebButton } from '@/web/WebButton';
import { WebIcon, type WebIconName } from '@/web/WebIcon';

interface NotifRow {
  k: keyof ReturnType<typeof useStore.getState>['notifPrefs'];
  label: string;
  sub: string;
  icon: WebIconName;
}

const NOTIF_ROWS: NotifRow[] = [
  { k: 'messages', label: 'Messages', sub: 'Direct messages from friends', icon: 'chat' },
  { k: 'friendRequests', label: 'Friend requests', sub: 'When someone wants to add you', icon: 'user-plus' },
  { k: 'orgEvents', label: 'New events', sub: 'Events from orgs you follow', icon: 'calendar' },
  { k: 'eventReminders', label: 'Event reminders', sub: "Heads-up an hour before events you're going to", icon: 'bell' },
  { k: 'friendActivity', label: 'Friend activity', sub: 'When friends RSVP or post events', icon: 'people' },
  { k: 'weeklyDigest', label: 'Weekly digest', sub: 'A Sunday summary of upcoming local scenes', icon: 'mail' },
];

const RADIUS_PRESETS = [1, 3, 5, 10, 25, 50] as const;

const RAIL_OPTIONS: { k: 'wide' | 'icons' | 'hover'; label: string; sub: string }[] = [
  { k: 'wide', label: 'Wide', sub: 'Always-labeled navigation' },
  { k: 'icons', label: 'Icons', sub: 'Icon-only with tooltips' },
  { k: 'hover', label: 'Hover', sub: 'Collapsed; expands on hover' },
];

export default function SettingsWeb() {
  const t = useTokens();

  const radius = useStore(s => s.radius);
  const setRadius = useStore(s => s.setRadius);
  const visibility = useStore(s => s.visibility);
  const setVisibility = useStore(s => s.setVisibility);
  const notifPrefs = useStore(s => s.notifPrefs);
  const setNotifPref = useStore(s => s.setNotifPref);
  const palette = useStore(s => s.palette);
  const setPalette = useStore(s => s.setPalette);
  const mode = useStore(s => s.mode);
  const setMode = useStore(s => s.setMode);
  const tweaks = useStore(s => s.tweaks);
  const setTweak = useStore(s => s.setTweak);
  const railStyle = useStore(s => s.railStyle);
  const setRailStyle = useStore(s => s.setRailStyle);
  const linkedCalendar = useStore(s => s.linkedCalendar);
  const blocked = useStore(s => s.blocked);
  const sessionEmail = useStore(s => s.session?.email);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);

  // Inline summary chips — derived once per render. Reading from store
  // values directly so they stay in sync with the controls inside the
  // expanded section without any duplicate state.
  const notifOnCount = NOTIF_ROWS.reduce(
    (n, row) => n + (notifPrefs[row.k] ? 1 : 0),
    0,
  );
  const calLabel = linkedCalendar
    ? linkedCalendar.charAt(0).toUpperCase() + linkedCalendar.slice(1)
    : 'None';
  const paletteLabel = PALETTES[palette]?.label ?? 'Sunset Coral';
  const visibilityLabel = visibility === 'public' ? 'Public' : 'Private';
  const railLabel =
    RAIL_OPTIONS.find(o => o.k === railStyle)?.label ?? 'Hover';

  const handleSignOut = () => {
    showConfirm({
      title: 'Sign out?',
      body: 'You can sign back in any time.',
      confirmLabel: 'SIGN OUT',
      tone: 'danger',
      icon: 'logout',
      onConfirm: async () => {
        try {
          await api.signOut();
          showToast({
            message: api.isMock() ? 'Signed out (mock).' : 'Signed out.',
            kind: 'info',
          });
          router.replace('/auth/sign-in' as never);
        } catch (e) {
          showToast({
            message: e instanceof Error ? e.message : 'Sign-out failed.',
            kind: 'error',
          });
        }
      },
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
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 40px 60px' }}>
        <WebSecondaryHeader
          subtitle="Account"
          title="Settings"
          hint={sessionEmail || undefined}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* ── Discovery ───────────────────────────── */}
          <WebSettingsSection
            title="Discovery"
            summary={`${radius >= 50 ? 'Any' : `${radius} mi`} radius`}
            icon="compass"
            defaultOpen
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6 }}>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={Math.min(radius, 50)}
                onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: t.primary }}
                aria-label="Discovery radius"
              />
              <div style={{ minWidth: 86, textAlign: 'right' }}>
                <div
                  style={{
                    fontFamily: FONT.display,
                    fontSize: 20,
                    lineHeight: 1,
                    fontWeight: 700,
                  }}
                >
                  {radius >= 50 ? 'Any' : `${radius} mi`}
                </div>
                {!RADIUS_PRESETS.includes(radius as never) && (
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      color: t.primary,
                      fontWeight: 700,
                      marginTop: 3,
                    }}
                  >
                    CUSTOM
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {RADIUS_PRESETS.map(d => {
                const on = radius === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setRadius(d)}
                    style={{
                      flex: 1,
                      padding: '8px 4px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: on ? t.ink : t.card,
                      color: on ? t.surface : t.ink2,
                      border: `1px solid ${on ? t.ink : t.line}`,
                      fontFamily: FONT.mono,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {d >= 50 ? 'Any' : `${d}mi`}
                  </button>
                );
              })}
            </div>
            {radius >= 25 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  borderRadius: 10,
                  background: t.warn + '26',
                  border: `1px solid ${t.warn}59`,
                  fontSize: 11.5,
                  color: t.ink2,
                  lineHeight: 1.4,
                }}
              >
                Heads up — at {radius} miles you&rsquo;ll see events across the whole region.
                Expect a busier feed.
              </div>
            )}
          </WebSettingsSection>

          {/* ── Privacy ─────────────────────────────── */}
          <WebSettingsSection
            title="Privacy"
            summary={visibilityLabel}
            icon={visibility === 'public' ? 'globe' : 'lock'}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              {(
                [
                  { k: 'public', icon: 'globe' as WebIconName, t: 'Public', d: 'Anyone can add you instantly' },
                  { k: 'private', icon: 'lock' as WebIconName, t: 'Private', d: 'You approve each request' },
                ] as { k: Visibility; icon: WebIconName; t: string; d: string }[]
              ).map(o => {
                const on = visibility === o.k;
                return (
                  <button
                    key={o.k}
                    type="button"
                    onClick={() => setVisibility(o.k)}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      padding: 14,
                      borderRadius: 14,
                      cursor: 'pointer',
                      background: t.card,
                      border: `1.5px solid ${on ? t.primary : t.line}`,
                      color: t.ink,
                      fontFamily: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                        color: on ? t.primary : t.ink,
                      }}
                    >
                      <WebIcon name={o.icon} size={17} />
                      <span
                        style={{
                          fontFamily: FONT.display,
                          fontSize: 16,
                          fontWeight: 700,
                        }}
                      >
                        {o.t}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: t.ink3 }}>{o.d}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: 12 }}>
              <SettingsLink
                icon="lock"
                label="Blocked users"
                value={`${blocked.length} blocked`}
                onClick={() => router.push('/settings/blocked' as never)}
              />
            </div>
          </WebSettingsSection>

          {/* ── Notifications ───────────────────────── */}
          <WebSettingsSection
            title="Notifications"
            summary={`${notifOnCount} of ${NOTIF_ROWS.length} on`}
            icon="bell"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {NOTIF_ROWS.map(row => (
                <WebToggleRow
                  key={row.k}
                  label={row.label}
                  sub={row.sub}
                  value={!!notifPrefs[row.k]}
                  onChange={(v) => setNotifPref(row.k, v)}
                  icon={row.icon}
                />
              ))}
            </div>
          </WebSettingsSection>

          {/* ── Appearance ──────────────────────────── */}
          <WebSettingsSection
            title="Appearance"
            summary={`${paletteLabel} · ${mode === 'dark' ? 'Dark' : 'Light'} · ${railLabel} rail`}
            icon={mode === 'dark' ? 'moon' : 'sun'}
          >
            {/* Palette */}
            <div style={{ marginBottom: 14 }}>
              <SubLabel>Color palette</SubLabel>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {(Object.keys(PALETTES) as PaletteName[]).map(name => {
                  const on = palette === name;
                  const swatch = PALETTES[name].light;
                  const colors = [swatch.primary, swatch.primarySoft, swatch.ink];
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setPalette(name)}
                      style={{
                        flex: '1 1 180px',
                        minWidth: 160,
                        textAlign: 'left',
                        padding: 14,
                        borderRadius: 14,
                        cursor: 'pointer',
                        background: t.card,
                        border: `1.5px solid ${on ? t.primary : t.line}`,
                        color: t.ink,
                        fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 4, marginBottom: 11 }}>
                        {colors.map((c, i) => (
                          <div
                            key={i}
                            style={{
                              width: i === 0 ? 30 : 18,
                              height: 30,
                              borderRadius: 8,
                              background: c,
                              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                            }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span
                          style={{
                            fontFamily: FONT.display,
                            fontSize: 14.5,
                            fontWeight: 700,
                            flex: 1,
                          }}
                        >
                          {PALETTES[name].label}
                        </span>
                        {on && <WebIcon name="check" size={15} color={t.primary} />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode */}
            <div style={{ marginBottom: 14 }}>
              <SubLabel>Brightness</SubLabel>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['light', 'dark'] as const).map(m => {
                  const on = mode === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      style={{
                        flex: 1,
                        padding: 12,
                        borderRadius: 12,
                        background: t.card,
                        border: `1.5px solid ${on ? t.primary : t.line}`,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        color: on ? t.primary : t.ink2,
                        fontFamily: 'inherit',
                      }}
                    >
                      <WebIcon name={m === 'dark' ? 'moon' : 'sun'} size={14} />
                      <span style={{ fontSize: 14, fontWeight: on ? 600 : 500 }}>
                        {m === 'dark' ? 'Dark' : 'Light'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rail style */}
            <div style={{ marginBottom: 14 }}>
              <SubLabel>Navigation rail</SubLabel>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {RAIL_OPTIONS.map(o => {
                  const on = railStyle === o.k;
                  return (
                    <button
                      key={o.k}
                      type="button"
                      onClick={() => setRailStyle(o.k)}
                      style={{
                        flex: '1 1 140px',
                        minWidth: 130,
                        textAlign: 'left',
                        padding: 12,
                        borderRadius: 12,
                        cursor: 'pointer',
                        background: t.card,
                        border: `1.5px solid ${on ? t.primary : t.line}`,
                        color: t.ink,
                        fontFamily: 'inherit',
                      }}
                    >
                      <div
                        style={{
                          fontFamily: FONT.display,
                          fontSize: 14,
                          fontWeight: 700,
                          color: on ? t.primary : t.ink,
                        }}
                      >
                        {o.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: t.ink3, marginTop: 3 }}>
                        {o.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Map sub-section */}
            <div>
              <SubLabel>Map</SubLabel>
              <WebToggleRow
                label="Rich pin hover"
                sub="Show the full event hover card when you mouse over a pin."
                value={!!tweaks.richPinHover}
                onChange={(v) => setTweak('richPinHover', v)}
                icon="pin"
              />
            </div>
          </WebSettingsSection>

          {/* ── Calendar ────────────────────────────── */}
          <WebSettingsSection
            title="Calendar linking"
            summary={calLabel}
            icon="calendar"
          >
            <SettingsLink
              icon="calendar"
              label="Linked calendar"
              value={calLabel}
              onClick={() => router.push('/settings/linked-calendar' as never)}
            />
          </WebSettingsSection>

          {/* ── Help & feedback ─────────────────────── */}
          <WebSettingsSection title="Help & feedback" icon="help">
            <SettingsLink
              icon="help"
              label="Help & feedback"
              value="Send a note"
              onClick={() => router.push('/settings/help' as never)}
            />
          </WebSettingsSection>

          {/* ── Account ─────────────────────────────── */}
          <WebSettingsSection
            title="Account"
            summary={sessionEmail || 'Mock session'}
            icon="profile"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SettingsLink
                icon="mail"
                label="Email"
                value={sessionEmail || 'Not signed in'}
                // L-04 — the row previously navigated to `/settings` (its
                // own page), which read as broken. Native opens a
                // `ChangeEmailSheet` bottom sheet; the web mirror hasn't
                // been built yet, so disable the row with a tooltip
                // until then. `onClick` is required by the type but is
                // never invoked because `disabled` short-circuits.
                onClick={() => {}}
                disabled
                disabledHint="Change-email flow coming soon — sign out + back in to update."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <WebButton tone="ghost" icon="logout" onClick={handleSignOut}>
                  Sign out
                </WebButton>
              </div>
            </div>
          </WebSettingsSection>

          <div
            style={{
              padding: '20px 0',
              textAlign: 'center',
              fontFamily: FONT.mono,
              fontSize: 11,
              color: t.ink3,
            }}
          >
            SceneCheck · v0.4.2
          </div>
        </div>
      </div>
    </div>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.1em',
        color: t.ink3,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}

function SettingsLink({
  icon,
  label,
  value,
  onClick,
  disabled,
  disabledHint,
}: {
  icon: WebIconName;
  label: string;
  value?: string;
  onClick: () => void;
  /** When true, the row is rendered non-interactive with a hint tooltip. */
  disabled?: boolean;
  /** Tooltip / title text when the row is disabled. */
  disabledHint?: string;
}) {
  const t = useTokens();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
      aria-disabled={disabled || undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        color: t.ink,
        textAlign: 'left',
        fontFamily: 'inherit',
        width: '100%',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 10,
          background: t.subtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.ink2,
          flexShrink: 0,
        }}
      >
        <WebIcon name={icon} size={15} />
      </div>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{label}</span>
      {value && (
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            color: t.ink3,
          }}
        >
          {value}
        </span>
      )}
      {!disabled && <WebIcon name="chevron-right" size={14} color={t.ink3} />}
    </button>
  );
}

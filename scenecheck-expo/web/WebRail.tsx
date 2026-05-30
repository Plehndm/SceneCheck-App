// WebRail — left-side navigation rail (Instagram-style) for the
// desktop web build. Port of `web/web-rail.jsx`.
//
// Three display modes (driven by `useStore().railStyle`):
//   • wide   — always-labeled (~248 px)
//   • icons  — icon-only with hover tooltips (~78 px)
//   • hover  — collapsed by default, expands to wide on mouse-enter
//
// Backend touchpoints:
//   • Nav clicks call `router.push()` (expo-router) — no API.
//   • Badge counts come from `badges` prop (unread notifications,
//     unread chat messages, pending friend requests). Keep these live
//     via Supabase Realtime so the dots update without polling.
//   • Bell ("Activity") opens a slide-out panel via `onPanel()` — the
//     panel itself (WebActivityPanel) wires the notifications feed.
//   • Account switcher (bottom) reads SC_MY_ACCOUNTS (mock-mode) and
//     mutates the store's `activeAccount`. In live mode that list is
//     the user's profile + orgs they manage.
//   • Create-event button (top-right plus) routes to /create-event.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { router } from 'expo-router';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { api } from '@/lib/api';
import { SC_MY_ACCOUNTS } from '@/data/mocks';
import type { Account } from '@/types/domain';
import { WebIcon, type WebIconName } from './WebIcon';
import { WebAvatar } from './WebAvatar';
import { WebTip } from './WebTip';
import { useFocusTrap } from './useFocusTrap';

export type RailStyle = 'wide' | 'icons' | 'hover';
export type RailRoute =
  | 'home'
  | 'search'
  | 'chat'
  | 'friends'
  | 'following'
  | 'profile'
  | 'settings'
  | 'create';

export interface RailBadges {
  notif?: number | null;
  chat?: number | null;
  requests?: number | null;
}

interface RailItemDef {
  key: string;
  icon: WebIconName;
  label: string;
  desc?: string;
  route?: RailRoute;
  panel?: 'activity';
  badge?: number | null;
}

interface Props {
  /** Which top-level tab is active. Drives the active-pill highlight. */
  activeTab?:
    | 'home'
    | 'search'
    | 'notifications'
    | 'chat'
    | 'friends'
    | 'following'
    | 'profile'
    | 'settings'
    | 'create'
    | (string & {});
  /** Navigation handler. Defaults to `router.push` via the route map. */
  go?: (route: RailRoute) => void;
  /** Open/close the activity slide-over. Receives the panel name. */
  onPanel?: (panel: 'activity') => void;
  /** Which side-panel is currently open (drives the bell's active state). */
  activePanel?: 'activity' | null;
  /** Unread badge counts. */
  badges?: RailBadges;
  /** Force the rail to its expanded width regardless of mode. */
  forceExpanded?: boolean;
  style?: CSSProperties;
}

// Default route handler: maps a rail route to an expo-router URL.
const ROUTE_MAP: Record<RailRoute, string> = {
  home: '/',
  search: '/search',
  chat: '/chat',
  friends: '/my-friends',
  following: '/my-following',
  profile: '/profile',
  settings: '/settings',
  create: '/create-event',
};

function defaultGo(route: RailRoute) {
  router.push(ROUTE_MAP[route] as never);
}

interface RailItemProps {
  item: RailItemDef;
  active: boolean;
  expanded: boolean;
  showTip: boolean;
  onClick: () => void;
}

function RailItem({ item, active, expanded, showTip, onClick }: RailItemProps) {
  const t = useTokens();
  const [hover, setHover] = useState(false);
  const railInk = '#F4ECDD';
  const bg = active
    ? t.primary
    : hover
      ? `color-mix(in oklab, ${railInk} 12%, transparent)`
      : 'transparent';
  const fg = active ? t.primaryInk : railInk;
  const node = (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label={item.label}
      style={{
        width: '100%',
        height: 46,
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: expanded ? '0 14px' : 0,
        justifyContent: expanded ? 'flex-start' : 'center',
        borderRadius: 14,
        background: bg,
        color: fg,
        position: 'relative',
        overflow: 'hidden',
        transition:
          'transform 120ms ease, opacity 120ms ease, color 120ms ease, box-shadow 160ms ease, background 120ms ease',
      }}
    >
      <span style={{ flexShrink: 0, display: 'flex', position: 'relative' }}>
        <WebIcon name={item.icon} size={22} strokeWidth={active ? 2.3 : 2} />
        {item.badge ? (
          <span
            style={{
              position: 'absolute',
              top: -5,
              right: -7,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 999,
              background: active ? t.ink : t.primary,
              color: 'white',
              fontFamily: FONT.mono,
              fontSize: 9.5,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid #14110F`,
            }}
          >
            {item.badge}
          </span>
        ) : null}
      </span>
      {expanded && (
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap',
            textTransform: 'uppercase',
          }}
        >
          {item.label}
        </span>
      )}
    </button>
  );
  if (!showTip) return node;
  return (
    <WebTip title={item.label} desc={item.desc} side="right" style={{ width: '100%' }}>
      {node}
    </WebTip>
  );
}

export function WebRail({
  activeTab,
  go,
  onPanel,
  activePanel = null,
  badges = {},
  forceExpanded = false,
  style,
}: Props) {
  const t = useTokens();
  const railStyle = useStore(s => s.railStyle);
  const activeAccount = useStore(s => s.activeAccount);
  const setActiveAccount = useStore(s => s.setActiveAccount);
  const picture = useStore(s => s.picture);
  const orgPictures = useStore(s => s.orgPictures);
  const me = useStore(s => s.me);
  const session = useStore(s => s.session);

  const [railHover, setRailHover] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  // Refs for the switcher trigger + popover. Used by the focus trap so
  // Tab cycles inside the menu while it's open and focus returns to the
  // trigger on close. (WCAG 2.1 SC 2.1.2, SC 2.4.3.)
  const switcherTriggerRef = useRef<HTMLButtonElement | null>(null);
  const switcherPopoverRef = useRef<HTMLDivElement | null>(null);

  // ESC closes the switcher. Mirrors the activity panel + slide-over
  // ESC handler so all three overlays behave the same way.
  useEffect(() => {
    if (!switcherOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSwitcherOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [switcherOpen]);

  useFocusTrap(switcherOpen, switcherPopoverRef, switcherTriggerRef);

  const expanded =
    railStyle === 'wide' ||
    forceExpanded ||
    (railStyle === 'hover' && railHover);
  const showTip = !expanded;

  const nav = go ?? defaultGo;

  // Build the account list from live data when we have a Supabase
  // session, otherwise fall back to the mock fixtures so the mock
  // build + the standalone demo + Jest keep rendering. In live mode
  // `me` is hydrated by AuthBootstrap from the `profiles` row, so
  // `me.id` is the auth user's UUID and `me.name`/`me.username`/etc.
  // reflect the signed-in person.
  //
  // Managed orgs are not yet hydrated by AuthBootstrap (`org_members`
  // hook is a future feature) — see the TODO below.
  const accounts: Account[] = useMemo(() => {
    if (api.isMock() || !session) return SC_MY_ACCOUNTS;
    return [
      {
        ...me,
        // Account.handle is what the rail chip + switcher both render
        // under the display name; backfill from username when the
        // profile row doesn't set one explicitly.
        handle: me.handle ?? (me.username ? `@${me.username}` : '@me'),
      } as Account,
      // TODO(orgs): hydrate the user's managed orgs (`org_members`
      // join → `profiles`) in AuthBootstrap and append them here.
    ];
  }, [me, session]);

  const account: Account =
    accounts.find(a => a.id === activeAccount) || accounts[0];
  // Picture resolution: the personal account uses the locally-picked
  // avatar (`useStore.picture`, populated by AuthBootstrap from
  // profiles.avatar_url) OR — once we have orgs — a per-org override.
  const acctPic =
    account.id === me.id
      ? (picture ?? account.picture ?? null)
      : (orgPictures || {})[account.id] || account.picture || null;
  const acctPerson = { ...account, picture: acctPic };

  // Rail color tokens — rail stays a dark control bar in every theme,
  // matching the Instagram/Discord nav idiom. These are constant in
  // the design and intentionally don't pull from `useTokens()`.
  const RAIL_BG = '#14110F';
  const RAIL_INK = '#F4ECDD';
  const RAIL_INK_2 = '#9C9182';
  const RAIL_LINE = '#2B2118';

  const groups: { group: string; items: RailItemDef[] }[] = [
    {
      group: 'DISCOVER',
      items: [
        {
          key: 'home',
          icon: 'map',
          label: 'Explore',
          desc: 'The live map of events happening near you',
          route: 'home',
        },
        {
          key: 'search',
          icon: 'compass',
          label: 'Discover',
          desc: 'Search events, people, orgs & interests',
          route: 'search',
        },
        {
          key: 'notifications',
          icon: 'bell',
          label: 'Activity',
          desc: 'Reminders, requests & org updates',
          panel: 'activity',
          badge: badges.notif ?? null,
        },
      ],
    },
    {
      group: 'CONNECT',
      items: [
        {
          key: 'chat',
          icon: 'chat',
          label: 'Messages',
          desc: 'Direct messages & event group chats',
          route: 'chat',
          badge: badges.chat ?? null,
        },
        {
          key: 'friends',
          icon: 'users',
          label: 'Friends',
          desc: 'Your friends & pending requests',
          route: 'friends',
          badge: badges.requests ?? null,
        },
        {
          key: 'following',
          icon: 'building',
          label: 'Following',
          desc: 'Organizations you follow',
          route: 'following',
        },
      ],
    },
  ];

  return (
    <div
      onMouseEnter={() => setRailHover(true)}
      onMouseLeave={() => {
        setRailHover(false);
        setSwitcherOpen(false);
      }}
      style={{
        width: expanded ? 248 : 78,
        flexShrink: 0,
        height: '100%',
        background: RAIL_BG,
        color: RAIL_INK,
        borderRight: `1px solid ${RAIL_LINE}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px 16px',
        transition: 'width 220ms cubic-bezier(.4, 0, .2, 1)',
        position: 'relative',
        zIndex: 60,
        ...style,
      }}
    >
      {/* Logo */}
      <WebTip title="SceneCheck" desc="Go to Explore" side="right" disabled={!showTip} style={{ width: '100%' }}>
        <button
          type="button"
          onClick={() => nav('home')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            padding: expanded ? '0 6px' : 0,
            justifyContent: expanded ? 'flex-start' : 'center',
            marginBottom: 22,
            color: RAIL_INK,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 13,
              background: t.primary,
              color: t.primaryInk,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONT.display,
              fontWeight: 800,
              fontStretch: '70%',
              fontSize: 24,
              letterSpacing: '-0.05em',
              boxShadow: `0 8px 18px -8px color-mix(in oklab, ${t.primary} 70%, transparent)`,
            }}
          >
            S
          </div>
          {expanded && (
            <div style={{ textAlign: 'left' }}>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 800,
                  fontStretch: '75%',
                  letterSpacing: '-0.045em',
                  fontSize: 19,
                  color: RAIL_INK,
                  lineHeight: 1,
                }}
              >
                SceneCheck
              </div>
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 8.5,
                  color: RAIL_INK_2,
                  letterSpacing: '0.18em',
                  marginTop: 2,
                }}
              >
                WEB · IRVINE
              </div>
            </div>
          )}
        </button>
      </WebTip>

      {/* Create event — prominent */}
      <WebTip
        title="Create event"
        desc="Host a new meetup"
        side="right"
        disabled={!showTip}
        style={{ width: '100%' }}
      >
        <button
          type="button"
          onClick={() => nav('create')}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: `color-mix(in oklab, ${RAIL_INK} 14%, transparent)`,
            color: RAIL_INK,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            justifyContent: expanded ? 'flex-start' : 'center',
            padding: expanded ? '0 14px' : 0,
            marginBottom: 18,
            boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${RAIL_INK} 16%, transparent)`,
          }}
        >
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: 9,
              background: t.primary,
              color: t.primaryInk,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <WebIcon name="plus" size={17} strokeWidth={2.6} />
          </span>
          {expanded && (
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Create event
            </span>
          )}
        </button>
      </WebTip>

      {/* Nav groups */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          scrollbarWidth: 'none',
        }}
      >
        {groups.map((g, gi) => (
          <div key={g.group} style={{ marginBottom: 8 }}>
            {expanded && (
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: RAIL_INK_2,
                  fontWeight: 500,
                  padding: '8px 12px 6px',
                }}
              >
                {g.group}
              </div>
            )}
            {!expanded && gi > 0 && (
              <div
                style={{
                  height: 1,
                  background: RAIL_LINE,
                  margin: '8px 10px',
                }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.items.map(it => {
                const isPanel = !!it.panel;
                const active = isPanel
                  ? activePanel === it.panel
                  : activeTab === it.key;
                return (
                  <RailItem
                    key={it.key}
                    item={it}
                    active={active}
                    expanded={expanded}
                    showTip={showTip}
                    onClick={() => {
                      if (it.panel) onPanel?.(it.panel);
                      else if (it.route) nav(it.route);
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom: settings + account switcher */}
      <div
        style={{
          marginTop: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          position: 'relative',
        }}
      >
        <RailItem
          item={{
            key: 'settings',
            icon: 'settings',
            label: 'Settings',
            desc: 'Radius, privacy, notifications & theme',
            route: 'settings',
          }}
          active={activeTab === 'settings'}
          expanded={expanded}
          showTip={showTip}
          onClick={() => nav('settings')}
        />

        <WebTip
          title={account.name}
          desc="Switch account"
          side="right"
          disabled={!showTip || switcherOpen}
          style={{ width: '100%' }}
        >
          <button
            ref={switcherTriggerRef}
            type="button"
            onClick={() => setSwitcherOpen(o => !o)}
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            style={{
              width: '100%',
              borderRadius: 14,
              border: `1px solid ${RAIL_LINE}`,
              cursor: 'pointer',
              background: switcherOpen
                ? `color-mix(in oklab, ${RAIL_INK} 12%, transparent)`
                : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: expanded ? '8px 10px' : 8,
              justifyContent: expanded ? 'flex-start' : 'center',
              color: RAIL_INK,
            }}
          >
            <WebAvatar
              person={acctPerson}
              size={34}
              ring={account.type !== 'org'}
            />
            {expanded && (
              <>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: 'left',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: RAIL_INK,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {account.name}
                  </div>
                  <div
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: 9.5,
                      color: RAIL_INK_2,
                      letterSpacing: '0.03em',
                    }}
                  >
                    {account.handle}
                  </div>
                </div>
                <WebIcon name="switch" size={16} color={RAIL_INK_2} />
              </>
            )}
          </button>
        </WebTip>

        {/* Switcher popover */}
        {switcherOpen && (
          <div
            ref={switcherPopoverRef}
            role="menu"
            aria-label="Switch account"
            style={{
              position: 'absolute',
              bottom: 56,
              left: expanded ? 0 : '100%',
              marginLeft: expanded ? 0 : 14,
              width: 270,
              background: t.card,
              borderRadius: 16,
              border: `1px solid ${t.line}`,
              boxShadow: '0 24px 60px -16px rgba(0,0,0,0.45)',
              padding: 8,
              zIndex: 80,
              color: t.ink,
            }}
          >
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: t.ink3,
                fontWeight: 500,
                padding: '6px 10px 8px',
              }}
            >
              Switch account
            </div>
            {accounts.map(a => {
              const pic =
                a.id === me.id
                  ? (picture ?? a.picture ?? null)
                  : (orgPictures || {})[a.id] || a.picture || null;
              const isActive = a.id === activeAccount;
              return (
                <button
                  key={a.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setActiveAccount(a.id);
                    setSwitcherOpen(false);
                    nav('profile');
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: 'none',
                    cursor: 'pointer',
                    background: isActive ? t.subtle : 'transparent',
                    textAlign: 'left',
                    color: t.ink,
                  }}
                >
                  <WebAvatar person={{ ...a, picture: pic }} size={36} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.1 }}>
                      {a.name}
                    </div>
                    <div
                      style={{
                        fontFamily: FONT.mono,
                        fontSize: 10,
                        color: t.ink3,
                      }}
                    >
                      {a.handle} · {a.type === 'org' ? 'Organization' : 'Personal'}
                    </div>
                  </div>
                  {isActive && <WebIcon name="check" size={16} color={t.primary} />}
                </button>
              );
            })}
            <div style={{ height: 1, background: t.line, margin: '6px 8px' }} />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setSwitcherOpen(false);
                nav('profile');
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 12,
                border: 'none',
                cursor: 'pointer',
                background: 'transparent',
                color: t.ink2,
                fontFamily: FONT.mono,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              <WebIcon name="profile" size={16} /> View my profile
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

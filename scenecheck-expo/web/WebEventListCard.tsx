// WebEventListCard — desktop rich card used in the Home right-pane
// list and the Discover/Search results. Port of `WEventListCard` from
// `web/web-screens-a.jsx`.
//
// Visual contract:
//   • Kind chip (yours / friend / recommended / other) at the top with
//     a coloured dot + uppercase label, accent matches the map pin.
//   • JOINED chip on the top-right when the user is subscribed.
//   • Bold display-font title, host row (WebAvatar + name).
//   • Time + place rows (mono font, low-emphasis).
//   • Capacity bar (WebCapBar) so the user can see "filling up" at a
//     glance.
//   • Tag row + JOIN button at the bottom; clicking JOIN doesn't open
//     the event (stopPropagation), opening the card itself does.
//
// `active` flips the border to the kind accent and lifts the card 1px
// to signal "this row matches the hovered map pin". `onHover(id|null)`
// drives the sync the other direction — hovering the card highlights
// the pin.

import type { CSSProperties, MouseEvent } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';
import { whenRange } from '@/lib/date-time';
import { useStore } from '@/store/useStore';
import { wHostAccount, wKindMeta } from './kind';
import { WebAvatar } from './WebAvatar';
import { WebCapBar } from './WebCapBar';
import { WebIcon } from './WebIcon';
import { WebTag } from './WebTag';

interface Props {
  event: SCEvent;
  joined: boolean;
  active?: boolean;
  onOpen: (id: string) => void;
  onJoin: (id: string) => void;
  onHover?: (id: string | null) => void;
  style?: CSSProperties;
}

export function WebEventListCard({
  event,
  joined,
  active = false,
  onOpen,
  onJoin,
  onHover,
  style,
}: Props) {
  const t = useTokens();
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const { accent, label } = wKindMeta(event, t, subscribedInterests);
  // No screen-level host lookup is plumbed through here yet; cards
  // fall back to the denormalized `event.host` string below when the
  // lookup is empty. A future change can pass a batched profile map.
  const host = wHostAccount(event, {});

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(event.id);
        }
      }}
      onMouseEnter={() => onHover?.(event.id)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        background: t.card,
        borderRadius: 16,
        cursor: 'pointer',
        border: `1px solid ${active ? accent : t.line}`,
        boxShadow: active
          ? '0 14px 30px -16px rgba(0,0,0,0.4)'
          : '0 1px 0 rgba(0,0,0,0.01)',
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        transition: 'border-color 140ms ease, box-shadow 160ms ease, transform 140ms ease',
        transform: active ? 'translateY(-1px)' : 'none',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 9.5,
            letterSpacing: '0.15em',
            fontWeight: 600,
            color: accent,
          }}
        >
          {label}
        </span>
        {joined && (
          <span
            style={{
              marginLeft: 'auto',
              background: t.good,
              color: 'white',
              fontFamily: FONT.mono,
              fontSize: 9,
              letterSpacing: '0.12em',
              fontWeight: 600,
              padding: '3px 7px',
              borderRadius: 999,
            }}
          >
            JOINED
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 17,
          fontWeight: 700,
          lineHeight: 1.14,
          letterSpacing: '-0.02em',
          color: t.ink,
        }}
      >
        {event.title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {host && <WebAvatar person={host} size={22} />}
        <span style={{ fontSize: 12, color: t.ink2, fontWeight: 600 }}>
          {host ? host.name : event.host}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            fontFamily: FONT.mono,
            fontSize: 11.5,
            color: t.ink2,
          }}
        >
          <WebIcon name="clock" size={13} color={t.ink3} /> {whenRange(event)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: t.ink3 }}>
          <WebIcon name="pin" size={13} color={t.ink3} /> {event.where}
        </div>
      </div>
      <WebCapBar attendees={event.attendees} cap={event.cap} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingTop: 10,
          borderTop: `1px solid ${t.line}`,
        }}
      >
        {(event.interests || []).slice(0, 2).map(tag => (
          <WebTag key={tag} tag={tag} size="sm" tone="soft" />
        ))}
        <button
          onClick={(e: MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation();
            onJoin(event.id);
          }}
          style={{
            marginLeft: 'auto',
            height: 34,
            padding: '0 14px',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: joined ? t.ink : t.good,
            color: joined ? t.card : 'white',
            fontFamily: FONT.mono,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.1em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {joined ? (
            <>
              <WebIcon name="check" size={13} /> JOINED
            </>
          ) : event.kind === 'yours' ? (
            'MANAGE'
          ) : (
            'JOIN'
          )}
        </button>
      </div>
    </div>
  );
}

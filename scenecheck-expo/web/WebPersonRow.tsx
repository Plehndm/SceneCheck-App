// WebPersonRow — compact person card used in the desktop Friends grid,
// the People-you-may-know suggestions, and the attendees overlay. Wraps
// the avatar + name + handle in a clickable surface (routes to
// /profile/{id}) and tucks a WebFriendButton + optional Message link
// on the trailing edge. Click bubbling: the button stops propagation
// internally so tapping it doesn't also open the profile.

import type { CSSProperties } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import type { Account } from '@/types/domain';
import { WebAvatar } from './WebAvatar';
import { WebFriendButton } from './WebFriendButton';
import { WebButton } from './WebButton';

interface Props {
  person: Account;
  /** Trailing subtitle string. Defaults to "@username · {mutual} mutual". */
  subtitle?: string;
  /** When true, render a small Message ghost button next to the friend pill. */
  message?: boolean;
  /** Show the friend button (default true). */
  friend?: boolean;
  style?: CSSProperties;
}

export function WebPersonRow({
  person,
  subtitle,
  message = false,
  friend = true,
  style,
}: Props) {
  const t = useTokens();
  const handle = person.username
    ? `@${person.username}`
    : person.handle ?? '';
  const sub = subtitle
    ?? `${handle}${person.mutual != null ? ` · ${person.mutual} mutual` : ''}`;
  return (
    <div
      onClick={() => router.push(`/profile/${person.id}` as never)}
      style={{
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 14,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        ...style,
      }}
    >
      <WebAvatar person={person} size={48} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 15.5,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: t.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {person.name}
        </div>
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10.5,
            color: t.ink3,
            marginTop: 3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sub}
        </div>
      </div>
      {message && (
        <WebButton
          tone="ghost"
          size="sm"
          icon="chat"
          onClick={(e) => {
            e.stopPropagation();
            // Open (or create) a DM. We route into the new-chat helper
            // route — the chat-thread create-on-send path lives there.
            router.push(`/new-chat?to=${person.id}` as never);
          }}
        >
          Message
        </WebButton>
      )}
      {friend && <WebFriendButton personId={person.id} size="sm" />}
    </div>
  );
}

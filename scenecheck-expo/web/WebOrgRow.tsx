// WebOrgRow — compact org card used in the desktop Following grid and
// other org-list surfaces. Mirrors WebPersonRow but swaps the friend
// pill for a WebFollowButton and renders a multi-line bio underneath
// the row when one is present.

import type { CSSProperties } from 'react';
import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import type { Account } from '@/types/domain';
import { WebAvatar } from './WebAvatar';
import { WebFollowButton } from './WebFollowButton';

interface Props {
  org: Account;
  /** When true, render the bio paragraph under the row. */
  showBio?: boolean;
  style?: CSSProperties;
}

export function WebOrgRow({ org, showBio = true, style }: Props) {
  const t = useTokens();
  return (
    <div
      onClick={() => router.push(`/profile/${org.id}` as never)}
      style={{
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 16,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WebAvatar person={org} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: t.ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {org.name}
          </div>
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10.5,
              color: t.ink3,
              marginTop: 3,
            }}
          >
            {org.handle ?? (org.username ? `@${org.username}` : '')}
            {org.followers != null ? ` · ${org.followers} followers` : ''}
          </div>
        </div>
      </div>
      {showBio && org.bio && (
        <p
          style={{
            margin: 0,
            fontSize: 12.5,
            color: t.ink2,
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {org.bio}
        </p>
      )}
      <div style={{ alignSelf: 'flex-start' }} onClick={(e) => e.stopPropagation()}>
        <WebFollowButton orgId={org.id} size="sm" />
      </div>
    </div>
  );
}

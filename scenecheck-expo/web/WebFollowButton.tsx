// WebFollowButton — org-follow status pill. Reads the live following
// set from `useStore` and dispatches `toggleFollow` on click.
//
// NOTE: the store only models "following" (an idempotent join row);
// the design also has a "pending follow-request" state for private
// orgs, but that's not wired into the cross-platform store yet — we
// surface it as an "info" toast and a primary "Request to follow"
// label, then immediately follow. When the friends/follow approval
// flow lands in the store, switch the `request-to-follow` branch to a
// pending-set mutator.
//
// Privacy is resolved through `useProfile(orgId)` so live UUIDs hit
// `profiles.visibility` rather than falling through the mock
// `SC_ACCOUNT_BY_ID` fixture (which always missed live mode). The
// API commit (`api.followOrg` / `api.unfollowOrg`) happens here at
// the click site rather than inside `useStore.toggleFollow` so the
// store stays dumb and shared with native — mirrors the friend-
// request optimistic-commit pattern in `requests.web.tsx`.

import type { CSSProperties, MouseEvent } from 'react';
import { useStore } from '@/store/useStore';
import { useProfile } from '@/hooks/useProfile';
import { api } from '@/lib/api';
import { WebButton, type WebButtonSize } from './WebButton';

interface Props {
  orgId: string;
  size?: WebButtonSize;
  full?: boolean;
  style?: CSSProperties;
}

export function WebFollowButton({ orgId, size = 'md', full = false, style }: Props) {
  const following = useStore(s => s.following);
  const toggle = useStore(s => s.toggleFollow);
  const showToast = useStore(s => s.showToast);

  const { profile: o } = useProfile(orgId);
  const status = following.has(orgId) ? 'following' : 'none';
  const cfg =
    status === 'following'
      ? { label: 'Following', tone: 'soft' as const, icon: 'check' }
      : {
          label: o?.privacy === 'private' ? 'Request to follow' : 'Follow',
          tone: 'primary' as const,
          icon: 'plus',
        };

  const onClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const wasFollowing = status === 'following';
    toggle(orgId); // optimistic
    try {
      if (wasFollowing) await api.unfollowOrg(orgId);
      else await api.followOrg(orgId);
    } catch {
      toggle(orgId); // rollback
      showToast({ message: 'Failed to update follow.', kind: 'error' });
      return;
    }
    if (wasFollowing) {
      showToast({ message: `Unfollowed ${o?.name || ''}`.trim(), kind: 'info' });
    } else if (o?.privacy === 'private') {
      showToast({
        message: `Requested to follow ${o?.name || ''}`.trim(),
        kind: 'success',
      });
    } else {
      showToast({ message: `Following ${o?.name || ''}`.trim(), kind: 'success' });
    }
  };

  return (
    <WebButton
      tone={cfg.tone}
      size={size}
      icon={cfg.icon}
      onClick={onClick}
      style={full ? { flex: 1, ...style } : style}
    >
      {cfg.label}
    </WebButton>
  );
}

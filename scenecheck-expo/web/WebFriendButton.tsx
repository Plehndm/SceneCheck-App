// WebFriendButton — friendship status pill. Reads the live social
// graph from `useStore` (friends + outgoingRequests) and dispatches
// the right mutator on click.
//
// Three visible states:
//   • Friends    → soft pill with user-check icon (toggles to remove)
//   • Requested  → ghost pill with clock icon (toggles to cancel)
//   • Add/Request → primary pill with user-plus icon. Label flips to
//                   "Request" when the target profile is private,
//                   because the action goes through approval rather
//                   than instantly creating the friendship.
//
// Privacy is resolved through `useProfile(personId)` so live UUIDs
// hit `profiles.visibility` instead of falling through the mock
// `SC_ACCOUNT_BY_ID` fixture (which always missed in live mode and
// silently bypassed FR8.2's private-account approval flow). The hook
// already short-circuits to the fixture under `api.isMock()`, so mock
// behaviour is preserved transparently.

import type { CSSProperties, MouseEvent } from 'react';
import { useStore } from '@/store/useStore';
import { useProfile } from '@/hooks/useProfile';
import { WebButton, type WebButtonSize } from './WebButton';

interface Props {
  personId: string;
  size?: WebButtonSize;
  full?: boolean;
  style?: CSSProperties;
}

export function WebFriendButton({ personId, size = 'md', full = false, style }: Props) {
  const friends = useStore(s => s.friends);
  const outgoing = useStore(s => s.outgoingRequests);
  const addFriend = useStore(s => s.addFriend);
  const removeFriend = useStore(s => s.removeFriend);
  const sendReq = useStore(s => s.sendFriendRequest);
  const cancelReq = useStore(s => s.cancelOutgoingRequest);
  const showToast = useStore(s => s.showToast);

  const { profile } = useProfile(personId);
  const privacy = profile?.privacy ?? 'public';
  const status = friends.has(personId)
    ? 'friend'
    : outgoing.has(personId)
      ? 'pending'
      : 'none';
  const cfg =
    status === 'friend'
      ? { label: 'Friends', tone: 'soft' as const, icon: 'user-check' }
      : status === 'pending'
        ? { label: 'Requested', tone: 'ghost' as const, icon: 'clock' }
        : {
            label: privacy === 'private' ? 'Request' : 'Add friend',
            tone: 'primary' as const,
            icon: 'user-plus',
          };

  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (status === 'friend') {
      removeFriend(personId);
      showToast({ message: `Removed ${profile?.name || 'friend'}`, kind: 'info' });
    } else if (status === 'pending') {
      cancelReq(personId);
      showToast({ message: 'Request canceled', kind: 'info' });
    } else if (privacy === 'private') {
      sendReq(personId);
      showToast({ message: `Request sent to ${profile?.name || 'them'}`, kind: 'success' });
    } else {
      addFriend(personId);
      showToast({
        message: `You're now friends with ${profile?.name || 'them'}`,
        kind: 'success',
      });
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

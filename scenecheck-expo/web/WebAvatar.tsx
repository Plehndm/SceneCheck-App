// WebAvatar — port of `WAvatar` from `web/web-shared.jsx`. Renders
// either a real picture (`person.picture`) or a gradient with the
// first two initials. Org avatars render as a dark square (`type ===
// 'org'`); personal avatars render as a circle. The `ring` prop puts
// the live ring (used to mark the active account in the rail) around
// the avatar; `square` forces a rounded-rect even on personal
// accounts.

import type { CSSProperties } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import type { Account } from '@/types/domain';

type AvatarPerson = Partial<
  Pick<Account, 'name' | 'picture' | 'type' | 'color1' | 'color2'>
>;

interface Props {
  person?: AvatarPerson | null;
  size?: number;
  ring?: boolean;
  square?: boolean;
  style?: CSSProperties;
}

export function WebAvatar({
  person,
  size = 44,
  ring = false,
  square = false,
  style,
}: Props) {
  const t = useTokens();
  const c1 = person?.color1 || '#FFB199';
  const c2 = person?.color2 || '#FF5B47';
  const initials = (person?.name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('');
  const isOrg = person?.type === 'org';
  const hasPic = !!person?.picture;
  const radius = square
    ? Math.max(8, size * 0.24)
    : isOrg
      ? Math.max(8, size * 0.28)
      : size / 2;
  const bgColor = hasPic ? 'transparent' : isOrg ? t.ink : c2;
  const bgImage = hasPic
    ? `url(${person!.picture})`
    : isOrg
      ? 'none'
      : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bgColor,
        backgroundImage: bgImage,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isOrg ? t.surface : 'white',
        fontFamily: FONT.display,
        fontWeight: isOrg ? 800 : 700,
        fontStretch: isOrg ? '70%' : '100%',
        fontSize: size * (isOrg ? 0.34 : 0.36),
        letterSpacing: '-0.02em',
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: ring ? `0 0 0 3px ${t.card}, 0 0 0 5px ${t.primary}` : 'none',
        ...style,
      }}
    >
      {!hasPic && initials}
    </div>
  );
}

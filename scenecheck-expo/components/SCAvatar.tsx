// Avatar — gradient circle for people, dark rounded-square for orgs, or a
// photo when present. The legacy version used a CSS linear-gradient
// background; on RN we use a solid color (color2). expo-linear-gradient
// can be wired in later if the gradient feel matters for the demo.

import { View, Image, type StyleProp, type ViewStyle } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import type { Account } from '@/types/domain';

interface Props {
  person?: Pick<Account, 'name' | 'color1' | 'color2' | 'type' | 'picture'> | null;
  size?: number;
  ring?: boolean;
  square?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SCAvatar({ person, size = 44, ring = false, square = false, style }: Props) {
  const t = useTokens();
  const isOrg = person?.type === 'org';
  const c2 = person?.color2 ?? '#FF5B47';
  const initials = (person?.name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('');
  const hasPic = !!person?.picture;

  const radius = isOrg && !square
    ? Math.max(8, size * 0.28)
    : square ? Math.max(8, size * 0.22) : size / 2;

  const containerStyle: ViewStyle = {
    width: size, height: size, borderRadius: radius,
    backgroundColor: hasPic ? 'transparent' : isOrg ? t.ink : c2,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    ...(ring ? { borderWidth: 3, borderColor: t.primary } : {}),
  };

  return (
    <View style={[containerStyle, style]}>
      {hasPic ? (
        <Image source={{ uri: person!.picture as string }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <SCText
          variant="display"
          color={isOrg ? t.surface : 'white'}
          weight={isOrg ? '800' : '700'}
          size={size * (isOrg ? 0.34 : 0.36)}
        >
          {initials}
        </SCText>
      )}
    </View>
  );
}

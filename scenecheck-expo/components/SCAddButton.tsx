// Join/leave toggle button. The "joined" state inverts the color (dark)
// and shows a check + JOINED label; the unjoined state is a green CTA.

import { Pressable, View } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { RADIUS } from '@/theme/tokens';

export type ButtonSize = 'sm' | 'md' | 'lg';

const SIZES: Record<ButtonSize, { h: number; fs: number; r: number }> = {
  sm: { h: 36, fs: 12, r: 10 },
  md: { h: 44, fs: 13, r: 12 },
  lg: { h: 56, fs: 15, r: 16 },
};

interface Props {
  joined: boolean;
  onPress: () => void;
  label?: string;
  size?: ButtonSize;
}

export function SCAddButton({ joined, onPress, label = 'ADD', size = 'lg' }: Props) {
  const t = useTokens();
  const s = SIZES[size];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        width: '100%', height: s.h, borderRadius: s.r,
        backgroundColor: joined ? t.ink : t.good,
        alignItems: 'center', justifyContent: 'center',
      }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {joined && <SCIcon name="check" size={16} color={t.card} />}
        <SCText variant="mono" size={s.fs} color={joined ? t.card : 'white'} weight="600">
          {joined ? 'JOINED' : label}
        </SCText>
      </View>
    </Pressable>
  );
}

// Convenience: a generic primary button using the same press affordance.
interface PrimaryProps {
  label: string;
  onPress: () => void;
  size?: ButtonSize;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function SCButton({ label, onPress, size = 'md', disabled, variant = 'primary' }: PrimaryProps) {
  const t = useTokens();
  const s = SIZES[size];
  const palette = {
    primary: { bg: t.primary, fg: t.primaryInk },
    secondary: { bg: t.ink, fg: t.card },
    ghost: { bg: 'transparent', fg: t.ink },
  }[variant];
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [{
        height: s.h, paddingHorizontal: s.h * 0.5, borderRadius: RADIUS.lg,
        backgroundColor: palette.bg,
        alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      <SCText variant="mono" size={s.fs} color={palette.fg} weight="600">
        {label.toUpperCase()}
      </SCText>
    </Pressable>
  );
}

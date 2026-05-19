// Hashtag chip. Pill shape with a faded `#` prefix.

import { Pressable, View, type ViewStyle } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { RADIUS } from '@/theme/tokens';

export type TagSize = 'sm' | 'md' | 'lg';
export type TagTone = 'soft' | 'primary' | 'ghost' | 'outline';

const SIZES: Record<TagSize, { fs: number; py: number; px: number }> = {
  sm: { fs: 12, py: 4, px: 9 },
  md: { fs: 14, py: 6, px: 11 },
  lg: { fs: 18, py: 9, px: 14 },
};

interface Props {
  tag: string;
  size?: TagSize;
  tone?: TagTone;
  onPress?: () => void;
}

export function SCTag({ tag, size = 'md', tone = 'soft', onPress }: Props) {
  const t = useTokens();
  const s = SIZES[size];
  const tones: Record<TagTone, { bg: string; fg: string; border?: string }> = {
    soft: { bg: t.subtle, fg: t.ink },
    primary: { bg: t.primary, fg: t.primaryInk },
    ghost: { bg: 'transparent', fg: t.ink2 },
    outline: { bg: 'transparent', fg: t.ink, border: t.line },
  };
  const tn = tones[tone];
  const containerStyle: ViewStyle = {
    flexDirection: 'row', alignItems: 'baseline',
    paddingVertical: s.py, paddingHorizontal: s.px,
    backgroundColor: tn.bg,
    borderRadius: RADIUS.pill,
    ...(tn.border ? { borderWidth: 1, borderColor: tn.border } : {}),
  };
  const inner = (
    <>
      <SCText variant="mono" size={s.fs} color={tn.fg} style={{ opacity: 0.55 }}>#</SCText>
      <SCText variant="mono" size={s.fs} color={tn.fg}>{tag}</SCText>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [containerStyle, pressed && { opacity: 0.85 }]}>
        {inner}
      </Pressable>
    );
  }
  return <View style={containerStyle}>{inner}</View>;
}

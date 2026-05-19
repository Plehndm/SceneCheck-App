// Card surface. The web prototype's SCCard was a div with border + radius
// that became a button when onPress was provided. RN splits press behavior
// out into Pressable, so we conditionally wrap.

import { Pressable, View, type ViewStyle, type StyleProp } from 'react-native';
import { type ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

interface Props {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export function SCCard({ children, style, onPress }: Props) {
  const t = useTokens();
  const base: ViewStyle = {
    backgroundColor: t.card,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

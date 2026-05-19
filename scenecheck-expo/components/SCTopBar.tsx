// Top bar with back button + title + optional right slot. Used inside
// stack screens. The tab screens use the native tab-bar header instead
// (configured in app/(tabs)/_layout.tsx).

import { View, Pressable, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { RADIUS } from '@/theme/tokens';

interface Props {
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  style?: ViewStyle;
}

export function SCTopBar({ onBack, title, subtitle, right, style }: Props) {
  const t = useTokens();
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 10,
      paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12,
    }, style]}>
      {onBack && (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [{
            width: 38, height: 38, borderRadius: RADIUS.md,
            borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
            alignItems: 'center', justifyContent: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCIcon name="back" size={18} color={t.ink} />
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle && <SCText variant="labelCap">{subtitle}</SCText>}
        {title && <SCText variant="display" size={18}>{title}</SCText>}
      </View>
      {right}
    </View>
  );
}

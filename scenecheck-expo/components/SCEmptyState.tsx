// "Nothing came back" placeholder. Shown after a fetch completes with no
// results (gate it on `!loading` so it never flashes during the skeleton).
// Keeps the empty-state look consistent across screens; pass an optional
// `action` (e.g. a button) for a call-to-action.

import { View, type ViewStyle } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCCard } from './SCCard';
import { SCText } from './SCText';
import { SCIcon, type IconName } from './SCIcon';
import { RADIUS } from '@/theme/tokens';
import type { ReactNode } from 'react';

interface Props {
  icon?: IconName;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  style?: ViewStyle;
}

export function SCEmptyState({ icon = 'search', title, subtitle, action, style }: Props) {
  const t = useTokens();
  return (
    <SCCard style={[{ padding: 24, alignItems: 'center', gap: 6 }, style]}>
      <View style={{
        width: 56, height: 56, borderRadius: RADIUS.xl,
        backgroundColor: t.subtle, alignItems: 'center', justifyContent: 'center',
        marginBottom: 6,
      }}>
        <SCIcon name={icon} size={24} color={t.ink3} />
      </View>
      <SCText variant="displayTight" size={20} style={{ textAlign: 'center' }}>{title}</SCText>
      {!!subtitle && (
        <SCText size={13} color={t.ink3} style={{ textAlign: 'center', lineHeight: 19, maxWidth: 280 }}>
          {subtitle}
        </SCText>
      )}
      {!!action && <View style={{ marginTop: 10 }}>{action}</View>}
    </SCCard>
  );
}

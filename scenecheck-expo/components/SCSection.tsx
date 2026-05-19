// Labelled section. Used as a wrapper around grouped content on most
// screens. Matches the visual cadence of the legacy <SCSection> with the
// uppercase mono label cap.

import { View, type ViewStyle, type StyleProp } from 'react-native';
import { type ReactNode } from 'react';
import { SCText } from './SCText';
import { SPACING } from '@/theme/tokens';

interface Props {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

export function SCSection({ title, action, children, padding = SPACING.lg, style }: Props) {
  return (
    <View style={[{ paddingHorizontal: padding }, style]}>
      <View style={{
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
        paddingTop: SPACING.lg, paddingBottom: SPACING.sm, paddingHorizontal: 2,
      }}>
        <SCText variant="labelCap">{title}</SCText>
        {action}
      </View>
      {children}
    </View>
  );
}

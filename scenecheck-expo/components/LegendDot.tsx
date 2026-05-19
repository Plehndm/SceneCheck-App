// Small "color · label" legend pair, used under the map preview.

import { View } from 'react-native';
import { SCText } from './SCText';

interface Props {
  color: string;
  label: string;
}

export function LegendDot({ color, label }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <SCText variant="mono" size={11}>{label}</SCText>
    </View>
  );
}

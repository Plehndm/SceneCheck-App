// Typography variants. The legacy CSS classes `.display`, `.display-tight`,
// `.mono`, and `.label-cap` mapped fonts + sizes via custom properties; on
// RN we just use a typed variant prop and pull color from the theme.

import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';

export type Variant = 'display' | 'displayTight' | 'body' | 'mono' | 'labelCap';

interface Props extends TextProps {
  variant?: Variant;
  size?: number;
  color?: string;
  weight?: TextStyle['fontWeight'];
  style?: TextStyle | TextStyle[];
}

const VARIANT_STYLES: Record<Variant, TextStyle> = {
  display: { fontFamily: FONT.display, fontWeight: '700', letterSpacing: -0.4 },
  displayTight: { fontFamily: FONT.display, fontWeight: '800', letterSpacing: -0.8 },
  body: { fontFamily: FONT.body, fontWeight: '400' },
  mono: { fontFamily: FONT.mono, fontWeight: '500', letterSpacing: 0.3 },
  labelCap: { fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500' },
};

export function SCText({ variant = 'body', size, color, weight, style, ...rest }: Props) {
  const t = useTokens();
  const variantStyle = VARIANT_STYLES[variant];
  const flat: TextStyle = {
    ...variantStyle,
    color: color ?? (variant === 'labelCap' ? t.ink3 : t.ink),
    ...(size != null ? { fontSize: size } : {}),
    ...(weight != null ? { fontWeight: weight } : {}),
  };
  return <Text {...rest} style={[flat, style]} />;
}

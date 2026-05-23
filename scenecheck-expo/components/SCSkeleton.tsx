// Loading placeholders. A page that's still fetching shows a skeleton in the
// same shape as its eventual content (instead of an empty flash or a spinner),
// then swaps to the real rows — or to an empty state if nothing came back.
//
//   {loading ? <SCListSkeleton rows={4} /> : list.length ? list.map(...) : <empty/>}
//
// The base `SCSkeleton` is a single pulsing block; `SCListSkeleton` and
// `SCRailSkeleton` compose it into the vertical-list and horizontal-rail
// layouts the browse screens use.

import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCCard } from './SCCard';
import { RADIUS } from '@/theme/tokens';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SCSkeleton({ width = '100%', height = 14, radius = RADIUS.sm, style }: SkeletonProps) {
  const t = useTokens();
  // A gentle opacity pulse so the placeholder reads as "loading", not as a
  // static empty box. Opacity is native-driver-safe on RN + RN-web.
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[{ width, height, borderRadius: radius, backgroundColor: t.subtle, opacity: pulse }, style]}
    />
  );
}

// One list row: a square icon/avatar placeholder + two text lines, matching the
// card rows on the events / search / joined-events screens.
function RowSkeleton() {
  return (
    <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
      <SCSkeleton width={40} height={40} radius={RADIUS.md} />
      <View style={{ flex: 1, gap: 8 }}>
        <SCSkeleton width="70%" height={14} />
        <SCSkeleton width="45%" height={11} />
      </View>
    </SCCard>
  );
}

export function SCListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ paddingHorizontal: 14, gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => <RowSkeleton key={i} />)}
    </View>
  );
}

// Horizontal rail of event-card-shaped placeholders (Home "Happening near you").
export function SCRailSkeleton({ cards = 3 }: { cards?: number }) {
  const t = useTokens();
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingBottom: 4 }}>
      {Array.from({ length: cards }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 232, minHeight: 168, padding: 14, gap: 12,
            backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: RADIUS.xl,
          }}
        >
          <SCSkeleton width="40%" height={10} />
          <SCSkeleton width="85%" height={18} />
          <SCSkeleton width="60%" height={12} />
          <View style={{ marginTop: 'auto', gap: 8 }}>
            <SCSkeleton width="50%" height={11} />
            <SCSkeleton width="70%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

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

// Alternating chat-bubble placeholders for a thread still loading its initial
// history (native chat detail). Each row is full-width so the percentage bubble
// width reads relative to the thread, left/right-aligned like real messages.
export function SCMessageSkeleton({ bubbles = 6 }: { bubbles?: number }) {
  // (width, mine, tall) per bubble so the stack reads as a conversation.
  const shapes: Array<[DimensionValue, boolean, number]> = [
    ['58%', false, 32],
    ['40%', true, 32],
    ['68%', false, 48],
    ['34%', true, 32],
    ['50%', false, 32],
    ['44%', true, 48],
  ];
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 8, gap: 12 }}>
      {Array.from({ length: bubbles }).map((_, i) => {
        const [w, mine, h] = shapes[i % shapes.length];
        return (
          <View key={i} style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
            <SCSkeleton width={w} height={h} radius={RADIUS.lg} />
          </View>
        );
      })}
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

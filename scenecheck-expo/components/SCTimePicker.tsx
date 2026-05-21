// Three-column clock-app time picker, ported from the legacy
// `SCWheel` + `SCTimePicker` in `legacy/src/screens.jsx`. Each column
// is a snap-scrolling list (hours 1–12, minutes 0–55 in 5-min steps,
// AM/PM) styled to feel like the iOS clock app: the centered row is
// the active value, neighbors are scaled and dimmed.
//
// `value` / `onChange` use the same friendly time string the rest of
// the app expects (e.g. `7:00 AM`) so this is a drop-in replacement
// for the previous TextInput.

import { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';
import { parseTime, fmtTime, type TimeParts } from '@/lib/date-time';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

const ROW = 36;
const VISIBLE_ROWS = 5;
const WHEEL_HEIGHT = ROW * VISIBLE_ROWS;
const PAD = (WHEEL_HEIGHT - ROW) / 2;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const AMPM = ['AM', 'PM'] as const;

export function SCTimePicker({ value, onChange }: Props) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const parts = parseTime(value);

  const setPart = <K extends keyof TimeParts>(k: K, v: TimeParts[K]) => {
    onChange(fmtTime({ ...parts, [k]: v }));
  };

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [{
          height: 44, flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, borderRadius: RADIUS.md,
          backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
        }, pressed && { opacity: 0.9 }]}
      >
        <SCIcon name="clock" size={16} color={t.ink3} />
        <SCText size={14} style={{ flex: 1 }}>{fmtTime(parts)}</SCText>
        <SCIcon name="chevron-right" size={14} color={t.ink3} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
            justifyContent: 'center', alignItems: 'center',
            paddingHorizontal: 18,
          }}
        >
          <Pressable
            onPress={() => { /* swallow */ }}
            style={{
              width: '100%', maxWidth: 320,
              backgroundColor: t.card, borderRadius: 18,
              padding: 14,
              shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 40,
              shadowOffset: { width: 0, height: 18 }, elevation: 12,
            }}
          >
            {/* Highlight band — sits behind the wheels so the active row
                always looks "framed" even mid-scroll. */}
            <View style={{ position: 'relative' }}>
              <View
                style={{
                  position: 'absolute', left: 0, right: 0,
                  top: PAD, height: ROW,
                  backgroundColor: t.subtle, borderRadius: 10,
                  pointerEvents: 'none',
                }}
              />
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'stretch' }}>
                <Wheel
                  items={HOURS}
                  value={parts.h}
                  onChange={(v) => setPart('h', v)}
                  format={(x) => String(x)}
                />
                <View style={{
                  alignSelf: 'center',
                  paddingHorizontal: 2,
                }}>
                  <SCText variant="mono" size={18} weight="800" color={t.ink3}>:</SCText>
                </View>
                <Wheel
                  items={MINUTES}
                  value={parts.m}
                  onChange={(v) => setPart('m', v)}
                  format={(x) => String(x).padStart(2, '0')}
                />
                <Wheel
                  items={AMPM as unknown as string[]}
                  value={parts.ap}
                  onChange={(v) => setPart('ap', v as 'AM' | 'PM')}
                  format={(x) => String(x)}
                />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

interface WheelProps<T extends string | number> {
  items: T[];
  value: T;
  onChange: (next: T) => void;
  format: (item: T) => string;
}

function Wheel<T extends string | number>({ items, value, onChange, format }: WheelProps<T>) {
  const t = useTokens();
  const scrollRef = useRef<ScrollView>(null);
  const externalIdx = Math.max(0, items.indexOf(value));
  const [localIdx, setLocalIdx] = useState(externalIdx);
  // True while a scroll we triggered ourselves is settling. An *animated*
  // programmatic scrollTo re-fires onMomentumScrollEnd, and reacting to
  // that re-snaps + re-emits onChange — the feedback loop that made the
  // AM/PM column oscillate forever (e.g. nudging 11 AM → 12 PM). We skip
  // exactly one settle per self-induced scroll to break it.
  const programmatic = useRef(false);

  // When the external value changes (e.g. wheel just mounted, or
  // another wheel's change reshaped the time), snap our scroll
  // position to match without animating (non-animated scrolls don't
  // fire momentum-end, so they can't feed the loop).
  useEffect(() => {
    setLocalIdx(externalIdx);
    scrollRef.current?.scrollTo({ y: externalIdx * ROW, animated: false });
  }, [externalIdx]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const visIdx = Math.round(y / ROW);
    const clamped = Math.max(0, Math.min(items.length - 1, visIdx));
    if (clamped !== localIdx) setLocalIdx(clamped);
  };

  const handleSettle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (programmatic.current) {
      programmatic.current = false;
      return;
    }
    const y = e.nativeEvent.contentOffset.y;
    const clamped = Math.max(0, Math.min(items.length - 1, Math.round(y / ROW)));
    const target = clamped * ROW;
    // Only re-snap if we're actually off the row; a redundant scrollTo to
    // the current position may not fire momentum-end, which would strand
    // the `programmatic` flag and swallow the user's next selection.
    if (Math.abs(y - target) > 0.5) {
      programmatic.current = true;
      scrollRef.current?.scrollTo({ y: target, animated: true });
    }
    const next = items[clamped];
    if (next !== value) onChange(next);
  };

  return (
    <View style={{ flex: 1, height: WHEEL_HEIGHT, overflow: 'hidden' }}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: PAD }}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleSettle}
        onScrollEndDrag={handleSettle}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => {
          const dist = Math.abs(i - localIdx);
          const scale = dist === 0 ? 1 : dist === 1 ? 0.92 : dist === 2 ? 0.84 : 0.78;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.3 : 0.18;
          return (
            <Pressable
              key={i}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: i * ROW, animated: true });
                onChange(item);
              }}
              style={{
                height: ROW, alignItems: 'center', justifyContent: 'center',
                opacity,
                transform: [{ scale }],
              }}
            >
              <SCText
                variant="mono"
                size={dist === 0 ? 19 : 17}
                weight={dist === 0 ? '700' : '500'}
                color={t.ink}
              >
                {format(item)}
              </SCText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

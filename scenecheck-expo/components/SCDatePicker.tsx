// Calendar popover, ported from the legacy `SCDatePicker` in
// `legacy/src/screens.jsx`. Renders a month-grid inside a Modal so the
// popout isn't clipped by the surrounding ScrollView. Out-of-range
// dates are greyed + line-through + disabled; today gets a primary-
// color outline; the selected date gets a filled ink background.
//
// `value` / `onChange` use a friendly date string format. Two modes:
//   - default (`withYear=false`): "Sat May 16" — drop-in replacement
//     for the create-event date field
//   - `withYear`: "May 16, 1995" — for inputs that span across years
//     (birthdate picker on sign-up)
//
// `minDate` / `maxDate` bound the selectable range. Defaults are
// tailored to the create-event use case: minDate=today (no past),
// maxDate=undefined (no upper bound). For birthdate, override both:
// pass an ancient minDate and the 18-years-ago maxDate.

import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';
import {
  MON_LONG, fmtDate, parseDate, fmtDateWithYear, parseDateWithYear,
} from '@/lib/date-time';

interface Props {
  value: string;
  onChange: (next: string) => void;
  minDate?: Date;
  maxDate?: Date;
  withYear?: boolean;
  placeholder?: string;
}

const DOW_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function SCDatePicker({
  value, onChange,
  minDate, maxDate,
  withYear = false,
  placeholder,
}: Props) {
  const t = useTokens();
  const [open, setOpen] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  // Default bounds: when not specified, the event-creation use case
  // wants "no past" + "no upper bound". The birthdate picker passes
  // both explicitly to override that.
  const minBound = useMemo(() => minDate ? startOfDay(minDate) : today, [minDate, today]);
  const maxBound = useMemo(() => maxDate ? startOfDay(maxDate) : null, [maxDate]);

  // Parse the value with the right parser. If parsing fails or the
  // value is empty, fall back to a sensible anchor: the max bound
  // (for birthdate, this puts the calendar near the user's likely
  // birth year), or the min bound, or today.
  const parsed = useMemo<Date | null>(() => {
    if (!value) return null;
    if (withYear) return parseDateWithYear(value);
    return parseDate(value);
  }, [value, withYear]);

  const anchor = useMemo(
    () => parsed ?? maxBound ?? minBound,
    [parsed, maxBound, minBound],
  );

  const [view, setView] = useState<{ y: number; m: number }>({
    y: anchor.getFullYear(), m: anchor.getMonth(),
  });

  // Re-anchor the visible month each time the popover opens so
  // reopening always lands near the selected (or default) date.
  const handleOpen = () => {
    setView({ y: anchor.getFullYear(), m: anchor.getMonth() });
    setOpen(true);
  };

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const stepMonth = (dir: -1 | 1) => setView(v => {
    const nm = v.m + dir;
    if (nm < 0) return { y: v.y - 1, m: 11 };
    if (nm > 11) return { y: v.y + 1, m: 0 };
    return { y: v.y, m: nm };
  });

  // Prev disabled when the *first* of the visible month is already
  // at or before the minBound's month. Same idea for next + maxBound.
  const prevDisabled =
    view.y < minBound.getFullYear()
    || (view.y === minBound.getFullYear() && view.m <= minBound.getMonth());
  const nextDisabled = !!maxBound && (
    view.y > maxBound.getFullYear()
    || (view.y === maxBound.getFullYear() && view.m >= maxBound.getMonth())
  );

  const triggerLabel = parsed
    ? (withYear ? fmtDateWithYear(parsed) : fmtDate(parsed))
    : placeholder ?? (withYear ? fmtDateWithYear(today) : fmtDate(today));
  const triggerMuted = !parsed && !!placeholder;

  const formatValue = (d: Date) => withYear ? fmtDateWithYear(d) : fmtDate(d);

  return (
    <View>
      <Pressable
        onPress={handleOpen}
        style={({ pressed }) => [{
          height: 44, flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingHorizontal: 14, borderRadius: RADIUS.md,
          backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
        }, pressed && { opacity: 0.9 }]}
      >
        <SCIcon name="calendar" size={16} color={t.ink3} />
        <SCText size={14} style={{ flex: 1 }} color={triggerMuted ? t.ink3 : undefined}>
          {triggerLabel}
        </SCText>
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
            onPress={() => { /* swallow taps inside the card */ }}
            style={{
              width: '100%', maxWidth: 360,
              backgroundColor: t.card, borderRadius: 18,
              padding: 16,
              shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 40,
              shadowOffset: { width: 0, height: 18 }, elevation: 12,
            }}
          >
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 10,
            }}>
              <NavBtn
                disabled={prevDisabled}
                onPress={() => stepMonth(-1)}
                icon="back"
              />
              <SCText variant="display" size={15} weight="700">
                {MON_LONG[view.m]} {view.y}
              </SCText>
              <NavBtn
                disabled={nextDisabled}
                onPress={() => stepMonth(1)}
                icon="chevron-right"
              />
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {DOW_INITIALS.map((c, i) => (
                <View key={i} style={{ flex: 1, alignItems: 'center' }}>
                  <SCText variant="mono" size={10} color={t.ink3} weight="600">{c}</SCText>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, i) => {
                if (day === null) {
                  return <View key={i} style={{ width: `${100 / 7}%`, height: 38 }} />;
                }
                const date = new Date(view.y, view.m, day);
                const isSelected = !!parsed && date.toDateString() === parsed.toDateString();
                const isToday = date.toDateString() === today.toDateString();
                const isOutOfRange = date < minBound || (!!maxBound && date > maxBound);

                const bg = isSelected ? t.ink : 'transparent';
                const fg = isSelected ? 'white'
                  : isOutOfRange ? t.ink3
                  : isToday ? t.primary : t.ink;

                return (
                  <View key={i} style={{ width: `${100 / 7}%`, padding: 1.5 }}>
                    <Pressable
                      disabled={isOutOfRange}
                      onPress={() => {
                        if (isOutOfRange) return;
                        onChange(formatValue(date));
                        setOpen(false);
                      }}
                      style={({ pressed }) => [{
                        height: 35, borderRadius: 10,
                        backgroundColor: bg,
                        borderWidth: !isSelected && isToday ? 1.5 : 1,
                        borderColor: !isSelected && isToday ? t.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: isOutOfRange ? 0.35 : 1,
                      }, pressed && { opacity: 0.7 }]}
                    >
                      <SCText
                        variant="mono"
                        size={13}
                        weight={isSelected || isToday ? '700' : '500'}
                        color={fg}
                        style={isOutOfRange ? { textDecorationLine: 'line-through' } : undefined}
                      >
                        {day}
                      </SCText>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function NavBtn({
  onPress, icon, disabled = false,
}: { onPress: () => void; icon: 'back' | 'chevron-right'; disabled?: boolean }) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        width: 32, height: 32, borderRadius: 9,
        backgroundColor: t.subtle,
        alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
      }, pressed && !disabled && { opacity: 0.7 }]}
    >
      <SCIcon name={icon} size={14} color={t.ink} />
    </Pressable>
  );
}

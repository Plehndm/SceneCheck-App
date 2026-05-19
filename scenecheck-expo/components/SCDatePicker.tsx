// Calendar popover, ported from the legacy `SCDatePicker` in
// `legacy/src/screens.jsx`. Renders a month-grid inside a Modal so the
// popout isn't clipped by the surrounding ScrollView. Past dates are
// greyed + line-through + disabled; today gets a primary-color outline;
// the selected date gets a filled ink background.
//
// `value` / `onChange` use the same friendly date string format the rest
// of the app expects (e.g. `Sat May 16`) so this is a drop-in replacement
// for the previous TextInput. Internal math goes through Date objects to
// keep month/year arithmetic correct across boundaries.

import { useMemo, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';
import { MON_LONG, fmtDate, parseDate } from '@/lib/date-time';

interface Props {
  value: string;
  onChange: (next: string) => void;
}

const DOW_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function SCDatePicker({ value, onChange }: Props) {
  const t = useTokens();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseDate(value), [value]);
  const [view, setView] = useState<{ y: number; m: number }>({
    y: selected.getFullYear(), m: selected.getMonth(),
  });

  // Re-anchor the visible month to the selected date every time the
  // popover opens — so reopening always lands on the user's date.
  const handleOpen = () => {
    setView({ y: selected.getFullYear(), m: selected.getMonth() });
    setOpen(true);
  };

  const today = new Date(); today.setHours(0, 0, 0, 0);
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

  const atOrBeforeCurrent = view.y < today.getFullYear()
    || (view.y === today.getFullYear() && view.m <= today.getMonth());

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
        <SCText size={14} style={{ flex: 1 }}>{fmtDate(selected)}</SCText>
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
                disabled={atOrBeforeCurrent}
                onPress={() => stepMonth(-1)}
                icon="back"
              />
              <SCText variant="display" size={15} weight="700">
                {MON_LONG[view.m]} {view.y}
              </SCText>
              <NavBtn onPress={() => stepMonth(1)} icon="chevron-right" />
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
                const isSelected = date.toDateString() === selected.toDateString();
                const isToday = date.toDateString() === today.toDateString();
                const isPast = date < today;

                const bg = isSelected ? t.ink : 'transparent';
                const fg = isSelected ? 'white'
                  : isPast ? t.ink3
                  : isToday ? t.primary : t.ink;

                return (
                  <View key={i} style={{ width: `${100 / 7}%`, padding: 1.5 }}>
                    <Pressable
                      disabled={isPast}
                      onPress={() => {
                        if (isPast) return;
                        onChange(fmtDate(date));
                        setOpen(false);
                      }}
                      style={({ pressed }) => [{
                        height: 35, borderRadius: 10,
                        backgroundColor: bg,
                        borderWidth: !isSelected && isToday ? 1.5 : 1,
                        borderColor: !isSelected && isToday ? t.primary : 'transparent',
                        alignItems: 'center', justifyContent: 'center',
                        opacity: isPast ? 0.35 : 1,
                      }, pressed && { opacity: 0.7 }]}
                    >
                      <SCText
                        variant="mono"
                        size={13}
                        weight={isSelected || isToday ? '700' : '500'}
                        color={fg}
                        style={isPast ? { textDecorationLine: 'line-through' } : undefined}
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

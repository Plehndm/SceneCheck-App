// Settings → Linked calendar. Single-select between Google / Apple /
// Outlook or None. The architecture doc has "FR8.x Calendar API
// Connector" — once we wire OAuth this drives the actual sync.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';
import type { LinkedCalendar } from '@/store/useStore';

const OPTIONS: { k: NonNullable<LinkedCalendar>; label: string; desc: string }[] = [
  { k: 'google', label: 'Google Calendar', desc: 'Sync events to your Google account' },
  { k: 'apple', label: 'Apple Calendar', desc: 'Sync to iCloud across your devices' },
  { k: 'outlook', label: 'Outlook', desc: 'Microsoft 365 / Outlook.com' },
];

export default function LinkedCalendarScreen() {
  const t = useTokens();
  const value = useStore(s => s.linkedCalendar);
  const setValue = useStore(s => s.setLinkedCalendar);

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} />
      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>Linked calendar</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6, lineHeight: 19 }}>
          When you join or create an event, SceneCheck will mirror it to your linked calendar.
        </SCText>
      </View>

      <View style={{ paddingHorizontal: 14, gap: 8 }}>
        {OPTIONS.map(opt => {
          const selected = value === opt.k;
          return (
            <Pressable
              key={opt.k}
              onPress={() => setValue(opt.k)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <SCCard style={{
                padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
                borderWidth: selected ? 1.5 : 1,
                borderColor: selected ? t.primary : t.line,
              }}>
                <View style={{
                  width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCIcon name="calendar" size={16} color={selected ? t.primary : t.ink2} />
                </View>
                <View style={{ flex: 1 }}>
                  <SCText size={14} weight={selected ? '600' : '500'}>{opt.label}</SCText>
                  <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>{opt.desc}</SCText>
                </View>
                {selected && (
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: t.primary,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SCIcon name="check" size={12} color={t.primaryInk} />
                  </View>
                )}
              </SCCard>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setValue(null)}
          style={({ pressed }) => [{
            padding: 12, marginTop: 4,
            borderRadius: RADIUS.md, borderWidth: 1, borderColor: t.line,
            alignItems: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCText variant="mono" size={11} weight="600" color={t.ink2}>UNLINK CALENDAR</SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

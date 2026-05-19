// Tappable row for showing a person — used on Home (nearby people),
// in chat lists, attendee rosters, search results.

import { View, Pressable } from 'react-native';
import { type ReactNode } from 'react';
import { SCAvatar } from './SCAvatar';
import { SCText } from './SCText';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import type { Account } from '@/types/domain';

interface Props {
  person: Account;
  onPress?: () => void;
  right?: ReactNode;
}

export function SCPersonRow({ person, onPress, right }: Props) {
  const t = useTokens();
  const meInterests = useStore(s => s.me.interests ?? []);
  const shared = (person.interests ?? []).filter(tag => meInterests.includes(tag));
  const sharedText = shared.length
    ? `${shared.length} shared interest${shared.length > 1 ? 's' : ''}`
    : (person.interests ?? []).slice(0, 2).filter(Boolean).join(' · ');

  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
      <SCAvatar person={person} size={42} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <SCText variant="display" size={15}>{person.name}</SCText>
        <SCText variant="mono" size={11} color={t.ink3}>
          @{person.username} · {person.mutual ?? 0} mutual · {sharedText}
        </SCText>
      </View>
      {right}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.85 }]}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

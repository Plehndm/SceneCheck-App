// Start a new chat — pick one (DM) or more (group) people, then begin
// the conversation. Friends surface first in the list.

import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_VISIBLE_PEOPLE, SC_VISIBLE_PERSON_BY_ID } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';

export default function NewChatScreen() {
  const t = useTokens();
  const friends = useStore(s => s.friends);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const ordered = useMemo(() => {
    const fs: typeof SC_VISIBLE_PEOPLE = [];
    const rest: typeof SC_VISIBLE_PEOPLE = [];
    for (const p of SC_VISIBLE_PEOPLE) {
      (friends.has(p.id) ? fs : rest).push(p);
    }
    return [...fs, ...rest];
  }, [friends]);

  const visible = ordered.filter(p => {
    if (!query.trim()) return true;
    const s = query.trim().toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.username ?? '').toLowerCase().includes(s);
  });

  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const start = () => {
    if (picked.length === 0) return;
    if (picked.length === 1) {
      router.replace(`/chat/dm-${picked[0]}` as never);
    } else {
      router.replace(`/chat/group-${picked.join('-')}` as never);
    }
  };

  const ctaLabel = picked.length <= 1 ? 'START CHAT' : `START GROUP · ${picked.length}`;
  const subtitle =
    picked.length === 0 ? 'PICK ONE OR MORE PEOPLE' :
    picked.length === 1 ? 'DIRECT MESSAGE' :
    `GROUP CHAT · ${picked.length} SELECTED`;

  return (
    <Screen scroll={false}>
      <SCTopBar onBack={() => router.back()} title="New chat" subtitle={subtitle} />

      {picked.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {picked.map(id => {
            const p = SC_VISIBLE_PERSON_BY_ID[id];
            if (!p) return null;
            return (
              <Pressable
                key={id}
                onPress={() => toggle(id)}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  paddingLeft: 4, paddingRight: 10, paddingVertical: 4,
                  backgroundColor: t.subtle,
                  borderRadius: 999, borderWidth: 1, borderColor: t.line,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCAvatar person={p} size={24} />
                <SCText size={13} weight="600">{p.name.split(' ')[0]}</SCText>
                <SCIcon name="x" size={12} color={t.ink3} />
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
          backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
          borderRadius: RADIUS.md, height: 44,
        }}>
          <SCIcon name="search" size={14} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search people…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, color: t.ink, fontSize: 14, height: '100%' }}
            autoCorrect={false}
          />
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 14 }}>
        <SCCard style={{ padding: 4 }}>
          {visible.length === 0 ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <SCText size={13} color={t.ink3}>No matches.</SCText>
            </View>
          ) : visible.map((p, i) => {
            const on = picked.includes(p.id);
            const isFriend = friends.has(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                  borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.line,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCAvatar person={p} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText size={15} weight="600">{p.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3}>
                    @{p.username}{isFriend ? ' · friend' : ''}
                  </SCText>
                </View>
                <View style={{
                  width: 22, height: 22, borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: on ? t.primary : t.line,
                  backgroundColor: on ? t.primary : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {on && <SCIcon name="check" size={14} color={t.primaryInk} />}
                </View>
              </Pressable>
            );
          })}
        </SCCard>
      </View>

      <View style={{ padding: 18, backgroundColor: t.surface }}>
        <Pressable
          onPress={start}
          disabled={picked.length === 0}
          style={({ pressed }) => [{
            height: 52, borderRadius: RADIUS.lg,
            backgroundColor: picked.length ? t.primary : t.subtle,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
          }, pressed && picked.length > 0 && { opacity: 0.85 }]}
        >
          <SCIcon name={picked.length > 1 ? 'people' : 'chat'} size={16} color={picked.length ? t.primaryInk : t.ink3} />
          <SCText variant="mono" size={12} weight="700" color={picked.length ? t.primaryInk : t.ink3}>
            {ctaLabel}
          </SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

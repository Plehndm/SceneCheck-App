// Start a new chat — pick one (DM) or more (group) people, then begin
// the conversation. Friends surface first in the list.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useFriends } from '@/hooks/useFriends';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';
import type { Account } from '@/types/domain';

export default function NewChatScreen() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [starting, setStarting] = useState(false);
  // Live mode: friend list from `api.fetchFriends()`. Mock mode:
  // derived from the Zustand `friends` Set. Either way the picker
  // is scoped to friends only — DMing strangers is intentionally
  // not surfaced here (the legacy let you DM the full SC_VISIBLE
  // catalogue but that doesn't translate to RLS-controlled
  // friendships).
  const { friends } = useFriends();

  // Deep-link target: the Message buttons on profiles + person rows route here
  // as `/new-chat?to=<id>`. When present we open (or create) the DM with that
  // person directly — api.createChat DEDUPES, so this lands on the existing
  // thread if you already DM them, and a fresh one otherwise. Without this the
  // param was ignored and the screen just showed an empty picker.
  const params = useLocalSearchParams<{ to?: string }>();
  const toId = typeof params.to === 'string' && params.to ? params.to : undefined;
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!toId || autoStarted.current) return;
    autoStarted.current = true;
    setStarting(true);
    api
      .createChat([toId], 'dm')
      .then(({ id }) => router.replace(`/chat/${id}` as never))
      .catch((e) => {
        showToast({
          message: e instanceof Error ? `Couldn't start chat: ${e.message}` : "Couldn't start chat.",
          kind: 'error',
        });
        setStarting(false);
      });
  }, [toId, showToast]);

  const ordered = useMemo<Account[]>(() => friends, [friends]);
  // Picked chips resolve against the friend list — the only source you can
  // pick from — so no SC_* lookup is needed in either mode.
  const byId = useMemo(() => Object.fromEntries(ordered.map(p => [p.id, p])), [ordered]);

  const visible = ordered.filter(p => {
    if (!query.trim()) return true;
    const s = query.trim().toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.username ?? '').toLowerCase().includes(s);
  });

  const toggle = (id: string) =>
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const start = async () => {
    if (picked.length === 0 || starting) return;
    setStarting(true);
    try {
      // createChat in live mode inserts chats + chat_members rows
      // and returns the new chat id. In mock mode it returns the
      // legacy dm-/group- stable id so the router lands on a
      // SC_THREADS entry as it did before.
      const { id } = await api.createChat(picked, picked.length === 1 ? 'dm' : 'group');
      router.replace(`/chat/${id}` as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't start chat: ${e.message}` : "Couldn't start chat.",
        kind: 'error',
      });
      setStarting(false);
    }
  };

  const ctaLabel = picked.length <= 1 ? 'START CHAT' : `START GROUP · ${picked.length}`;
  const subtitle =
    picked.length === 0 ? 'PICK ONE OR MORE PEOPLE' :
    picked.length === 1 ? 'DIRECT MESSAGE' :
    `GROUP CHAT · ${picked.length} SELECTED`;

  // While auto-opening a deep-linked DM (`?to=`), show a minimal opening state
  // rather than flashing the friend picker before the redirect lands.
  if (toId && starting) {
    return (
      <Screen scroll={false}>
        <SCTopBar onBack={() => router.back()} title="New chat" subtitle="OPENING…" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <SCText size={14} color={t.ink3}>Opening chat…</SCText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <SCTopBar onBack={() => router.back()} title="New chat" subtitle={subtitle} />

      {picked.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingBottom: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {picked.map(id => {
            const p = byId[id];
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
                    @{p.username} · friend
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
          disabled={picked.length === 0 || starting}
          style={({ pressed }) => [{
            height: 52, borderRadius: RADIUS.lg,
            backgroundColor: picked.length ? t.primary : t.subtle,
            alignItems: 'center', justifyContent: 'center',
            flexDirection: 'row', gap: 8,
            opacity: starting ? 0.6 : 1,
          }, pressed && picked.length > 0 && !starting && { opacity: 0.85 }]}
        >
          <SCIcon name={picked.length > 1 ? 'people' : 'chat'} size={16} color={picked.length ? t.primaryInk : t.ink3} />
          <SCText variant="mono" size={12} weight="700" color={picked.length ? t.primaryInk : t.ink3}>
            {starting ? 'STARTING…' : ctaLabel}
          </SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

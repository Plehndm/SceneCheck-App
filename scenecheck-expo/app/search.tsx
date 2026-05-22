// Search — unified search across events, people, and orgs. Filters by
// tab and renders typed result rows. People + orgs come from Supabase via
// useSearchPeople / useSearchOrgs (which fall back to the SC_* fixtures in
// mock mode); events come from useEvents and are filtered client-side.

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCAvatar } from '@/components/SCAvatar';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useEvents } from '@/hooks/useEvents';
import { useSearchPeople, useSearchOrgs } from '@/hooks/useSearch';
import { excludeSelf } from '@/lib/people';
import { whenRange } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';

type Tab = 'events' | 'people' | 'orgs';

export default function SearchScreen() {
  const t = useTokens();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('events');
  const meId = useStore(s => s.me.id);
  const lowered = query.trim().toLowerCase();

  // Events come from useEvents (live or fixtures) and are filtered locally.
  // People + orgs come from Supabase (fixtures in mock mode); the hooks
  // already apply the query, so when it's empty we just cap the default view.
  const { events: allEvents, reload: reloadEvents } = useEvents();
  const { results: peopleAll, reload: reloadPeople } = useSearchPeople(query);
  const { results: orgsAll, reload: reloadOrgs } = useSearchOrgs(query);

  const events = useMemo(() => {
    if (!lowered) return allEvents.slice(0, 6);
    return allEvents.filter(e =>
      e.title.toLowerCase().includes(lowered) ||
      e.where.toLowerCase().includes(lowered) ||
      e.interests.some(i => i.toLowerCase().includes(lowered))
    );
  }, [lowered, allEvents]);

  // Never surface yourself in people results (live excludes self in the
  // query; this also covers mock mode where the fixture list is unfiltered).
  const peopleVisible = excludeSelf(peopleAll, meId);
  const people = lowered ? peopleVisible : peopleVisible.slice(0, 6);
  const orgs = lowered ? orgsAll : orgsAll.slice(0, 6);

  return (
    <Screen onRefresh={() => { reloadEvents(); reloadPeople(); reloadOrgs(); }}>
      <SCTopBar onBack={() => router.back()} />

      <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
        <SCText variant="displayTight" size={32}>Search</SCText>
      </View>

      {/* Search input */}
      <View style={{ paddingHorizontal: 18, marginBottom: 14 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
          borderRadius: RADIUS.lg, paddingHorizontal: 14, height: 48,
        }}>
          <SCIcon name="search" size={18} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search events, people, orgs…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, color: t.ink, fontSize: 14, height: '100%' }}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <SCIcon name="x" size={16} color={t.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 6, paddingBottom: 14 }}
      >
        {([
          { k: 'events', label: `EVENTS · ${events.length}` },
          { k: 'people', label: `PEOPLE · ${people.length}` },
          { k: 'orgs', label: `ORGS · ${orgs.length}` },
        ] as { k: Tab; label: string }[]).map(c => (
          <Pressable
            key={c.k}
            onPress={() => setTab(c.k)}
            style={({ pressed }) => [{
              paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
              borderWidth: 1,
              backgroundColor: tab === c.k ? t.ink : t.card,
              borderColor: tab === c.k ? t.ink : t.line,
            }, pressed && { opacity: 0.85 }]}
          >
            <SCText variant="mono" size={11} weight="600" color={tab === c.k ? 'white' : t.ink}>
              {c.label}
            </SCText>
          </Pressable>
        ))}
      </ScrollView>

      {/* Results */}
      <View style={{ paddingHorizontal: 14, gap: 8 }}>
        {tab === 'events' && events.map(e => (
          <Pressable
            key={e.id}
            onPress={() => router.push(`/event/${e.id}` as never)}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          >
            <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <View style={{
                width: 38, height: 38, borderRadius: RADIUS.md, backgroundColor: t.accentBlue,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name="pin" size={16} color="white" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <SCText variant="display" size={14}>{e.title}</SCText>
                <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                  {whenRange(e)} · {e.where}
                </SCText>
              </View>
              <SCIcon name="chevron-right" size={14} color={t.ink3} />
            </SCCard>
          </Pressable>
        ))}

        {tab === 'people' && people.map(p => (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/profile/${p.id}` as never)}
            style={({ pressed }) => [pressed && { opacity: 0.9 }]}
          >
            <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <SCAvatar person={p} size={42} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <SCText variant="display" size={14}>{p.name}</SCText>
                <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                  @{p.username}{p.mutual != null ? ` · ${p.mutual} mutual` : ''}
                </SCText>
              </View>
              <SCIcon name="chevron-right" size={14} color={t.ink3} />
            </SCCard>
          </Pressable>
        ))}

        {tab === 'orgs' && orgs.map(o => {
          const handle = o.handle ?? (o.username ? `@${o.username}` : '');
          return (
            <Pressable
              key={o.id}
              onPress={() => router.push(`/profile/${o.id}` as never)}
              style={({ pressed }) => [pressed && { opacity: 0.9 }]}
            >
              <SCCard style={{ padding: 12, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <SCAvatar person={o} size={42} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <SCText variant="display" size={14}>{o.name}</SCText>
                  <SCText variant="mono" size={11} color={t.ink3} style={{ marginTop: 2 }}>
                    {handle}{o.followers != null ? ` · ${o.followers} followers` : ''}
                  </SCText>
                </View>
                <SCIcon name="chevron-right" size={14} color={t.ink3} />
              </SCCard>
            </Pressable>
          );
        })}

        {((tab === 'events' && events.length === 0) ||
          (tab === 'people' && people.length === 0) ||
          (tab === 'orgs' && orgs.length === 0)) && (
          <SCCard style={{ padding: 24, alignItems: 'center' }}>
            <SCText variant="displayTight" size={20}>No matches</SCText>
            <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
              Try a different search term or tab.
            </SCText>
          </SCCard>
        )}
      </View>
    </Screen>
  );
}

// Interest management — your current interests + suggestions. Tapping
// an interest opens its detail page.

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCTag } from '@/components/SCTag';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SC_INTERESTS_SUGGESTED } from '@/data/mocks';
import { RADIUS } from '@/theme/tokens';

const COLLAPSE_THRESHOLD = 6;

export default function InterestsScreen() {
  const t = useTokens();
  const subscribed = useStore(s => s.subscribedInterests);
  const toggle = useStore(s => s.toggleInterestSub);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const list = SC_INTERESTS_SUGGESTED.filter(i =>
    i.tag.toLowerCase().includes(query.toLowerCase())
  );

  const subsArr = Array.from(subscribed);
  const isTruncated = subsArr.length > COLLAPSE_THRESHOLD && !showAll;
  const visibleSubs = isTruncated ? subsArr.slice(0, COLLAPSE_THRESHOLD) : subsArr;
  const hiddenCount = subsArr.length - COLLAPSE_THRESHOLD;

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="INTERESTS" />
      <View style={{ paddingHorizontal: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <SCText variant="labelCap">Your current interests</SCText>
          <SCText variant="mono" size={11} color={t.ink3}>{subsArr.length}</SCText>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 18, alignItems: 'center' }}>
          {visibleSubs.map(tag => (
            <SCTag
              key={tag} tag={tag} size="lg" tone="primary"
              onPress={() => router.push(`/interests/${tag}` as never)}
            />
          ))}
          {subsArr.length > COLLAPSE_THRESHOLD && (
            <Pressable
              onPress={() => setShowAll(!showAll)}
              style={({ pressed }) => [{
                paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
                borderWidth: 1.5, borderColor: t.line,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600" color={t.ink2}>
                {showAll ? 'SHOW LESS' : `SHOW ALL +${hiddenCount}`}
              </SCText>
            </Pressable>
          )}
          {subsArr.length === 0 && (
            <SCText variant="mono" size={12} color={t.ink3}>
              No interests yet — add some from below.
            </SCText>
          )}
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
          backgroundColor: t.subtle, borderRadius: RADIUS.lg, height: 48, marginBottom: 14,
        }}>
          <SCIcon name="search" size={16} color={t.ink3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search interests…"
            placeholderTextColor={t.ink3}
            style={{ flex: 1, fontSize: 13, color: t.ink, height: '100%' }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')}>
              <SCIcon name="x" size={14} color={t.ink3} />
            </Pressable>
          )}
        </View>

        <SCText variant="labelCap" style={{ marginBottom: 8 }}>
          {query ? `MATCHING "${query}"` : 'SUGGESTED FOR YOU'}
        </SCText>
        <View style={{ gap: 8 }}>
          {list.map(i => (
            <View key={i.tag} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              padding: 12,
              backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
              borderRadius: RADIUS.lg,
            }}>
              <Pressable
                onPress={() => router.push(`/interests/${i.tag}` as never)}
                style={({ pressed }) => [{ flex: 1, gap: 3 }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={16} weight="600">
                  <SCText variant="mono" size={16} style={{ opacity: 0.5 }}>#</SCText>{i.tag}
                </SCText>
                <SCText size={12} color={t.ink3}>
                  {i.others.toLocaleString()} others nearby
                </SCText>
              </Pressable>
              <Pressable
                onPress={() => toggle(i.tag)}
                style={({ pressed }) => [{
                  paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.md,
                  backgroundColor: subscribed.has(i.tag) ? t.ink : t.good,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }, pressed && { opacity: 0.85 }]}
              >
                {subscribed.has(i.tag) && <SCIcon name="check" size={12} color={t.card} />}
                <SCText variant="mono" size={11} weight="600" color={subscribed.has(i.tag) ? t.card : 'white'}>
                  {subscribed.has(i.tag) ? 'ADDED' : 'ADD'}
                </SCText>
              </Pressable>
            </View>
          ))}
          {list.length === 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <SCText size={13} color={t.ink3}>No tag found.</SCText>
              {query.trim().length > 0 && (
                <Pressable onPress={() => { toggle(query.toLowerCase()); setQuery(''); }}>
                  <SCText size={13} weight="600" color={t.primary} style={{ marginTop: 4 }}>
                    Create #{query.toLowerCase()}
                  </SCText>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

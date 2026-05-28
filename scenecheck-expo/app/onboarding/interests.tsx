// FR1.3 — Post-signup interest questionnaire.
//
// This screen lands a freshly-signed-up user (live mode) on a tag-picker so
// the home feed has something to rank against on first launch. Selecting any
// number of tags (zero is fine; the user can use Skip) and tapping Continue
// calls api.markOnboarded — which stamps profiles.onboarded_at in live mode
// (and flips the in-memory slice in mock mode), then routes into the tabs.
//
// Routing:
// - Reached from auth/sign-up.tsx after a successful signup with a live
//   session.
// - The AuthGate inside (tabs)/_layout bounces unonboarded users here if
//   they reach the tabs without onboardedAt set, so this is the canonical
//   landing page for "logged in but unonboarded".
// - This route is intentionally OUTSIDE the (tabs) group so the gate does
//   NOT loop us back here.

import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCIcon } from '@/components/SCIcon';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { useInterests } from '@/hooks/useInterests';
import { api } from '@/lib/api';
import { RADIUS } from '@/theme/tokens';

export default function OnboardingInterestsScreen() {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const [query, setQuery] = useState('');
  // Local selection set, committed in one batch on Continue / Skip. We
  // intentionally don't pipe through toggleInterestSub mid-flight so a
  // mid-flow abandonment doesn't leave the user with half-saved tags.
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  // Catalog filter — useInterests hits SC_INTERESTS_SUGGESTED in mock and
  // the interests table in live mode, same as the post-onboarding interests
  // screen.
  const { interests: list, loading } = useInterests(query);

  const toggle = (tag: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const finish = async (tags: string[]) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.markOnboarded(tags);
      router.replace('/(tabs)' as never);
    } catch (e) {
      // Stay on the screen so the user can retry; AuthGate would otherwise
      // bounce them right back here on the next render.
      showToast({
        message: e instanceof Error ? `Couldn't save: ${e.message}` : "Couldn't save interests.",
        kind: 'error',
      });
      setSubmitting(false);
    }
  };

  const handleContinue = () => finish(Array.from(selected));
  const handleSkip = () => finish([]);

  return (
    <Screen contentContainerStyle={{ paddingBottom: 160 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 8 }}>
        <SCText variant="labelCap" color={t.ink3}>WELCOME</SCText>
        <SCText variant="displayTight" size={32} style={{ marginTop: 6 }}>
          Pick a few interests
        </SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 8, lineHeight: 19 }}>
          We&apos;ll use these to recommend events near you. You can change them
          anytime from Profile → Interests.
        </SCText>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 18, marginTop: 8 }}>
        <View style={{
          flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14,
          backgroundColor: t.subtle, borderRadius: RADIUS.lg, height: 48,
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
            <Pressable onPress={() => setQuery('')} accessibilityLabel="Clear search">
              <SCIcon name="x" size={14} color={t.ink3} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Selection summary */}
      <View style={{ paddingHorizontal: 22, marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <SCText variant="labelCap">{query ? `MATCHING "${query}"` : 'SUGGESTED'}</SCText>
        <SCText variant="mono" size={11} color={t.ink3}>
          {selected.size} selected
        </SCText>
      </View>

      {/* Chip grid — tap to toggle. Selected chips invert to the primary
          color so the picked set is obvious without a side panel. */}
      <View style={{ paddingHorizontal: 18, marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {list.map(i => {
          const isOn = selected.has(i.tag);
          return (
            <Pressable
              key={i.tag}
              onPress={() => toggle(i.tag)}
              accessibilityLabel={`${isOn ? 'Remove' : 'Add'} ${i.tag}`}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
                borderWidth: 1.5,
                borderColor: isOn ? t.primary : t.line,
                backgroundColor: isOn ? t.primary : t.card,
              }, pressed && { opacity: 0.85 }]}
            >
              {isOn && <SCIcon name="check" size={12} color={t.primaryInk} />}
              <SCText
                variant="mono" size={12} weight="700"
                color={isOn ? t.primaryInk : t.ink}
              >
                #{i.tag}
              </SCText>
            </Pressable>
          );
        })}
        {!loading && list.length === 0 && (
          <SCText size={13} color={t.ink3} style={{ paddingVertical: 8 }}>
            No tags match that search.
          </SCText>
        )}
      </View>

      {/* Footer CTAs — sticky to the bottom so they're reachable while the
          chip grid scrolls. Continue commits the selection; Skip commits an
          empty list so the user lands on the home feed regardless. */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18,
        backgroundColor: t.surface, gap: 10,
      }}>
        <SCButton
          label={submitting ? 'SAVING…' : 'CONTINUE'}
          onPress={handleContinue}
          disabled={submitting}
          size="lg"
        />
        <Pressable
          onPress={handleSkip}
          disabled={submitting}
          accessibilityLabel="Skip for now"
          style={({ pressed }) => [{
            height: 44, borderRadius: RADIUS.lg,
            alignItems: 'center', justifyContent: 'center',
            opacity: submitting ? 0.5 : 1,
          }, pressed && { opacity: 0.7 }]}
        >
          <SCText variant="mono" size={12} weight="700" color={t.ink2}>
            SKIP FOR NOW
          </SCText>
        </Pressable>
      </View>
    </Screen>
  );
}

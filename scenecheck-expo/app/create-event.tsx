// Create event — simplified single-page form (the legacy 4-step wizard
// in screens.jsx is queued for a Phase 4.x polish pass). Saves to the
// drafts slice when cancelled with unsaved input; otherwise calls
// api.createEvent and navigates to the success screen.

import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCTag } from '@/components/SCTag';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { SCDatePicker } from '@/components/SCDatePicker';
import { SCTimePicker } from '@/components/SCTimePicker';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { api } from '@/lib/api';
import { useInterests } from '@/hooks/useInterests';
import { timeToMin } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';
import type { DraftForm, Visibility } from '@/types/domain';

// Empty-form template used as a fallback when there's no draft to resume
// and the user has no interests on file. New events auto-fill their tag
// chips from `me.interests` (see makeEmptyForm below) so the host
// doesn't have to re-tag every event with the same things.
const FALLBACK_INTERESTS = ['biking'] as const;

function makeEmptyForm(meInterests: readonly string[]): DraftForm {
  return {
    title: '',
    desc: '',
    date: 'Sat May 16',
    timeStart: '7:00 AM',
    timeEnd: '9:00 AM',
    location: 'Anteater Plaza',
    cap: 12,
    interests: meInterests.length > 0
      ? [...meInterests]
      : [...FALLBACK_INTERESTS],
    visibility: 'public',
    minSubs: 3,
    addToCalendar: true,
    autoGroupChat: true,
  };
}

export default function CreateEventScreen() {
  const t = useTokens();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();

  const drafts = useStore(s => s.drafts);
  const saveDraft = useStore(s => s.saveDraft);
  const removeDraft = useStore(s => s.removeDraft);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);
  const meInterests = useStore(s => s.me.interests ?? []);

  const initialDraft = useMemo(
    () => (draftId ? drafts.find(d => d.id === draftId) : null),
    [draftId, drafts],
  );

  // Lazy initializer — pulls me.interests at mount-time so a host's
  // current interests pre-fill the tags chip set. Drafts win when
  // present (the user already picked tags they care about for that draft).
  const [form, setForm] = useState<DraftForm>(
    () => initialDraft?.form ?? makeEmptyForm(meInterests),
  );
  const [tagQuery, setTagQuery] = useState('');
  const [publishing, setPublishing] = useState(false);

  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleInterest = (tag: string) =>
    set('interests', form.interests.includes(tag)
      ? form.interests.filter(x => x !== tag)
      : [...form.interests, tag]);

  // `useInterests(tagQuery)` returns the live `interests` table in
  // live mode and `SC_INTERESTS_SUGGESTED` in mock mode — both
  // pre-filtered by the search query. The "add more" list also
  // includes any tag the user already has selected via `me.interests`
  // (so a user with custom tags can still re-add them after removal).
  const { interests: catalogResults } = useInterests(tagQuery);
  const addableTags = useMemo(() => {
    const catalog = new Set<string>([
      ...catalogResults.map(i => i.tag),
      ...meInterests,
    ]);
    const selected = new Set(form.interests);
    const q = tagQuery.trim().toLowerCase();
    const all = Array.from(catalog).filter(tag => !selected.has(tag));
    return q
      ? all.filter(tag => tag.toLowerCase().includes(q))
      : all.filter(tag => catalogResults.some(i => i.tag === tag));
  }, [form.interests, tagQuery, meInterests, catalogResults]);

  const timesInvalid = timeToMin(form.timeEnd) < timeToMin(form.timeStart);
  const titleValid = form.title.trim().length > 0;
  const canPublish = titleValid && !timesInvalid && !publishing;

  const handlePublish = async () => {
    if (!canPublish) {
      if (!titleValid) showToast({ message: 'Add a title before publishing.', kind: 'error' });
      else if (timesInvalid) showToast({ message: 'End time must be after start.', kind: 'error' });
      return;
    }
    setPublishing(true);
    try {
      const result = await api.createEvent({ ...form });
      if (initialDraft) removeDraft(initialDraft.id);
      router.replace({ pathname: '/event-published', params: { eventId: (result as { event_id?: string })?.event_id ?? 'e1', title: form.title } } as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't publish: ${e.message}` : "Couldn't publish.",
        kind: 'error',
      });
      setPublishing(false);
    }
  };

  const handleCancel = () => {
    const isDirty = form.title.trim() || form.desc.trim();
    if (initialDraft) {
      // Resuming a draft — silently update.
      saveDraft(form, { id: initialDraft.id });
      router.back();
      return;
    }
    if (isDirty) {
      showConfirm({
        title: 'Save as draft?',
        body: 'You can finish later from the Drafts list.',
        confirmLabel: 'SAVE DRAFT',
        cancelLabel: 'DISCARD',
        onConfirm: () => {
          saveDraft(form);
          showToast({ message: 'Saved to Drafts.', kind: 'success' });
          router.back();
        },
        onCancel: () => router.back(),
      });
    } else {
      router.back();
    }
  };

  return (
    <Screen contentContainerStyle={{ paddingBottom: 120 }}>
      <SCTopBar
        onBack={handleCancel}
        title={initialDraft ? 'Edit draft' : 'New event'}
        subtitle={initialDraft ? 'RESUMING DRAFT' : 'CREATE'}
      />

      <View style={{ paddingHorizontal: 18, gap: 16 }}>
        {/* Title */}
        <Field label="Title" hint={`${form.title.length}/60`}>
          <TextInput
            value={form.title}
            onChangeText={(v) => set('title', v.slice(0, 60))}
            placeholder="What's the scene?"
            placeholderTextColor={t.ink3}
            style={inputStyle(t)}
          />
        </Field>

        {/* Description */}
        <Field label="Description" hint={`${form.desc.length}/240`}>
          <TextInput
            value={form.desc}
            onChangeText={(v) => set('desc', v.slice(0, 240))}
            placeholder="What should people expect?"
            placeholderTextColor={t.ink3}
            multiline
            numberOfLines={4}
            style={[inputStyle(t), { height: 100, paddingTop: 12, textAlignVertical: 'top' }]}
          />
        </Field>

        {/* Date + times */}
        <Field label="Date">
          <SCDatePicker value={form.date} onChange={(v) => set('date', v)} />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Start">
              <SCTimePicker value={form.timeStart} onChange={(v) => set('timeStart', v)} />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="End">
              <SCTimePicker value={form.timeEnd} onChange={(v) => set('timeEnd', v)} />
            </Field>
          </View>
        </View>

        {timesInvalid && (
          <View style={{
            padding: 10, borderRadius: RADIUS.md,
            backgroundColor: t.warn + '26', borderColor: t.warn + '59', borderWidth: 1,
          }}>
            <SCText size={12} color={t.ink2}>
              End time is before start. Adjust to publish.
            </SCText>
          </View>
        )}

        {/* Location */}
        <Field label="Location">
          <TextInput
            value={form.location}
            onChangeText={(v) => set('location', v)}
            placeholder="Anteater Plaza"
            placeholderTextColor={t.ink3}
            style={inputStyle(t)}
          />
        </Field>

        {/* Capacity */}
        <Field label={`Capacity · ${form.cap}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Pressable
              onPress={() => set('cap', Math.max(2, form.cap - 1))}
              style={({ pressed }) => [stepperBtn(t), pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="x" size={14} color={t.ink} />
            </Pressable>
            <SCText variant="display" size={20} style={{ flex: 1, textAlign: 'center' }}>
              {form.cap}
            </SCText>
            <Pressable
              onPress={() => set('cap', Math.min(200, form.cap + 1))}
              style={({ pressed }) => [stepperBtn(t), pressed && { opacity: 0.85 }]}
            >
              <SCIcon name="plus" size={14} color={t.ink} />
            </Pressable>
          </View>
        </Field>

        {/* Interests — auto-filled from me.interests on a new event; user
            can remove tags by tapping them, or search the catalog below
            to add more. */}
        <Field label={`Tags · ${form.interests.length}`}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {form.interests.length === 0 ? (
              <SCText size={12} color={t.ink3}>
                No tags yet — search and tap to add.
              </SCText>
            ) : form.interests.map(tag => (
              <Pressable
                key={tag}
                onPress={() => toggleInterest(tag)}
                accessibilityLabel={`Remove tag ${tag}`}
                style={({ pressed }) => [{
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: t.primary,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={11} weight="700" color={t.primaryInk}>
                  #{tag}
                </SCText>
                <SCIcon name="x" size={10} color={t.primaryInk} />
              </Pressable>
            ))}
          </View>

          {/* Search */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingHorizontal: 12, marginBottom: 8,
            backgroundColor: t.subtle, borderRadius: RADIUS.md, height: 40,
          }}>
            <SCIcon name="search" size={14} color={t.ink3} />
            <TextInput
              value={tagQuery}
              onChangeText={setTagQuery}
              placeholder="Search tags to add…"
              placeholderTextColor={t.ink3}
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, color: t.ink, fontSize: 13 }}
            />
            {tagQuery.length > 0 && (
              <Pressable onPress={() => setTagQuery('')} accessibilityLabel="Clear tag search">
                <SCIcon name="x" size={12} color={t.ink3} />
              </Pressable>
            )}
          </View>

          {/* Catalog results — tags not yet selected. With no query we show
              the curated suggested list; with a query we show every catalog
              match that survives the substring filter. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {addableTags.length === 0 ? (
              <SCText variant="mono" size={11} color={t.ink3}>
                {tagQuery.length > 0 ? 'No tags match that search.' : 'All suggested tags are already added.'}
              </SCText>
            ) : addableTags.map(tag => (
              <SCTag
                key={tag}
                tag={tag}
                size="sm"
                tone="soft"
                onPress={() => {
                  toggleInterest(tag);
                  setTagQuery('');
                }}
              />
            ))}
          </View>
        </Field>

        {/* Visibility */}
        <Field label="Visibility">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['public', 'private'] as Visibility[]).map(v => (
              <Pressable
                key={v}
                onPress={() => set('visibility', v)}
                style={({ pressed }) => [{
                  flex: 1, padding: 12, borderRadius: RADIUS.md,
                  borderWidth: 1.5,
                  borderColor: form.visibility === v ? t.primary : t.line,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name={v === 'public' ? 'globe' : 'lock'} size={14} color={form.visibility === v ? t.primary : t.ink2} />
                <SCText size={13} weight={form.visibility === v ? '600' : '500'}>
                  {v === 'public' ? 'Public' : 'Private'}
                </SCText>
              </Pressable>
            ))}
          </View>
        </Field>

        <SCCard style={{ padding: 12 }}>
          <SCText variant="mono" size={11} color={t.ink3}>
            Once {Math.max(1, Math.ceil(form.cap / 5))} subscribers join, this event becomes publicly
            visible on the map. Until then, only you and people you share it with see it.
          </SCText>
        </SCCard>
      </View>

      {/* Bottom CTA */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18,
        backgroundColor: t.surface, flexDirection: 'row', gap: 10,
      }}>
        <Pressable
          onPress={() => {
            saveDraft(form, { id: initialDraft?.id });
            showToast({ message: 'Saved to Drafts.', kind: 'info' });
          }}
          style={({ pressed }) => [{
            paddingHorizontal: 16, height: 56, borderRadius: RADIUS.lg,
            borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
            alignItems: 'center', justifyContent: 'center',
          }, pressed && { opacity: 0.85 }]}
        >
          <SCText variant="mono" size={11} weight="700">SAVE DRAFT</SCText>
        </Pressable>
        <View style={{ flex: 1 }}>
          <SCButton
            label={publishing ? 'PUBLISHING…' : 'PUBLISH'}
            onPress={handlePublish}
            disabled={!canPublish}
            size="lg"
          />
        </View>
      </View>
    </Screen>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const t = useTokens();
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
        <SCText variant="labelCap">{label}</SCText>
        {hint && <SCText variant="mono" size={10} color={t.ink3}>{hint}</SCText>}
      </View>
      {children}
    </View>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>) {
  return {
    height: 44,
    backgroundColor: t.card,
    borderColor: t.line,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    color: t.ink,
    fontSize: 14,
  };
}

function stepperBtn(t: ReturnType<typeof useTokens>) {
  return {
    width: 44, height: 44, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };
}

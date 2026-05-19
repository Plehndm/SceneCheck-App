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
import { SC_INTERESTS_SUGGESTED } from '@/data/mocks';
import { timeToMin } from '@/lib/date-time';
import { RADIUS } from '@/theme/tokens';
import type { DraftForm, Visibility } from '@/types/domain';

const EMPTY_FORM: DraftForm = {
  title: '',
  desc: '',
  date: 'Sat May 16',
  timeStart: '7:00 AM',
  timeEnd: '9:00 AM',
  location: 'Anteater Plaza',
  cap: 12,
  interests: ['biking'],
  visibility: 'public',
  minSubs: 3,
  addToCalendar: true,
  autoGroupChat: true,
};

export default function CreateEventScreen() {
  const t = useTokens();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();

  const drafts = useStore(s => s.drafts);
  const saveDraft = useStore(s => s.saveDraft);
  const removeDraft = useStore(s => s.removeDraft);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);

  const initialDraft = useMemo(
    () => (draftId ? drafts.find(d => d.id === draftId) : null),
    [draftId, drafts],
  );

  const [form, setForm] = useState<DraftForm>(initialDraft?.form ?? EMPTY_FORM);
  const [publishing, setPublishing] = useState(false);

  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const toggleInterest = (tag: string) =>
    set('interests', form.interests.includes(tag)
      ? form.interests.filter(x => x !== tag)
      : [...form.interests, tag]);

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

        {/* Interests */}
        <Field label="Tags">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {SC_INTERESTS_SUGGESTED.map(i => (
              <SCTag
                key={i.tag}
                tag={i.tag}
                size="sm"
                tone={form.interests.includes(i.tag) ? 'primary' : 'soft'}
                onPress={() => toggleInterest(i.tag)}
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

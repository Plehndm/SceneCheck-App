// Bottom-sheet for rating an event (1–5 stars + an optional review). Submits
// via api.rateEvent, which upserts into `ratings` keyed on (event_id, user_id)
// — so the rating attaches to the host (events.creator_id) and shows up in
// their reviews + computed average. Re-opening lets you change a prior rating.

import { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useTokens } from '@/theme/ThemeProvider';
import { useStore } from '@/store/useStore';
import { api } from '@/lib/api';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { RADIUS } from '@/theme/tokens';

interface Props {
  visible: boolean;
  eventId: string;
  eventTitle: string;
  onClose: () => void;
  onRated?: () => void;
  // Editing an existing rating: seed the picker + review and switch the copy
  // from "submit" to "update". Omit for a fresh rating.
  initialStars?: number;
  initialText?: string;
}

export function RateEventSheet({
  visible, eventId, eventTitle, onClose, onRated, initialStars = 0, initialText = '',
}: Props) {
  const t = useTokens();
  const showToast = useStore(s => s.showToast);
  const kbHeight = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  const editing = initialStars > 0;
  const [stars, setStars] = useState(initialStars);
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  // Seed from the initial values each time the sheet opens (so editing a
  // review pre-fills it, and a fresh rating starts blank).
  useEffect(() => {
    if (visible) { setStars(initialStars); setText(initialText); setSaving(false); }
  }, [visible, initialStars, initialText]);

  const submit = async () => {
    if (stars < 1) {
      showToast({ message: 'Tap a star to choose a rating.', kind: 'error' });
      return;
    }
    setSaving(true);
    try {
      await api.rateEvent(eventId, stars, text.trim());
      showToast({ message: editing ? 'Rating updated.' : 'Rating submitted — thanks!', kind: 'success' });
      onRated?.();
      onClose();
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't submit rating: ${e.message}` : "Couldn't submit rating.",
        kind: 'error',
      });
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end', paddingBottom: kbHeight }}
      >
        <Pressable
          onPress={() => { /* swallow taps inside the sheet */ }}
          style={{
            backgroundColor: t.card,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 20, paddingBottom: insets.bottom + 20, gap: 14,
          }}
        >
          <View>
            <SCText variant="mono" size={10} weight="600" color={t.ink3}>{editing ? 'EDIT RATING' : 'RATE EVENT'}</SCText>
            <SCText variant="displayTight" size={22} numberOfLines={1} style={{ marginTop: 2 }}>
              {eventTitle}
            </SCText>
          </View>

          {/* Star picker */}
          <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', paddingVertical: 4 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable
                key={n}
                onPress={() => setStars(n)}
                hitSlop={6}
                accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
              >
                <SCIcon name="star" size={36} color={n <= stars ? t.warn : t.line} />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 280))}
            placeholder="Add a review (optional)"
            placeholderTextColor={t.ink3}
            multiline
            style={{
              minHeight: 64,
              backgroundColor: t.surface, borderColor: t.line, borderWidth: 1,
              borderRadius: RADIUS.md,
              paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
              color: t.ink, fontSize: 14, textAlignVertical: 'top',
            }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [{
                flex: 1, height: 48, borderRadius: RADIUS.lg,
                borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600">CANCEL</SCText>
            </Pressable>
            <Pressable
              onPress={submit}
              disabled={saving}
              style={({ pressed }) => [{
                flex: 2, height: 48, borderRadius: RADIUS.lg,
                backgroundColor: t.primary,
                alignItems: 'center', justifyContent: 'center',
                opacity: saving ? 0.6 : 1,
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="700" color={t.primaryInk}>
                {saving ? 'SAVING…' : editing ? 'UPDATE RATING' : 'SUBMIT RATING'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

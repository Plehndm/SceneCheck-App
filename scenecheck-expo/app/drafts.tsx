// Drafts — unpublished events the user has saved. Resume opens
// create-event with the draft pre-filled; trash removes the entry.

import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon } from '@/components/SCIcon';
import { SCTopBar } from '@/components/SCTopBar';
import { SCButton } from '@/components/SCAddButton';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { RADIUS } from '@/theme/tokens';

export default function DraftsScreen() {
  const t = useTokens();
  const drafts = useStore(s => s.drafts);
  const removeDraft = useStore(s => s.removeDraft);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);

  const handleDelete = (id: string, title: string) => {
    showConfirm({
      title: `Delete "${title || 'this draft'}"?`,
      body: 'This can\'t be undone.',
      confirmLabel: 'DELETE',
      tone: 'danger',
      onConfirm: () => {
        removeDraft(id);
        showToast({ message: 'Draft deleted.', kind: 'info' });
      },
    });
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="DRAFTS" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={32}>Drafts</SCText>
        <SCText size={13} color={t.ink3} style={{ marginTop: 6 }}>
          {drafts.length} {drafts.length === 1 ? 'draft' : 'drafts'} saved to this device
        </SCText>
      </View>

      {drafts.length === 0 ? (
        <View style={{ paddingHorizontal: 18 }}>
          <SCCard style={{ padding: 20, alignItems: 'center' }}>
            <SCText size={14} color={t.ink2}>No drafts yet</SCText>
            <SCText size={12} color={t.ink3} style={{ marginTop: 4, marginBottom: 14, textAlign: 'center' }}>
              When you start an event but don&apos;t publish, it lands here.
            </SCText>
            <SCButton label="New event" onPress={() => router.push('/create-event' as never)} />
          </SCCard>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 14, gap: 8 }}>
          {drafts.map(d => (
            <SCCard key={d.id} style={{ padding: 12 }}>
              <Pressable
                onPress={() => router.push({ pathname: '/create-event', params: { draftId: d.id } } as never)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <View style={{
                    width: 38, height: 38, borderRadius: RADIUS.md,
                    backgroundColor: t.primarySoft,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SCIcon name="edit" size={16} color={t.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <SCText size={14} weight="600" numberOfLines={1}>
                      {d.form.title || '(Untitled draft)'}
                    </SCText>
                    <SCText variant="mono" size={10} color={t.ink3} style={{ marginTop: 2 }}>
                      Saved {d.savedAt}
                    </SCText>
                    {!!d.form.desc && (
                      <SCText size={12} color={t.ink2} style={{ marginTop: 6, lineHeight: 17 }} numberOfLines={2}>
                        {d.form.desc}
                      </SCText>
                    )}
                  </View>
                </View>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <View style={{ flex: 1 }}>
                  <SCButton
                    label="Resume"
                    onPress={() => router.push({ pathname: '/create-event', params: { draftId: d.id } } as never)}
                  />
                </View>
                <Pressable
                  onPress={() => handleDelete(d.id, d.form.title)}
                  style={({ pressed }) => [{
                    width: 44, height: 44, borderRadius: RADIUS.md,
                    borderWidth: 1, borderColor: t.line,
                    alignItems: 'center', justifyContent: 'center',
                  }, pressed && { opacity: 0.85 }]}
                >
                  <SCIcon name="x" size={14} color={t.danger} />
                </Pressable>
              </View>
            </SCCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

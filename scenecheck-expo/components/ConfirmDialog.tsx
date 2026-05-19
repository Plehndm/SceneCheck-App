// Modal confirm. Renders nothing when the store's confirm slot is null.
// Uses React Native's Modal so the OS handles backdrop dismiss + a11y.

import { Modal, Pressable, View } from 'react-native';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCIcon, type IconName } from './SCIcon';
import { RADIUS } from '@/theme/tokens';

export function ConfirmDialog() {
  const t = useTokens();
  const cfg = useStore(s => s.confirm);
  const dismiss = useStore(s => s.dismissConfirm);
  if (!cfg) return null;

  const isDanger = cfg.tone === 'danger';
  const confirmBg = isDanger ? t.danger : t.primary;
  const confirmFg = isDanger ? 'white' : t.primaryInk;
  const iconBg = isDanger ? t.danger + '2E' : t.primarySoft;
  const iconFg = isDanger ? t.danger : t.primary;
  const iconName = (cfg.icon ?? 'bell') as IconName;

  const handleCancel = () => {
    cfg.onCancel?.();
    dismiss();
  };

  const handleConfirm = () => {
    cfg.onConfirm();
    dismiss();
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={handleCancel}>
      <Pressable
        onPress={handleCancel}
        style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'flex-end',
        }}
      >
        <Pressable onPress={() => {}} style={{
          backgroundColor: t.card,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <View style={{
              width: 36, height: 36, borderRadius: RADIUS.md,
              backgroundColor: iconBg,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name={iconName} size={18} color={iconFg} />
            </View>
            <SCText variant="displayTight" size={22} style={{ flex: 1 }}>{cfg.title}</SCText>
          </View>
          <SCText size={14} color={t.ink2} style={{ lineHeight: 21 }}>{cfg.body}</SCText>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={handleCancel}
              style={({ pressed }) => [{
                flex: 1, height: 48, borderRadius: RADIUS.lg,
                borderWidth: 1, borderColor: t.line, backgroundColor: t.card,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600">
                {cfg.cancelLabel ?? 'CANCEL'}
              </SCText>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [{
                flex: 1, height: 48, borderRadius: RADIUS.lg,
                backgroundColor: confirmBg,
                alignItems: 'center', justifyContent: 'center',
              }, pressed && { opacity: 0.85 }]}
            >
              <SCText variant="mono" size={12} weight="600" color={confirmFg}>
                {cfg.confirmLabel ?? 'CONFIRM'}
              </SCText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

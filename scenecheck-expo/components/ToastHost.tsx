// Toast stack. Subscribes to the toast slice of the store; renders one
// pill per active toast at the bottom of the viewport. Replaces the
// legacy `window.scToast()` imperative bus with a store-backed pattern
// that's testable and SSR-safe.

import { View, Pressable } from 'react-native';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { RADIUS } from '@/theme/tokens';

export function ToastHost() {
  const t = useTokens();
  const toasts = useStore(s => s.toasts);
  const dismiss = useStore(s => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute', left: 12, right: 12, bottom: 120,
        gap: 8, zIndex: 90,
      }}
    >
      {toasts.map(toast => {
        const tone =
          toast.kind === 'success' ? { bg: t.good, fg: 'white' } :
          toast.kind === 'error'   ? { bg: t.danger, fg: 'white' } :
                                     { bg: t.ink, fg: t.card };
        return (
          <View
            key={toast.id}
            style={{
              backgroundColor: tone.bg, borderRadius: RADIUS.lg,
              paddingVertical: 12, paddingHorizontal: 14,
              flexDirection: 'row', alignItems: 'center', gap: 10,
            }}
          >
            <SCText size={13} color={tone.fg} style={{ flex: 1, lineHeight: 17 }}>
              {toast.message}
            </SCText>
            {toast.action && (
              <Pressable
                onPress={() => { toast.action!.onPress(); dismiss(toast.id); }}
                style={({ pressed }) => [{
                  paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={11} weight="700" color={tone.fg}>
                  {toast.action.label}
                </SCText>
              </Pressable>
            )}
            <Pressable onPress={() => dismiss(toast.id)}>
              <SCIcon name="x" size={14} color={tone.fg} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

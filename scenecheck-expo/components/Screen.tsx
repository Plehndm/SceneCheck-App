// Screen container — provides the background color from the theme and a
// safe-area wrapper. Every screen renders inside one of these so the page
// chrome stays consistent.
//
// Pass `onRefresh` to make the page reloadable: on native it wires a
// pull-to-refresh RefreshControl; on web (where pull-to-refresh is
// unreliable) it shows a small refresh button in the top-right corner.

import {
  KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View,
  type ScrollViewProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState, type ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';
import { SCIcon } from '@/components/SCIcon';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
  // Reload the active page. Wrapped in a refreshing-state guard so the
  // control reflects in-flight work whether the callback is sync or async.
  onRefresh?: () => void | Promise<void>;
}

export function Screen({ children, scroll = true, contentContainerStyle, scrollProps, onRefresh }: Props) {
  const t = useTokens();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  // A floating refresh button for web (RefreshControl pull-down doesn't work
  // reliably there). Native gets the RefreshControl instead.
  const webRefreshButton = onRefresh && Platform.OS === 'web' ? (
    <Pressable
      onPress={handleRefresh}
      disabled={refreshing}
      accessibilityLabel="Refresh"
      style={({ pressed }) => [{
        position: 'absolute', top: 8, right: 14, zIndex: 10,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: t.card, borderWidth: 1, borderColor: t.line,
        alignItems: 'center', justifyContent: 'center',
        opacity: refreshing ? 0.5 : 1,
      }, pressed && { opacity: 0.7 }]}
    >
      <SCIcon name="rotate-ccw" size={18} color={t.ink2} />
    </Pressable>
  ) : null;

  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
        {webRefreshButton}
        {/* Lift the form above the keyboard so the focused input stays
            visible. iOS uses `padding` (shrinks the scroll area to the
            keyboard top); Android relies on the window's adjustResize, so
            no extra behavior is needed there. `keyboardShouldPersistTaps`
            keeps buttons tappable while the keyboard is open. */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[{ paddingBottom: 110 }, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh && Platform.OS !== 'web'
                ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={t.ink3} />
                : undefined
            }
            {...scrollProps}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
      {webRefreshButton}
      <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

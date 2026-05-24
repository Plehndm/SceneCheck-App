// Screen container — provides the background color from the theme and a
// safe-area wrapper. Every screen renders inside one of these so the page
// chrome stays consistent.
//
// Pass `onRefresh` to make the page reloadable: on native it wires a
// pull-to-refresh RefreshControl; on web (where pull-to-refresh is
// unreliable) it shows a small refresh button in the top-right corner.

import {
  Animated, Easing, KeyboardAvoidingView, Platform, Pressable, RefreshControl,
  ScrollView, View, type ScrollViewProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTheme } from '@/theme/ThemeProvider';
import { SCIcon } from '@/components/SCIcon';
import { SCText } from '@/components/SCText';

// The refresh affordance reads pure black in light mode / pure white in dark —
// maximum contrast regardless of palette (the palette `ink` is only near-black/
// near-white and tinted).
const refreshColorFor = (mode: 'light' | 'dark') => (mode === 'dark' ? '#FFFFFF' : '#000000');

// A small "REFRESHING" pill with a spinning icon, shown (on every platform)
// while a refresh is in flight so the user always gets explicit feedback — the
// native RefreshControl spinner alone is easy to miss, and web has none.
function RefreshIndicator() {
  const { tokens: t, mode } = useTheme();
  const refreshColor = refreshColorFor(mode);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 0, right: 0, alignItems: 'center', zIndex: 20 }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: t.card, borderColor: t.line, borderWidth: 1, borderRadius: 999,
        paddingHorizontal: 12, paddingVertical: 6,
      }}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <SCIcon name="rotate-ccw" size={14} color={refreshColor} />
        </Animated.View>
        <SCText variant="mono" size={10} weight="600" color={refreshColor}>REFRESHING</SCText>
      </View>
    </View>
  );
}

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
  const { tokens: t, mode } = useTheme();
  const refreshColor = refreshColorFor(mode);
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
      <SCIcon name="rotate-ccw" size={18} color={refreshColor} />
    </Pressable>
  ) : null;

  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
        {webRefreshButton}
        {refreshing && <RefreshIndicator />}
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
                // Pure black (light) / white (dark) so the pull spinner reads at
                // max contrast. `colors` tints the Android arrow,
                // `progressBackgroundColor` its disc; `tintColor` is the iOS spinner.
                ? <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    tintColor={refreshColor}
                    colors={[refreshColor]}
                    progressBackgroundColor={t.card}
                  />
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
      {refreshing && <RefreshIndicator />}
      <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

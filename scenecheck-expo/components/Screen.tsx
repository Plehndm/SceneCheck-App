// Screen container — provides the background color from the theme and a
// safe-area wrapper. Every screen renders inside one of these so the page
// chrome stays consistent.

import { ScrollView, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type ReactNode } from 'react';
import { useTokens } from '@/theme/ThemeProvider';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ViewStyle;
  scrollProps?: ScrollViewProps;
}

export function Screen({ children, scroll = true, contentContainerStyle, scrollProps }: Props) {
  const t = useTokens();
  if (scroll) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ paddingBottom: 110 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          {...scrollProps}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.pageBg }} edges={['top']}>
      <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
}

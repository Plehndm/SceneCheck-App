// Tests for the Screen container's pull-to-refresh / web-refresh wiring.

import { Platform } from 'react-native';
import { fireEvent } from '@testing-library/react-native';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { renderScreen } from '../test-utils';

// Platform.OS is a writable property in the RN jest mock; flip it per-test.
function withPlatform(os: string, fn: () => void) {
  const orig = Platform.OS;
  (Platform as unknown as { OS: string }).OS = os;
  try { fn(); } finally { (Platform as unknown as { OS: string }).OS = orig; }
}

describe('Screen', () => {
  test('renders its children', () => {
    const { getByText } = renderScreen(<Screen><SCText>body</SCText></Screen>);
    expect(getByText('body')).toBeTruthy();
  });

  test('renders no refresh button when onRefresh is omitted', () => {
    const { queryByLabelText } = renderScreen(<Screen><SCText>body</SCText></Screen>);
    expect(queryByLabelText('Refresh')).toBeNull();
  });

  test('on web, shows a Refresh button that invokes onRefresh', () => {
    withPlatform('web', () => {
      const onRefresh = jest.fn();
      const { getByLabelText } = renderScreen(
        <Screen onRefresh={onRefresh}><SCText>body</SCText></Screen>,
      );
      fireEvent.press(getByLabelText('Refresh'));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  test('on native, does not render the web Refresh button (uses RefreshControl)', () => {
    withPlatform('ios', () => {
      const { queryByLabelText } = renderScreen(
        <Screen onRefresh={() => {}}><SCText>body</SCText></Screen>,
      );
      expect(queryByLabelText('Refresh')).toBeNull();
    });
  });
});

// Integration tests for the settings screen (app/settings.tsx).
// Covers each section header and a few key mutations (visibility,
// palette, notification toggle).

import { fireEvent } from '@testing-library/react-native';
import SettingsScreen from '@/app/settings';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('SettingsScreen', () => {
  test('renders the page chrome', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Settings')).toBeTruthy();
  });

  test('renders every named section', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    expect(getByText(/DISCOVERY · /)).toBeTruthy();
    expect(getByText(/PROFILE VISIBILITY · /)).toBeTruthy();
    expect(getByText('APPEARANCE')).toBeTruthy();
    expect(getByText('NOTIFICATIONS')).toBeTruthy();
    expect(getByText(/PREFERENCES · /)).toBeTruthy();
    expect(getByText('TWEAKS · DEV')).toBeTruthy();
  });

  test('switching to Private visibility mutates the store', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    fireEvent.press(getByText('Private'));
    expect(useStore.getState().visibility).toBe('private');
  });

  test('switching palette updates the store', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    fireEvent.press(getByText('COBALT GLOW'));
    expect(useStore.getState().palette).toBe('cobalt');
  });

  test('switching mode to Dark updates the store', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    fireEvent.press(getByText('Dark'));
    expect(useStore.getState().mode).toBe('dark');
  });

  test('sign out opens a confirm dialog', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    fireEvent.press(getByText('SIGN OUT'));
    expect(useStore.getState().confirm).not.toBeNull();
    expect(useStore.getState().confirm?.title).toBe('Sign out?');
  });
});

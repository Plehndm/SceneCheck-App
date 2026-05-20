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
    // "Account" is now the SCTopBar subtitle (uppercase "ACCOUNT") +
    // the ACCOUNT section header; the big title is still "Settings".
    expect(getByText('Settings')).toBeTruthy();
    // The back-bar's subtitle confirms SCTopBar is mounted.
    expect(getByText('ACCOUNT')).toBeTruthy();
  });

  test('renders every named section', () => {
    const { getByText } = renderScreen(<SettingsScreen />);
    // The ACCOUNT *section* header carries the email suffix, which
    // distinguishes it from the SCTopBar "ACCOUNT" subtitle.
    expect(getByText(/^ACCOUNT · /)).toBeTruthy();
    expect(getByText(/DISCOVERY · /)).toBeTruthy();
    expect(getByText(/PROFILE VISIBILITY · /)).toBeTruthy();
    expect(getByText('APPEARANCE')).toBeTruthy();
    expect(getByText('NOTIFICATIONS')).toBeTruthy();
    expect(getByText(/PREFERENCES · /)).toBeTruthy();
    expect(getByText('TWEAKS · DEV')).toBeTruthy();
  });

  test('tapping Email row opens the change-email sheet', () => {
    const { getByText, queryByText } = renderScreen(<SettingsScreen />);
    expect(queryByText('UPDATE EMAIL')).toBeNull();
    fireEvent.press(getByText('Email'));
    expect(getByText('UPDATE EMAIL')).toBeTruthy();
  });

  test('tapping Password row opens the change-password sheet', () => {
    const { getByText, queryByText } = renderScreen(<SettingsScreen />);
    expect(queryByText('UPDATE PASSWORD')).toBeNull();
    fireEvent.press(getByText('Password'));
    expect(getByText('UPDATE PASSWORD')).toBeTruthy();
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

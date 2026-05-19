// Integration tests for the sign-up screen (app/auth/sign-up.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SignUpScreen from '@/app/auth/sign-up';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
  (router.push as jest.Mock).mockClear();
});

// Helper: click any date in the birthdate calendar so the form
// passes the "Pick your birthdate" guard. Tests that aren't
// exercising the birthdate flow itself just need *some* selection.
function pickAnyBirthdate(host: ReturnType<typeof renderScreen>) {
  const { getByText, getAllByText } = host;
  // The picker trigger renders the placeholder when nothing is set.
  fireEvent.press(getByText('Pick your birthdate'));
  // Any in-range date cell will do — '15' is in every month and the
  // picker's `maxDate` is 18 years ago today, so the cell sits well
  // inside the bounds. Multiple '15's may exist (overflow cells);
  // press the first one we find.
  const cells = getAllByText('15');
  fireEvent.press(cells[0]);
}

describe('SignUpScreen', () => {
  test('renders the form chrome', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    expect(getByText('Create account')).toBeTruthy();
    expect(getByPlaceholderText('How should we call you?')).toBeTruthy();
    expect(getByPlaceholderText('Your email')).toBeTruthy();
    expect(getByPlaceholderText('At least 8 characters')).toBeTruthy();
    // Birthdate is now a picker, not a TextInput — its trigger shows
    // the placeholder until a date is selected.
    expect(getByText('Pick your birthdate')).toBeTruthy();
  });

  test('rejects submission without a display name', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('Your email'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    fireEvent.press(getByText('SIGN UP'));
    expect(useStore.getState().toasts.length).toBe(1);
    expect(useStore.getState().toasts[0].message).toMatch(/display name/i);
  });

  test('rejects passwords shorter than 8 chars', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('How should we call you?'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Your email'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'short');
    fireEvent.press(getByText('SIGN UP'));
    expect(useStore.getState().toasts.length).toBe(1);
    expect(useStore.getState().toasts[0].message).toMatch(/8 characters/i);
  });

  test('rejects submission without a birthdate', () => {
    const host = renderScreen(<SignUpScreen />);
    const { getByText, getByPlaceholderText } = host;
    fireEvent.changeText(getByPlaceholderText('How should we call you?'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Your email'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    fireEvent.press(getByText('SIGN UP'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].message).toMatch(/birthdate/i);
  });

  test('signs up successfully in mock mode and writes display name into me', async () => {
    const host = renderScreen(<SignUpScreen />);
    const { getByText, getByPlaceholderText } = host;
    fireEvent.changeText(getByPlaceholderText('How should we call you?'), 'Test User');
    fireEvent.changeText(getByPlaceholderText('Your email'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    pickAnyBirthdate(host);
    fireEvent.press(getByText('SIGN UP'));
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(useStore.getState().me.name).toBe('Test User');
  });

  test('Sign in link routes back to /auth/sign-in', () => {
    const { getByText } = renderScreen(<SignUpScreen />);
    fireEvent.press(getByText('Sign in'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-in');
  });
});

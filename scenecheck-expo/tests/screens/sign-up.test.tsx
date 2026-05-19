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

describe('SignUpScreen', () => {
  test('renders the form chrome', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    expect(getByText('Create account')).toBeTruthy();
    expect(getByPlaceholderText('you@uci.edu')).toBeTruthy();
    expect(getByPlaceholderText('At least 8 characters')).toBeTruthy();
    expect(getByPlaceholderText('YYYY-MM-DD')).toBeTruthy();
  });

  test('rejects passwords shorter than 8 chars', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('you@uci.edu'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'short');
    // SCButton uppercases its label.
    fireEvent.press(getByText('SIGN UP'));
    expect(useStore.getState().toasts.length).toBe(1);
    expect(useStore.getState().toasts[0].message).toMatch(/8 characters/i);
  });

  test('signs up successfully in mock mode', async () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignUpScreen />);
    fireEvent.changeText(getByPlaceholderText('you@uci.edu'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    fireEvent.press(getByText('SIGN UP'));
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  test('Sign in link routes back to /auth/sign-in', () => {
    const { getByText } = renderScreen(<SignUpScreen />);
    fireEvent.press(getByText('Sign in'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-in');
  });
});

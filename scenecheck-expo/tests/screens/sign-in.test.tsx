// Integration tests for the sign-in screen (app/auth/sign-in.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SignInScreen from '@/app/auth/sign-in';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
  (router.push as jest.Mock).mockClear();
});

describe('SignInScreen', () => {
  test('renders the welcome chrome', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignInScreen />);
    expect(getByText('Welcome back')).toBeTruthy();
    expect(getByPlaceholderText('Your email')).toBeTruthy();
    expect(getByPlaceholderText('••••••••')).toBeTruthy();
  });

  test('Sign in with empty fields shows an error toast', () => {
    const { getByText } = renderScreen(<SignInScreen />);
    // SCButton uppercases its label.
    fireEvent.press(getByText('SIGN IN'));
    expect(useStore.getState().toasts.length).toBe(1);
    expect(useStore.getState().toasts[0].kind).toBe('error');
  });

  test('Sign in with credentials replaces to /(tabs) in mock mode', async () => {
    const { getByPlaceholderText, getByText } = renderScreen(<SignInScreen />);
    fireEvent.changeText(getByPlaceholderText('Your email'), 'a@b.com');
    fireEvent.changeText(getByPlaceholderText('••••••••'), 'password');
    fireEvent.press(getByText('SIGN IN'));
    // api.signIn in mock mode resolves immediately; let microtasks flush.
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  test('"Create an account" link pushes /auth/sign-up', () => {
    const { getByText } = renderScreen(<SignInScreen />);
    fireEvent.press(getByText('Create an account'));
    expect(router.push).toHaveBeenCalledWith('/auth/sign-up');
  });

  test('the guest-skip link is gone (hard auth gate, Phase 1)', () => {
    const { queryByText } = renderScreen(<SignInScreen />);
    expect(queryByText(/SKIP — EXPLORE AS GUEST/)).toBeNull();
  });

  test('"Forgot password?" link routes to /auth/forgot-password', () => {
    const { getByText } = renderScreen(<SignInScreen />);
    fireEvent.press(getByText('Forgot password?'));
    expect(router.push).toHaveBeenCalledWith('/auth/forgot-password');
  });
});

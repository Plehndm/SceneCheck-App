// Integration tests for the sign-in screen (app/auth/sign-in.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SignInScreen from '@/app/auth/sign-in';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  resetStore();
  setRouteParams({});
  (router.replace as jest.Mock).mockClear();
  (router.push as jest.Mock).mockClear();
});

describe('SignInScreen', () => {
  test('renders the welcome chrome', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<SignInScreen />);
    expect(getByText('SceneCheck')).toBeTruthy();
    expect(getByPlaceholderText('Your email')).toBeTruthy();
    expect(getByPlaceholderText('Your password')).toBeTruthy();
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
    fireEvent.changeText(getByPlaceholderText('Your password'), 'password');
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

  test('?confirmEmail=1 query param shows the "Confirm your email" banner', () => {
    setRouteParams({ confirmEmail: '1' });
    const { getByText } = renderScreen(<SignInScreen />);
    expect(getByText('Confirm your email')).toBeTruthy();
    // Body copy explains what to do next.
    expect(getByText(/confirmation link/i)).toBeTruthy();
    // And exposes a resend button inline.
    expect(getByText('RESEND CONFIRMATION EMAIL')).toBeTruthy();
  });

  test('?email=… prefills the email field', () => {
    setRouteParams({ confirmEmail: '1', email: 'someone@example.com' });
    const { getByDisplayValue } = renderScreen(<SignInScreen />);
    expect(getByDisplayValue('someone@example.com')).toBeTruthy();
  });

  test('?confirmed=1 query param shows the "Email confirmed" success banner', () => {
    setRouteParams({ confirmed: '1' });
    const { getByText } = renderScreen(<SignInScreen />);
    expect(getByText('Email confirmed')).toBeTruthy();
    expect(getByText(/sign in now/i)).toBeTruthy();
  });

  test('no banner when no relevant query params are present', () => {
    setRouteParams({});
    const { queryByText } = renderScreen(<SignInScreen />);
    expect(queryByText('Confirm your email')).toBeNull();
    expect(queryByText('Email confirmed')).toBeNull();
  });

  test('dismissing the check-email banner removes it', () => {
    setRouteParams({ confirmEmail: '1' });
    const { getByText, queryByText, getByLabelText } = renderScreen(<SignInScreen />);
    expect(getByText('Confirm your email')).toBeTruthy();
    fireEvent.press(getByLabelText('Dismiss'));
    expect(queryByText('Confirm your email')).toBeNull();
  });
});

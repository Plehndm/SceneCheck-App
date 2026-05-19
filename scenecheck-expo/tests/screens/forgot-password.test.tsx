// Integration tests for /auth/forgot-password.

import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ForgotPasswordScreen from '@/app/auth/forgot-password';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
});

describe('ForgotPasswordScreen', () => {
  test('renders chrome with email field', () => {
    const { getByText, getByPlaceholderText } = renderScreen(<ForgotPasswordScreen />);
    expect(getByText('Reset password')).toBeTruthy();
    expect(getByPlaceholderText('Your email')).toBeTruthy();
  });

  test('rejects empty email submission with an error toast', () => {
    const { getByText } = renderScreen(<ForgotPasswordScreen />);
    fireEvent.press(getByText('SEND RECOVERY EMAIL'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
  });

  test('happy path: success toast + sent state replaces CTA', async () => {
    const { getByText, getByPlaceholderText, queryByPlaceholderText } = renderScreen(<ForgotPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('Your email'), 'someone@example.com');
    await act(async () => {
      fireEvent.press(getByText('SEND RECOVERY EMAIL'));
    });
    const toasts = useStore.getState().toasts;
    expect(toasts.some(t => t.kind === 'success' && /recovery/i.test(t.message))).toBe(true);
    // After send, the email input is replaced by the confirmation copy.
    expect(queryByPlaceholderText('Your email')).toBeNull();
    expect(getByText('BACK TO SIGN IN')).toBeTruthy();
  });
});

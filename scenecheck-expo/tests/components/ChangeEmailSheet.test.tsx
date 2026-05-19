// Component tests for `ChangeEmailSheet`. Four cases:
//   1. Invisible until visible=true (the EDIT EMAIL header lives in
//      the modal body).
//   2. SEND CONFIRMATIONS with an empty / whitespace email errors
//      out + doesn't call onClose.
//   3. SEND CONFIRMATIONS with the same address as the current
//      session email errors out.
//   4. Happy path: a new address triggers an info toast (the
//      "check both inboxes" copy) and closes via onClose.
//
// `api.updateEmail` in mock mode returns `{ ok: true }` so the
// success path is deterministic.

import { fireEvent } from '@testing-library/react-native';
import { ChangeEmailSheet } from '@/components/ChangeEmailSheet';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('ChangeEmailSheet', () => {
  test('renders nothing visible when visible=false', () => {
    const { queryByText } = renderScreen(
      <ChangeEmailSheet visible={false} onClose={() => {}} />,
    );
    expect(queryByText('CHANGE EMAIL')).toBeNull();
  });

  test('rejects an empty email with an error toast', () => {
    const onClose = jest.fn();
    const { getByText } = renderScreen(
      <ChangeEmailSheet visible onClose={onClose} />,
    );
    fireEvent.press(getByText('SEND CONFIRMATIONS'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('rejects entering the same email as the current session', () => {
    // resetStore sets session.email to 'me@scenecheck.test'.
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <ChangeEmailSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('Your new email'), 'ME@SCENECHECK.TEST');
    fireEvent.press(getByText('SEND CONFIRMATIONS'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].message).toMatch(/already your email/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('happy path: toasts the info message and closes', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <ChangeEmailSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('Your new email'), 'new@example.com');
    fireEvent.press(getByText('SEND CONFIRMATIONS'));
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    const toasts = useStore.getState().toasts;
    expect(toasts.some(t => /both/i.test(t.message))).toBe(true);
  });
});

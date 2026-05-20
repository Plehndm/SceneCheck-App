// Component tests for `ChangeEmailSheet`. Four cases:
//   1. Invisible until visible=true (the CHANGE EMAIL header lives
//      in the modal body).
//   2. UPDATE EMAIL with an empty / whitespace email errors out +
//      doesn't call onClose.
//   3. UPDATE EMAIL with the same address as the current session
//      email errors out.
//   4. Happy path: a new address triggers an "Email updated"
//      success toast and closes via onClose.
//
// Email confirmation is OFF on the hosted project (PROGRESS_SNAPSHOT
// §21), so the sheet promises an immediate change rather than the
// old double-inbox confirmation flow. `api.updateEmail` in mock
// mode returns `{ ok: true }` so the success path is deterministic.

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
    fireEvent.press(getByText('UPDATE EMAIL'));
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
    fireEvent.press(getByText('UPDATE EMAIL'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].message).toMatch(/already your email/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('happy path: toasts "Email updated" and closes', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <ChangeEmailSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('Your new email'), 'new@example.com');
    fireEvent.press(getByText('UPDATE EMAIL'));
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    const toasts = useStore.getState().toasts;
    expect(toasts.some(t => /updated/i.test(t.message))).toBe(true);
  });
});

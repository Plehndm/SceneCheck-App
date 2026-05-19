// Component tests for `ChangePasswordSheet`. Four cases:
//   1. Invisible until visible=true.
//   2. Empty password errors out.
//   3. Mismatch between new + confirm errors out.
//   4. Happy path: matching 8+ char password toasts success +
//      closes.

import { fireEvent } from '@testing-library/react-native';
import { ChangePasswordSheet } from '@/components/ChangePasswordSheet';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('ChangePasswordSheet', () => {
  test('renders nothing visible when visible=false', () => {
    const { queryByText } = renderScreen(
      <ChangePasswordSheet visible={false} onClose={() => {}} />,
    );
    expect(queryByText('CHANGE PASSWORD')).toBeNull();
  });

  test('rejects an empty password', () => {
    const onClose = jest.fn();
    const { getByText } = renderScreen(
      <ChangePasswordSheet visible onClose={onClose} />,
    );
    fireEvent.press(getByText('UPDATE PASSWORD'));
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(onClose).not.toHaveBeenCalled();
  });

  test('rejects a confirm mismatch', () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <ChangePasswordSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    fireEvent.changeText(getByPlaceholderText('Repeat the password'), 'differentpw1');
    fireEvent.press(getByText('UPDATE PASSWORD'));
    const toasts = useStore.getState().toasts;
    expect(toasts[0].message).toMatch(/don't match/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('happy path: toasts success and closes', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <ChangePasswordSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenoughpw');
    fireEvent.changeText(getByPlaceholderText('Repeat the password'), 'longenoughpw');
    fireEvent.press(getByText('UPDATE PASSWORD'));
    await Promise.resolve();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalled();
    const toasts = useStore.getState().toasts;
    expect(toasts.some(t => /updated/i.test(t.message))).toBe(true);
  });
});

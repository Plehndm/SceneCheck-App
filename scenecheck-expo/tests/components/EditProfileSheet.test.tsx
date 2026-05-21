// Component tests for the EditProfileSheet (`EditProfileSheet.tsx`).
// Four cases:
//   1. Sheet body is not rendered when `visible` is false.
//   2. Pre-fills the input with the current display name.
//   3. SAVE CHANGES writes the patch into `me`, emits a success toast,
//      and calls onClose.
//   4. Empty / whitespace-only name produces an error toast and
//      does NOT mutate `me`.

import { fireEvent } from '@testing-library/react-native';
import { EditProfileSheet } from '@/components/EditProfileSheet';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';

beforeEach(() => resetStore());

describe('EditProfileSheet', () => {
  test('renders nothing visible when visible=false', () => {
    const { queryByText } = renderScreen(
      <EditProfileSheet visible={false} onClose={() => {}} />,
    );
    expect(queryByText('EDIT PROFILE')).toBeNull();
  });

  test('pre-fills the input with the current display name', () => {
    const { getByDisplayValue } = renderScreen(
      <EditProfileSheet visible onClose={() => {}} />,
    );
    expect(getByDisplayValue(SC_ME.name)).toBeTruthy();
  });

  test('SAVE CHANGES writes the new name into me + emits a toast + closes', async () => {
    const onClose = jest.fn();
    const { getByText, getByDisplayValue } = renderScreen(
      <EditProfileSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByDisplayValue(SC_ME.name), 'New Name');
    fireEvent.press(getByText('SAVE CHANGES'));
    await Promise.resolve();
    expect(useStore.getState().me.name).toBe('New Name');
    expect(useStore.getState().toasts.some(t => /updated/i.test(t.message))).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  test('editing the bio saves it into me', async () => {
    const onClose = jest.fn();
    const { getByText, getByPlaceholderText } = renderScreen(
      <EditProfileSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByPlaceholderText('A line about you'), 'Updated bio line');
    fireEvent.press(getByText('SAVE CHANGES'));
    await Promise.resolve();
    expect(useStore.getState().me.bio).toBe('Updated bio line');
    expect(onClose).toHaveBeenCalled();
  });

  test('empty name produces an error toast + does not mutate me', () => {
    const onClose = jest.fn();
    const { getByText, getByDisplayValue } = renderScreen(
      <EditProfileSheet visible onClose={onClose} />,
    );
    fireEvent.changeText(getByDisplayValue(SC_ME.name), '   ');
    fireEvent.press(getByText('SAVE CHANGES'));
    expect(useStore.getState().me.name).toBe(SC_ME.name);
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('error');
    expect(toasts[0].message).toMatch(/display name/i);
    expect(onClose).not.toHaveBeenCalled();
  });
});

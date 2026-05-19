// Component tests for the host-only edit sheet (`EditEventSheet.tsx`).
// Three things matter at the unit level:
//   1. The sheet pre-fills its fields from the event prop.
//   2. SAVE CHANGES writes the patch via `applyEventOverride` AND emits
//      the legacy "Saved · attendees notified" success toast.
//   3. CANCEL closes via the `onClose` callback without mutating state.

import { fireEvent } from '@testing-library/react-native';
import { EditEventSheet } from '@/components/EditEventSheet';
import { renderScreen, resetStore } from '../test-utils';
import { SC_EVENT_BY_ID } from '@/data/mocks';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('EditEventSheet', () => {
  test('renders nothing visible when `visible` is false', () => {
    const event = SC_EVENT_BY_ID.e1;
    const { queryByText } = renderScreen(
      <EditEventSheet visible={false} event={event} onClose={() => {}} />,
    );
    // Headline label only rendered inside the modal body.
    expect(queryByText('EDIT EVENT')).toBeNull();
  });

  test('pre-fills title + capacity from the event when opened', () => {
    const event = SC_EVENT_BY_ID.e1;
    const { getByDisplayValue, getByText } = renderScreen(
      <EditEventSheet visible event={event} onClose={() => {}} />,
    );
    expect(getByDisplayValue(event.title)).toBeTruthy();
    expect(getByText(`Capacity · ${event.cap}`)).toBeTruthy();
  });

  test('SAVE CHANGES writes the patch via applyEventOverride + emits toast', () => {
    const event = SC_EVENT_BY_ID.e1;
    const onClose = jest.fn();
    const { getByText, getByDisplayValue } = renderScreen(
      <EditEventSheet visible event={event} onClose={onClose} />,
    );
    // Edit the title field.
    fireEvent.changeText(getByDisplayValue(event.title), 'Updated title');
    fireEvent.press(getByText('SAVE CHANGES'));

    const override = useStore.getState().eventOverrides[event.id];
    expect(override).toBeTruthy();
    expect(override.title).toBe('Updated title');
    expect(override.cap).toBe(event.cap);

    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].kind).toBe('success');
    expect(toasts[0].message).toMatch(/attendees notified/i);

    expect(onClose).toHaveBeenCalled();
  });

  test('CANCEL closes via onClose without applying any override', () => {
    const event = SC_EVENT_BY_ID.e1;
    const onClose = jest.fn();
    const { getByText } = renderScreen(
      <EditEventSheet visible event={event} onClose={onClose} />,
    );
    fireEvent.press(getByText('CANCEL'));
    expect(onClose).toHaveBeenCalled();
    expect(useStore.getState().eventOverrides[event.id]).toBeUndefined();
  });
});

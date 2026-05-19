// Integration tests for the event detail screen (app/event/[id].tsx).
// Covers happy-path render, host-only actions, the join/leave toggle,
// and the "event is gone" fallback when the id is unknown.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import EventDetailScreen from '@/app/event/[id]';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { SC_EVENT_BY_ID } from '@/data/mocks';
import { useStore } from '@/store/useStore';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
  (router.back as jest.Mock).mockClear();
});

describe('EventDetailScreen', () => {
  test('renders the title and description for a known event', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    const e = SC_EVENT_BY_ID.e1;
    expect(getByText(e.title)).toBeTruthy();
    if (e.desc) expect(getByText(e.desc)).toBeTruthy();
  });

  test('renders the YOUR EVENT label for events the user hosts', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    expect(getByText('YOUR EVENT')).toBeTruthy();
  });

  test('renders FRIEND HOSTING label for a friend-hosted event', () => {
    setRouteParams({ id: 'e2' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    expect(getByText('FRIEND HOSTING')).toBeTruthy();
  });

  test('renders host edit / cancel buttons only on hosted events', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    expect(getByText('EDIT EVENT')).toBeTruthy();
    expect(getByText('CANCEL EVENT')).toBeTruthy();
  });

  test('hides host actions on non-hosted events', () => {
    setRouteParams({ id: 'e2' });
    const { queryByText } = renderScreen(<EventDetailScreen />);
    expect(queryByText('EDIT EVENT')).toBeNull();
    expect(queryByText('CANCEL EVENT')).toBeNull();
  });

  test('tapping JOIN on an unjoined event adds it to the joined set', () => {
    // e2 is a friend event, not pre-joined.
    setRouteParams({ id: 'e2' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    fireEvent.press(getByText('JOIN EVENT'));
    expect(useStore.getState().joined.has('e2')).toBe(true);
  });

  test('tapping the JOINED button schedules pendingLeave with undo toast', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    fireEvent.press(getByText('JOINED'));
    expect(useStore.getState().pendingLeave.has('e1')).toBe(true);
    expect(useStore.getState().toasts.length).toBe(1);
    expect(useStore.getState().toasts[0].action?.label).toBe('UNDO');
  });

  test('renders the "event is gone" fallback for unknown ids', () => {
    setRouteParams({ id: 'DOES_NOT_EXIST' });
    const { getByText } = renderScreen(<EventDetailScreen />);
    expect(getByText('This event is gone')).toBeTruthy();
  });
});

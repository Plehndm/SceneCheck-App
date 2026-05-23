// Integration tests for the joined-events list (app/my-events.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import MyEventsScreen from '@/app/my-events';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_EVENT_BY_ID } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('MyEventsScreen', () => {
  test('lists the events in the joined set', () => {
    // resetStore seeds joined = { 'e1' }.
    const { getByText } = renderScreen(<MyEventsScreen />);
    expect(getByText(/Events you.ve joined/)).toBeTruthy();
    expect(getByText(SC_EVENT_BY_ID.e1.title)).toBeTruthy();
  });

  test('tapping an event opens its detail', () => {
    const { getByText } = renderScreen(<MyEventsScreen />);
    fireEvent.press(getByText(SC_EVENT_BY_ID.e1.title));
    expect(router.push).toHaveBeenCalledWith('/event/e1');
  });

  test('shows the empty state when nothing is joined', () => {
    useStore.setState({ joined: new Set() });
    const { getByText } = renderScreen(<MyEventsScreen />);
    expect(getByText('No events yet')).toBeTruthy();
  });
});

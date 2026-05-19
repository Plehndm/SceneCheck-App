// Integration tests for the events list screen (app/events.tsx).
// Filter chips switch between ALL / YOURS / FRIENDS / FOR YOU.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import EventsScreen from '@/app/events';
import { renderScreen, resetStore } from '../test-utils';
import { SC_EVENTS } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('EventsListScreen', () => {
  test('renders the headline with total event count', () => {
    const { getByText } = renderScreen(<EventsScreen />);
    expect(getByText('Events nearby')).toBeTruthy();
    expect(getByText(new RegExp(`${SC_EVENTS.length} events`, 'i'))).toBeTruthy();
  });

  test('renders all filter chips', () => {
    const { getByText } = renderScreen(<EventsScreen />);
    expect(getByText(`ALL · ${SC_EVENTS.length}`)).toBeTruthy();
    const yoursCount = SC_EVENTS.filter(e => e.kind === 'yours').length;
    expect(getByText(`YOURS · ${yoursCount}`)).toBeTruthy();
  });

  test('renders every event row by title in the ALL filter', () => {
    const { getByText } = renderScreen(<EventsScreen />);
    SC_EVENTS.forEach(e => expect(getByText(e.title)).toBeTruthy());
  });

  test('switching to YOURS filter narrows the list', () => {
    const yours = SC_EVENTS.filter(e => e.kind === 'yours');
    const others = SC_EVENTS.filter(e => e.kind !== 'yours');
    const { getByText, queryByText } = renderScreen(<EventsScreen />);
    fireEvent.press(getByText(`YOURS · ${yours.length}`));
    yours.forEach(e => expect(getByText(e.title)).toBeTruthy());
    // At least one non-yours event should now be hidden.
    if (others.length > 0) {
      expect(queryByText(others[0].title)).toBeNull();
    }
  });

  test('tapping an event row navigates to /event/<id>', () => {
    const { getByText } = renderScreen(<EventsScreen />);
    fireEvent.press(getByText(SC_EVENTS[0].title));
    expect(router.push).toHaveBeenCalledWith(`/event/${SC_EVENTS[0].id}`);
  });
});

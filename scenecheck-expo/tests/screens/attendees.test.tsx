// Integration tests for the event attendees list (app/attendees/[id].tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import AttendeesScreen from '@/app/attendees/[id]';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { SC_VISIBLE_PEOPLE, SC_EVENT_BY_ID } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('AttendeesScreen', () => {
  test('renders the event subtitle for a known event', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<AttendeesScreen />);
    expect(getByText(SC_EVENT_BY_ID.e1.title.toUpperCase())).toBeTruthy();
    expect(getByText('Attendees')).toBeTruthy();
  });

  test('renders one row per visible person', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<AttendeesScreen />);
    SC_VISIBLE_PEOPLE.forEach(p => expect(getByText(p.name)).toBeTruthy());
  });

  test('tapping a person row navigates to /profile/<id>', () => {
    setRouteParams({ id: 'e1' });
    const { getByText } = renderScreen(<AttendeesScreen />);
    fireEvent.press(getByText(SC_VISIBLE_PEOPLE[0].name));
    expect(router.push).toHaveBeenCalledWith(`/profile/${SC_VISIBLE_PEOPLE[0].id}`);
  });

  test('renders fallback for unknown event id', () => {
    setRouteParams({ id: 'DOES_NOT_EXIST' });
    const { getByText } = renderScreen(<AttendeesScreen />);
    expect(getByText('Event not found.')).toBeTruthy();
  });
});

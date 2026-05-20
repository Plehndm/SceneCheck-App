// Integration tests for the Home tab (app/(tabs)/index.tsx).
// The screen renders the date header, the map preview card, an
// "Happening near you" rail of event cards, and a "People nearby" list.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import HomeScreen from '@/app/(tabs)/index';
import { renderScreen, resetStore } from '../test-utils';
import { SC_EVENTS, SC_VISIBLE_PEOPLE } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('HomeScreen', () => {
  test('renders the dynamic date header + headline', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    // Date is now `fmtDate(new Date())` ("Tue May 20"); the city is
    // appended only when location resolves (the jest geocode mock
    // returns [], so just the date shows). Assert the date shape.
    // End-anchored so it matches the bare header date ("Wed May 20")
    // and NOT the event-card "when" strings that carry a time suffix
    // ("Sat May 9 · 7:00 AM"). City is null under the jest geocode
    // mock, so the header has no " · City" suffix.
    expect(
      getByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/),
    ).toBeTruthy();
    expect(getByText(/What's the/)).toBeTruthy();
  });

  test('renders the LIVE chip with event count', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    expect(getByText(`LIVE · ${SC_EVENTS.length} EVENTS NEARBY`)).toBeTruthy();
  });

  test('renders the HAPPENING NEAR YOU section header', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    expect(getByText('HAPPENING NEAR YOU')).toBeTruthy();
    expect(getByText('SEE ALL →')).toBeTruthy();
  });

  test('renders the first 5 event cards by title', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    SC_EVENTS.slice(0, 5).forEach(e => {
      expect(getByText(e.title)).toBeTruthy();
    });
  });

  test('renders PEOPLE NEARBY section with the first 4 visible people', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    expect(getByText('PEOPLE NEARBY')).toBeTruthy();
    SC_VISIBLE_PEOPLE.slice(0, 4).forEach(p => {
      expect(getByText(p.name)).toBeTruthy();
    });
  });

  test('SEE ALL → action pushes /events', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    fireEvent.press(getByText('SEE ALL →'));
    expect(router.push).toHaveBeenCalledWith('/events');
  });

  test('tapping an event card navigates to /event/<id>', () => {
    const { getByText } = renderScreen(<HomeScreen />);
    fireEvent.press(getByText(SC_EVENTS[0].title));
    expect(router.push).toHaveBeenCalledWith(`/event/${SC_EVENTS[0].id}`);
  });

  test('+ button (a11y label "Create a new event") routes to /create-event', () => {
    const { getByLabelText } = renderScreen(<HomeScreen />);
    fireEvent.press(getByLabelText('Create a new event'));
    expect(router.push).toHaveBeenCalledWith('/create-event');
  });
});

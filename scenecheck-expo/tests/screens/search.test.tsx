// Integration tests for the global search screen (app/search.tsx).
// Tabs switch between events / people / orgs. The slider input field
// filters all three.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import SearchScreen from '@/app/search';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { SC_EVENTS, SC_VISIBLE_PEOPLE, SC_ORGS } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  setRouteParams({}); // default: no ?tab= → the ALL feed
  (router.push as jest.Mock).mockClear();
});

describe('SearchScreen', () => {
  test('renders all three filter tabs', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    expect(getByText(/EVENTS · \d+/)).toBeTruthy();
    expect(getByText(/PEOPLE · \d+/)).toBeTruthy();
    expect(getByText(/ORGS · \d+/)).toBeTruthy();
  });

  test('events tab renders event titles by default', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    // Default to first 6 events.
    expect(getByText(SC_EVENTS[0].title)).toBeTruthy();
  });

  test('typing a query narrows the events list to matches', () => {
    const { getByPlaceholderText, queryByText } = renderScreen(<SearchScreen />);
    fireEvent.changeText(getByPlaceholderText('Search events, people, orgs…'), 'climbing');
    // Climbing-tagged events should still show; cooking should not.
    expect(queryByText(SC_EVENTS.find(e => e.id === 'e3')?.title ?? '')).toBeTruthy();
    expect(queryByText(SC_EVENTS.find(e => e.id === 'e2')?.title ?? '')).toBeNull();
  });

  test('switching to PEOPLE tab renders people rows', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    fireEvent.press(getByText(/PEOPLE · \d+/));
    expect(getByText(SC_VISIBLE_PEOPLE[0].name)).toBeTruthy();
  });

  test('switching to ORGS tab renders org names', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    fireEvent.press(getByText(/ORGS · \d+/));
    expect(getByText(SC_ORGS[0].name)).toBeTruthy();
  });

  test('tapping an event result pushes /event/<id>', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    fireEvent.press(getByText(SC_EVENTS[0].title));
    expect(router.push).toHaveBeenCalledWith(`/event/${SC_EVENTS[0].id}`);
  });

  test('the default ALL tab shows events, people, and orgs together', () => {
    const { getByText } = renderScreen(<SearchScreen />);
    expect(getByText(/ALL · \d+/)).toBeTruthy();
    expect(getByText(SC_EVENTS[0].title)).toBeTruthy();
    expect(getByText(SC_VISIBLE_PEOPLE[0].name)).toBeTruthy();
    expect(getByText(SC_ORGS[0].name)).toBeTruthy();
  });

  test('?tab=orgs auto-selects the orgs filter (events hidden)', () => {
    setRouteParams({ tab: 'orgs' });
    const { getByText, queryByText } = renderScreen(<SearchScreen />);
    expect(getByText(SC_ORGS[0].name)).toBeTruthy();
    expect(queryByText(SC_EVENTS[0].title)).toBeNull();
  });

  test('?tab=people auto-selects the people filter (orgs hidden)', () => {
    setRouteParams({ tab: 'people' });
    const { getByText, queryByText } = renderScreen(<SearchScreen />);
    expect(getByText(SC_VISIBLE_PEOPLE[0].name)).toBeTruthy();
    expect(queryByText(SC_ORGS[0].name)).toBeNull();
  });
});

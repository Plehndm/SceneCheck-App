// Integration tests for "Events I'm hosting" (app/my-hosting.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import MyHostingScreen from '@/app/my-hosting';
import { renderScreen, resetStore } from '../test-utils';
import { SC_EVENTS } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('MyHostingScreen', () => {
  test('renders the headline', () => {
    const { getByText } = renderScreen(<MyHostingScreen />);
    expect(getByText("Events I'm hosting")).toBeTruthy();
  });

  test('renders rows for events with hostId="me"', () => {
    const myEvents = SC_EVENTS.filter(e => e.hostId === 'me');
    const { getByText } = renderScreen(<MyHostingScreen />);
    myEvents.forEach(e => expect(getByText(e.title)).toBeTruthy());
  });

  test('tapping a row navigates to /event/<id>', () => {
    const myEvents = SC_EVENTS.filter(e => e.hostId === 'me');
    if (myEvents.length === 0) return;
    const { getByText } = renderScreen(<MyHostingScreen />);
    fireEvent.press(getByText(myEvents[0].title));
    expect(router.push).toHaveBeenCalledWith(`/event/${myEvents[0].id}`);
  });
});

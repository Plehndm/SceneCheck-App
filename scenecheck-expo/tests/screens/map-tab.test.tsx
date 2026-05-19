// Integration tests for the Map tab (app/(tabs)/map.tsx).
// The actual Map component is mocked (native — react-native-maps is
// stubbed in jest.setup; on web that file lives behind .web.tsx).
// We just verify the surrounding chrome renders and the radius
// chips work.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import MapTab from '@/app/(tabs)/map';
import { renderScreen, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('MapTab', () => {
  test('renders the date label and "Map" headline', () => {
    const { getByText } = renderScreen(<MapTab />);
    // The date string is now built from `fmtDate(new Date())` (round-2
    // code-review fix) — assert on the trailing constant instead of a
    // frozen May-9 literal.
    expect(getByText(/· Irvine$/)).toBeTruthy();
    expect(getByText('Map')).toBeTruthy();
  });

  test('renders all 4 radius chips (1/3/5/10 mi)', () => {
    const { getByText } = renderScreen(<MapTab />);
    expect(getByText('1 MI')).toBeTruthy();
    expect(getByText('3 MI')).toBeTruthy();
    expect(getByText('5 MI')).toBeTruthy();
    expect(getByText('10 MI')).toBeTruthy();
  });

  test('renders the legend by default (no focused event)', () => {
    const { getByText } = renderScreen(<MapTab />);
    expect(getByText('Key')).toBeTruthy();
    expect(getByText('Your events')).toBeTruthy();
    expect(getByText('Friends')).toBeTruthy();
    expect(getByText('Recommended')).toBeTruthy();
  });

  test('tapping a radius chip does not crash', () => {
    const { getByText } = renderScreen(<MapTab />);
    fireEvent.press(getByText('10 MI'));
    // Component remains mounted.
    expect(getByText('Map')).toBeTruthy();
  });

  test('+ button (a11y label "Create a new event") routes to /create-event', () => {
    const { getByLabelText } = renderScreen(<MapTab />);
    fireEvent.press(getByLabelText('Create a new event'));
    expect(router.push).toHaveBeenCalledWith('/create-event');
  });
});

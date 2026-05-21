// Integration tests for the Map tab (app/(tabs)/map.tsx).
// The actual Map component is mocked (native — react-native-maps is
// stubbed in jest.setup; on web that file lives behind .web.tsx).
// We just verify the surrounding chrome renders and the radius
// chips work.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import MapTab from '@/app/(tabs)/map';
import { useStore } from '@/store/useStore';
import { renderScreen, resetStore } from '../test-utils';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('MapTab', () => {
  test('renders the date label and "Map" headline', () => {
    const { getByText } = renderScreen(<MapTab />);
    // The label is now `useDateCityLabel()` — live date, plus a
    // reverse-geocoded city when location resolves. The jest geocode
    // mock returns [], so just the date shows; assert its shape.
    expect(
      getByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}$/),
    ).toBeTruthy();
    expect(getByText('Map')).toBeTruthy();
  });

  test('renders the radius preset chips (1/3/5/10/25/50 mi)', () => {
    const { getByText } = renderScreen(<MapTab />);
    for (const mi of [1, 3, 5, 10, 25, 50]) {
      expect(getByText(`${mi} MI`)).toBeTruthy();
    }
  });

  test('renders the legend by default (no focused event)', () => {
    const { getByText } = renderScreen(<MapTab />);
    expect(getByText('Key')).toBeTruthy();
    expect(getByText('Your events')).toBeTruthy();
    expect(getByText('Friends')).toBeTruthy();
    expect(getByText('Recommended')).toBeTruthy();
  });

  test('tapping a radius chip writes the persisted store radius (miles)', () => {
    // resetStore seeds radius=5; tapping 10 MI updates the shared store
    // value that Settings reads and that survives reloads via persist.
    expect(useStore.getState().radius).toBe(5);
    const { getByText } = renderScreen(<MapTab />);
    fireEvent.press(getByText('10 MI'));
    expect(useStore.getState().radius).toBe(10);
  });

  test('a non-preset (custom) radius surfaces the Custom button with its value', () => {
    resetStore({ radius: 7.5 }); // off the preset list → custom
    const { getByText, queryByText } = renderScreen(<MapTab />);
    expect(getByText('CUSTOM · 7.5 MI')).toBeTruthy();
    // No preset chip should be styled active (none equals 7.5) — the
    // chips still render, but the custom button is the live indicator.
    expect(queryByText('5 MI')).toBeTruthy();
  });

  test('no Custom button when the radius matches a preset', () => {
    resetStore({ radius: 5 });
    const { queryByText } = renderScreen(<MapTab />);
    expect(queryByText(/^CUSTOM/)).toBeNull();
  });

  test('pressing the Custom button routes to /settings', () => {
    resetStore({ radius: 7.5 });
    const { getByText } = renderScreen(<MapTab />);
    fireEvent.press(getByText('CUSTOM · 7.5 MI'));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  test('+ button (a11y label "Create a new event") routes to /create-event', () => {
    const { getByLabelText } = renderScreen(<MapTab />);
    fireEvent.press(getByLabelText('Create a new event'));
    expect(router.push).toHaveBeenCalledWith('/create-event');
  });
});

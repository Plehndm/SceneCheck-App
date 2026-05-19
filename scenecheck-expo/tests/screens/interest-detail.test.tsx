// Integration tests for an interest detail (app/interests/[tag].tsx).

import { fireEvent } from '@testing-library/react-native';
import InterestDetailScreen from '@/app/interests/[tag]';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_INTERESTS_DETAILS } from '@/data/mocks';

beforeEach(() => resetStore());

describe('InterestDetailScreen', () => {
  test('renders the tag name, count, and description for a known tag', () => {
    setRouteParams({ tag: 'biking' });
    const { getByText } = renderScreen(<InterestDetailScreen />);
    const i = SC_INTERESTS_DETAILS.biking;
    expect(getByText('biking')).toBeTruthy();
    expect(getByText(i.desc)).toBeTruthy();
  });

  test('falls back to a stub for unknown tags', () => {
    setRouteParams({ tag: 'something-new' });
    const { getByText } = renderScreen(<InterestDetailScreen />);
    expect(getByText('something-new')).toBeTruthy();
    expect(getByText('A user-created interest tag.')).toBeTruthy();
  });

  test('tapping the JOINED button on a subscribed tag unsubscribes it', () => {
    setRouteParams({ tag: 'biking' });
    expect(useStore.getState().subscribedInterests.has('biking')).toBe(true);
    const { getByText } = renderScreen(<InterestDetailScreen />);
    fireEvent.press(getByText('JOINED'));
    expect(useStore.getState().subscribedInterests.has('biking')).toBe(false);
  });

  test('tapping ADD on a new tag subscribes it', () => {
    setRouteParams({ tag: 'cooking' });
    expect(useStore.getState().subscribedInterests.has('cooking')).toBe(false);
    const { getByText } = renderScreen(<InterestDetailScreen />);
    fireEvent.press(getByText('ADD'));
    expect(useStore.getState().subscribedInterests.has('cooking')).toBe(true);
  });
});

// Integration tests for the event-published success screen
// (app/event-published.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import EventPublishedScreen from '@/app/event-published';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
});

describe('EventPublishedScreen', () => {
  test('renders the success headline + title param', () => {
    setRouteParams({ eventId: 'e1', title: 'Test Event' });
    const { getByText } = renderScreen(<EventPublishedScreen />);
    expect(getByText("You're live!")).toBeTruthy();
    expect(getByText('Test Event')).toBeTruthy();
  });

  test('Home button replaces to /(tabs)', () => {
    setRouteParams({ eventId: 'e1', title: 'Test Event' });
    const { getByText } = renderScreen(<EventPublishedScreen />);
    fireEvent.press(getByText('HOME'));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  test('View event button replaces to /event/<id>', () => {
    setRouteParams({ eventId: 'e7', title: 'Test Event' });
    const { getByText } = renderScreen(<EventPublishedScreen />);
    fireEvent.press(getByText('VIEW EVENT'));
    expect(router.replace).toHaveBeenCalledWith('/event/e7');
  });
});

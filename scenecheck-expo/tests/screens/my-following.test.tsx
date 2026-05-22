// Integration tests for the orgs-you-follow list (app/my-following.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import MyFollowingScreen from '@/app/my-following';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_ORGS } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('MyFollowingScreen', () => {
  test('renders rows for orgs in the following set', () => {
    const orgs = SC_ORGS.filter(o => useStore.getState().following.has(o.id));
    const { getByText } = renderScreen(<MyFollowingScreen />);
    orgs.forEach(o => expect(getByText(o.name)).toBeTruthy());
  });

  test('renders the empty state when not following anyone', () => {
    useStore.setState({ following: new Set() });
    const { getByText } = renderScreen(<MyFollowingScreen />);
    expect(getByText('Not following anyone yet')).toBeTruthy();
  });

  test('"Browse orgs" opens search with the orgs filter pre-selected', () => {
    useStore.setState({ following: new Set() });
    const { getByText } = renderScreen(<MyFollowingScreen />);
    fireEvent.press(getByText('BROWSE ORGS')); // SCButton uppercases its label
    expect(router.push).toHaveBeenCalledWith('/search?tab=orgs');
  });

  test('tapping a row navigates to that org profile', () => {
    const orgs = SC_ORGS.filter(o => useStore.getState().following.has(o.id));
    if (orgs.length === 0) return;
    const { getByText } = renderScreen(<MyFollowingScreen />);
    fireEvent.press(getByText(orgs[0].name));
    expect(router.push).toHaveBeenCalledWith(`/profile/${orgs[0].id}`);
  });

  test('tapping FOLLOWING removes the org from the following set', () => {
    const orgs = SC_ORGS.filter(o => useStore.getState().following.has(o.id));
    if (orgs.length === 0) return;
    // The SCTopBar subtitle "FOLLOWING" also matches — use [1] to skip
    // it and press the first row button. Order: [0]=subtitle, [1]=row1.
    const { getAllByText } = renderScreen(<MyFollowingScreen />);
    fireEvent.press(getAllByText('FOLLOWING')[1]);
    expect(useStore.getState().following.has(orgs[0].id)).toBe(false);
  });
});

// Integration tests for the other-account profile (app/profile/[id].tsx).
// One file covers both the person branch (friend/message + safety
// actions) and the org branch (follow + stats + events).

import { fireEvent } from '@testing-library/react-native';
import OtherProfileScreen from '@/app/profile/[id]';
import { renderScreen, resetStore, setRouteParams } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_ACCOUNT_BY_ID } from '@/data/mocks';

beforeEach(() => resetStore());

describe('OtherProfileScreen — person', () => {
  test('renders name, handle, and bio', () => {
    setRouteParams({ id: 'p2' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    const p = SC_ACCOUNT_BY_ID.p2;
    expect(getByText(p.name)).toBeTruthy();
    if (p.bio) expect(getByText(p.bio)).toBeTruthy();
  });

  test('shows MESSAGE button and safety actions on people', () => {
    setRouteParams({ id: 'p2' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('MESSAGE')).toBeTruthy();
    expect(getByText(/Block /)).toBeTruthy();
    expect(getByText('Report account')).toBeTruthy();
  });

  test('tapping ADD on a public stranger adds them as a friend', () => {
    // p4 (Theo) is private — would show REQUEST. p6 has blockedYou so unavailable.
    // Use a non-friend public person. Existing fixtures: p2 is private,
    // p1 already a friend. Find someone public who isn't already a friend.
    setRouteParams({ id: 'p3' });
    // p3 (Sasha) is already in friends — would render FRIENDS instead of ADD.
    // Remove from friends first:
    useStore.setState({ friends: new Set(['p1', 'p5']) });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    fireEvent.press(getByText('ADD'));
    expect(useStore.getState().friends.has('p3')).toBe(true);
  });

  test('renders the unavailable stub for users who blocked you', () => {
    // p6 has blockedYou: true so SC_VISIBLE_PERSON_BY_ID excludes them.
    setRouteParams({ id: 'p6' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('Profile unavailable')).toBeTruthy();
  });
});

describe('OtherProfileScreen — org', () => {
  test('renders org name + follower count + stat tiles', () => {
    setRouteParams({ id: 'orgA' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    const o = SC_ACCOUNT_BY_ID.orgA;
    expect(getByText(o.name)).toBeTruthy();
    expect(getByText('FOLLOWERS')).toBeTruthy();
    expect(getByText('EVENTS')).toBeTruthy();
  });

  test('shows FOLLOW (or following) for orgs instead of friend buttons', () => {
    // orgA is already in `following` per resetStore.
    setRouteParams({ id: 'orgA' });
    const { getByText, queryByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('FOLLOWING · TAP TO UNFOLLOW')).toBeTruthy();
    expect(queryByText('MESSAGE')).toBeNull();
  });

  test('tapping FOLLOW toggles the following set', () => {
    setRouteParams({ id: 'orgC' });
    expect(useStore.getState().following.has('orgC')).toBe(false);
    const { getByText } = renderScreen(<OtherProfileScreen />);
    fireEvent.press(getByText('FOLLOW'));
    expect(useStore.getState().following.has('orgC')).toBe(true);
  });
});

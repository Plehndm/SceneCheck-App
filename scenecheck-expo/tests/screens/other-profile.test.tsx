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
  test('renders name, handle, and bio (public profile)', () => {
    // p1 (Maya) is public, so the full profile renders. (p2/p4 are
    // private — non-friends now get the request card, see below.)
    setRouteParams({ id: 'p1' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    const p = SC_ACCOUNT_BY_ID.p1;
    expect(getByText(p.name)).toBeTruthy();
    if (p.bio) expect(getByText(p.bio)).toBeTruthy();
  });

  test('shows MESSAGE button and safety actions on people', () => {
    setRouteParams({ id: 'p1' });
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

  test('a private non-friend sees bio + interests, but not message/safety', () => {
    // p4 (Theo) is private and not a friend → request card. Bio + interests
    // are shown (public on a private account); message/safety + the rest
    // stay hidden until they accept.
    setRouteParams({ id: 'p4' });
    useStore.setState({ friends: new Set(['p1', 'p3', 'p5']), outgoingRequests: new Set() });
    const { getByText, queryByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('This account is private')).toBeTruthy();
    expect(getByText('Interests')).toBeTruthy();
    const p = SC_ACCOUNT_BY_ID.p4;
    if (p.bio) expect(getByText(p.bio)).toBeTruthy();
    expect(queryByText('MESSAGE')).toBeNull();
    fireEvent.press(getByText('SEND FRIEND REQUEST'));
    expect(useStore.getState().outgoingRequests.has('p4')).toBe(true);
  });

  test('a private account you ARE friends with shows the full profile', () => {
    setRouteParams({ id: 'p4' });
    useStore.setState({ friends: new Set(['p4']) });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('Interests')).toBeTruthy();
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

describe('OtherProfileScreen — ratings + hosted events', () => {
  test('always renders the Ratings + hosting section headers', () => {
    // orgA has both reviews + hosted events in the fixtures.
    setRouteParams({ id: 'orgA' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('Ratings')).toBeTruthy();
    expect(getByText('Events posted')).toBeTruthy();
  });

  test('shows "No ratings yet" + empty hosting state for a host with neither', () => {
    // orgC has no reviews and hosts no events in the fixtures.
    setRouteParams({ id: 'orgC' });
    const { getByText } = renderScreen(<OtherProfileScreen />);
    expect(getByText('No ratings yet')).toBeTruthy();
    expect(getByText('No events posted yet.')).toBeTruthy();
  });
});

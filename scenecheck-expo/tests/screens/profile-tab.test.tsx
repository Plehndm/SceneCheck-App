// Integration tests for the Profile tab (app/(tabs)/profile.tsx).
// Covers stats card, interest chips, my-stuff menu, and the theme
// switcher (no longer the only theme surface, but still useful for
// dev parity).

import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ProfileTab from '@/app/(tabs)/profile';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_ME } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('ProfileTab', () => {
  test('renders the user name, handle, and city', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    expect(getByText(SC_ME.name)).toBeTruthy();
    expect(getByText(`@${SC_ME.username} · ${SC_ME.city}`)).toBeTruthy();
  });

  test('renders all stat tiles', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    expect(getByText('HOSTED')).toBeTruthy();
    expect(getByText('EVENTS')).toBeTruthy();
    expect(getByText('RATING')).toBeTruthy();
  });

  test('tapping the EVENTS stat opens the joined-events list', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    fireEvent.press(getByText('EVENTS'));
    expect(router.push).toHaveBeenCalledWith('/my-events');
  });

  test('tapping the HOSTED stat opens the hosting list', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    fireEvent.press(getByText('HOSTED'));
    expect(router.push).toHaveBeenCalledWith('/my-hosting');
  });

  test('renders MY STUFF section with the friends count from the store', () => {
    const { getByText, getAllByText } = renderScreen(<ProfileTab />);
    expect(getByText('MY STUFF')).toBeTruthy();
    expect(getByText('Friends')).toBeTruthy();
    // friends set = [p1, p3, p5] → count 3
    expect(getAllByText('3').length).toBeGreaterThan(0);
  });

  test('renders interest chips for every tag on me.interests', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    (SC_ME.interests ?? []).forEach(tag => {
      expect(getByText(tag)).toBeTruthy();
    });
  });

  test('NEW EVENT button pushes /create-event', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    fireEvent.press(getByText('NEW EVENT'));
    expect(router.push).toHaveBeenCalledWith('/create-event');
  });

  test('Settings row navigates to /settings', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    fireEvent.press(getByText('Settings'));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  test('Friends row navigates to /my-friends', () => {
    const { getByText } = renderScreen(<ProfileTab />);
    fireEvent.press(getByText('Friends'));
    expect(router.push).toHaveBeenCalledWith('/my-friends');
  });

  test('tapping the name opens the edit profile sheet (SAVE CHANGES becomes visible)', () => {
    const { getByText, queryByText, getByLabelText } = renderScreen(<ProfileTab />);
    expect(queryByText('SAVE CHANGES')).toBeNull();
    fireEvent.press(getByLabelText('Edit display name'));
    expect(getByText('SAVE CHANGES')).toBeTruthy();
  });

  test('drafts row only renders when drafts exist', () => {
    const { queryByText } = renderScreen(<ProfileTab />);
    expect(queryByText('Drafts')).toBeNull();

    act(() => {
      useStore.getState().saveDraft({
        title: 'Test', desc: '', date: 'Sat May 16',
        timeStart: '7:00 AM', timeEnd: '9:00 AM',
        location: '', cap: 10, interests: [], visibility: 'public',
        minSubs: 2, addToCalendar: false, autoGroupChat: false,
      });
    });

    const { getByText } = renderScreen(<ProfileTab />);
    expect(getByText('Drafts')).toBeTruthy();
  });
});

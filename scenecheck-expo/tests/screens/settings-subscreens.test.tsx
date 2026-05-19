// Integration tests for the three settings sub-screens:
// linked-calendar, blocked, help.

import { fireEvent } from '@testing-library/react-native';
import LinkedCalendarScreen from '@/app/settings/linked-calendar';
import BlockedUsersScreen from '@/app/settings/blocked';
import HelpFeedbackScreen from '@/app/settings/help';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('LinkedCalendarScreen', () => {
  test('renders all three providers + UNLINK', () => {
    const { getByText } = renderScreen(<LinkedCalendarScreen />);
    expect(getByText('Google Calendar')).toBeTruthy();
    expect(getByText('Apple Calendar')).toBeTruthy();
    expect(getByText('Outlook')).toBeTruthy();
    expect(getByText('UNLINK CALENDAR')).toBeTruthy();
  });

  test('selecting Apple updates the store', () => {
    const { getByText } = renderScreen(<LinkedCalendarScreen />);
    fireEvent.press(getByText('Apple Calendar'));
    expect(useStore.getState().linkedCalendar).toBe('apple');
  });

  test('UNLINK CALENDAR sets linkedCalendar to null', () => {
    const { getByText } = renderScreen(<LinkedCalendarScreen />);
    fireEvent.press(getByText('UNLINK CALENDAR'));
    expect(useStore.getState().linkedCalendar).toBeNull();
  });
});

describe('BlockedUsersScreen', () => {
  test('renders rows for each blocked user', () => {
    const { getByText } = renderScreen(<BlockedUsersScreen />);
    expect(getByText('Casey Morgan')).toBeTruthy();
    expect(getByText('Riley Tanaka')).toBeTruthy();
  });

  test('tapping UNBLOCK opens a confirm dialog', () => {
    const { getAllByText } = renderScreen(<BlockedUsersScreen />);
    fireEvent.press(getAllByText('UNBLOCK')[0]);
    expect(useStore.getState().confirm?.title).toMatch(/Unblock /);
  });

  test('renders the empty state when no one is blocked', () => {
    useStore.setState({ blocked: [] });
    const { getByText } = renderScreen(<BlockedUsersScreen />);
    expect(getByText("No one's blocked.")).toBeTruthy();
  });
});

describe('HelpFeedbackScreen', () => {
  test('renders every help row label', () => {
    const { getByText } = renderScreen(<HelpFeedbackScreen />);
    expect(getByText('How SceneCheck works')).toBeTruthy();
    expect(getByText('Email support')).toBeTruthy();
    expect(getByText('Privacy policy')).toBeTruthy();
    expect(getByText('Report a bug')).toBeTruthy();
  });

  test('renders the version line', () => {
    const { getByText } = renderScreen(<HelpFeedbackScreen />);
    expect(getByText(/SceneCheck · v/)).toBeTruthy();
  });
});

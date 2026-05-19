// Integration tests for the new-chat composer (app/new-chat.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import NewChatScreen from '@/app/new-chat';
import { renderScreen, resetStore } from '../test-utils';
import { SC_VISIBLE_PEOPLE } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
});

describe('NewChatScreen', () => {
  test('renders the "pick one or more people" subtitle initially', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    expect(getByText('PICK ONE OR MORE PEOPLE')).toBeTruthy();
  });

  test('renders every visible person', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    SC_VISIBLE_PEOPLE.forEach(p => expect(getByText(p.name)).toBeTruthy());
  });

  test('picking one person switches subtitle and CTA to DM', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(SC_VISIBLE_PEOPLE[0].name));
    expect(getByText('DIRECT MESSAGE')).toBeTruthy();
    expect(getByText('START CHAT')).toBeTruthy();
  });

  test('picking two people switches to GROUP CHAT mode', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(SC_VISIBLE_PEOPLE[0].name));
    fireEvent.press(getByText(SC_VISIBLE_PEOPLE[1].name));
    expect(getByText(/GROUP CHAT · 2 SELECTED/)).toBeTruthy();
    expect(getByText('START GROUP · 2')).toBeTruthy();
  });

  test('START CHAT for a single pick replaces to /chat/dm-<id>', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(SC_VISIBLE_PEOPLE[0].name));
    fireEvent.press(getByText('START CHAT'));
    expect(router.replace).toHaveBeenCalledWith(`/chat/dm-${SC_VISIBLE_PEOPLE[0].id}`);
  });
});

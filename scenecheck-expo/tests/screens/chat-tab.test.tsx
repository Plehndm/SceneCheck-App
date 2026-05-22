// Integration tests for the Chat tab (app/(tabs)/chat.tsx).

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import ChatTab from '@/app/(tabs)/chat';
import { renderScreen, resetStore } from '../test-utils';
import { SC_CHATS, SC_EVENT_BY_ID, SC_ACCOUNT_BY_ID } from '@/data/mocks';

beforeEach(() => {
  resetStore();
  (router.push as jest.Mock).mockClear();
});

describe('ChatTab', () => {
  test('renders the Conversations header', () => {
    const { getByText } = renderScreen(<ChatTab />);
    expect(getByText('Conversations')).toBeTruthy();
    expect(getByText('Chat')).toBeTruthy();
  });

  test('renders one card per chat in SC_CHATS', () => {
    const { getByText } = renderScreen(<ChatTab />);
    for (const c of SC_CHATS) {
      const title = c.kind === 'event'
        ? c.title ?? SC_EVENT_BY_ID[c.eventId ?? '']?.title ?? 'Event chat'
        : SC_ACCOUNT_BY_ID[c.personId ?? '']?.name ?? 'DM';
      expect(getByText(title)).toBeTruthy();
    }
  });

  test('shows an unread badge with the count for chats with unread > 0', () => {
    const { getAllByText } = renderScreen(<ChatTab />);
    // c1 has 2 unread, c4 has 1 unread → both should render.
    const twoBadges = getAllByText('2');
    expect(twoBadges.length).toBeGreaterThan(0);
    const oneBadges = getAllByText('1');
    expect(oneBadges.length).toBeGreaterThan(0);
  });

  test('the compose button starts a new chat (routes to /new-chat)', () => {
    const { getByLabelText } = renderScreen(<ChatTab />);
    fireEvent.press(getByLabelText('Start a new chat'));
    expect(router.push).toHaveBeenCalledWith('/new-chat');
  });

  test('tapping a chat navigates to /chat/<id>', () => {
    const { getByText } = renderScreen(<ChatTab />);
    const firstChatTitle = SC_CHATS[0].title ??
      SC_EVENT_BY_ID[SC_CHATS[0].eventId ?? '']?.title ?? 'chat';
    fireEvent.press(getByText(firstChatTitle));
    expect(router.push).toHaveBeenCalledWith(`/chat/${SC_CHATS[0].id}`);
  });
});

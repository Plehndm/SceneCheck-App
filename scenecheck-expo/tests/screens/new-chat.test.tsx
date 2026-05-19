// Integration tests for the new-chat composer (app/new-chat.tsx).
// Phase 6: the picker is scoped to friends only (DMing strangers
// doesn't translate to RLS-controlled friendships). resetStore
// defaults `friends` to ['p1', 'p3', 'p5'] so the assertions
// below pin on p1 and p3.

import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import NewChatScreen from '@/app/new-chat';
import { renderScreen, resetStore } from '../test-utils';
import { SC_VISIBLE_PERSON_BY_ID } from '@/data/mocks';

const FRIEND_P1 = SC_VISIBLE_PERSON_BY_ID['p1'];
const FRIEND_P3 = SC_VISIBLE_PERSON_BY_ID['p3'];

beforeEach(() => {
  resetStore();
  (router.replace as jest.Mock).mockClear();
});

describe('NewChatScreen', () => {
  test('renders the "pick one or more people" subtitle initially', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    expect(getByText('PICK ONE OR MORE PEOPLE')).toBeTruthy();
  });

  test('renders every friend (and only friends)', () => {
    const { getByText, queryByText } = renderScreen(<NewChatScreen />);
    expect(getByText(FRIEND_P1.name)).toBeTruthy();
    expect(getByText(FRIEND_P3.name)).toBeTruthy();
    // p2 is not in the resetStore friends Set — should not appear.
    expect(queryByText(SC_VISIBLE_PERSON_BY_ID['p2'].name)).toBeNull();
  });

  test('picking one person switches subtitle and CTA to DM', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(FRIEND_P1.name));
    expect(getByText('DIRECT MESSAGE')).toBeTruthy();
    expect(getByText('START CHAT')).toBeTruthy();
  });

  test('picking two people switches to GROUP CHAT mode', () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(FRIEND_P1.name));
    fireEvent.press(getByText(FRIEND_P3.name));
    expect(getByText(/GROUP CHAT · 2 SELECTED/)).toBeTruthy();
    expect(getByText('START GROUP · 2')).toBeTruthy();
  });

  test('START CHAT for a single pick replaces to /chat/dm-<id>', async () => {
    const { getByText } = renderScreen(<NewChatScreen />);
    fireEvent.press(getByText(FRIEND_P1.name));
    fireEvent.press(getByText('START CHAT'));
    // api.createChat in mock mode resolves immediately to
    // `{ id: 'dm-<id>' }` (stable legacy router target). Let
    // microtasks flush so the redirect lands.
    await Promise.resolve();
    await Promise.resolve();
    expect(router.replace).toHaveBeenCalledWith(`/chat/dm-${FRIEND_P1.id}`);
  });
});

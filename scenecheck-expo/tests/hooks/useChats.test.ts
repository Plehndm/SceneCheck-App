// Smoke tests for the chat hooks added in Phase 6.

import { renderHook, act } from '@testing-library/react-native';
import { useChats } from '@/hooks/useChats';
import { useChatMessages } from '@/hooks/useChatMessages';
import { SC_CHATS, SC_THREADS } from '@/data/mocks';

describe('useChats', () => {
  test('returns SC_CHATS synchronously in mock mode', () => {
    const { result } = renderHook(() => useChats());
    expect(result.current.loading).toBe(false);
    expect(result.current.chats).toEqual(SC_CHATS);
  });

  test('exposes a callable reload function', () => {
    const { result } = renderHook(() => useChats());
    expect(typeof result.current.reload).toBe('function');
  });
});

describe('useChatMessages', () => {
  test('seeds messages from SC_THREADS[id] in mock mode', () => {
    // Pick a chat id that has thread data in the mocks. The first
    // key in SC_THREADS is the most stable target.
    const chatId = Object.keys(SC_THREADS)[0];
    expect(chatId).toBeDefined();
    const { result } = renderHook(() => useChatMessages(chatId));
    expect(result.current.loading).toBe(false);
    // The seed length matches the fixture (the hook stamps unique
    // ids onto each entry; the count is unchanged).
    expect(result.current.messages.length).toBe(SC_THREADS[chatId].length);
  });

  test('send() appends an optimistic message immediately', async () => {
    const chatId = Object.keys(SC_THREADS)[0];
    const { result } = renderHook(() => useChatMessages(chatId));
    const before = result.current.messages.length;
    await act(async () => {
      // The mock-mode send resolves immediately; the optimistic
      // append happens synchronously inside the action.
      await result.current.send('hello from the test');
    });
    expect(result.current.messages.length).toBe(before + 1);
    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.text).toBe('hello from the test');
    expect(last.from).toBe('host');
  });

  test('handles undefined chatId without crashing', () => {
    const { result } = renderHook(() => useChatMessages(undefined));
    expect(result.current.loading).toBe(false);
    expect(result.current.messages).toEqual([]);
  });
});

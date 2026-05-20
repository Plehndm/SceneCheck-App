// Integration tests for the friend-requests screen (app/requests.tsx).

import { fireEvent } from '@testing-library/react-native';
import RequestsScreen from '@/app/requests';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('RequestsScreen', () => {
  test('renders the inbox header with the right count', () => {
    const { getByText } = renderScreen(<RequestsScreen />);
    // "Inbox" is now the SCTopBar subtitle, rendered uppercase.
    expect(getByText('INBOX')).toBeTruthy();
    expect(getByText('Follow requests')).toBeTruthy();
    // The "2 PEOPLE WANT TO ADD YOU" string renders as separate child
    // text nodes inside a single SCText; query by the constant tail.
    expect(getByText(/TO ADD YOU/i)).toBeTruthy();
  });

  test('renders the empty state when there are no incoming requests', () => {
    useStore.setState({ incomingRequests: new Set() });
    const { getByText } = renderScreen(<RequestsScreen />);
    expect(getByText("You're all caught up")).toBeTruthy();
  });

  test('ACCEPT moves the requester into friends and clears the inbox row', () => {
    const { getAllByText } = renderScreen(<RequestsScreen />);
    fireEvent.press(getAllByText('ACCEPT')[0]);
    // fr1 maps to p4 in SC_FRIEND_REQUESTS.
    expect(useStore.getState().friends.has('p4')).toBe(true);
    expect(useStore.getState().incomingRequests.has('fr1')).toBe(false);
  });

  test('DECLINE just clears the inbox row', () => {
    const before = useStore.getState().friends.size;
    const { getAllByText } = renderScreen(<RequestsScreen />);
    fireEvent.press(getAllByText('DECLINE')[0]);
    expect(useStore.getState().friends.size).toBe(before);
    expect(useStore.getState().incomingRequests.has('fr1')).toBe(false);
  });
});

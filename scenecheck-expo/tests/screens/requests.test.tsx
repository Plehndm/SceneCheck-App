// Integration tests for the friend-requests screen (app/requests.tsx).

import { fireEvent } from '@testing-library/react-native';
import RequestsScreen from '@/app/requests';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';

beforeEach(() => resetStore());

describe('RequestsScreen', () => {
  test('renders the header + both-direction counts', () => {
    const { getByText } = renderScreen(<RequestsScreen />);
    expect(getByText('REQUESTS')).toBeTruthy();        // SCTopBar subtitle
    expect(getByText('Friend requests')).toBeTruthy(); // title
    expect(getByText(/TO APPROVE · \d+ SENT/i)).toBeTruthy(); // "2 TO APPROVE · 1 SENT"
  });

  test('renders the empty state only when BOTH directions are empty', () => {
    useStore.setState({ incomingRequests: new Set(), outgoingRequests: new Set() });
    const { getByText } = renderScreen(<RequestsScreen />);
    expect(getByText("You're all caught up")).toBeTruthy();
  });

  test('lists outgoing requests under "Sent by you"; CANCEL removes them', () => {
    // resetStore seeds outgoingRequests = { 'p2' } (Jordan Park).
    const { getByText } = renderScreen(<RequestsScreen />);
    expect(getByText('Sent by you')).toBeTruthy();
    fireEvent.press(getByText('CANCEL'));
    expect(useStore.getState().outgoingRequests.has('p2')).toBe(false);
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

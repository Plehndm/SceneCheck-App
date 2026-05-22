// Component tests for SCEventCard. Ported from the prototype's
// tests/integration/SCEventCard.test.js — same assertions, RN testing
// primitives instead of DOM ones, ThemeProvider wrapped because every
// SC component reads from useTokens().

import { render, fireEvent } from '@testing-library/react-native';
import { SCEventCard } from '@/components/SCEventCard';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { SC_EVENT_BY_ID } from '@/data/mocks';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const yourEvent = SC_EVENT_BY_ID.e1;        // kind: 'yours'
const friendEvent = SC_EVENT_BY_ID.e2;      // kind: 'friend'
const recommendedEvent = SC_EVENT_BY_ID.e4; // kind: 'recommended'

describe('SCEventCard', () => {
  test('shows "YOUR EVENT" label for kind: yours', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={() => {}} />,
    );
    expect(getByText('YOUR EVENT')).toBeTruthy();
  });

  test('shows "FRIEND HOSTING" label for kind: friend', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={friendEvent} joined={false} onPress={() => {}} />,
    );
    expect(getByText('FRIEND HOSTING')).toBeTruthy();
  });

  test('shows "RECOMMENDED" for a scraped event that matches an interest', () => {
    // e4 has interests ['running','uci']; passing a matching interest makes it
    // recommended for this user.
    const { getByText } = renderWithTheme(
      <SCEventCard event={recommendedEvent} joined={false} meInterests={['uci']} onPress={() => {}} />,
    );
    expect(getByText('RECOMMENDED')).toBeTruthy();
  });

  test('shows "NEARBY" (not RECOMMENDED) for a scraped event with no matching interest', () => {
    const { getByText, queryByText } = renderWithTheme(
      <SCEventCard event={recommendedEvent} joined={false} meInterests={['cooking']} onPress={() => {}} />,
    );
    expect(getByText('NEARBY')).toBeTruthy();
    expect(queryByText('RECOMMENDED')).toBeNull();
  });

  test('shows "JOINED" badge when joined=true', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={true} onPress={() => {}} />,
    );
    expect(getByText('JOINED')).toBeTruthy();
  });

  test('omits "JOINED" badge when joined=false', () => {
    const { queryByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={() => {}} />,
    );
    expect(queryByText('JOINED')).toBeNull();
  });

  test('renders event title', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={() => {}} />,
    );
    expect(getByText('Morning Ride — Back Bay loop')).toBeTruthy();
  });

  test('renders event location', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={() => {}} />,
    );
    expect(getByText('Anteater Plaza → Back Bay')).toBeTruthy();
  });

  test('renders attendees/cap counts', () => {
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={() => {}} />,
    );
    // yourEvent has attendees: 6, cap: 12 — they render as separate <SCText>.
    expect(getByText('6')).toBeTruthy();
    expect(getByText('/12')).toBeTruthy();
  });

  test('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(
      <SCEventCard event={yourEvent} joined={false} onPress={onPress} />,
    );
    // Tap on the title — the Pressable wraps the whole card.
    fireEvent.press(getByText('Morning Ride — Back Bay loop'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

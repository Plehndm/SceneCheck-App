// Component tests for ConflictChip. The chip is store-driven: it reads
// `tweaks.preflightConflicts` and `joined` from the Zustand store. We
// drive the store directly between cases instead of mocking it, since
// the store IS the contract this component depends on.

import { render } from '@testing-library/react-native';
import { ConflictChip } from '@/components/ConflictChip';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useStore, DEFAULT_TWEAKS } from '@/store/useStore';
import { SC_EVENT_BY_ID } from '@/data/mocks';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  useStore.setState({
    joined: new Set(['e1']),
    pendingLeave: new Set(),
    tweaks: { ...DEFAULT_TWEAKS, preflightConflicts: true },
  });
});

describe('ConflictChip', () => {
  test('renders "OVERLAPS HH:MM" when target conflicts with a joined event', () => {
    // e9 is Sat May 9 · 8:00 AM; user joined e1 (Sat May 9 · 7:00 AM).
    const { getByText } = renderWithTheme(<ConflictChip event={SC_EVENT_BY_ID.e9} />);
    expect(getByText(/OVERLAPS\s+7:00 AM/)).toBeTruthy();
  });

  test('renders nothing when the user already joined the target', () => {
    const { queryByText } = renderWithTheme(<ConflictChip event={SC_EVENT_BY_ID.e1} />);
    expect(queryByText(/OVERLAPS/)).toBeNull();
  });

  test('renders nothing when no joined event overlaps', () => {
    const { queryByText } = renderWithTheme(<ConflictChip event={SC_EVENT_BY_ID.e2} />);
    expect(queryByText(/OVERLAPS/)).toBeNull();
  });

  test('renders nothing when the preflightConflicts tweak is off', () => {
    useStore.setState({
      tweaks: { ...DEFAULT_TWEAKS, preflightConflicts: false },
    });
    const { queryByText } = renderWithTheme(<ConflictChip event={SC_EVENT_BY_ID.e9} />);
    expect(queryByText(/OVERLAPS/)).toBeNull();
  });
});

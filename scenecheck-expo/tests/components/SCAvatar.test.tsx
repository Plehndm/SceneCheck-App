// Component tests for SCAvatar. Ported from the prototype's
// tests/integration/SCAvatar.test.js with adjusted assertions for RN
// (no DOM, no className queries — uses the rendered text instead).

import { render } from '@testing-library/react-native';
import { SCAvatar } from '@/components/SCAvatar';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { SC_PEOPLE, SC_ORGS } from '@/data/mocks';

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('SCAvatar', () => {
  test('renders initials from a person name', () => {
    const maya = SC_PEOPLE.find(p => p.id === 'p1')!;
    const { getByText } = renderWithTheme(<SCAvatar person={maya} size={40} />);
    // "Maya Chen" → "MC"
    expect(getByText('MC')).toBeTruthy();
  });

  test('handles single-word names with a single initial', () => {
    const { getByText } = renderWithTheme(
      <SCAvatar person={{ name: 'Cher', type: 'person' }} size={40} />,
    );
    expect(getByText('C')).toBeTruthy();
  });

  test('renders "?" when no person provided', () => {
    const { getByText } = renderWithTheme(<SCAvatar size={40} />);
    expect(getByText('?')).toBeTruthy();
  });

  test('renders org initials for org accounts', () => {
    const topout = SC_ORGS.find(o => o.id === 'orgA')!;
    const { getByText } = renderWithTheme(<SCAvatar person={topout} size={40} />);
    // "TopOut Climbing" → "TC"
    expect(getByText('TC')).toBeTruthy();
  });

  test('does not render initials when a picture URI is provided', () => {
    const withPic = { ...SC_PEOPLE[0], picture: 'https://example.com/avatar.jpg' };
    const { queryByText } = renderWithTheme(<SCAvatar person={withPic} size={40} />);
    expect(queryByText('MC')).toBeNull();
  });
});

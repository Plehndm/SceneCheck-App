// Tests for the loading-skeleton + empty-state primitives that the browse
// screens use to distinguish "still loading" from "nothing came back".

import { SCSkeleton, SCListSkeleton, SCRailSkeleton } from '@/components/SCSkeleton';
import { SCEmptyState } from '@/components/SCEmptyState';
import { SCText } from '@/components/SCText';
import { renderScreen } from '../test-utils';

describe('SCSkeleton', () => {
  test('renders a single placeholder labelled "Loading"', () => {
    const { getAllByLabelText } = renderScreen(<SCSkeleton />);
    expect(getAllByLabelText('Loading').length).toBe(1);
  });
});

describe('SCListSkeleton', () => {
  test('renders one card row per requested row (each row has placeholders)', () => {
    const { getAllByLabelText } = renderScreen(<SCListSkeleton rows={3} />);
    // Each row is an icon block + two text lines = 3 placeholders.
    expect(getAllByLabelText('Loading').length).toBe(9);
  });
});

describe('SCRailSkeleton', () => {
  test('renders placeholder cards', () => {
    const { getAllByLabelText } = renderScreen(<SCRailSkeleton cards={2} />);
    expect(getAllByLabelText('Loading').length).toBeGreaterThanOrEqual(2);
  });
});

describe('SCEmptyState', () => {
  test('renders the title and subtitle', () => {
    const { getByText } = renderScreen(
      <SCEmptyState title="Nothing here" subtitle="Try again later" />,
    );
    expect(getByText('Nothing here')).toBeTruthy();
    expect(getByText('Try again later')).toBeTruthy();
  });

  test('renders an optional action', () => {
    const { getByText } = renderScreen(
      <SCEmptyState title="Empty" action={<SCText>Do something</SCText>} />,
    );
    expect(getByText('Do something')).toBeTruthy();
  });
});

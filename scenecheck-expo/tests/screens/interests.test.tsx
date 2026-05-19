// Integration tests for the interests management screen
// (app/interests/index.tsx).

import { fireEvent } from '@testing-library/react-native';
import InterestsScreen from '@/app/interests/index';
import { renderScreen, resetStore } from '../test-utils';
import { useStore } from '@/store/useStore';
import { SC_INTERESTS_SUGGESTED } from '@/data/mocks';

beforeEach(() => resetStore());

describe('InterestsScreen', () => {
  test('renders the "Your current interests" header with count', () => {
    const { getByText } = renderScreen(<InterestsScreen />);
    expect(getByText('Your current interests')).toBeTruthy();
    // resetStore seeds 3 interests: biking, coffee, climbing
    expect(getByText('3')).toBeTruthy();
  });

  test('renders the suggested list', () => {
    const { getByText } = renderScreen(<InterestsScreen />);
    expect(getByText('SUGGESTED FOR YOU')).toBeTruthy();
    // Each row's "N others nearby" line is a stable per-tag anchor — the
    // tag-name SCText nests a "#" child node so the full text is "#tag",
    // and a bare `getByText('tag')` doesn't match the prefixed version.
    SC_INTERESTS_SUGGESTED.forEach(i => {
      expect(getByText(`${i.others.toLocaleString()} others nearby`)).toBeTruthy();
    });
  });

  test('shows ADDED for tags already in subscribedInterests', () => {
    const { getAllByText } = renderScreen(<InterestsScreen />);
    // biking, coffee, climbing are pre-subscribed.
    expect(getAllByText('ADDED').length).toBeGreaterThan(0);
  });

  test('tapping ADD on a new tag subscribes it', () => {
    const { getAllByText } = renderScreen(<InterestsScreen />);
    fireEvent.press(getAllByText('ADD')[0]);
    // Some new tag should now be subscribed.
    expect(useStore.getState().subscribedInterests.size).toBeGreaterThan(3);
  });

  test('typing into the search input filters the suggested list', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderScreen(<InterestsScreen />);
    fireEvent.changeText(getByPlaceholderText('Search interests…'), 'biking');
    expect(getByText('biking')).toBeTruthy();
    // cooking should be filtered out.
    expect(queryByText('cooking')).toBeNull();
  });
});

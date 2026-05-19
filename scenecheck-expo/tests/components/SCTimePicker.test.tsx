// Component tests for the three-wheel time picker (`SCTimePicker.tsx`).
// The scroll-snap wheel itself doesn't fire `onMomentumScrollEnd` in
// jsdom, so we don't try to drive scroll mechanics. What we DO verify:
//   1. The trigger renders the formatted time string.
//   2. Opening reveals the AM/PM column and the colon separator.
//   3. Tapping an item inside a wheel calls `onChange` with the
//      reformatted time string.

import { fireEvent } from '@testing-library/react-native';
import { SCTimePicker } from '@/components/SCTimePicker';
import { renderScreen } from '../test-utils';

describe('SCTimePicker', () => {
  test('renders the formatted time string in the trigger', () => {
    const { getByText } = renderScreen(
      <SCTimePicker value="7:00 AM" onChange={() => {}} />,
    );
    expect(getByText('7:00 AM')).toBeTruthy();
  });

  test('opens the popover and renders the AM/PM column + colon', () => {
    const { getByText, getAllByText } = renderScreen(
      <SCTimePicker value="7:00 AM" onChange={() => {}} />,
    );
    fireEvent.press(getByText('7:00 AM'));
    // Colon separator is part of the popover layout.
    expect(getByText(':')).toBeTruthy();
    // AM/PM column renders both labels (current is in the trigger too,
    // so getAllByText for 'AM' returns >= 1).
    expect(getAllByText('AM').length).toBeGreaterThan(0);
    expect(getByText('PM')).toBeTruthy();
  });

  test('tapping a wheel item calls onChange with the reformatted time', () => {
    const onChange = jest.fn();
    const { getByText } = renderScreen(
      <SCTimePicker value="7:00 AM" onChange={onChange} />,
    );
    fireEvent.press(getByText('7:00 AM'));
    // Tap PM in the AM/PM column.
    fireEvent.press(getByText('PM'));
    expect(onChange).toHaveBeenCalledWith('7:00 PM');
  });
});

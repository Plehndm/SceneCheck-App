// Component tests for the calendar popover (`SCDatePicker.tsx`).
// Two things to lock in:
//   1. The trigger always shows the formatted date from the `value` prop.
//   2. The popover renders the current month label when opened.
//
// Direct selection of a non-past day is hard to assert deterministically
// (calendar contents shift relative to whatever "today" is on the
// machine running the tests), so we keep this focused on render + open
// behavior. The shared formatting paths (`fmtDate` / `parseDate`) have
// their own unit tests in `tests/unit/date-time.test.ts`.

import { fireEvent } from '@testing-library/react-native';
import { SCDatePicker } from '@/components/SCDatePicker';
import { renderScreen } from '../test-utils';
import { MON_LONG } from '@/lib/date-time';

describe('SCDatePicker', () => {
  test('renders the formatted date string in the trigger button', () => {
    const { getByText } = renderScreen(
      <SCDatePicker value="Sat May 16" onChange={() => {}} />,
    );
    expect(getByText('Sat May 16')).toBeTruthy();
  });

  test('opens the calendar popover with the parsed month label', () => {
    const { getByText, queryByText } = renderScreen(
      <SCDatePicker value="Sat May 16" onChange={() => {}} />,
    );
    // Before opening — no month label rendered.
    expect(queryByText(new RegExp(`^${MON_LONG[4]} `))).toBeNull();
    // Tap the trigger.
    fireEvent.press(getByText('Sat May 16'));
    // Popover should now show "May <year>".
    expect(getByText(new RegExp(`^${MON_LONG[4]} \\d{4}$`))).toBeTruthy();
  });

  test('falls back to today when the input value is malformed', () => {
    // parseDate returns today for unparseable strings — the trigger
    // should still render a valid friendly date.
    const { getByText } = renderScreen(
      <SCDatePicker value="not a date" onChange={() => {}} />,
    );
    // Today's friendly form, e.g. "Mon Mar 17" — assert the shape.
    expect(getByText(/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2}$/)).toBeTruthy();
  });
});

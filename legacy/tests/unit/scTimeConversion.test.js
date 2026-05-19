// Unit tests for scTimeToMin and scMinToTime (src/screens.jsx:808-821)
// FR coverage: FR5 (time validation — end must be after start)

describe('scTimeToMin', () => {
  const scTimeToMin = global.scTimeToMin;

  test('7:00 AM = 420 minutes', () => {
    expect(scTimeToMin('7:00 AM')).toBe(420);
  });

  test('12:00 PM (noon) = 720 minutes', () => {
    expect(scTimeToMin('12:00 PM')).toBe(720);
  });

  test('12:00 AM (midnight) = 0 minutes', () => {
    expect(scTimeToMin('12:00 AM')).toBe(0);
  });

  test('6:30 PM = 1110 minutes', () => {
    expect(scTimeToMin('6:30 PM')).toBe(1110);
  });

  test('11:59 PM = 1439 minutes', () => {
    expect(scTimeToMin('11:59 PM')).toBe(1439);
  });

  test('1:00 AM = 60 minutes', () => {
    expect(scTimeToMin('1:00 AM')).toBe(60);
  });
});

describe('scMinToTime', () => {
  const scMinToTime = global.scMinToTime;

  test('420 minutes = 7:00 AM', () => {
    expect(scMinToTime(420)).toBe('7:00 AM');
  });

  test('720 minutes = 12:00 PM', () => {
    expect(scMinToTime(720)).toBe('12:00 PM');
  });

  test('0 minutes = 12:00 AM', () => {
    expect(scMinToTime(0)).toBe('12:00 AM');
  });

  test('1439 minutes = 11:59 PM', () => {
    expect(scMinToTime(1439)).toBe('11:59 PM');
  });
});

describe('scTimeToMin + scMinToTime roundtrip', () => {
  const scTimeToMin = global.scTimeToMin;
  const scMinToTime = global.scMinToTime;

  test.each([
    '7:00 AM', '12:00 PM', '12:00 AM', '6:30 PM', '11:59 PM', '1:00 AM',
  ])('roundtrip preserves "%s"', (t) => {
    expect(scMinToTime(scTimeToMin(t))).toBe(t);
  });
});

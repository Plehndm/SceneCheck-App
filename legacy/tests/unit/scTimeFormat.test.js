// Unit tests for scParseTime and scFmtTime (src/screens.jsx:798-804)
// FR coverage: FR5 (create event time picker)

describe('scParseTime', () => {
  const scParseTime = global.scParseTime;

  test('parses "7:00 AM"', () => {
    expect(scParseTime('7:00 AM')).toEqual({ h: 7, m: 0, ap: 'AM' });
  });

  test('parses "12:00 PM"', () => {
    expect(scParseTime('12:00 PM')).toEqual({ h: 12, m: 0, ap: 'PM' });
  });

  test('parses "12:30 AM"', () => {
    expect(scParseTime('12:30 AM')).toEqual({ h: 12, m: 30, ap: 'AM' });
  });

  test('parses "6:30 PM"', () => {
    expect(scParseTime('6:30 PM')).toEqual({ h: 6, m: 30, ap: 'PM' });
  });

  test('returns default for null input', () => {
    expect(scParseTime(null)).toEqual({ h: 12, m: 0, ap: 'AM' });
  });

  test('returns default for empty string', () => {
    expect(scParseTime('')).toEqual({ h: 12, m: 0, ap: 'AM' });
  });
});

describe('scFmtTime', () => {
  const scFmtTime = global.scFmtTime;

  test('formats {h:7, m:0, ap:"AM"} to "7:00 AM"', () => {
    expect(scFmtTime({ h: 7, m: 0, ap: 'AM' })).toBe('7:00 AM');
  });

  test('formats {h:12, m:30, ap:"PM"} to "12:30 PM"', () => {
    expect(scFmtTime({ h: 12, m: 30, ap: 'PM' })).toBe('12:30 PM');
  });

  test('pads single-digit minutes with zero', () => {
    expect(scFmtTime({ h: 9, m: 5, ap: 'AM' })).toBe('9:05 AM');
  });
});

describe('scParseTime + scFmtTime roundtrip', () => {
  const scParseTime = global.scParseTime;
  const scFmtTime = global.scFmtTime;

  test.each([
    '7:00 AM', '12:00 PM', '6:30 PM', '12:00 AM', '11:45 PM',
  ])('roundtrip preserves "%s"', (t) => {
    expect(scFmtTime(scParseTime(t))).toBe(t);
  });
});

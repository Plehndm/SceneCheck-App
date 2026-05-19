// Unit tests for scFmtDate and scParseDate (src/screens.jsx:785-796)
// FR coverage: FR5 (create event date picker)

describe('scFmtDate', () => {
  const scFmtDate = global.scFmtDate;

  test('formats a Saturday in May correctly', () => {
    const d = new Date(2026, 4, 9); // May 9, 2026 is a Saturday
    expect(scFmtDate(d)).toBe('Sat May 9');
  });

  test('formats a Monday in January correctly', () => {
    const d = new Date(2026, 0, 5); // Jan 5, 2026 is a Monday
    expect(scFmtDate(d)).toBe('Mon Jan 5');
  });

  test('formats December 31 correctly', () => {
    const d = new Date(2026, 11, 31);
    expect(scFmtDate(d)).toBe('Thu Dec 31');
  });
});

describe('scParseDate', () => {
  const scParseDate = global.scParseDate;

  test('parses "Sat May 9" to correct month and day', () => {
    const d = scParseDate('Sat May 9');
    expect(d.getMonth()).toBe(4); // May = index 4
    expect(d.getDate()).toBe(9);
  });

  test('parses "Mon Jan 5" to correct month and day', () => {
    const d = scParseDate('Mon Jan 5');
    expect(d.getMonth()).toBe(0); // Jan = index 0
    expect(d.getDate()).toBe(5);
  });

  test('falls back to today for null input', () => {
    const d = scParseDate(null);
    const today = new Date();
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });

  test('falls back to today for empty string', () => {
    const d = scParseDate('');
    const today = new Date();
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });
});

describe('scFmtDate + scParseDate roundtrip', () => {
  const scFmtDate = global.scFmtDate;
  const scParseDate = global.scParseDate;

  test('roundtrip preserves month and day', () => {
    const original = new Date(2026, 4, 16); // May 16
    const formatted = scFmtDate(original);
    const parsed = scParseDate(formatted);
    expect(parsed.getMonth()).toBe(original.getMonth());
    expect(parsed.getDate()).toBe(original.getDate());
  });
});

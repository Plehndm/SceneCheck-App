// Unit tests for scWhenRange (src/data.jsx:155)
// FR coverage: FR4 (event display), FR5 (event details)

describe('scWhenRange', () => {
  const scWhenRange = global.scWhenRange;

  test('formats event with endTime as range', () => {
    const event = { when: 'Sat May 9 · 7:00 AM', endTime: '9:00 AM' };
    expect(scWhenRange(event)).toBe('Sat May 9 · 7:00 AM – 9:00 AM');
  });

  test('returns just when string if no endTime', () => {
    const event = { when: 'Sat May 9 · 7:00 AM' };
    expect(scWhenRange(event)).toBe('Sat May 9 · 7:00 AM');
  });

  test('returns empty string for null event', () => {
    expect(scWhenRange(null)).toBe('');
  });

  test('returns empty string for undefined event', () => {
    expect(scWhenRange(undefined)).toBe('');
  });

  test('handles event with empty endTime', () => {
    const event = { when: 'Sat May 9 · 7:00 AM', endTime: '' };
    // empty string is falsy, so should return just when
    expect(scWhenRange(event)).toBe('Sat May 9 · 7:00 AM');
  });
});

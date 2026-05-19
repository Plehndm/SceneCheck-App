// Unit tests for lib/date-time.ts — ported from the original
// tests/unit/{scDateFormat,scTimeFormat,scTimeConversion,scWhenRange}.test.js
// in the prototype repo. The behavior is identical; the imports are typed.

import {
  fmtDate, parseDate, fmtTime, parseTime,
  timeToMin, minToTime, whenRange,
} from '@/lib/date-time';

describe('fmtDate', () => {
  test('formats a Saturday in May correctly', () => {
    expect(fmtDate(new Date(2026, 4, 9))).toBe('Sat May 9');
  });

  test('formats a Monday in January correctly', () => {
    expect(fmtDate(new Date(2026, 0, 5))).toBe('Mon Jan 5');
  });

  test('formats December 31 correctly', () => {
    expect(fmtDate(new Date(2026, 11, 31))).toBe('Thu Dec 31');
  });
});

describe('parseDate', () => {
  test('parses "Sat May 9" to correct month and day', () => {
    const d = parseDate('Sat May 9');
    expect(d.getMonth()).toBe(4);
    expect(d.getDate()).toBe(9);
  });

  test('parses "Mon Jan 5" to correct month and day', () => {
    const d = parseDate('Mon Jan 5');
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  test('falls back to today for null input', () => {
    const d = parseDate(null);
    const today = new Date();
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });

  test('falls back to today for empty string', () => {
    const d = parseDate('');
    const today = new Date();
    expect(d.getMonth()).toBe(today.getMonth());
    expect(d.getDate()).toBe(today.getDate());
  });
});

describe('fmtDate + parseDate roundtrip', () => {
  test('roundtrip preserves month and day', () => {
    const original = new Date(2026, 4, 16);
    const formatted = fmtDate(original);
    const parsed = parseDate(formatted);
    expect(parsed.getMonth()).toBe(original.getMonth());
    expect(parsed.getDate()).toBe(original.getDate());
  });
});

describe('parseTime', () => {
  test('parses "7:00 AM"', () => {
    expect(parseTime('7:00 AM')).toEqual({ h: 7, m: 0, ap: 'AM' });
  });

  test('parses "12:00 PM"', () => {
    expect(parseTime('12:00 PM')).toEqual({ h: 12, m: 0, ap: 'PM' });
  });

  test('parses "12:30 AM"', () => {
    expect(parseTime('12:30 AM')).toEqual({ h: 12, m: 30, ap: 'AM' });
  });

  test('parses "6:30 PM"', () => {
    expect(parseTime('6:30 PM')).toEqual({ h: 6, m: 30, ap: 'PM' });
  });

  test('returns default for null input', () => {
    expect(parseTime(null)).toEqual({ h: 12, m: 0, ap: 'AM' });
  });

  test('returns default for empty string', () => {
    expect(parseTime('')).toEqual({ h: 12, m: 0, ap: 'AM' });
  });
});

describe('fmtTime', () => {
  test('formats {h:7, m:0, ap:"AM"} to "7:00 AM"', () => {
    expect(fmtTime({ h: 7, m: 0, ap: 'AM' })).toBe('7:00 AM');
  });

  test('formats {h:12, m:30, ap:"PM"} to "12:30 PM"', () => {
    expect(fmtTime({ h: 12, m: 30, ap: 'PM' })).toBe('12:30 PM');
  });

  test('pads single-digit minutes with zero', () => {
    expect(fmtTime({ h: 9, m: 5, ap: 'AM' })).toBe('9:05 AM');
  });
});

describe('parseTime + fmtTime roundtrip', () => {
  test.each([
    '7:00 AM', '12:00 PM', '6:30 PM', '12:00 AM', '11:45 PM',
  ])('roundtrip preserves "%s"', (t) => {
    expect(fmtTime(parseTime(t))).toBe(t);
  });
});

describe('timeToMin', () => {
  test('7:00 AM = 420 minutes', () => {
    expect(timeToMin('7:00 AM')).toBe(420);
  });
  test('12:00 PM (noon) = 720 minutes', () => {
    expect(timeToMin('12:00 PM')).toBe(720);
  });
  test('12:00 AM (midnight) = 0 minutes', () => {
    expect(timeToMin('12:00 AM')).toBe(0);
  });
  test('6:30 PM = 1110 minutes', () => {
    expect(timeToMin('6:30 PM')).toBe(1110);
  });
  test('11:59 PM = 1439 minutes', () => {
    expect(timeToMin('11:59 PM')).toBe(1439);
  });
  test('1:00 AM = 60 minutes', () => {
    expect(timeToMin('1:00 AM')).toBe(60);
  });
});

describe('minToTime', () => {
  test('420 minutes = 7:00 AM', () => {
    expect(minToTime(420)).toBe('7:00 AM');
  });
  test('720 minutes = 12:00 PM', () => {
    expect(minToTime(720)).toBe('12:00 PM');
  });
  test('0 minutes = 12:00 AM', () => {
    expect(minToTime(0)).toBe('12:00 AM');
  });
  test('1439 minutes = 11:59 PM', () => {
    expect(minToTime(1439)).toBe('11:59 PM');
  });
});

describe('timeToMin + minToTime roundtrip', () => {
  test.each([
    '7:00 AM', '12:00 PM', '12:00 AM', '6:30 PM', '11:59 PM', '1:00 AM',
  ])('roundtrip preserves "%s"', (t) => {
    expect(minToTime(timeToMin(t))).toBe(t);
  });
});

describe('whenRange', () => {
  test('formats event with endTime as range', () => {
    expect(whenRange({ when: 'Sat May 9 · 7:00 AM', endTime: '9:00 AM' }))
      .toBe('Sat May 9 · 7:00 AM – 9:00 AM');
  });

  test('returns just when string if no endTime', () => {
    expect(whenRange({ when: 'Sat May 9 · 7:00 AM' }))
      .toBe('Sat May 9 · 7:00 AM');
  });

  test('returns empty string for null event', () => {
    expect(whenRange(null)).toBe('');
  });

  test('returns empty string for undefined event', () => {
    expect(whenRange(undefined)).toBe('');
  });

  test('handles event with empty endTime', () => {
    expect(whenRange({ when: 'Sat May 9 · 7:00 AM', endTime: '' }))
      .toBe('Sat May 9 · 7:00 AM');
  });
});

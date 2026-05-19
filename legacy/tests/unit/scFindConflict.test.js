// Unit tests for scFindConflict (src/heuristic-fixes.jsx:24)
// FR coverage: FR5.5 (schedule management), FR7 (subscription conflicts)

describe('scFindConflict', () => {
  const scFindConflict = global.scFindConflict;

  test('detects conflict when events are on same day within 2 hours', () => {
    // e1 is Sat May 9 · 7:00 AM, e9 is Sat May 9 · 8:00 AM (1hr apart < 2hr threshold)
    const e9 = global.SC_EVENT_BY_ID['e9'];
    const joined = new Set(['e1']);
    const conflict = scFindConflict(e9, joined);
    expect(conflict).not.toBeNull();
    expect(conflict.id).toBe('e1');
  });

  test('returns null when events are far apart in time', () => {
    // e2 is Sat May 9 · 6:30 PM, e1 is Sat May 9 · 7:00 AM (11.5hrs apart)
    const e2 = global.SC_EVENT_BY_ID['e2'];
    const joined = new Set(['e1']);
    const conflict = scFindConflict(e2, joined);
    expect(conflict).toBeNull();
  });

  test('returns null for null event', () => {
    expect(scFindConflict(null, new Set(['e1']))).toBeNull();
  });

  test('returns null for empty joined set', () => {
    const e9 = global.SC_EVENT_BY_ID['e9'];
    expect(scFindConflict(e9, new Set())).toBeNull();
  });

  test('returns null for undefined joined set', () => {
    const e9 = global.SC_EVENT_BY_ID['e9'];
    expect(scFindConflict(e9, undefined)).toBeNull();
  });

  test('skips self — does not report conflict with own event', () => {
    const e1 = global.SC_EVENT_BY_ID['e1'];
    const joined = new Set(['e1']);
    // e1 checking against itself should be skipped
    const conflict = scFindConflict(e1, joined);
    expect(conflict).toBeNull();
  });

  test('detects conflict with exactly 119 minutes apart (under threshold)', () => {
    // e1: 7:00 AM = 420 min, e9: 8:00 AM = 480 min → diff = 60 < 120 ✓
    const e9 = global.SC_EVENT_BY_ID['e9'];
    const joined = new Set(['e1']);
    expect(scFindConflict(e9, joined)).not.toBeNull();
  });
});

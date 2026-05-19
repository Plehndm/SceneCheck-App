// Unit tests for lib/conflicts.ts — the consolidated conflict-detection
// module from the code-review fix. Previously the same logic lived in
// both app.jsx (`eventsOverlap`) and heuristic-fixes.jsx (`scFindConflict`);
// this exercises the single source of truth.

import {
  eventsOverlap, findConflict, findAllConflicts, OVERLAP_WINDOW_MIN,
} from '@/lib/conflicts';
import { SC_EVENT_BY_ID } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

describe('OVERLAP_WINDOW_MIN', () => {
  test('is 120 (matches legacy threshold)', () => {
    expect(OVERLAP_WINDOW_MIN).toBe(120);
  });
});

describe('eventsOverlap', () => {
  test('returns false for null/undefined', () => {
    expect(eventsOverlap(null, null)).toBe(false);
    expect(eventsOverlap(undefined, undefined)).toBe(false);
    expect(eventsOverlap(SC_EVENT_BY_ID.e1, null)).toBe(false);
  });

  test('returns true for events 1hr apart on same day', () => {
    // e1: Sat May 9 7:00 AM, e9: Sat May 9 8:00 AM → 60 min < 120
    expect(eventsOverlap(SC_EVENT_BY_ID.e1, SC_EVENT_BY_ID.e9)).toBe(true);
  });

  test('returns false for events ~11hr apart on same day', () => {
    // e1: 7:00 AM, e2: 6:30 PM → 690 min > 120
    expect(eventsOverlap(SC_EVENT_BY_ID.e1, SC_EVENT_BY_ID.e2)).toBe(false);
  });

  test('returns false for events on different dates', () => {
    // e3 is Fri May 8, e1 is Sat May 9
    expect(eventsOverlap(SC_EVENT_BY_ID.e3, SC_EVENT_BY_ID.e1)).toBe(false);
  });

  test('is symmetric', () => {
    expect(eventsOverlap(SC_EVENT_BY_ID.e1, SC_EVENT_BY_ID.e9))
      .toBe(eventsOverlap(SC_EVENT_BY_ID.e9, SC_EVENT_BY_ID.e1));
  });

  test('returns false when when-string is malformed', () => {
    const bad: SCEvent = { ...SC_EVENT_BY_ID.e1, when: 'garbage' };
    expect(eventsOverlap(bad, SC_EVENT_BY_ID.e9)).toBe(false);
  });
});

describe('findConflict', () => {
  test('returns null when no event passed', () => {
    expect(findConflict(null, new Set(['e1']), SC_EVENT_BY_ID)).toBeNull();
  });

  test('returns null for empty joined set', () => {
    expect(findConflict(SC_EVENT_BY_ID.e9, new Set(), SC_EVENT_BY_ID)).toBeNull();
  });

  test('detects conflict with a joined event 1hr apart', () => {
    const conflict = findConflict(SC_EVENT_BY_ID.e9, new Set(['e1']), SC_EVENT_BY_ID);
    expect(conflict).not.toBeNull();
    expect(conflict?.id).toBe('e1');
  });

  test('returns null when joined events are far apart in time', () => {
    expect(findConflict(SC_EVENT_BY_ID.e2, new Set(['e1']), SC_EVENT_BY_ID)).toBeNull();
  });

  test('skips self — does not flag conflict with own joined event', () => {
    expect(findConflict(SC_EVENT_BY_ID.e1, new Set(['e1']), SC_EVENT_BY_ID)).toBeNull();
  });

  test('handles missing events in lookup gracefully', () => {
    expect(findConflict(SC_EVENT_BY_ID.e9, new Set(['NOT_REAL']), SC_EVENT_BY_ID)).toBeNull();
  });
});

describe('findAllConflicts', () => {
  test('returns empty array when no conflicts', () => {
    expect(findAllConflicts(SC_EVENT_BY_ID.e2, new Set(['e1']), SC_EVENT_BY_ID)).toEqual([]);
  });

  test('returns all matching conflicts', () => {
    // e1 and e9 are both Sat May 9 within 2hrs; checking against e1's start
    // window from e9's perspective with both joined returns [e1].
    const result = findAllConflicts(SC_EVENT_BY_ID.e9, new Set(['e1', 'e2']), SC_EVENT_BY_ID);
    expect(result.map(c => c.id)).toEqual(['e1']);
  });

  test('returns empty when only self is joined', () => {
    expect(findAllConflicts(SC_EVENT_BY_ID.e1, new Set(['e1']), SC_EVENT_BY_ID)).toEqual([]);
  });
});

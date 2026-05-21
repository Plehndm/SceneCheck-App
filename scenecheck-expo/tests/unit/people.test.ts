// Unit tests for lib/people.excludeSelf — the helper that keeps the
// signed-in user out of "people nearby" / search results.

import { excludeSelf } from '@/lib/people';

const PEOPLE = [
  { id: 'p1', name: 'Maya Chen' },
  { id: 'p2', name: 'Jordan Park' },
  { id: 'p3', name: 'Sasha Williams' },
];

describe('excludeSelf', () => {
  test('removes the current user when meId matches a list id directly', () => {
    const out = excludeSelf(PEOPLE, 'p2');
    expect(out.map(p => p.id)).toEqual(['p1', 'p3']);
  });

  test('removes the current user via the UUID → mock-id mapping (live mode)', () => {
    // ID_MAP maps 'p1' → this UUID, so signing in as that live user must
    // drop the matching mock person from the list.
    const out = excludeSelf(PEOPLE, '00000000-0000-0000-0000-000000000002');
    expect(out.map(p => p.id)).toEqual(['p2', 'p3']);
  });

  test('returns the list unchanged when meId is undefined', () => {
    expect(excludeSelf(PEOPLE, undefined)).toHaveLength(3);
  });

  test('returns the list unchanged when the user is not in it', () => {
    expect(excludeSelf(PEOPLE, 'p9')).toHaveLength(3);
  });
});

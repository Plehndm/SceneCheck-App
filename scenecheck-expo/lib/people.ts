// Small people-list helpers shared by the Home rail + Search.

import { toMockId } from './api';

// Drop the signed-in user from a people list so you never see yourself in
// "people nearby" / search results. The mock fixtures key people by mock
// id ('p1'…), while the live `me.id` is a UUID — matching on the UUID and
// its mock-id mapping covers both mock and live modes.
export function excludeSelf<T extends { id: string }>(
  people: T[],
  meId: string | undefined,
): T[] {
  if (!meId) return people;
  const selfMock = toMockId(meId);
  return people.filter((p) => p.id !== meId && p.id !== selfMock);
}

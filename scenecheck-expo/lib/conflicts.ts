// Single source of truth for event-overlap detection. The legacy prototype
// had this logic duplicated in app.jsx (`eventsOverlap`) and
// heuristic-fixes.jsx (`scFindConflict`); the code review flagged that a
// threshold change in one would silently desync from the other. This module
// is the canonical implementation — both the conflict modal and the
// conflict chip consume it.
//
// Two events are considered to conflict when they fall on the same date and
// their start times are within OVERLAP_WINDOW_MIN of each other.

import type { SCEvent } from '@/types/domain';

export const OVERLAP_WINDOW_MIN = 120;

interface Parsed { date: string; mins: number }

function parseWhen(when: string | undefined | null): Parsed | null {
  const m = when && when.match(/^(.+?)\s·\s(\d{1,2}):(\d{2})\s(AM|PM)/);
  if (!m) return null;
  let h = parseInt(m[2], 10);
  const min = parseInt(m[3], 10);
  if (m[4] === 'PM' && h !== 12) h += 12;
  if (m[4] === 'AM' && h === 12) h = 0;
  return { date: m[1].trim(), mins: h * 60 + min };
}

export function eventsOverlap(
  a: Pick<SCEvent, 'when'> | null | undefined,
  b: Pick<SCEvent, 'when'> | null | undefined,
): boolean {
  if (!a || !b) return false;
  const pa = parseWhen(a.when);
  const pb = parseWhen(b.when);
  if (!pa || !pb) return false;
  return pa.date === pb.date && Math.abs(pa.mins - pb.mins) < OVERLAP_WINDOW_MIN;
}

export function findConflict(
  event: SCEvent | null | undefined,
  joinedIds: Iterable<string>,
  eventsById: Record<string, SCEvent>,
): SCEvent | null {
  if (!event) return null;
  for (const id of joinedIds) {
    if (id === event.id) continue;
    const other = eventsById[id];
    if (!other) continue;
    if (eventsOverlap(event, other)) return other;
  }
  return null;
}

export function findAllConflicts(
  event: SCEvent | null | undefined,
  joinedIds: Iterable<string>,
  eventsById: Record<string, SCEvent>,
): SCEvent[] {
  if (!event) return [];
  const out: SCEvent[] = [];
  for (const id of joinedIds) {
    if (id === event.id) continue;
    const other = eventsById[id];
    if (!other) continue;
    if (eventsOverlap(event, other)) out.push(other);
  }
  return out;
}

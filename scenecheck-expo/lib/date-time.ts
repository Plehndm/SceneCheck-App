// Date/time helpers. Pure functions, easy to unit-test. Ported from
// src/date-time.jsx (no-bundler version exposed these on window).

import type { SCEvent } from '@/types/domain';

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const MON_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
export const MON_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export interface TimeParts { h: number; m: number; ap: 'AM' | 'PM' }

export function fmtDate(d: Date): string {
  return `${DOW_SHORT[d.getDay()]} ${MON_SHORT[d.getMonth()]} ${d.getDate()}`;
}

export function parseDate(s: string | null | undefined): Date {
  const m = (s || '').match(/([A-Za-z]+)\s+(\d+)/);
  const now = new Date();
  if (!m) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monIdx = MON_SHORT.indexOf(m[1].slice(0, 3) as typeof MON_SHORT[number]);
  const day = parseInt(m[2], 10);
  // Bump to next year if the month already passed this year.
  const year = now.getFullYear() + (monIdx < now.getMonth() ? 1 : 0);
  return new Date(year, Math.max(0, monIdx), day);
}

export function parseTime(t: string | null | undefined): TimeParts {
  const m = (t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return { h: 12, m: 0, ap: 'AM' };
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10), ap: m[3].toUpperCase() as 'AM' | 'PM' };
}

export function fmtTime(parts: TimeParts): string {
  return `${parts.h}:${String(parts.m).padStart(2, '0')} ${parts.ap}`;
}

export function timeToMin(t: string): number {
  const { h, m, ap } = parseTime(t);
  let hr = h % 12;
  if (ap === 'PM') hr += 12;
  return hr * 60 + m;
}

export function minToTime(min: number): string {
  const total = ((min % (24 * 60)) + 24 * 60) % (24 * 60);
  let h = Math.floor(total / 60);
  const m = total % 60;
  const ap: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return fmtTime({ h, m, ap });
}

export function whenRange(e: Pick<SCEvent, 'when' | 'endTime'> | null | undefined): string {
  if (!e) return '';
  if (e.endTime) return `${e.when} – ${e.endTime}`;
  return e.when;
}

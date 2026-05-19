// Date/time helpers shared across the app. Extracted from screens.jsx and
// data.jsx so they live next to their tests in tests/unit/. Like the other
// source files this exposes its API on window for the no-bundler setup.

const SC_DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SC_MON_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const SC_MON_LONG  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function scFmtDate(d) {
  return `${SC_DOW_SHORT[d.getDay()]} ${SC_MON_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function scParseDate(s) {
  // Match e.g. "Sat May 16" — falls back to today if it can't parse.
  const m = (s || '').match(/([A-Za-z]+)\s+(\d+)/);
  const now = new Date();
  if (!m) return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monIdx = SC_MON_SHORT.indexOf(m[1].slice(0,3));
  const day = parseInt(m[2], 10);
  // Bump to next year if month already passed this year.
  const year = now.getFullYear() + (monIdx < now.getMonth() ? 1 : 0);
  return new Date(year, Math.max(0, monIdx), day);
}

function scParseTime(t) {
  const m = (t || '').match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return { h: 12, m: 0, ap: 'AM' };
  return { h: parseInt(m[1], 10), m: parseInt(m[2], 10), ap: m[3].toUpperCase() };
}

function scFmtTime(parts) {
  return `${parts.h}:${String(parts.m).padStart(2,'0')} ${parts.ap}`;
}

// Time math helpers for guardrails (start < end). Times are stored as the
// friendly strings like "7:00 AM" but compared as minutes-since-midnight.
function scTimeToMin(t) {
  const { h, m, ap } = scParseTime(t);
  let hr = h % 12;
  if (ap === 'PM') hr += 12;
  return hr * 60 + m;
}

function scMinToTime(min) {
  const total = ((min % (24*60)) + 24*60) % (24*60);
  let h = Math.floor(total / 60);
  const m = total % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return scFmtTime({ h, m, ap });
}

// "Sat May 9 · 7:00 AM – 9:00 AM" if the event has an endTime, else just the
// start. All display surfaces (cards, lists, detail, chat chips) call this.
function scWhenRange(e) {
  if (!e) return '';
  if (e.endTime) return `${e.when} – ${e.endTime}`;
  return e.when;
}

Object.assign(window, {
  SC_DOW_SHORT, SC_MON_SHORT, SC_MON_LONG,
  scFmtDate, scParseDate, scParseTime, scFmtTime,
  scTimeToMin, scMinToTime, scWhenRange,
});

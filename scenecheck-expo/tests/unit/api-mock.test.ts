// Mock-mode behavior of the API client. Ported from the prototype's
// tests/integration/api-mock-mode.test.js — now exercised through real
// imports instead of `window.SC_API` globals.

import { api } from '@/lib/api';
import {
  SC_EVENTS, SC_EVENT_BY_ID, SC_CHATS, SC_THREADS, SC_INTERESTS_SUGGESTED,
  SC_VISIBLE_PEOPLE, SC_ORGS,
} from '@/data/mocks';

describe('api.isMock()', () => {
  test('returns true when no Supabase env vars are set', () => {
    // jest.setup.ts doesn't set EXPO_PUBLIC_SUPABASE_URL / ANON_KEY,
    // so the supabase client is null and isMock should be true.
    expect(api.isMock()).toBe(true);
  });
});

describe('api.fetchEvents (mock)', () => {
  test('returns the SC_EVENTS fixture', async () => {
    const events = await api.fetchEvents(33.64, -117.84, 5000);
    expect(events).toBe(SC_EVENTS);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('id');
    expect(events[0]).toHaveProperty('title');
  });
});

describe('api.getEventById (mock)', () => {
  test('returns the correct event', async () => {
    const event = await api.getEventById('e1');
    expect(event).not.toBeNull();
    expect(event?.id).toBe('e1');
    expect(event?.title).toContain('Morning Ride');
  });

  test('returns null for unknown id', async () => {
    expect(await api.getEventById('NOT_REAL')).toBeNull();
  });
});

describe('api.getProfile (mock)', () => {
  test('returns the "me" profile', async () => {
    const profile = await api.getProfile('me');
    expect(profile).toBeDefined();
    expect(profile.name).toBe('Alex Rivera');
  });
});

describe('api.searchPeople (mock)', () => {
  test('returns SC_VISIBLE_PEOPLE for an empty query', async () => {
    expect(await api.searchPeople('')).toBe(SC_VISIBLE_PEOPLE);
  });

  test('filters by name / username / interest, case-insensitively', async () => {
    const byName = await api.searchPeople('maya');
    expect(byName.some(p => p.name === 'Maya Chen')).toBe(true);
    const byInterest = await api.searchPeople('CLIMBING');
    expect(byInterest.length).toBeGreaterThan(0);
  });

  test('returns [] for no match', async () => {
    expect(await api.searchPeople('zzznoone')).toEqual([]);
  });
});

describe('api.searchOrgs (mock)', () => {
  test('returns SC_ORGS for an empty query', async () => {
    expect(await api.searchOrgs('')).toBe(SC_ORGS);
  });

  test('filters by name / handle', async () => {
    const results = await api.searchOrgs('topout');
    expect(results.some(o => o.name === 'TopOut Climbing')).toBe(true);
  });
});

describe('api.getProfilesByIds (mock)', () => {
  test('resolves known mock ids to accounts (order preserved, misses dropped)', async () => {
    const rows = await api.getProfilesByIds(['p1', 'nope', 'orgA']);
    expect(rows.map(r => r.name)).toEqual(['Maya Chen', 'TopOut Climbing']);
  });

  test('returns [] for an empty id list', async () => {
    expect(await api.getProfilesByIds([])).toEqual([]);
  });
});

describe('api avatar (mock)', () => {
  test('uploadAvatar echoes the local uri (no backend in mock mode)', async () => {
    expect(await api.uploadAvatar('file:///tmp/pic.jpg')).toBe('file:///tmp/pic.jpg');
  });

  test('removeAvatar resolves to a no-op in mock mode', async () => {
    await expect(api.removeAvatar()).resolves.toBeUndefined();
  });
});

describe('api.searchInterests (mock)', () => {
  test('filters by query', async () => {
    const results = await api.searchInterests('bik');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tag).toBe('biking');
  });

  test('returns empty for no match', async () => {
    expect(await api.searchInterests('xyznonexistent')).toEqual([]);
  });

  test('is case-insensitive', async () => {
    const results = await api.searchInterests('BIKING');
    expect(results.length).toBeGreaterThan(0);
  });
});

describe('api.getChats / getChatMessages (mock)', () => {
  test('getChats returns SC_CHATS', async () => {
    expect(await api.getChats()).toBe(SC_CHATS);
  });

  test('getChatMessages returns the thread for a known chat', async () => {
    const msgs = await api.getChatMessages('c1');
    expect(msgs).toBe(SC_THREADS.c1);
    expect(msgs.length).toBeGreaterThan(0);
  });

  test('getChatMessages returns [] for unknown chat', async () => {
    expect(await api.getChatMessages('NOT_REAL')).toEqual([]);
  });
});

describe('api.subscribeToEvent (mock)', () => {
  test('returns confirmed status', async () => {
    const result = await api.subscribeToEvent('e1');
    expect(result.status).toBe('confirmed');
  });
});

describe('api.rateEvent (mock)', () => {
  test('returns rated:true without hitting a backend', async () => {
    expect(await api.rateEvent('e1', 5, 'great event')).toEqual({ rated: true });
  });
});

describe('api.deleteRating (mock)', () => {
  test('returns deleted:true without hitting a backend', async () => {
    expect(await api.deleteRating('e1')).toEqual({ deleted: true });
  });
});

describe('api.sendFriendRequest (mock)', () => {
  test('returns pending status', async () => {
    const result = await api.sendFriendRequest('p2');
    expect(result.status).toBe('pending');
  });
});

describe('api ID mapping', () => {
  test('toUUID converts known mock IDs', () => {
    expect(api.toUUID('me')).toBe('00000000-0000-0000-0000-000000000001');
    expect(api.toUUID('e1')).toBe('20000000-0000-0000-0000-000000000001');
  });

  test('toMockId converts UUIDs back', () => {
    expect(api.toMockId('00000000-0000-0000-0000-000000000001')).toBe('me');
    expect(api.toMockId('20000000-0000-0000-0000-000000000001')).toBe('e1');
  });

  test('unknown IDs pass through unchanged', () => {
    expect(api.toUUID('unknown-id')).toBe('unknown-id');
    expect(api.toMockId('unknown-uuid')).toBe('unknown-uuid');
  });

  test('toUUID / toMockId roundtrip preserves known mocks', () => {
    const ids = ['me', 'p1', 'p2', 'e1', 'e2', 'orgA'];
    for (const id of ids) {
      expect(api.toMockId(api.toUUID(id))).toBe(id);
    }
  });
});

describe('static mocks coverage', () => {
  test('all SC_EVENTS appear in SC_EVENT_BY_ID', () => {
    for (const e of SC_EVENTS) {
      expect(SC_EVENT_BY_ID[e.id]).toBe(e);
    }
  });

  test('SC_INTERESTS_SUGGESTED is non-empty', () => {
    expect(SC_INTERESTS_SUGGESTED.length).toBeGreaterThan(0);
  });
});

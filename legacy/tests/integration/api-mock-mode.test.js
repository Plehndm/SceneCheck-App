// Integration tests for the API client in mock mode
// Verifies that api.js correctly falls back to SC_* mock data
// when liveBackend is off (default behavior).

// Note: api.js is loaded in jest.setup.js via the source file chain
// but since we skipped app.jsx and api.js depends on window.supabase
// which doesn't exist in test env, it will default to mock mode.

// We need to manually load api.js since jest.setup.js doesn't include it
beforeAll(() => {
  // Ensure api.js globals are available
  if (!global.SC_API) {
    require('../../src/api.js');
  }
});

describe('SC_API mock mode', () => {
  const api = () => global.SC_API;

  test('useMock() returns true when no Supabase client', () => {
    expect(api().useMock()).toBe(true);
  });

  test('fetchEvents returns SC_EVENTS in mock mode', async () => {
    const events = await api().fetchEvents(33.64, -117.84, 5000);
    expect(events).toBe(global.SC_EVENTS);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toHaveProperty('id');
    expect(events[0]).toHaveProperty('title');
  });

  test('getEventById returns correct event in mock mode', async () => {
    const event = await api().getEventById('e1');
    expect(event).toBeDefined();
    expect(event.id).toBe('e1');
    expect(event.title).toContain('Morning Ride');
  });

  test('getProfile returns profile for "me" in mock mode', async () => {
    const profile = await api().getProfile('me');
    expect(profile).toBeDefined();
    expect(profile.name).toBe('Alex Rivera');
  });

  test('searchInterests filters mock data by query', async () => {
    const results = await api().searchInterests('bik');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].tag).toBe('biking');
  });

  test('searchInterests returns empty for no match', async () => {
    const results = await api().searchInterests('xyznonexistent');
    expect(results.length).toBe(0);
  });

  test('getChats returns SC_CHATS in mock mode', async () => {
    const chats = await api().getChats();
    expect(chats).toBe(global.SC_CHATS);
    expect(chats.length).toBeGreaterThan(0);
  });

  test('getChatMessages returns thread messages in mock mode', async () => {
    const messages = await api().getChatMessages('c1');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0]).toHaveProperty('text');
  });

  test('subscribeToEvent returns confirmed in mock mode', async () => {
    const result = await api().subscribeToEvent('e1');
    expect(result.status).toBe('confirmed');
  });

  test('sendFriendRequest returns pending in mock mode', async () => {
    const result = await api().sendFriendRequest('p2');
    expect(result.status).toBe('pending');
  });

  test('ID mapping: toUUID converts mock IDs', () => {
    expect(api().toUUID('me')).toBe('00000000-0000-0000-0000-000000000001');
    expect(api().toUUID('e1')).toBe('20000000-0000-0000-0000-000000000001');
  });

  test('ID mapping: toMockId converts UUIDs back', () => {
    expect(api().toMockId('00000000-0000-0000-0000-000000000001')).toBe('me');
    expect(api().toMockId('20000000-0000-0000-0000-000000000001')).toBe('e1');
  });

  test('ID mapping: unknown IDs pass through unchanged', () => {
    expect(api().toUUID('unknown-id')).toBe('unknown-id');
    expect(api().toMockId('unknown-uuid')).toBe('unknown-uuid');
  });
});

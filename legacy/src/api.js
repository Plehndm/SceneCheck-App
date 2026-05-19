// SceneCheck API Client — dual-mode bridge between frontend and Supabase backend.
// When liveBackend is off (default), returns mock data from SC_* globals.
// When on, makes real Supabase calls and transforms responses to match mock shapes.

// ── Configuration ──────────────────────────────────────────────
// These are placeholders — replace with real values after Supabase project creation.
const SC_SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SC_SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// The Supabase JS client is loaded via CDN <script> tag in index.html.
// window.supabase?.createClient is available if the CDN loaded.
const supabase = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SC_SUPABASE_URL, SC_SUPABASE_ANON_KEY)
  : null;

function useMock() {
  // Use mock data unless Supabase client exists AND the live toggle is on
  if (!supabase) return true;
  if (typeof window !== 'undefined' && window.scFixes && window.scFixes.liveBackend) return false;
  return true;
}

// ── ID Mapping (mock string IDs ↔ real UUIDs) ─────────────────
const ID_MAP = {
  'me':    '00000000-0000-0000-0000-000000000001',
  'p1':    '00000000-0000-0000-0000-000000000002',
  'p2':    '00000000-0000-0000-0000-000000000003',
  'p3':    '00000000-0000-0000-0000-000000000004',
  'p4':    '00000000-0000-0000-0000-000000000005',
  'p5':    '00000000-0000-0000-0000-000000000006',
  'p6':    '00000000-0000-0000-0000-000000000007',
  'org1':  '00000000-0000-0000-0000-000000000011',
  'org2':  '00000000-0000-0000-0000-000000000012',
  'org3':  '00000000-0000-0000-0000-000000000013',
  'orgA':  '00000000-0000-0000-0000-000000000021',
  'orgB':  '00000000-0000-0000-0000-000000000022',
  'orgC':  '00000000-0000-0000-0000-000000000023',
  'orgD':  '00000000-0000-0000-0000-000000000024',
  'e1':    '20000000-0000-0000-0000-000000000001',
  'e2':    '20000000-0000-0000-0000-000000000002',
  'e3':    '20000000-0000-0000-0000-000000000003',
  'e4':    '20000000-0000-0000-0000-000000000004',
  'e5':    '20000000-0000-0000-0000-000000000005',
  'e6':    '20000000-0000-0000-0000-000000000006',
  'e7':    '20000000-0000-0000-0000-000000000007',
  'e8':    '20000000-0000-0000-0000-000000000008',
  'e9':    '20000000-0000-0000-0000-000000000009',
};
const REVERSE_ID = Object.fromEntries(Object.entries(ID_MAP).map(([k, v]) => [v, k]));

function toUUID(mockId) { return ID_MAP[mockId] || mockId; }
function toMockId(uuid) { return REVERSE_ID[uuid] || uuid; }

// ── Transform Functions (DB row → mock data shape) ────────────
function fmtWhen(startAt) {
  if (!startAt) return '';
  const d = new Date(startAt);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()} · ${h}:${m} ${ap}`;
}

function fmtTime(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function transformEventRow(row, currentUserId) {
  const creatorMockId = toMockId(row.creator_id);
  const kind = row.source === 'scraped' ? 'recommended'
    : row.creator_id === currentUserId ? 'yours'
    : 'friend'; // simplified — would need friendship check for accuracy
  return {
    id: toMockId(row.id),
    kind,
    hostId: creatorMockId,
    title: row.title,
    desc: row.description || '',
    interests: (row.event_interests || []).map(ei =>
      typeof ei === 'string' ? ei : ei.interest_id?.name || ei.name || ''
    ),
    when: fmtWhen(row.start_at),
    endTime: fmtTime(row.end_at),
    where: row.location_name || '',
    attendees: row.subscriber_count || 0,
    cap: row.capacity || 0,
    rating: null,
    x: row.lng ? (row.lng + 117.88) / 0.12 : 0.5,  // normalize to 0-1 for SVG map
    y: row.lat ? (row.lat - 33.62) / 0.06 : 0.5,
  };
}

// ── API Methods ───────────────────────────────────────────────
const api = {
  // ── Auth ──
  async signUp(email, password) {
    if (useMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signIn(email, password) {
    if (useMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    if (useMock()) return;
    await supabase.auth.signOut();
  },

  async getCurrentUser() {
    if (useMock()) return SC_ME;
    const { data } = await supabase.auth.getUser();
    return data?.user || null;
  },

  // ── Events ──
  async fetchEvents(lat, lng, radiusM) {
    if (useMock()) return SC_EVENTS;
    const user = await this.getCurrentUser();
    const { data, error } = await supabase.rpc('rank_events_query', {
      p_lat: lat || 33.6461,
      p_lng: lng || -117.8427,
      p_radius: radiusM || 8047,
      p_user_id: user?.id,
    });
    if (error) throw error;
    return (data || []).map(row => transformEventRow(row, user?.id));
  },

  async getEventById(eventId) {
    if (useMock()) return SC_EVENT_BY_ID[eventId] || null;
    const uuid = toUUID(eventId);
    const { data, error } = await supabase
      .from('events')
      .select('*, event_interests(interest_id(name))')
      .eq('id', uuid)
      .single();
    if (error) throw error;
    const user = await this.getCurrentUser();
    return transformEventRow(data, user?.id);
  },

  async createEvent(form) {
    if (useMock()) return { event_id: 'mock_' + Date.now() };
    const { data, error } = await supabase.functions.invoke('create-event', {
      body: form,
    });
    if (error) throw error;
    return data;
  },

  async subscribeToEvent(eventId, joinChat = false) {
    if (useMock()) return { status: 'confirmed', chat_id: null };
    const { data, error } = await supabase.functions.invoke('subscribe-to-event', {
      body: { event_id: toUUID(eventId), join_chat: joinChat },
    });
    if (error) throw error;
    return data;
  },

  // ── Profile ──
  async getProfile(userId) {
    if (useMock()) return SC_ACCOUNT_BY_ID[userId] || SC_ME;
    const uuid = toUUID(userId);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uuid)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(fields) {
    if (useMock()) return fields;
    const user = await this.getCurrentUser();
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Social ──
  async sendFriendRequest(targetId) {
    if (useMock()) return { status: 'pending' };
    const { data, error } = await supabase.functions.invoke('send-friend-request', {
      body: { target_id: toUUID(targetId) },
    });
    if (error) throw error;
    return data;
  },

  async acceptFriendRequest(friendshipId) {
    if (useMock()) return { status: 'accepted' };
    const { data, error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async blockUser(targetId) {
    if (useMock()) return { blocked: true };
    const user = await this.getCurrentUser();
    const { error } = await supabase
      .from('blocks')
      .insert({ blocker_id: user.id, blocked_id: toUUID(targetId) });
    if (error) throw error;
    return { blocked: true };
  },

  // ── Interests ──
  async searchInterests(query) {
    if (useMock()) {
      return SC_INTERESTS_SUGGESTED.filter(i =>
        i.tag.toLowerCase().includes(query.toLowerCase())
      );
    }
    const { data, error } = await supabase
      .from('interests')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    if (error) throw error;
    return data;
  },

  async subscribeToInterest(interestId) {
    if (useMock()) return { subscribed: true };
    const user = await this.getCurrentUser();
    const { error } = await supabase
      .from('user_interests')
      .insert({ user_id: user.id, interest_id: toUUID(interestId) });
    if (error) throw error;
    return { subscribed: true };
  },

  // ── Chat ──
  async getChats() {
    if (useMock()) return SC_CHATS;
    const { data, error } = await supabase
      .from('chats')
      .select('*, chat_members(user_id), messages(body, created_at, sender_id)')
      .order('created_at', { foreignTable: 'messages', ascending: false });
    if (error) throw error;
    return data;
  },

  async getChatMessages(chatId) {
    if (useMock()) return SC_THREADS[chatId] || [];
    const uuid = toUUID(chatId);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', uuid)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async sendMessage(chatId, body) {
    if (useMock()) return { id: 'mock_' + Date.now(), body };
    const user = await this.getCurrentUser();
    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: toUUID(chatId), sender_id: user.id, body })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  subscribeToChat(chatId, onMessage) {
    if (useMock()) return { unsubscribe: () => {} };
    const uuid = toUUID(chatId);
    const channel = supabase.channel(`messages:${uuid}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${uuid}`,
      }, (payload) => onMessage(payload.new))
      .subscribe();
    return { unsubscribe: () => supabase.removeChannel(channel) };
  },

  // ── Notifications ──
  async fetchNotifications() {
    if (useMock()) return [];
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async markNotificationRead(notifId) {
    if (useMock()) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notifId);
  },

  // ── Ratings ──
  async rateEvent(eventId, stars, text) {
    if (useMock()) return { rated: true };
    const { data, error } = await supabase.functions.invoke('rollup-rating', {
      body: { event_id: toUUID(eventId), stars, text },
    });
    if (error) throw error;
    return data;
  },

  // ── Reports ──
  async submitReport(targetUserId, targetEventId, reason, details) {
    if (useMock()) return { reported: true };
    const user = await this.getCurrentUser();
    const { error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        target_user_id: targetUserId ? toUUID(targetUserId) : null,
        target_event_id: targetEventId ? toUUID(targetEventId) : null,
        reason,
        details: details || '',
      });
    if (error) throw error;
    return { reported: true };
  },

  // ── Utility ──
  useMock,
  toUUID,
  toMockId,
};

Object.assign(window, { SC_API: api });

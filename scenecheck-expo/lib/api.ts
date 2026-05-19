// SceneCheck API — dual-mode bridge between the frontend and Supabase.
//
// Ported from src/api.js with three structural changes the code review
// called out:
//   1. No more `window.supabase` / `window.SC_*` globals — everything
//      arrives via imports, which makes the module testable in isolation.
//   2. The mock toggle is no longer driven by an in-page Tweaks panel; it
//      flips automatically based on whether Supabase env vars are present
//      (or `EXPO_PUBLIC_USE_MOCK=1` is set).
//   3. Real types — every method's return shape is now declared.
//
// Mock-mode returns the static fixtures from data/mocks.ts so the UI can
// be developed before Supabase is provisioned.

import { supabase, isLiveBackendAvailable } from './supabase';
import { isoToTime, isoToWhen } from './date-time';
import {
  SC_ME, SC_EVENTS, SC_EVENT_BY_ID,
  SC_ACCOUNT_BY_ID, SC_INTERESTS_SUGGESTED,
  SC_CHATS, SC_THREADS,
} from '@/data/mocks';
import type { SCEvent, Account, Chat, Message, Interest } from '@/types/domain';

// ── ID mapping (mock string IDs ↔ real UUIDs) ─────────────────
const ID_MAP: Record<string, string> = {
  'me': '00000000-0000-0000-0000-000000000001',
  'p1': '00000000-0000-0000-0000-000000000002',
  'p2': '00000000-0000-0000-0000-000000000003',
  'p3': '00000000-0000-0000-0000-000000000004',
  'p4': '00000000-0000-0000-0000-000000000005',
  'p5': '00000000-0000-0000-0000-000000000006',
  'p6': '00000000-0000-0000-0000-000000000007',
  'org1': '00000000-0000-0000-0000-000000000011',
  'org2': '00000000-0000-0000-0000-000000000012',
  'org3': '00000000-0000-0000-0000-000000000013',
  'orgA': '00000000-0000-0000-0000-000000000021',
  'orgB': '00000000-0000-0000-0000-000000000022',
  'orgC': '00000000-0000-0000-0000-000000000023',
  'orgD': '00000000-0000-0000-0000-000000000024',
  'e1': '20000000-0000-0000-0000-000000000001',
  'e2': '20000000-0000-0000-0000-000000000002',
  'e3': '20000000-0000-0000-0000-000000000003',
  'e4': '20000000-0000-0000-0000-000000000004',
  'e5': '20000000-0000-0000-0000-000000000005',
  'e6': '20000000-0000-0000-0000-000000000006',
  'e7': '20000000-0000-0000-0000-000000000007',
  'e8': '20000000-0000-0000-0000-000000000008',
  'e9': '20000000-0000-0000-0000-000000000009',
};
const REVERSE_ID: Record<string, string> = Object.fromEntries(
  Object.entries(ID_MAP).map(([k, v]) => [v, k])
);

export const toUUID = (mockId: string): string => ID_MAP[mockId] || mockId;
export const toMockId = (uuid: string): string => REVERSE_ID[uuid] || uuid;

// ── Row transforms (DB → in-memory shape) ─────────────────────
// Formatting is delegated to lib/date-time.ts so the legacy duplication
// between this module and the date helpers is eliminated.

interface EventRow {
  id: string;
  title: string;
  description: string | null;
  start_at: string | null;
  end_at: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
  creator_id: string | null;
  capacity: number | null;
  subscriber_count: number | null;
  event_interests?: { interest_id?: { name?: string } | null; name?: string }[];
}

function transformEventRow(row: EventRow, currentUserId: string | null): SCEvent {
  const creatorMockId = row.creator_id ? toMockId(row.creator_id) : null;
  const kind: SCEvent['kind'] = row.source === 'scraped'
    ? 'recommended'
    : row.creator_id === currentUserId
      ? 'yours'
      : 'friend'; // simplified — accurate version needs the friendship table
  return {
    id: toMockId(row.id),
    kind,
    hostId: creatorMockId,
    title: row.title,
    desc: row.description || '',
    interests: (row.event_interests || []).map(ei =>
      (typeof ei === 'string' ? ei : ei.interest_id?.name || ei.name || '') as string
    ),
    when: isoToWhen(row.start_at),
    endTime: isoToTime(row.end_at),
    where: row.location_name || '',
    attendees: row.subscriber_count || 0,
    cap: row.capacity || 0,
    rating: null,
    // Pass real coordinates through directly. components/Map/types.ts:eventLatLng
    // prefers `lat`/`lng` when present; x/y stay at a centered default so any
    // legacy fixture/consumer still gets a valid number.
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    x: 0.5,
    y: 0.5,
  };
}

export const isMock = (): boolean => !isLiveBackendAvailable();

function requireClient() {
  if (!supabase) throw new Error('Supabase client not configured — set EXPO_PUBLIC_SUPABASE_URL/ANON_KEY.');
  return supabase;
}

// ── API surface ───────────────────────────────────────────────
export const api = {
  isMock,
  toUUID,
  toMockId,

  // ── Auth ──
  async signUp(email: string, password: string) {
    if (isMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const sb = requireClient();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signIn(email: string, password: string) {
    if (isMock()) return { user: SC_ME, session: { access_token: 'mock' } };
    const sb = requireClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut(): Promise<void> {
    if (isMock()) return;
    await requireClient().auth.signOut();
  },

  async getCurrentUser() {
    if (isMock()) return SC_ME;
    const { data } = await requireClient().auth.getUser();
    return data?.user ?? null;
  },

  // ── Events ──
  async fetchEvents(lat?: number, lng?: number, radiusM?: number): Promise<SCEvent[]> {
    if (isMock()) return SC_EVENTS;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    const { data, error } = await sb.rpc('rank_events_query', {
      p_lat: lat ?? 33.6461,
      p_lng: lng ?? -117.8427,
      p_radius: radiusM ?? 8047,
      p_user_id: (user && 'id' in user) ? user.id : null,
    });
    if (error) throw error;
    return (data || []).map((row: EventRow) =>
      transformEventRow(row, (user && 'id' in user) ? user.id : null)
    );
  },

  async getEventById(eventId: string): Promise<SCEvent | null> {
    if (isMock()) return SC_EVENT_BY_ID[eventId] || null;
    const sb = requireClient();
    const { data, error } = await sb
      .from('events')
      .select('*, event_interests(interest_id(name))')
      .eq('id', toUUID(eventId))
      .single();
    if (error) throw error;
    const user = await this.getCurrentUser();
    return transformEventRow(data as EventRow, (user && 'id' in user) ? user.id : null);
  },

  async createEvent(form: Record<string, unknown>) {
    if (isMock()) return { event_id: 'mock_' + Date.now() };
    const { data, error } = await requireClient().functions.invoke('create-event', { body: form });
    if (error) throw error;
    return data;
  },

  async subscribeToEvent(eventId: string, joinChat = false) {
    if (isMock()) return { status: 'confirmed' as const, chat_id: null };
    const { data, error } = await requireClient().functions.invoke('subscribe-to-event', {
      body: { event_id: toUUID(eventId), join_chat: joinChat },
    });
    if (error) throw error;
    return data;
  },

  // ── Profile ──
  async getProfile(userId: string): Promise<Account> {
    if (isMock()) return SC_ACCOUNT_BY_ID[userId] || SC_ME;
    const sb = requireClient();
    const { data, error } = await sb
      .from('profiles')
      .select('*')
      .eq('user_id', toUUID(userId))
      .single();
    if (error) throw error;
    return data as Account;
  },

  async updateProfile(fields: Partial<Account>) {
    if (isMock()) return fields;
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('profiles')
      .update(fields)
      .eq('user_id', user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // ── Social ──
  async sendFriendRequest(targetId: string) {
    if (isMock()) return { status: 'pending' as const };
    const { data, error } = await requireClient().functions.invoke('send-friend-request', {
      body: { target_id: toUUID(targetId) },
    });
    if (error) throw error;
    return data;
  },

  async acceptFriendRequest(friendshipId: string) {
    if (isMock()) return { status: 'accepted' as const };
    const sb = requireClient();
    const { data, error } = await sb
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async blockUser(targetId: string) {
    if (isMock()) return { blocked: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb
      .from('blocks')
      .insert({ blocker_id: user.id, blocked_id: toUUID(targetId) });
    if (error) throw error;
    return { blocked: true as const };
  },

  // ── Interests ──
  async searchInterests(query: string): Promise<Interest[]> {
    if (isMock()) {
      return SC_INTERESTS_SUGGESTED.filter(i =>
        i.tag.toLowerCase().includes(query.toLowerCase())
      );
    }
    const sb = requireClient();
    const { data, error } = await sb
      .from('interests')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(20);
    if (error) throw error;
    return data as Interest[];
  },

  async subscribeToInterest(interestId: string) {
    if (isMock()) return { subscribed: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb
      .from('user_interests')
      .insert({ user_id: user.id, interest_id: toUUID(interestId) });
    if (error) throw error;
    return { subscribed: true as const };
  },

  // ── Chat ──
  async getChats(): Promise<Chat[]> {
    if (isMock()) return SC_CHATS;
    const sb = requireClient();
    const { data, error } = await sb
      .from('chats')
      .select('*, chat_members(user_id), messages(body, created_at, sender_id)')
      .order('created_at', { foreignTable: 'messages', ascending: false });
    if (error) throw error;
    return data as Chat[];
  },

  async getChatMessages(chatId: string): Promise<Message[]> {
    if (isMock()) return SC_THREADS[chatId] || [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('chat_id', toUUID(chatId))
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data as Message[];
  },

  async sendMessage(chatId: string, body: string) {
    if (isMock()) return { id: 'mock_' + Date.now(), body };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { data, error } = await sb
      .from('messages')
      .insert({ chat_id: toUUID(chatId), sender_id: user.id, body })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  subscribeToChat(chatId: string, onMessage: (m: unknown) => void) {
    if (isMock()) return { unsubscribe: () => {} };
    const sb = requireClient();
    const uuid = toUUID(chatId);
    const channel = sb.channel(`messages:${uuid}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${uuid}`,
      }, (payload) => onMessage(payload.new))
      .subscribe();
    return { unsubscribe: () => { sb.removeChannel(channel); } };
  },

  // ── Notifications ──
  async fetchNotifications() {
    if (isMock()) return [];
    const sb = requireClient();
    const { data, error } = await sb
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data;
  },

  async markNotificationRead(notifId: string): Promise<void> {
    if (isMock()) return;
    await requireClient().from('notifications').update({ read: true }).eq('id', notifId);
  },

  // ── Ratings ──
  async rateEvent(eventId: string, stars: number, text: string) {
    if (isMock()) return { rated: true as const };
    const { data, error } = await requireClient().functions.invoke('rollup-rating', {
      body: { event_id: toUUID(eventId), stars, text },
    });
    if (error) throw error;
    return data;
  },

  // ── Reports ──
  async submitReport(
    targetUserId: string | null,
    targetEventId: string | null,
    reason: string,
    details?: string,
  ) {
    if (isMock()) return { reported: true as const };
    const sb = requireClient();
    const user = await this.getCurrentUser();
    if (!user || !('id' in user)) throw new Error('Not authenticated');
    const { error } = await sb.from('reports').insert({
      reporter_id: user.id,
      target_user_id: targetUserId ? toUUID(targetUserId) : null,
      target_event_id: targetEventId ? toUUID(targetEventId) : null,
      reason,
      details: details || '',
    });
    if (error) throw error;
    return { reported: true as const };
  },
};

export type Api = typeof api;

// Global app store. Replaces the 21-state god-component in src/app.jsx
// (flagged in the code review as the primary structural reason that file
// hit 0% coverage and couldn't be ported screen-by-screen).
//
// Slices:
//   ui      — palette, mode, heuristic-fix toggles
//   events  — joined event set, pending-leave grace timers, conflict modal
//   social  — friends, incoming/outgoing requests
//   auth    — current user, profile pictures
//
// Persistence: palette/mode + friend graph + joined set survive reloads via
// AsyncStorage; ephemeral state (pendingLeave, conflictPrompt) does not.
// The `partialize` selector below is the single source of truth for what
// crosses session boundaries.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { kvStorage } from '@/lib/storage';
import type { PaletteName, Mode } from '@/theme/tokens';
import type { SCEvent, Account, Visibility } from '@/types/domain';
import { SC_ME, SC_FRIEND_REQUESTS } from '@/data/mocks';
import { isLiveBackendAvailable } from '@/lib/supabase';

// In live mode (Supabase env vars present), the store starts with empty
// fixtures so real users don't see fake friends, fake blocked users, or a
// hardcoded "joined event e1" on first launch. The data is hydrated by the
// API client after auth. In mock mode the prototype's fixtures are seeded
// directly so the UI is browsable without a backend. Round-2 code-review
// finding §7 / §2 Important.
const isMockSeed = !isLiveBackendAvailable();

export interface Tweaks {
  showFAB: boolean;
  tabStyle: 'pill' | 'plain';
  offline: boolean;
  showSkeletons: boolean;
  preflightConflicts: boolean;
  inlineSettings: boolean;
  hostEditDelete: boolean;
  failureStates: boolean;
  helpTooltips: boolean;
}

export const DEFAULT_TWEAKS: Tweaks = {
  showFAB: true,
  tabStyle: 'pill',
  offline: false,
  showSkeletons: false,
  preflightConflicts: true,
  inlineSettings: true,
  hostEditDelete: true,
  failureStates: true,
  helpTooltips: true,
};

export interface NotifPrefs {
  messages: boolean;
  friendRequests: boolean;
  orgEvents: boolean;
  eventReminders: boolean;
  friendActivity: boolean;
  weeklyDigest: boolean;
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  messages: true,
  friendRequests: true,
  orgEvents: true,
  eventReminders: true,
  friendActivity: false,
  weeklyDigest: false,
};

export type LinkedCalendar = 'google' | 'apple' | 'outlook' | null;

export interface BlockedUser {
  id: string;
  name: string;
  username: string;
  reason: string;
}

export interface ConflictPrompt {
  id: string;
  conflicts: SCEvent[];
}

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
  action?: { label: string; onPress: () => void };
  duration: number;
}

export interface ConfirmConfig {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  icon?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

interface State {
  // ── ui ──
  palette: PaletteName;
  mode: Mode;
  tweaks: Tweaks;
  setPalette: (p: PaletteName) => void;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  resetTweaks: () => void;

  // ── events ──
  joined: Set<string>;
  pendingLeave: Set<string>;
  conflictPrompt: ConflictPrompt | null;
  eventOverrides: Record<string, Partial<SCEvent>>;
  joinEvent: (id: string) => void;
  leaveEvent: (id: string) => void;          // immediate; use schedulePendingLeave for grace flow
  schedulePendingLeave: (id: string) => void;
  cancelPendingLeave: (id: string) => void;
  setConflictPrompt: (p: ConflictPrompt | null) => void;
  applyEventOverride: (id: string, patch: Partial<SCEvent>) => void;
  isJoined: (id: string) => boolean;

  // ── social ──
  friends: Set<string>;
  outgoingRequests: Set<string>;
  incomingRequests: Set<string>;
  addFriend: (personId: string) => void;
  removeFriend: (personId: string) => void;
  sendFriendRequest: (personId: string) => void;
  cancelOutgoingRequest: (personId: string) => void;
  acceptFriendRequest: (requestId: string, personId: string) => void;
  declineFriendRequest: (requestId: string) => void;

  // ── auth ──
  me: Account;
  // Tracks the active Supabase session. `null` when signed out (or in
  // mock mode where there's no Supabase client at all). Managed by
  // `components/AuthBootstrap.tsx` from `onAuthStateChange`. Used by
  // `components/AuthGate.tsx` to redirect unauthenticated visitors to
  // /auth/sign-in.
  session: { userId: string; email: string | null } | null;
  picture: string | null;        // user-selected profile photo data URL
  orgPictures: Record<string, string>;
  setPicture: (dataUrl: string | null) => void;
  setOrgPicture: (orgId: string, dataUrl: string | null) => void;
  setMe: (patch: Partial<Account>) => void;
  setSession: (s: { userId: string; email: string | null } | null) => void;

  // ── drafts ──
  drafts: import('@/types/domain').Draft[];
  saveDraft: (form: import('@/types/domain').DraftForm, opts?: { id?: string | null; lastStep?: number }) => string;
  removeDraft: (id: string) => void;

  // ── preferences ──
  radius: number;                  // discovery radius in miles
  visibility: Visibility;          // 'public' | 'private'
  notifPrefs: NotifPrefs;
  linkedCalendar: LinkedCalendar;
  blocked: BlockedUser[];
  following: Set<string>;          // org IDs the user follows
  subscribedInterests: Set<string>; // interest tags the user has subscribed to
  setRadius: (mi: number) => void;
  setVisibility: (v: Visibility) => void;
  setNotifPref: <K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) => void;
  setLinkedCalendar: (c: LinkedCalendar) => void;
  unblockUser: (id: string) => void;
  toggleFollow: (orgId: string) => void;
  toggleInterestSub: (tag: string) => void;

  // ── overlays ──
  toasts: Toast[];
  confirm: ConfirmConfig | null;
  showToast: (toast: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number;
  dismissToast: (id: number) => void;
  showConfirm: (config: ConfirmConfig) => void;
  dismissConfirm: () => void;
  // Internal: monotonic id source for toasts. Lives in store state (not at
  // module scope) so it doesn't leak across tests when Jest caches modules
  // between test files. Round-2 code-review finding §2 Critical.
  _toastIdCounter: number;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      // ── ui ──
      palette: 'sunset',
      mode: 'light',
      tweaks: DEFAULT_TWEAKS,
      setPalette: (p) => set({ palette: p }),
      setMode: (m) => set({ mode: m }),
      toggleMode: () => set(s => ({ mode: s.mode === 'light' ? 'dark' : 'light' })),
      setTweak: (key, value) => set(s => ({ tweaks: { ...s.tweaks, [key]: value } })),
      resetTweaks: () => set({ tweaks: DEFAULT_TWEAKS }),

      // ── events ──
      joined: isMockSeed ? new Set(['e1']) : new Set<string>(),
      pendingLeave: new Set(),
      conflictPrompt: null,
      eventOverrides: {},
      isJoined: (id) => {
        const s = get();
        return s.joined.has(id) && !s.pendingLeave.has(id);
      },
      joinEvent: (id) => set(s => {
        if (s.joined.has(id)) return s;
        const next = new Set(s.joined);
        next.add(id);
        return { joined: next };
      }),
      leaveEvent: (id) => set(s => {
        const next = new Set(s.joined);
        next.delete(id);
        const pending = new Set(s.pendingLeave);
        pending.delete(id);
        return { joined: next, pendingLeave: pending };
      }),
      schedulePendingLeave: (id) => set(s => {
        const pending = new Set(s.pendingLeave);
        pending.add(id);
        return { pendingLeave: pending };
      }),
      cancelPendingLeave: (id) => set(s => {
        const pending = new Set(s.pendingLeave);
        pending.delete(id);
        return { pendingLeave: pending };
      }),
      setConflictPrompt: (p) => set({ conflictPrompt: p }),
      applyEventOverride: (id, patch) => set(s => ({
        eventOverrides: { ...s.eventOverrides, [id]: { ...s.eventOverrides[id], ...patch } },
      })),

      // ── social ──
      friends: isMockSeed ? new Set(['p1', 'p3', 'p5']) : new Set<string>(),
      outgoingRequests: isMockSeed ? new Set(['p2']) : new Set<string>(),
      incomingRequests: isMockSeed
        ? new Set(SC_FRIEND_REQUESTS.map(r => r.id))
        : new Set<string>(),
      addFriend: (personId) => set(s => {
        const next = new Set(s.friends); next.add(personId);
        return { friends: next };
      }),
      removeFriend: (personId) => set(s => {
        const next = new Set(s.friends); next.delete(personId);
        return { friends: next };
      }),
      sendFriendRequest: (personId) => set(s => {
        const next = new Set(s.outgoingRequests); next.add(personId);
        return { outgoingRequests: next };
      }),
      cancelOutgoingRequest: (personId) => set(s => {
        const next = new Set(s.outgoingRequests); next.delete(personId);
        return { outgoingRequests: next };
      }),
      acceptFriendRequest: (requestId, personId) => set(s => {
        const incoming = new Set(s.incomingRequests); incoming.delete(requestId);
        const friends = new Set(s.friends); friends.add(personId);
        return { incomingRequests: incoming, friends };
      }),
      declineFriendRequest: (requestId) => set(s => {
        const incoming = new Set(s.incomingRequests); incoming.delete(requestId);
        return { incomingRequests: incoming };
      }),

      // ── auth ──
      me: SC_ME,
      session: null,
      picture: null,
      orgPictures: {},
      setPicture: (dataUrl) => set({ picture: dataUrl }),
      setOrgPicture: (orgId, dataUrl) => set(s => {
        const next = { ...s.orgPictures };
        if (dataUrl) next[orgId] = dataUrl;
        else delete next[orgId];
        return { orgPictures: next };
      }),
      setMe: (patch) => set(s => ({ me: { ...s.me, ...patch } })),
      setSession: (next) => set({ session: next }),

      // ── drafts ──
      drafts: [],
      saveDraft: (form, opts) => {
        const id = opts?.id ?? `d_${Date.now()}`;
        const savedAt = new Date().toLocaleString();
        set(s => {
          const existing = s.drafts.findIndex(d => d.id === id);
          const draft = { id, savedAt, lastStep: opts?.lastStep ?? 0, form };
          if (existing >= 0) {
            const next = [...s.drafts];
            next[existing] = draft;
            return { drafts: next };
          }
          return { drafts: [draft, ...s.drafts] };
        });
        return id;
      },
      removeDraft: (id) => set(s => ({ drafts: s.drafts.filter(d => d.id !== id) })),

      // ── preferences ──
      radius: 5,
      visibility: 'public',
      notifPrefs: DEFAULT_NOTIF_PREFS,
      linkedCalendar: 'google',
      blocked: isMockSeed
        ? [
            { id: 'b1', name: 'Casey Morgan', username: 'casey_m', reason: 'Blocked Mar 14' },
            { id: 'b2', name: 'Riley Tanaka', username: 'rileyt', reason: 'Blocked Feb 02' },
          ]
        : [],
      following: isMockSeed ? new Set(['orgA', 'orgD']) : new Set<string>(),
      subscribedInterests: isMockSeed
        ? new Set(['biking', 'coffee', 'climbing'])
        : new Set<string>(),
      setRadius: (mi) => set({ radius: mi }),
      setVisibility: (v) => set({ visibility: v }),
      setNotifPref: (key, value) => set(s => ({ notifPrefs: { ...s.notifPrefs, [key]: value } })),
      setLinkedCalendar: (c) => set({ linkedCalendar: c }),
      unblockUser: (id) => set(s => ({ blocked: s.blocked.filter(b => b.id !== id) })),
      toggleFollow: (orgId) => set(s => {
        const next = new Set(s.following);
        if (next.has(orgId)) next.delete(orgId); else next.add(orgId);
        return { following: next };
      }),
      toggleInterestSub: (tag) => set(s => {
        const next = new Set(s.subscribedInterests);
        if (next.has(tag)) next.delete(tag); else next.add(tag);
        // Keep `me.interests` in sync — both are seeded from the same
        // `user_interests` source on hydrate, and the profile screen +
        // create-event auto-fill read `me.interests`. Without this, adding
        // an interest updated the catalog screen but never the profile.
        return { subscribedInterests: next, me: { ...s.me, interests: Array.from(next) } };
      }),

      // ── overlays ──
      toasts: [],
      confirm: null,
      _toastIdCounter: 0,
      showToast: (opts) => {
        const duration = opts.duration ?? 3600;
        let id = 0;
        set(s => {
          id = s._toastIdCounter + 1;
          const toast: Toast = {
            id, message: opts.message, kind: opts.kind ?? 'info',
            action: opts.action, duration,
          };
          return {
            _toastIdCounter: id,
            toasts: [...s.toasts, toast],
          };
        });
        if (duration > 0) {
          setTimeout(() => {
            set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
          }, duration);
        }
        return id;
      },
      dismissToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
      showConfirm: (config) => set({ confirm: config }),
      dismissConfirm: () => set({ confirm: null }),
    }),
    {
      name: 'scenecheck-store',
      storage: createJSONStorage(() => kvStorage),
      // Persist only what should survive reloads. Set/Map need custom
      // (de)serialization since JSON.stringify drops them silently.
      partialize: (s) => ({
        palette: s.palette,
        mode: s.mode,
        tweaks: s.tweaks,
        joined: Array.from(s.joined),
        friends: Array.from(s.friends),
        outgoingRequests: Array.from(s.outgoingRequests),
        incomingRequests: Array.from(s.incomingRequests),
        picture: s.picture,
        orgPictures: s.orgPictures,
        me: s.me,
        radius: s.radius,
        visibility: s.visibility,
        notifPrefs: s.notifPrefs,
        linkedCalendar: s.linkedCalendar,
        blocked: s.blocked,
        following: Array.from(s.following),
        subscribedInterests: Array.from(s.subscribedInterests),
        drafts: s.drafts,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<State> & {
          joined?: string[]; friends?: string[];
          outgoingRequests?: string[]; incomingRequests?: string[];
          following?: string[]; subscribedInterests?: string[];
        };
        return {
          ...current,
          ...p,
          joined: new Set(p.joined ?? Array.from(current.joined)),
          friends: new Set(p.friends ?? Array.from(current.friends)),
          outgoingRequests: new Set(p.outgoingRequests ?? Array.from(current.outgoingRequests)),
          incomingRequests: new Set(p.incomingRequests ?? Array.from(current.incomingRequests)),
          following: new Set(p.following ?? Array.from(current.following)),
          subscribedInterests: new Set(p.subscribedInterests ?? Array.from(current.subscribedInterests)),
        };
      },
    },
  ),
);

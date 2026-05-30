// Unit tests for the Zustand store. These exercise the slice mutators
// in isolation — no React rendering — so they're cheap and pinpoint
// regressions in the state model that's now load-bearing for every
// screen (the old app.jsx had 21 useStates and 0% test coverage).

import { useStore, DEFAULT_TWEAKS, DEFAULT_NOTIF_PREFS } from '@/store/useStore';

// Reset to defaults between tests so order-of-test doesn't matter.
function resetStore() {
  useStore.setState({
    joined: new Set(['e1']),
    pendingLeave: new Set(),
    conflictPrompt: null,
    eventOverrides: {},
    friends: new Set(['p1', 'p3', 'p5']),
    outgoingRequests: new Set(['p2']),
    incomingRequests: new Set(['fr1', 'fr2']),
    picture: null,
    orgPictures: {},
    palette: 'sunset',
    mode: 'light',
    tweaks: DEFAULT_TWEAKS,
    drafts: [],
    radius: 10,
    visibility: 'public',
    notifPrefs: DEFAULT_NOTIF_PREFS,
    linkedCalendar: 'google',
    following: new Set(['orgA', 'orgD']),
    subscribedInterests: new Set(['biking', 'coffee', 'climbing']),
    toasts: [],
    confirm: null,
    _toastIdCounter: 0,
  });
}

beforeEach(resetStore);

describe('events slice', () => {
  test('joinEvent adds to joined set', () => {
    useStore.getState().joinEvent('e2');
    expect(useStore.getState().joined.has('e2')).toBe(true);
  });

  test('joinEvent is idempotent', () => {
    useStore.getState().joinEvent('e1');
    expect(useStore.getState().joined.size).toBe(1);
  });

  test('leaveEvent removes from joined and pendingLeave', () => {
    useStore.getState().schedulePendingLeave('e1');
    useStore.getState().leaveEvent('e1');
    const s = useStore.getState();
    expect(s.joined.has('e1')).toBe(false);
    expect(s.pendingLeave.has('e1')).toBe(false);
  });

  test('schedulePendingLeave adds to pendingLeave only', () => {
    useStore.getState().schedulePendingLeave('e1');
    const s = useStore.getState();
    expect(s.pendingLeave.has('e1')).toBe(true);
    expect(s.joined.has('e1')).toBe(true);
  });

  test('cancelPendingLeave removes from pendingLeave only', () => {
    useStore.getState().schedulePendingLeave('e1');
    useStore.getState().cancelPendingLeave('e1');
    const s = useStore.getState();
    expect(s.pendingLeave.has('e1')).toBe(false);
    expect(s.joined.has('e1')).toBe(true);
  });

  test('isJoined accounts for pendingLeave grace window', () => {
    expect(useStore.getState().isJoined('e1')).toBe(true);
    useStore.getState().schedulePendingLeave('e1');
    expect(useStore.getState().isJoined('e1')).toBe(false);
  });

  test('re-joining during the grace window clears pendingLeave (isJoined back to true)', () => {
    // Leave (start the 5s grace) then re-join: joinEvent must clear the
    // pending leave, else isJoined stays false and the button/chip don't flip.
    useStore.getState().schedulePendingLeave('e1');
    expect(useStore.getState().isJoined('e1')).toBe(false);
    useStore.getState().joinEvent('e1');
    expect(useStore.getState().pendingLeave.has('e1')).toBe(false);
    expect(useStore.getState().isJoined('e1')).toBe(true);
  });

  test('applyEventOverride merges patches', () => {
    useStore.getState().applyEventOverride('e1', { title: 'Updated' });
    useStore.getState().applyEventOverride('e1', { where: 'New place' });
    const override = useStore.getState().eventOverrides.e1;
    expect(override.title).toBe('Updated');
    expect(override.where).toBe('New place');
  });
});

describe('social slice', () => {
  test('addFriend extends friends set', () => {
    useStore.getState().addFriend('p2');
    expect(useStore.getState().friends.has('p2')).toBe(true);
  });

  test('removeFriend shrinks friends set', () => {
    useStore.getState().removeFriend('p1');
    expect(useStore.getState().friends.has('p1')).toBe(false);
  });

  test('sendFriendRequest adds to outgoing only', () => {
    useStore.getState().sendFriendRequest('p4');
    const s = useStore.getState();
    expect(s.outgoingRequests.has('p4')).toBe(true);
    expect(s.friends.has('p4')).toBe(false);
  });

  test('acceptFriendRequest moves to friends and clears the inbox row', () => {
    useStore.getState().acceptFriendRequest('fr1', 'p4');
    const s = useStore.getState();
    expect(s.incomingRequests.has('fr1')).toBe(false);
    expect(s.friends.has('p4')).toBe(true);
  });

  test('declineFriendRequest just clears the inbox row', () => {
    useStore.getState().declineFriendRequest('fr1');
    const s = useStore.getState();
    expect(s.incomingRequests.has('fr1')).toBe(false);
    expect(s.friends.has('p4')).toBe(false);
  });
});

describe('ui / theme slice', () => {
  test('setPalette swaps palette', () => {
    useStore.getState().setPalette('cobalt');
    expect(useStore.getState().palette).toBe('cobalt');
  });

  test('toggleMode flips light ↔ dark', () => {
    expect(useStore.getState().mode).toBe('light');
    useStore.getState().toggleMode();
    expect(useStore.getState().mode).toBe('dark');
    useStore.getState().toggleMode();
    expect(useStore.getState().mode).toBe('light');
  });

  test('setTweak mutates one key without disturbing others', () => {
    useStore.getState().setTweak('offline', true);
    const tw = useStore.getState().tweaks;
    expect(tw.offline).toBe(true);
    expect(tw.preflightConflicts).toBe(DEFAULT_TWEAKS.preflightConflicts);
  });

  test('resetTweaks reverts to defaults', () => {
    useStore.getState().setTweak('offline', true);
    useStore.getState().setTweak('helpTooltips', false);
    useStore.getState().resetTweaks();
    expect(useStore.getState().tweaks).toEqual(DEFAULT_TWEAKS);
  });
});

describe('preferences slice', () => {
  test('setRadius updates radius', () => {
    useStore.getState().setRadius(10);
    expect(useStore.getState().radius).toBe(10);
  });

  test('setVisibility swaps public/private', () => {
    useStore.getState().setVisibility('private');
    expect(useStore.getState().visibility).toBe('private');
  });

  test('setNotifPref updates one key', () => {
    useStore.getState().setNotifPref('messages', false);
    expect(useStore.getState().notifPrefs.messages).toBe(false);
  });

  test('toggleFollow adds and removes', () => {
    useStore.getState().toggleFollow('orgB');
    expect(useStore.getState().following.has('orgB')).toBe(true);
    useStore.getState().toggleFollow('orgB');
    expect(useStore.getState().following.has('orgB')).toBe(false);
  });

  test('toggleInterestSub adds and removes', () => {
    useStore.getState().toggleInterestSub('study');
    expect(useStore.getState().subscribedInterests.has('study')).toBe(true);
    useStore.getState().toggleInterestSub('study');
    expect(useStore.getState().subscribedInterests.has('study')).toBe(false);
  });

  test('toggleInterestSub keeps me.interests in sync (so the profile updates)', () => {
    useStore.getState().toggleInterestSub('study');
    expect(useStore.getState().me.interests).toContain('study');
    useStore.getState().toggleInterestSub('study');
    expect(useStore.getState().me.interests ?? []).not.toContain('study');
  });

  test('unblockUser removes from blocked list', () => {
    useStore.getState().unblockUser('b1');
    expect(useStore.getState().blocked.find(b => b.id === 'b1')).toBeUndefined();
  });
});

describe('drafts slice', () => {
  const sampleForm = {
    title: 'Test draft',
    desc: 'Description here',
    date: 'Sat May 16', timeStart: '7:00 AM', timeEnd: '9:00 AM',
    location: 'Test place', cap: 10,
    interests: ['biking'], visibility: 'public' as const,
    minSubs: 2, addToCalendar: true, autoGroupChat: true,
  };

  test('saveDraft creates a new draft with an id', () => {
    const id = useStore.getState().saveDraft(sampleForm);
    expect(id).toBeTruthy();
    expect(useStore.getState().drafts.length).toBe(1);
    expect(useStore.getState().drafts[0].id).toBe(id);
  });

  test('saveDraft with existing id updates in place', () => {
    const id = useStore.getState().saveDraft(sampleForm);
    useStore.getState().saveDraft({ ...sampleForm, title: 'Renamed' }, { id });
    const drafts = useStore.getState().drafts;
    expect(drafts.length).toBe(1);
    expect(drafts[0].form.title).toBe('Renamed');
  });

  test('removeDraft drops the entry', () => {
    const id = useStore.getState().saveDraft(sampleForm);
    useStore.getState().removeDraft(id);
    expect(useStore.getState().drafts.length).toBe(0);
  });
});

describe('overlays slice', () => {
  test('showToast appends and returns id', () => {
    const id = useStore.getState().showToast({ message: 'hi', kind: 'info', duration: 0 });
    const toasts = useStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0].id).toBe(id);
    expect(toasts[0].message).toBe('hi');
  });

  test('dismissToast removes by id', () => {
    const id = useStore.getState().showToast({ message: 'hi', kind: 'info', duration: 0 });
    useStore.getState().dismissToast(id);
    expect(useStore.getState().toasts).toEqual([]);
  });

  test('showConfirm + dismissConfirm flow', () => {
    let confirmed = false;
    useStore.getState().showConfirm({
      title: 'Sure?', body: 'Really?',
      onConfirm: () => { confirmed = true; },
    });
    expect(useStore.getState().confirm).not.toBeNull();
    useStore.getState().confirm?.onConfirm();
    useStore.getState().dismissConfirm();
    expect(confirmed).toBe(true);
    expect(useStore.getState().confirm).toBeNull();
  });
});

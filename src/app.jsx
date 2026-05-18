// SceneCheck — root app + routing

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "sunset",
  "dark": false,
  "showFAB": true,
  "tabStyle": "pill",
  "offline": false,
  "showSkeletons": false,
  "preflightConflicts": true,
  "inlineSettings": true,
  "hostEditDelete": true,
  "failureStates": true,
  "helpTooltips": true
}/*EDITMODE-END*/;

const PALETTES = {
  sunset: {
    label: 'Sunset Coral',
    light: {
      '--primary': '#FF5B47', '--primary-ink': '#FFFFFF', '--primary-soft': '#FFE3DD',
      '--accent-blue': '#2E7BFF', '--accent-friend': '#1A1714',
      '--ink': '#14110F', '--ink-2': '#4D453E', '--ink-3': '#8A8077',
      '--surface': '#FFFBF5', '--card': '#FFFFFF',
      '--subtle': '#F2EBDF', '--line': '#ECE3D2',
      '--map-land': '#EFE6D2', '--map-park': '#B7D69A', '--map-water': '#BBD8EC',
      '--map-road': '#FFFFFF', '--map-build': '#E5DBC6',
      '--map-pin-mute': '#A89E8C',
      '--page-bg': '#ECE3D2', '--page-glow-1': '#F8E3CC', '--page-glow-2': '#F4D8C3',
    },
    dark: {
      '--primary': '#FF6F5A', '--primary-ink': '#1A0F0C', '--primary-soft': '#3A1F1A',
      '--accent-blue': '#5B9CFF', '--accent-friend': '#F2EBDF',
      '--ink': '#F4ECDD', '--ink-2': '#C8BEAE', '--ink-3': '#7E7568',
      '--surface': '#16120E', '--card': '#231C16',
      '--subtle': '#2C241D', '--line': '#332A22',
      '--map-land': '#1F1812', '--map-park': '#2F4A28', '--map-water': '#1B2C3D',
      '--map-road': '#3A2E24', '--map-build': '#2A2118',
      '--map-pin-mute': '#6E665B',
      '--page-bg': '#0E0B08', '--page-glow-1': '#2A1B12', '--page-glow-2': '#1F1410',
    },
  },
  cobalt: {
    label: 'Cobalt Glow',
    light: {
      '--primary': '#2A55FF', '--primary-ink': '#FFFFFF', '--primary-soft': '#DDE5FF',
      '--accent-blue': '#5BC1FF', '--accent-friend': '#0E1633',
      '--ink': '#0E1633', '--ink-2': '#3D456A', '--ink-3': '#7E84A1',
      '--surface': '#F4F6FF', '--card': '#FFFFFF',
      '--subtle': '#E8ECFB', '--line': '#DDE2F5',
      '--map-land': '#E5EAF7', '--map-park': '#A8D4B5', '--map-water': '#A6C9F0',
      '--map-road': '#FFFFFF', '--map-build': '#D5DCEE',
      '--map-pin-mute': '#9AA1BA',
      '--page-bg': '#E8ECFB', '--page-glow-1': '#DDE5FF', '--page-glow-2': '#D6E4FF',
    },
    dark: {
      '--primary': '#5C7BFF', '--primary-ink': '#06091C', '--primary-soft': '#172248',
      '--accent-blue': '#7CC9FF', '--accent-friend': '#E6E9F7',
      '--ink': '#E6E9F7', '--ink-2': '#A9AECB', '--ink-3': '#6E7390',
      '--surface': '#0B0E1F', '--card': '#161A30',
      '--subtle': '#1F2440', '--line': '#252B49',
      '--map-land': '#11142A', '--map-park': '#214030', '--map-water': '#162640',
      '--map-road': '#272D4D', '--map-build': '#1A1F38',
      '--map-pin-mute': '#5F6582',
      '--page-bg': '#06091C', '--page-glow-1': '#172248', '--page-glow-2': '#0F1638',
    },
  },
  lime: {
    label: 'Electric Lime',
    light: {
      '--primary': '#C5F23B', '--primary-ink': '#0D1407', '--primary-soft': '#EFFBC8',
      '--accent-blue': '#2E7BFF', '--accent-friend': '#0D1407',
      '--ink': '#0D1407', '--ink-2': '#3F4830', '--ink-3': '#7A8268',
      '--surface': '#F4F7EE', '--card': '#FFFFFF',
      '--subtle': '#EAF1D8', '--line': '#DEE6CB',
      '--map-land': '#E8EEDA', '--map-park': '#B5D58A', '--map-water': '#BBD8EC',
      '--map-road': '#FFFFFF', '--map-build': '#D7DDC4',
      '--map-pin-mute': '#9AA088',
      '--page-bg': '#EAF1D8', '--page-glow-1': '#EFFBC8', '--page-glow-2': '#E2EFC2',
    },
    dark: {
      '--primary': '#D4FF4D', '--primary-ink': '#0D1407', '--primary-soft': '#22300C',
      '--accent-blue': '#5B9CFF', '--accent-friend': '#EAF2D6',
      '--ink': '#EAF2D6', '--ink-2': '#B6BFA0', '--ink-3': '#797F65',
      '--surface': '#0E120A', '--card': '#181D11',
      '--subtle': '#222918', '--line': '#2A311C',
      '--map-land': '#141810', '--map-park': '#2D4422', '--map-water': '#1B2C3D',
      '--map-road': '#2F3622', '--map-build': '#1F2415',
      '--map-pin-mute': '#5F6549',
      '--page-bg': '#08100A', '--page-glow-1': '#1A2A0E', '--page-glow-2': '#10180A',
    },
  },
};

function applyPalette(name, dark) {
  const p = PALETTES[name] || PALETTES.sunset;
  const vars = dark ? p.dark : p.light;
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
}

function useViewportScale(designW, designH, padding = 80) {
  const [scale, setScale] = useStateA(1);
  useEffectA(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sx = (vw - padding * 2) / designW;
      const sy = (vh - padding) / designH;
      setScale(Math.min(1, sx, sy));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [designW, designH, padding]);
  return scale;
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  useEffectA(() => { applyPalette(tweaks.palette, tweaks.dark); }, [tweaks.palette, tweaks.dark]);
  // Publish heuristic-fix tweak flags on window so heuristic-fixes.jsx
  // components can read them without needing to be prop-drilled through
  // every screen. Fires an event so any mounted useFixes() hook re-renders.
  useEffectA(() => {
    window.scFixes = {
      preflightConflicts: !!tweaks.preflightConflicts,
      inlineSettings: !!tweaks.inlineSettings,
      hostEditDelete: !!tweaks.hostEditDelete,
      failureStates: !!tweaks.failureStates,
      helpTooltips: !!tweaks.helpTooltips,
    };
    window.dispatchEvent(new Event('sc-fixes-updated'));
  }, [tweaks.preflightConflicts, tweaks.inlineSettings, tweaks.hostEditDelete, tweaks.failureStates, tweaks.helpTooltips]);
  const scale = useViewportScale(402, 874, 60);

  // Route is either a string (top-level tab) or an object {name, ...}
  const [route, setRoute] = useStateA('home');
  const [history, setHistory] = useStateA([]);
  const [activeTab, setActiveTab] = useStateA('home');
  // Live ref to the current route so navigation calls fired in the same tick
  // (e.g. two taps before React re-renders) see the up-to-date value rather
  // than a stale closure copy. Without this, two back-to-back `go(...)` calls
  // would both push the same "previous" route onto history, and `back` would
  // skip the screen the user actually wants to return to.
  const routeRef = React.useRef(route);
  routeRef.current = route;
  const sameRoute = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    const an = typeof a === 'string' ? a : a.name;
    const bn = typeof b === 'string' ? b : b.name;
    if (an !== bn) return false;
    // For object routes, compare the key id field so e.g. two different events
    // aren't collapsed but the same event tapped twice is.
    const k = a.eventId !== undefined ? 'eventId'
            : a.personId !== undefined ? 'personId'
            : a.chatId !== undefined ? 'chatId'
            : a.orgId !== undefined ? 'orgId'
            : a.tag !== undefined ? 'tag'
            : a.hostId !== undefined ? 'hostId'
            : null;
    return k ? a[k] === b[k] : true;
  };

  // Active account (Instagram-style switcher).
  // 'me' = personal account; 'org1'/'org2'/'org3' = managed org accounts.
  const [activeAccount, setActiveAccount] = useStateA('me');
  const [accountSwitcherOpen, setAccountSwitcherOpen] = useStateA(false);

  // Profile picture set by the user (data URL). Persists across sessions in localStorage.
  const [picture, setPictureRaw] = useStateA(() => {
    try { return localStorage.getItem('sc-me-picture') || null; } catch { return null; }
  });
  const setPicture = (dataUrl) => {
    setPictureRaw(dataUrl);
    try { if (dataUrl) localStorage.setItem('sc-me-picture', dataUrl); else localStorage.removeItem('sc-me-picture'); } catch {}
  };
  // Pictures for org accounts you manage
  const [orgPictures, setOrgPicturesRaw] = useStateA(() => {
    try { return JSON.parse(localStorage.getItem('sc-org-pictures') || '{}'); } catch { return {}; }
  });
  const setOrgPicture = (orgId, dataUrl) => {
    const next = { ...orgPictures };
    if (dataUrl) next[orgId] = dataUrl; else delete next[orgId];
    setOrgPicturesRaw(next);
    try { localStorage.setItem('sc-org-pictures', JSON.stringify(next)); } catch {}
  };

  // joined event ids
  const [joined, setJoined] = useStateA(new Set(['e1']));
  // Conflict-aware join
  const eventsOverlap = (a, b) => {
    if (!a || !b) return false;
    const parse = (w) => {
      // "Sat May 9 · 7:00 AM"
      const m = w && w.match(/^(.+?)\s·\s(\d{1,2}):(\d{2})\s(AM|PM)/);
      if (!m) return null;
      let h = parseInt(m[2]);
      const min = parseInt(m[3]);
      if (m[4] === 'PM' && h !== 12) h += 12;
      if (m[4] === 'AM' && h === 12) h = 0;
      return { date: m[1].trim(), mins: h*60 + min };
    };
    const pa = parse(a.when), pb = parse(b.when);
    if (!pa || !pb) return false;
    return pa.date === pb.date && Math.abs(pa.mins - pb.mins) < 120;
  };
  const [conflictPrompt, setConflictPrompt] = useStateA(null);
  // Pending-leave: when you tap to leave an event, we keep you in `joined`
  // for a short grace window so a mis-tap can be undone via toast.
  const [pendingLeave, setPendingLeave] = useStateA(new Map()); // eventId -> expiresAt
  const leaveTimers = React.useRef({});
  const cancelPendingLeave = (eventId) => {
    if (leaveTimers.current[eventId]) {
      clearTimeout(leaveTimers.current[eventId]);
      delete leaveTimers.current[eventId];
    }
    setPendingLeave(prev => {
      if (!prev.has(eventId)) return prev;
      const next = new Map(prev); next.delete(eventId); return next;
    });
  };
  const schedulePendingLeave = (eventId) => {
    const expiresAt = Date.now() + 5000;
    setPendingLeave(prev => { const n = new Map(prev); n.set(eventId, expiresAt); return n; });
    leaveTimers.current[eventId] = setTimeout(() => {
      delete leaveTimers.current[eventId];
      setPendingLeave(prev => { const n = new Map(prev); n.delete(eventId); return n; });
      setJoined(prev => { const n = new Set(prev); n.delete(eventId); return n; });
    }, 5000);
  };
  const toggleJoin = (id, opts = {}) => {
    if (joined.has(id)) {
      // Leaving — schedule with grace + show undo toast (unless already pending).
      if (pendingLeave.has(id)) { cancelPendingLeave(id); return; }
      const target = SC_EVENT_BY_ID[id];
      schedulePendingLeave(id);
      window.scToast && window.scToast({
        message: `Left "${target?.title || 'event'}". Removing in 5s.`,
        kind: 'info', duration: 5200,
        action: { label: 'UNDO', onClick: () => cancelPendingLeave(id) },
      });
      return;
    }
    if (!opts.force) {
      const target = SC_EVENT_BY_ID[id];
      const conflicts = [...joined].map(x => SC_EVENT_BY_ID[x]).filter(e => eventsOverlap(e, target));
      if (conflicts.length) { setConflictPrompt({ id, conflicts }); return; }
    }
    const next = new Set(joined); next.add(id); setJoined(next);
    const target = SC_EVENT_BY_ID[id];
    window.scToast && window.scToast({
      message: `Joined "${target?.title || 'event'}".`, kind: 'success',
    });
  };
  // friends — set of person IDs you've successfully friended (mutual)
  const [friends, setFriends] = useStateA(new Set(['p1','p3','p5']));
  // Outgoing requests you've sent that are pending the other side's approval
  const [outgoingRequests, setOutgoingRequests] = useStateA(new Set(['p2']));
  // Incoming requests waiting for YOUR approval (only relevant when your privacy='private')
  const [incomingRequests, setIncomingRequests] = useStateA(
    new Set(SC_FRIEND_REQUESTS.map(r => r.id))
  );
  // Map of friend-request id -> personId (for incoming)
  const incomingRequestList = useMemoA(
    () => SC_FRIEND_REQUESTS.filter(r => incomingRequests.has(r.id)),
    [incomingRequests]
  );

  // Send / cancel a friend request, or unfriend.
  // Returns the new state for that person: 'friend' | 'pending' | 'none'.
  const friendStatus = (personId) => {
    if (friends.has(personId)) return 'friend';
    if (outgoingRequests.has(personId)) return 'pending';
    return 'none';
  };
  // Pending unfriend: 30s grace window so a misclick can be undone.
  // While in this set, the person remains in `friends` and is shown as a friend
  // in the My Friends list, but with an "UNDO · Xs" indicator. After 30s the
  // pending timer fires and they're removed from `friends` for real.
  const [pendingUnfriend, setPendingUnfriend] = useStateA(new Map()); // personId -> expiresAt(ms)
  const unfriendTimers = React.useRef({});
  const cancelPendingUnfriend = (personId) => {
    if (unfriendTimers.current[personId]) {
      clearTimeout(unfriendTimers.current[personId]);
      delete unfriendTimers.current[personId];
    }
    setPendingUnfriend(prev => {
      if (!prev.has(personId)) return prev;
      const next = new Map(prev); next.delete(personId); return next;
    });
  };
  const schedulePendingUnfriend = (personId) => {
    const expiresAt = Date.now() + 5000;
    setPendingUnfriend(prev => { const n = new Map(prev); n.set(personId, expiresAt); return n; });
    unfriendTimers.current[personId] = setTimeout(() => {
      delete unfriendTimers.current[personId];
      setPendingUnfriend(prev => { const n = new Map(prev); n.delete(personId); return n; });
      setFriends(prev => { const n = new Set(prev); n.delete(personId); return n; });
    }, 5000);
  };

  const toggleFriend = (personId) => {
    const status = friendStatus(personId);
    const person = SC_PEOPLE.find(p => p.id === personId);
    if (status === 'friend') {
      // If they're already pending unfriend, this tap is the UNDO.
      if (pendingUnfriend.has(personId)) {
        cancelPendingUnfriend(personId);
      } else {
        // start 30s grace window — actual removal happens when the timer fires
        schedulePendingUnfriend(personId);
      }
    } else if (status === 'pending') {
      // cancel pending request
      const next = new Set(outgoingRequests); next.delete(personId); setOutgoingRequests(next);
    } else {
      // not yet connected. If they're public, instant friend; if private, send request.
      if (person?.privacy === 'private') {
        const next = new Set(outgoingRequests); next.add(personId); setOutgoingRequests(next);
      } else {
        const next = new Set(friends); next.add(personId); setFriends(next);
      }
    }
  };
  const acceptRequest = (requestId) => {
    const r = SC_FRIEND_REQUESTS.find(x => x.id === requestId);
    if (!r) return;
    const nextR = new Set(incomingRequests); nextR.delete(requestId); setIncomingRequests(nextR);
    const nextF = new Set(friends); nextF.add(r.personId); setFriends(nextF);
  };
  const declineRequest = (requestId) => {
    const nextR = new Set(incomingRequests); nextR.delete(requestId); setIncomingRequests(nextR);
  };

  // Orgs you follow (you receive event notifications when they post)
  const [following, setFollowing] = useStateA(new Set(['orgA','orgD']));
  // Pending follow requests for private orgs
  const [pendingFollows, setPendingFollows] = useStateA(new Set());
  const followStatus = (orgId) => {
    if (following.has(orgId)) return 'following';
    if (pendingFollows.has(orgId)) return 'pending';
    return 'none';
  };
  const toggleFollow = (orgId) => {
    const status = followStatus(orgId);
    const org = SC_ACCOUNT_BY_ID[orgId];
    if (status === 'following') {
      const next = new Set(following); next.delete(orgId); setFollowing(next);
    } else if (status === 'pending') {
      const next = new Set(pendingFollows); next.delete(orgId); setPendingFollows(next);
    } else {
      if (org?.privacy === 'private') {
        const next = new Set(pendingFollows); next.add(orgId); setPendingFollows(next);
      } else {
        const next = new Set(following); next.add(orgId); setFollowing(next);
      }
    }
  };
  // subscribed interests
  const [subs, setSubs] = useStateA(new Set(SC_ME.interests));
  const toggleSub = (tag) => {
    const next = new Set(subs);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setSubs(next);
  };

  // settings
  const [radius, setRadius] = useStateA(2);
  // ── Drafts: in-progress event forms saved from the publish-failure flow.
  // Seed with sample drafts so the Drafts screen has content out of the box.
  const [drafts, setDrafts] = useStateA(SC_DRAFTS_SEED);
  const saveDraft = (form, opts = {}) => {
    const stamp = new Date();
    const hh = stamp.getHours();
    const mm = String(stamp.getMinutes()).padStart(2, '0');
    const ap = hh >= 12 ? 'PM' : 'AM';
    const savedAt = `Just now · ${((hh + 11) % 12 + 1)}:${mm} ${ap}`;
    const id = opts.id || `d_${Date.now()}`;
    setDrafts(prev => {
      const without = prev.filter(d => d.id !== id);
      return [{ id, savedAt, lastStep: opts.lastStep ?? 0, form }, ...without];
    });
    return id;
  };
  const removeDraft = (id) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  };
  // Privacy is a binary choice that controls how *others* add you as a friend:
  //   'public'  — anyone can add you and become a friend instantly.
  //   'private' — your approval is required before they become a friend.
  const [privacy, setPrivacy] = useStateA('public');
  // Legacy alias for older screens that used the variable name `visibility`
  const visibility = privacy; const setVisibility = setPrivacy;

  // Notification preferences — multi-toggle, persisted
  const DEFAULT_NOTIF_PREFS = {
    messages: true,
    friendRequests: true,
    orgEvents: true,
    eventReminders: true,
    friendActivity: false,
    weeklyDigest: false,
  };
  const [notifPrefs, setNotifPrefsRaw] = useStateA(() => {
    try { return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(localStorage.getItem('sc-notif-prefs') || '{}')) }; } catch { return DEFAULT_NOTIF_PREFS; }
  });
  const setNotifPref = (key, val) => {
    const next = { ...notifPrefs, [key]: val };
    setNotifPrefsRaw(next);
    try { localStorage.setItem('sc-notif-prefs', JSON.stringify(next)); } catch {}
  };

  const back = () => {
    setHistory((h) => {
      if (h.length === 0) { setRoute('home'); routeRef.current = 'home'; setActiveTab('home'); return []; }
      let i = h.length - 1;
      // Skip any history entries that match the route we're currently on —
      // a defensive guard in case a duplicate slipped in past `go`'s de-dupe
      // (or before this fix landed). Without this, a stale duplicate would
      // pop, set route to the same value, and feel like back did nothing.
      while (i >= 0 && sameRoute(h[i], routeRef.current)) i--;
      if (i < 0) { setRoute('home'); routeRef.current = 'home'; setActiveTab('home'); return []; }
      const prev = h[i];
      setRoute(prev);
      routeRef.current = prev;
      const prevName = typeof prev === 'string' ? prev : prev.name;
      if (prevName === 'home' || prevName === 'map' || prevName === 'discover-orgs' || prevName === 'search') setActiveTab('home');
      else if (prevName === 'chat' || prevName === 'chat-thread' || prevName === 'new-chat' || prevName === 'requests') setActiveTab('chat');
      else if (prevName === 'profile' || prevName === 'interests' || prevName === 'profile-other' || prevName === 'interest-detail' || prevName === 'my-profile' || prevName === 'org-profile' || prevName === 'my-hosting' || prevName === 'my-friends' || prevName === 'my-following' || prevName === 'drafts') setActiveTab('profile');
      else if (prevName === 'settings') setActiveTab('settings');
      return h.slice(0, i);
    });
  };
  const go = (r, opts = {}) => {
    const prev = routeRef.current;
    // No-op if we're already on this exact route — prevents two fast taps
    // from pushing identical history frames that confuse `back`.
    if (sameRoute(prev, r)) return;
    if (opts.replaceWith !== undefined) {
      // Caller wants to overwrite the back-stack as part of this transition
      // (e.g. SCNewChat → chat-thread should leave the user with "back ⇒ chat
      // list", not "back ⇒ new-chat composer"). `replaceWith` is the new
      // history array (single route or full stack).
      const next = Array.isArray(opts.replaceWith) ? opts.replaceWith : [opts.replaceWith];
      setHistory(next);
    } else {
      setHistory((h) => {
        // Don't push a duplicate of what's already on top of the stack. This
        // is the key fix for the back-button loop after tapping attendees: the
        // ref above already advances synchronously across back-to-back `go`
        // calls, so the right `prev` is pushed exactly once.
        if (h.length && sameRoute(h[h.length - 1], prev)) return h;
        return [...h, prev];
      });
    }
    setRoute(r);
    routeRef.current = r;
    // update active tab if going to a tab root
    const rn = typeof r === 'string' ? r : r.name;
    if (rn === 'home' || rn === 'map' || rn === 'discover-orgs' || rn === 'search') setActiveTab('home');
    if (rn === 'chat' || rn === 'requests' || rn === 'new-chat' || rn === 'chat-thread') setActiveTab('chat');
    if (rn === 'profile' || rn === 'interests' || rn === 'org-profile' || rn === 'my-hosting' || rn === 'my-friends' || rn === 'my-following' || rn === 'drafts') setActiveTab('profile');
    if (rn === 'settings') setActiveTab('settings');
  };

  const switchTab = (tab) => {
    const dest = tab === 'home' ? 'home'
              : tab === 'chat' ? 'chat'
              : tab === 'profile' ? 'profile'
              : 'settings';
    setActiveTab(tab);
    setRoute(dest);
    routeRef.current = dest;
    setHistory([]);
  };

  // ─── First-run onboarding + global confirm dialogs ───
  const [onboardingOpen, setOnboardingOpen] = useStateA(() => {
    try { return !localStorage.getItem('sc-onboarded'); } catch { return false; }
  });
  const closeOnboarding = () => {
    setOnboardingOpen(false);
    try { localStorage.setItem('sc-onboarded', '1'); } catch {}
  };
  const replayOnboarding = () => {
    try { localStorage.removeItem('sc-onboarded'); } catch {}
    setOnboardingOpen(true);
  };
  // Expose replay on window so the in-app Help & Feedback row can trigger it
  // without prop-drilling through Settings.
  useEffectA(() => { window.scReplayOnboarding = replayOnboarding; return () => { delete window.scReplayOnboarding; }; }, []);
  // Sign-out confirm + discard-draft confirm
  const [signOutOpen, setSignOutOpen] = useStateA(false);
  const [discardDraftOpen, setDiscardDraftOpen] = useStateA(false);
  const discardDraftResolveRef = React.useRef(null);
  const requestDiscardDraft = () => new Promise(resolve => {
    discardDraftResolveRef.current = resolve;
    setDiscardDraftOpen(true);
  });
  const handleSignOut = () => {
    setSignOutOpen(false);
    window.scToast && window.scToast({ message: 'Signed out (demo).', kind: 'info' });
  };

  // Determine which screen
  const routeName = typeof route === 'string' ? route : route.name;
  const showTabs = ['home', 'chat', 'profile', 'settings', 'interests', 'requests', 'discover-orgs', 'search', 'my-hosting', 'my-friends', 'my-following', 'drafts'].includes(routeName);

  const accountCtx = {
    activeAccount, setActiveAccount,
    accountSwitcherOpen, setAccountSwitcherOpen,
    picture, setPicture,
    orgPictures, setOrgPicture,
  };
  const friendCtx = {
    friends, friendStatus, toggleFriend,
    incomingRequestList, acceptRequest, declineRequest,
    outgoingRequests,
    pendingUnfriend,
  };
  const followCtx = { following, followStatus, toggleFollow, pendingFollows };

  const screen = useMemoA(() => {
    if (typeof route === 'string') {
      if (route === 'home') return <SCHomeScreen go={go} back={back} joined={joined} pendingLeave={pendingLeave} toggleJoin={toggleJoin} offline={tweaks.offline} showSkeletons={tweaks.showSkeletons} {...followCtx} {...friendCtx}/>;
      if (route === 'map') return <SCMapScreen go={go} back={back} joined={joined} pendingLeave={pendingLeave} toggleJoin={toggleJoin}/>;
      if (route === 'events-list') return <SCEventsList go={go} back={back} joined={joined} pendingLeave={pendingLeave} toggleJoin={toggleJoin}/>;
      if (route === 'chat') return <SCChatList go={go} back={back} {...friendCtx}/>;
      if (route === 'requests') return <SCRequestsScreen go={go} back={back} {...friendCtx}/>;
      if (route === 'profile') return <SCMyProfile go={go} back={back} {...accountCtx} {...followCtx} {...friendCtx} privacy={privacy} drafts={drafts}/>;
      if (route === 'discover-orgs' || route === 'search') return <SCSearchScreen go={go} back={back} {...followCtx} {...friendCtx}/>;
      if (route === 'my-hosting') return <SCMyHosting go={go} back={back} activeAccount={activeAccount}/>;
      if (route === 'drafts') return <SCDraftsScreen go={go} back={back} drafts={drafts} removeDraft={removeDraft}/>;
      if (route === 'my-friends') return <SCMyFriends go={go} back={back} {...friendCtx}/>;
      if (route === 'my-following') return <SCMyFollowing go={go} back={back} {...followCtx}/>;
      if (route === 'interests') return <SCInterestsScreen go={go} back={back} subscribed={subs} toggleSub={toggleSub}/>;
      if (route === 'settings') return <SCSettingsScreen go={go} back={back} radius={radius} setRadius={setRadius} privacy={privacy} setPrivacy={setPrivacy} visibility={visibility} setVisibility={setVisibility} picture={picture} setPicture={setPicture} notifPrefs={notifPrefs} setNotifPref={setNotifPref} dark={tweaks.dark} setDark={(v) => setTweak('dark', v)} requestSignOut={() => setSignOutOpen(true)} {...friendCtx}/>;
    } else {
      if (route.name === 'profile-other') return <SCProfileOther go={go} back={back} personId={route.personId} {...friendCtx}/>;
      if (route.name === 'org-profile') return <SCOrgProfile go={go} back={back} orgId={route.orgId} {...followCtx} {...accountCtx}/>;
      if (route.name === 'interest-detail') return <SCInterestDetail go={go} back={back} tag={route.tag} subscribed={subs} toggleSub={toggleSub}/>;
      if (route.name === 'event') return <SCEventScreen go={go} back={back} eventId={route.eventId} joined={joined} pendingLeave={pendingLeave} toggleJoin={toggleJoin}/>;
      if (route.name === 'attendees') return <SCAttendees go={go} back={back} eventId={route.eventId} {...friendCtx}/>;
      if (route.name === 'chat-thread') return <SCChatThread go={go} back={back} chatId={route.chatId} personId={route.personId} personIds={route.personIds} offline={tweaks.offline} {...friendCtx}/>;
      if (route.name === 'new-chat') return <SCNewChat go={go} back={back} {...friendCtx}/>;
      if (route.name === 'create-event') return <SCCreateEvent go={go} back={back} requestDiscardDraft={requestDiscardDraft} offline={tweaks.offline} draftId={route.draftId} drafts={drafts} saveDraft={saveDraft} removeDraft={removeDraft} {...accountCtx}/>;
      if (route.name === 'event-published') return <SCEventPublished go={go} back={back} form={route.form}/>;
      if (route.name === 'ratings') return <SCRatingsScreen go={go} back={back} hostId={route.hostId}/>;
      if (route.name === 'map') return <SCMapScreen go={go} back={back} joined={joined} pendingLeave={pendingLeave} toggleJoin={toggleJoin} focusEventId={route.focusEventId}/>;
    }
    return null;
  }, [route, joined, pendingLeave, friends, outgoingRequests, incomingRequests, following, pendingFollows, subs, radius, privacy, picture, orgPictures, activeAccount, accountSwitcherOpen, notifPrefs, pendingUnfriend, tweaks.dark, tweaks.palette, tweaks.offline, tweaks.showSkeletons, drafts]);

  // Crown the whole device
  return (
    <>
      {/* Sceneecheck wordmark — top center, fixed, doesn't depend on device size */}
      <div style={{
        position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px 6px 8px',
        background: 'color-mix(in oklab, var(--card) 75%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 999,
        border: '1px solid color-mix(in oklab, var(--ink) 8%, transparent)',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, background: 'var(--ink)', color: 'var(--surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--display)', fontWeight: 800, fontStretch: '70%', fontSize: 16, letterSpacing: '-0.05em',
        }}>S</div>
        <div className="display-tight" style={{ fontSize: 14, lineHeight: 1, color: 'var(--ink)' }}>SceneCheck</div>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-3)', letterSpacing: '0.16em' }}>· PROTOTYPE</span>
      </div>

      {/* meta — bottom center */}
      <div style={{
        position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)',
        zIndex: 100, color: 'var(--ink-3)',
        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', textAlign: 'center', whiteSpace: 'nowrap',
      }}>
        IN4MATX 43 · GROUP 10 · TAP MAP, EVENTS, PEOPLE & TABS — ALL WIRED
      </div>

      <div className="scale-wrap" style={{ transform: `scale(${scale})` }}>
      <IOSDevice width={402} height={874} dark={tweaks.dark}>
        <SCOnboarding open={onboardingOpen} onClose={closeOnboarding}/>
        <SCConfirmDialog
          open={signOutOpen}
          title="Sign out of SceneCheck?"
          body="You'll need to sign back in to see your events, friends, and chats."
          confirmLabel="SIGN OUT" cancelLabel="STAY"
          tone="danger" icon="logout"
          onConfirm={handleSignOut}
          onCancel={() => setSignOutOpen(false)}/>
        <SCConfirmDialog
          open={discardDraftOpen}
          title="Discard this draft?"
          body="Your event details haven't been saved. Leaving now will clear what you've entered."
          confirmLabel="DISCARD" cancelLabel="KEEP EDITING"
          tone="danger" icon="x"
          onConfirm={() => { setDiscardDraftOpen(false); discardDraftResolveRef.current && discardDraftResolveRef.current(true); }}
          onCancel={() => { setDiscardDraftOpen(false); discardDraftResolveRef.current && discardDraftResolveRef.current(false); }}/>
        <ToastHost/>
        <SCOfflineBanner visible={tweaks.offline} onRetry={() => setTweak('offline', false)}/>
        {conflictPrompt && (
          <div style={{
            position:'absolute', inset: 0, zIndex: 80,
            background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center',
          }} onClick={() => setConflictPrompt(null)}>
            <div onClick={e => e.stopPropagation()} style={{
              background:'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
              width: '100%', padding: '22px 20px 36px',
              boxShadow:'0 -10px 40px rgba(0,0,0,0.2)',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 12, background:'#FFE3DD', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--primary)' }}>
                  <SCIcon name="bell" size={18}/>
                </div>
                <div className="display-tight" style={{ fontSize: 22, lineHeight: 1.05 }}>Schedule conflict</div>
              </div>
              <p style={{ fontSize: 14, color:'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                You're already going to <b>{conflictPrompt.conflicts[0].title}</b> at the same time. Joining this event will overlap.
              </p>
              <div style={{ marginTop: 12, padding: 12, background:'var(--subtle)', borderRadius: 12, fontFamily:'var(--mono)', fontSize: 11.5 }}>
                {conflictPrompt.conflicts.map(c => (
                  <div key={c.id} style={{ marginBottom: 4 }}>
                    <span style={{ color:'var(--ink-3)' }}>OVERLAPS</span> · {scWhenRange(c)} · {c.title}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap: 10, marginTop: 18 }}>
                <button className="press" onClick={() => setConflictPrompt(null)} style={{
                  flex: 1, height: 48, borderRadius: 14, border:'1px solid var(--line)', background:'var(--card)',
                  cursor:'pointer', fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
                }}>CANCEL</button>
                <button className="press" onClick={() => { const id = conflictPrompt.id; setConflictPrompt(null); toggleJoin(id, { force: true }); }} style={{
                  flex: 1, height: 48, borderRadius: 14, border:'none', background:'var(--primary)', color:'var(--primary-ink)',
                  cursor:'pointer', fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
                }}>JOIN ANYWAY</button>
              </div>
            </div>
          </div>
        )}
        {/* Screen with status-bar + content padding */}
        <div id="sc-screen" style={{
          position: 'absolute', inset: 0,
          background: 'var(--surface)',
          color: 'var(--ink)',
          paddingTop: 60,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}>
          <div className="scroll" style={{
            flex: 1, overflowY: 'auto',
            paddingBottom: showTabs ? 0 : 0,
          }}>
            {screen}
          </div>
          {showTabs && <SCBottomTabs active={activeTab} onChange={switchTab}/>}
          {/* FAB - create event */}
          {tweaks.showFAB && routeName === 'home' && (
            <button className="press" style={{
              position: 'absolute', right: 18, bottom: 110,
              width: 56, height: 56, borderRadius: 18,
              background: 'var(--primary)', color: 'var(--primary-ink)',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 10px 24px -8px rgba(0,0,0,0.3)',
              zIndex: 31,
            }}
            onClick={() => go({ name:'create-event' })}>
              <SCIcon name="plus" size={22}/>
            </button>
          )}
        </div>
      </IOSDevice>
      </div>

      {/* Tweaks panel */}
      <TweaksPanel>
        <TweakSection title="Theme">
          <TweakColor label="Palette"
            value={tweaks.palette}
            onChange={(v) => setTweak('palette', v)}
            options={[
              ['#FF5B47','#FFE3DD','#14110F'],
              ['#2A55FF','#DDE5FF','#0E1633'],
              ['#C5F23B','#EFFBC8','#0D1407'],
            ]}
            optionLabels={['Sunset Coral','Cobalt Glow','Electric Lime']}
            optionValues={['sunset','cobalt','lime']}
          />
          <TweakToggle label="Dark mode" value={tweaks.dark} onChange={(v) => setTweak('dark', v)}/>
        </TweakSection>
        <TweakSection title="Layout">
          <TweakToggle label="Show create-event FAB" value={tweaks.showFAB} onChange={(v) => setTweak('showFAB', v)}/>
        </TweakSection>
        <TweakSection title="Simulate states">
          <TweakToggle label="Offline mode" value={tweaks.offline} onChange={(v) => setTweak('offline', v)}/>
          <TweakToggle label="Loading skeletons" value={tweaks.showSkeletons} onChange={(v) => setTweak('showSkeletons', v)}/>
          <TweakButton label="Replay onboarding tour" onClick={replayOnboarding}/>
        </TweakSection>
        <TweakSection title="Heuristic fixes (H2 round)">
          <TweakToggle label="① Pre-flight conflict chips" value={tweaks.preflightConflicts} onChange={(v) => setTweak('preflightConflicts', v)}/>
          <TweakToggle label="② Inline values + collapsible settings" value={tweaks.inlineSettings} onChange={(v) => setTweak('inlineSettings', v)}/>
          <TweakToggle label="③ Host edit / cancel + msg actions" value={tweaks.hostEditDelete} onChange={(v) => setTweak('hostEditDelete', v)}/>
          <TweakToggle label="④ Detailed failure states (publish / upload / 404)" value={tweaks.failureStates} onChange={(v) => setTweak('failureStates', v)}/>
          <TweakToggle label="⑤ Help replay + (?) tooltips" value={tweaks.helpTooltips} onChange={(v) => setTweak('helpTooltips', v)}/>
        </TweakSection>
        <TweakSection title="Jump to screen">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            {[
              { l:'Home',           r:'home' },
              { l:'Full Map',       r:'map' },
              { l:'My Profile',     r:'profile' },
              { l:'Other Profile',  r:{ name:'profile-other', personId:'p1' } },
              { l:'Interests',      r:'interests' },
              { l:'Interest #biking', r:{ name:'interest-detail', tag:'biking' } },
              { l:'Event Detail',   r:{ name:'event', eventId:'e1' } },
              { l:'Chat List',      r:'chat' },
              { l:'Chat Thread',    r:{ name:'chat-thread', chatId:'c1' } },
              { l:'Create Event',   r:{ name:'create-event' } },
              { l:'Settings',       r:'settings' },
            ].map((j, i) => (
              <button key={i} onClick={() => go(j.r)} style={{
                padding: '8px 10px', background: '#222', color: 'white',
                border: '1px solid #333', borderRadius: 8,
                fontFamily: 'monospace', fontSize: 11, cursor: 'pointer', textAlign: 'left',
              }}>{j.l}</button>
            ))}
          </div>
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

// Tweak swatches w/ optional palette-of-colors mode + custom labels/values
// (the starter's TweakColor is fine, but we want a label per option)
// We'll customize: replace TweakColor here for our use case.
function TweakColor({ label, value, onChange, options, optionLabels, optionValues }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#aaa', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((opt, i) => {
          const v = optionValues[i];
          const colors = Array.isArray(opt) ? opt : [opt];
          const sel = value === v;
          return (
            <button key={v} onClick={() => onChange(v)} style={{
              flex: 1, padding: 6, borderRadius: 10, cursor: 'pointer',
              background: sel ? 'rgba(255,255,255,0.1)' : 'transparent',
              border: '1.5px solid ' + (sel ? '#fff' : '#333'),
              display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center',
            }}>
              <div style={{ display: 'flex', gap: 2 }}>
                {colors.map((c, j) => (
                  <div key={j} style={{ width: j === 0 ? 22 : 10, height: 22, borderRadius: 4, background: c }}/>
                ))}
              </div>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#ddd', textAlign: 'center' }}>{optionLabels[i]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

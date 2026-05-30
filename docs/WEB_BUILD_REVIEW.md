# SceneCheck Web Build — Review Report

**Generated**: 2026-05-29
**Scope**: `scenecheck-expo/` web overrides (`*.web.tsx`), shared web atoms (`scenecheck-expo/web/*`), and supporting hooks (notifications, chat, profiles). Native (iOS/Android) sources were inspected only as parity references.
**Source agents**: R1 (foundation: WebShell, WebRail, atoms, _layout), R2 (home/map/search), R3 (chat/profile/overlays/secondary lists), R4 (create-event, settings, notifications).

---

## Executive summary

The web build is architecturally healthy — the shell/rail/atom split is clean, badge wiring is real (not hardcoded), notifications use a refcount singleton that correctly fans out to multiple consumers, and the per-screen optimistic-commit pattern on Home + Map is exemplary. The four agents surfaced **35 raw findings**, which dedupe to **24 distinct issues**: **4 critical**, **8 high**, **8 medium**, **4 low**. None of the issues prevent the app from booting in either mock or live mode, but several silently degrade behavior in live mode in ways that are not obvious from the UI.

The dominant theme is **mock-fixture bleed in live mode**. Six different files import `SC_*` constants (`SC_ACCOUNT_BY_ID`, `SC_ME`, `SC_EVENTS`, `SC_MY_ACCOUNTS`) and consume them on the live code path without an `api.isMock()` guard. This violates the central AGENTS.md invariant. The user-visible damage is concentrated in five surfaces: friend/follow privacy labels are wrong, host attribution silently goes blank, the "RECOMMENDED" bucket is computed against the mock persona's interests, the create-event "posting as" identity is a fixture (so the event publishes with `hostId: 'me'`), and interest detail pages always list mock events.

The second theme is **wiring gaps in mutators**. Three high-traffic actions (event JOIN in the overlay, JOIN/LEAVE in Search, follow-org via `toggleFollow`) update the store but never call the corresponding `api.*` method, so live-mode users see a successful toast while the server records nothing. Combined with two `create_event` payload omissions (`visibility` and `auto_group_chat`), these gaps directly contradict spec requirements FR5.1, FR5.5, FR7.1, FR7.3, FR8.1, and FR9.4.

The third theme is **a11y on overlay surfaces**. `WebSlideOver`, `WebActivityPanel`, and the rail account-switcher popover all lack focus traps and focus restoration, breaking keyboard navigation. A shared `useFocusTrap` hook would fix all three.

The highest-impact single fix is **`web/kind.ts`**: removing the `SC_ACCOUNT_BY_ID` and `SC_ME.interests` defaults eliminates 3 separate findings across 4 screens. The highest-impact pair of fixes is the **event-overlay JOIN flow + `useStore.toggleFollow` API commit**, which unblocks FR5.5 (waitlist), FR7.1 (subscriptions), FR7.2 (calendar) and FR7.3 (group chat) in one batch. Overall posture: the web build is roughly 80% live-ready; the remaining 20% is concentrated in 6-7 commits' worth of mostly-mechanical fixes.

---

## Methodology

Four parallel agents each audited a slice of the web build (R1: foundation; R2: home/map/search; R3: chat/profile/overlays; R4: create/settings/notifications). This aggregator re-read every report, opened each cited file, verified line numbers against current source, validated the proposed fixes by reading surrounding context, and merged overlapping findings into single records that cite every affected file. The four `.review-r*.md` files were not modified. Native source (`*.tsx` without a `.web.tsx` sibling) was inspected only as a parity reference. No source was modified during this audit.

---

## Findings

### Critical (4)

#### C-01: `kind.ts` helpers silently fall back to mock fixtures in live mode
- **Affected files**:
  - `scenecheck-expo/web/kind.ts:14` — imports `SC_ACCOUNT_BY_ID`, `SC_ME`
  - `scenecheck-expo/web/kind.ts:31-41` — `wIsRecommended` defaults `subs` to `SC_ME.interests`
  - `scenecheck-expo/web/kind.ts:90-95` — `wHostAccount` reads `SC_ACCOUNT_BY_ID[hostId]` unconditionally
  - `scenecheck-expo/web/WebMap.tsx` (pin loop), `scenecheck-expo/web/WebEventListCard.tsx`, `scenecheck-expo/web/WebSearchAutocomplete.tsx` — call `wKindMeta(e, t)` without passing `subs`
  - `scenecheck-expo/app/event/[id].web.tsx:56` — `host = hostProfile ?? wHostAccount(event)`
- **Source agents**: R1 (F-R1-005, F-R1-006), R2 (F-R2-001, F-R2-003)
- **Category**: mock-leak
- **Description**: Two helpers in the shared web module read mock fixtures on every call. `wHostAccount` returns `null` for any live `hostId` (UUID misses the fixture map), so host name/avatar/handle is silently blank on event cards, hover cards, and the event overlay header when `useProfile` hasn't yet resolved. `wIsRecommended` builds its `Set` from `SC_ME.interests` (`['biking', 'coffee', 'climbing']`) when callers omit `subs`, so the "RECOMMENDED" bucket and the for-you accent on the map and cards reflect the mock persona instead of the signed-in user.
- **Evidence**:
  ```ts
  // wIsRecommended (line 36-39)
  const set =
    subs instanceof Set
      ? subs
      : new Set(Array.isArray(subs) ? subs : SC_ME.interests || []);
  // wHostAccount (line 93)
  if (e.hostId && SC_ACCOUNT_BY_ID[e.hostId]) return SC_ACCOUNT_BY_ID[e.hostId];
  ```
- **Native parity reference**: `scenecheck-expo/components/SCEventCard.tsx` — native cards take host data from the screen's pre-fetched profile map, not from the fixture dictionary.
- **Spec reference**: FR3.4, FR4.1, FR4.4, AGENTS.md "Mock vs live mode" invariant.
- **Proposed fix**:
  1. In `wIsRecommended`, change the fallback to an empty `Set<string>()`; remove the `SC_ME` import once unused.
  2. Convert `wHostAccount` to accept an optional `lookup?: Record<string, Account>` and return `lookup?.[e.hostId] ?? null`. Drop the `SC_ACCOUNT_BY_ID` reference. (Screens already either call `useProfile(hostId)` — event overlay — or do not display a host on cards. The new signature lets future callers seed the lookup from a batched `getProfilesByIds` if they need card-level hosts.)
  3. Update `WebMap` and `WebEventListCard` to pass `subscribedInterests` (already in the store and already read by their `counts` memos) to per-card `wKindMeta(e, t, subscribedInterests)` calls.
- **Reasoning**: One central helper change fixes recommendation classification and host attribution simultaneously. The lookup-map signature for `wHostAccount` is safer than embedding `useProfile` in the helper because the helper is sync and called from render bodies.
- **Side effects to watch**: `event/[id].web.tsx` line 56 already uses `hostProfile ?? wHostAccount(event)` — once `wHostAccount` requires a lookup, drop the fallback (the `useProfile` call covers it). `WebChatThread.resolveHeader` (line 59) also calls `wHostAccount(ev)`; switch that to use the chat's `members` array if available.

#### C-02: Event-overlay JOIN bypasses `api.subscribeToEvent` — no DB write, no waitlist, no calendar
- **Affected files**:
  - `scenecheck-expo/app/event/[id].web.tsx:66-75` — `handleJoinToggle` is store-only
  - `scenecheck-expo/app/event/[id].web.tsx:178-184` — `WebJoinButton` label has no waitlist branch
- **Source agents**: R3 (F-R3-001, F-R3-002)
- **Category**: wiring-gap
- **Description**: The web event overlay's JOIN button calls only `joinEvent(id)` / `leaveEvent(id)` (store mutators) and a `showToast`. No `api.subscribeToEvent`/`api.cancelSubscription`, no waitlist status check, no calendar side-effect, no error rollback. In live mode an RSVP shows a green toast but the server records nothing, so the user is not in `event_subscriptions`, never gets added to the auto group chat, and never receives event reminders. The label is also a static "JOIN EVENT" — never "JOIN WAITLIST" when capacity is full.
- **Evidence**:
  ```ts
  const handleJoinToggle = () => {
    if (!id) return;
    if (joined) {
      leaveEvent(id);
      showToast({ message: `Left "${event.title}".`, kind: 'info' });
    } else {
      joinEvent(id);
      showToast({ message: `Joined "${event.title}".`, kind: 'success' });
    }
  };
  ```
- **Native parity reference**: `scenecheck-expo/app/event/[id].tsx:178-278` — full async `handleToggleJoin` calls `api.subscribeToEvent`, reads `result.status === 'waitlisted'`, fires Google Calendar insert, rolls back on error. Line 562 picks the label dynamically: `label={!capUnknown && goingCount >= e.cap ? 'JOIN WAITLIST' : 'JOIN EVENT'}`.
- **Spec reference**: FR5.5 (waitlist), FR7.1 (subscription persistence), FR7.2 (calendar add), FR7.3 (auto chat join).
- **Proposed fix**: Port the native `handleToggleJoin` verbatim:
  ```ts
  const handleJoinToggle = async () => {
    if (!id) return;
    if (joined) {
      leaveEvent(id);
      try {
        await api.cancelSubscription(id);
        showToast({ message: `Left "${event.title}".`, kind: 'info' });
      } catch (err) {
        joinEvent(id); // rollback
        showToast({ message: `Couldn't leave: ${err instanceof Error ? err.message : String(err)}`, kind: 'error' });
      }
    } else {
      joinEvent(id);
      try {
        const res = await api.subscribeToEvent(id, true);
        if (res?.status === 'waitlisted') {
          showToast({ message: `You're on the waitlist for "${event.title}".`, kind: 'info' });
        } else {
          showToast({ message: `Joined "${event.title}".`, kind: 'success' });
        }
        if (linkedCalendar === 'google' && event.startAt && googleCalendar.isConfigured()) {
          googleCalendar.insertEvent({ /* … */ }).catch(() => { /* swallow */ });
        }
      } catch (err) {
        leaveEvent(id); // rollback
        showToast({ message: `Couldn't join: ${err instanceof Error ? err.message : String(err)}`, kind: 'error' });
      }
    }
  };
  ```
  And switch the button label:
  ```ts
  const capUnknown = event.cap <= 0;
  const isFull = !capUnknown && goingCount >= event.cap;
  label={event.kind === 'yours' ? 'MANAGE EVENT' : (isFull ? 'JOIN WAITLIST' : 'JOIN EVENT')}
  ```
- **Reasoning**: Reusing the native implementation guarantees identical semantics and avoids subtle divergence on rollback behavior. The "calendar sync available on native" toast on the dedicated calendar button (line 199) can remain as is — that button is a manual handoff, separate from FR7.2's automatic insert.
- **Side effects to watch**: The same store-only join pattern appears in `app/search.web.tsx:108-111`, `app/interests/[tag].web.tsx:68-76`, `app/my-hosting.web.tsx`, `app/my-events.web.tsx`, `app/(tabs)/profile.web.tsx`. After fixing the overlay, lift the optimistic-commit flow into a shared `useJoinEventHandler()` hook and route every list page through it (see H-01).

#### C-03: `useStore.toggleFollow` never calls `api.followOrg` / `api.unfollowOrg`
- **Affected files**:
  - `scenecheck-expo/web/WebFollowButton.tsx:14` — imports `SC_ACCOUNT_BY_ID`
  - `scenecheck-expo/web/WebFollowButton.tsx:29` — `SC_ACCOUNT_BY_ID[orgId] ?? null` for privacy label
  - `scenecheck-expo/web/WebFollowButton.tsx:42` — `toggle(orgId)` is store-only; no API call anywhere on web
  - `scenecheck-expo/store/useStore.ts` — `toggleFollow` mutator only flips the local `following` Set
- **Source agents**: R1 (F-R1-002)
- **Category**: wiring-gap + mock-leak (combined)
- **Description**: Two compounding defects on org follow. (1) The privacy label is computed from `SC_ACCOUNT_BY_ID[orgId]?.privacy`, so live orgs always show "Follow" (never "Request to follow") because the lookup misses. (2) The actual follow/unfollow is store-only — `api.followOrg`/`api.unfollowOrg` are never called, so private-org join rows are never written to `org_follows` in live mode.
- **Evidence**:
  ```ts
  const o = SC_ACCOUNT_BY_ID[orgId] ?? null;
  // ...
  const onClick = (e) => {
    e.stopPropagation();
    toggle(orgId);                // store-only; no API
    /* toast only */
  };
  ```
- **Spec reference**: FR7.1, FR7.2 (private-org request flow).
- **Proposed fix**: Resolve the org via `useProfile(orgId)` (same hook the event overlay uses for hosts), drop the `SC_ACCOUNT_BY_ID` import, and add an optimistic-commit pattern to the click handler:
  ```ts
  const { profile: o } = useProfile(orgId);
  const onClick = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const wasFollowing = status === 'following';
    toggle(orgId); // optimistic
    try {
      if (wasFollowing) await api.unfollowOrg(orgId);
      else await api.followOrg(orgId);
    } catch {
      toggle(orgId); // rollback
      showToast({ message: 'Failed to update follow.', kind: 'error' });
      return;
    }
    /* existing toast */
  };
  ```
- **Reasoning**: Mirrors the friend-request optimistic-commit pattern already used in `requests.web.tsx`. Adding the API call inside `WebFollowButton` rather than in the store mutator keeps the store dumb and avoids changing the contract for any native caller that hasn't been audited here.
- **Side effects to watch**: `useStore.ts` `toggleFollow` is shared with native. If native already calls the API separately, do not modify the store mutator. If neither platform calls the API, this is also a native bug worth flagging.

#### C-04: `WebFriendButton` privacy label leaks mock fixture in live mode
- **Affected files**:
  - `scenecheck-expo/web/WebFriendButton.tsx:15` — imports `SC_ACCOUNT_BY_ID`
  - `scenecheck-expo/web/WebFriendButton.tsx:34` — `SC_ACCOUNT_BY_ID[personId] ?? null`
  - `scenecheck-expo/web/WebFriendButton.tsx:46` — label `'Request' : 'Add friend'` switched on `p?.privacy`
- **Source agents**: R1 (F-R1-001)
- **Category**: mock-leak
- **Description**: In live mode `personId` is a UUID that misses `SC_ACCOUNT_BY_ID`, so `p?.privacy === 'private'` is always falsy. Every live profile (including actually-private ones) renders as "Add friend", and the action takes the immediate-friendship branch (`addFriend`) rather than the request branch (`sendFriendRequest`). That side-steps the FR8.2 private-account approval flow entirely.
- **Evidence**:
  ```ts
  const p = SC_ACCOUNT_BY_ID[personId] ?? null;
  // ...
  label: p?.privacy === 'private' ? 'Request' : 'Add friend',
  ```
- **Spec reference**: FR8.1 (friend requests), FR8.2 (private-account approval).
- **Proposed fix**: Use `useProfile(personId)` and read `profile?.privacy`. Drop the `SC_ACCOUNT_BY_ID` import. The action toasts that read `p?.name` can use `profile?.name`.
  ```ts
  const { profile } = useProfile(personId);
  const privacy = profile?.privacy ?? 'public';
  // ... label: privacy === 'private' ? 'Request' : 'Add friend'
  ```
- **Reasoning**: `useProfile` already short-circuits to the mock fixture when `api.isMock()`, so mock behavior is preserved transparently while live mode gets the real value.
- **Side effects to watch**: `useProfile` triggers a network round-trip; the button shows the default label until resolution. Consider showing a neutral spinner state for the privacy-dependent branch when `loading === true` and `profile == null`.

---

### High (8)

#### H-01: Join/Leave on Search + secondary lists bypass the API (same root cause as C-02)
- **Affected files**:
  - `scenecheck-expo/app/search.web.tsx:108-111` — `onToggleJoin` is store-only
  - `scenecheck-expo/app/interests/[tag].web.tsx:68-76` — `handleJoin` is store-only
  - `scenecheck-expo/app/my-hosting.web.tsx`, `scenecheck-expo/app/my-events.web.tsx`, `scenecheck-expo/app/(tabs)/profile.web.tsx` — same pattern in list pages (per R3 cross-cutting note)
- **Source agents**: R2 (F-R2-002), R3 (F-R3-001 cross-cutting note)
- **Category**: wiring-gap
- **Description**: Same as C-02 but spread across five secondary screens. None of them call `api.subscribeToEvent` / `api.cancelSubscription`. The Home and Map screens do this correctly (see `index.web.tsx:117-149`, `map.web.tsx:85-117`); the gap is everywhere else.
- **Spec reference**: FR7.1.
- **Proposed fix**: Once C-02 is fixed in the overlay, extract a shared hook:
  ```ts
  // hooks/useJoinEventHandler.ts
  export function useJoinEventHandler() {
    const joined = useStore(s => s.joined);
    const joinStore = useStore(s => s.joinEvent);
    const leaveStore = useStore(s => s.leaveEvent);
    const showToast = useStore(s => s.showToast);
    return useCallback(async (event: SCEvent) => {
      const isJoined = joined.has(event.id);
      if (isJoined) {
        leaveStore(event.id);
        try { await api.cancelSubscription(event.id); }
        catch (err) {
          joinStore(event.id);
          showToast({ message: `Couldn't leave: ${err instanceof Error ? err.message : String(err)}`, kind: 'error' });
        }
      } else {
        joinStore(event.id);
        try {
          const res = await api.subscribeToEvent(event.id, true);
          showToast({ message: res?.status === 'waitlisted' ? `Waitlisted for "${event.title}".` : `Joined "${event.title}".`, kind: res?.status === 'waitlisted' ? 'info' : 'success' });
        } catch (err) {
          leaveStore(event.id);
          showToast({ message: `Couldn't join: ${err instanceof Error ? err.message : String(err)}`, kind: 'error' });
        }
      }
    }, [joined, joinStore, leaveStore, showToast]);
  }
  ```
  Then have every list page call `const onJoin = useJoinEventHandler();` and pass `onJoin={() => onJoin(e)}` to the card.
- **Reasoning**: Removes 5 copies of the same buggy block in one move and ensures any future change (e.g. waitlist toast wording) lands in one place.

#### H-02: Activity panel + slide-over + account-switcher have no focus trap or focus restoration
- **Affected files**:
  - `scenecheck-expo/web/WebActivityPanel.tsx:66-86` — `role="dialog" aria-modal="true"` with no focus management
  - `scenecheck-expo/web/WebSlideOver.tsx:72-94` — same, plus missing `aria-label`/`aria-labelledby`
  - `scenecheck-expo/web/WebRail.tsx:636-651` — switcher popover has no role, no ESC handler, no `aria-expanded` link
- **Source agents**: R1 (F-R1-003, F-R1-004, F-R1-007)
- **Category**: a11y
- **Description**: All three overlays declare ARIA roles but rely on the OS / screen reader to enforce focus containment, which browsers don't do. Keyboard users can Tab past the dialog into the main content, ESC works on the activity panel and slide-over but not the switcher, and focus is never restored to the triggering button on close. The slide-over is used by every overlay route (event, profile, attendees, ratings, interests), so the gap propagates to every detail screen.
- **Spec reference**: WCAG 2.1 SC 2.1.2 (No Keyboard Trap) and SC 2.4.3 (Focus Order). FR10 (notifications must be interactable).
- **Proposed fix**: Add a shared `web/useFocusTrap.ts` hook:
  ```ts
  export function useFocusTrap(open: boolean, panelRef: RefObject<HTMLElement>, triggerRef?: RefObject<HTMLElement>) {
    useEffect(() => {
      if (!open) {
        triggerRef?.current?.focus();
        return;
      }
      const panel = panelRef.current;
      if (!panel) return;
      const first = panel.querySelector<HTMLElement>('[autofocus],button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
      first?.focus();
      const onKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        const focusables = panel.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!focusables.length) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      };
      panel.addEventListener('keydown', onKey);
      return () => panel.removeEventListener('keydown', onKey);
    }, [open, panelRef, triggerRef]);
  }
  ```
  Apply it inside `WebActivityPanel`, `WebSlideOver`, and the switcher popover. For `WebSlideOver`, also accept and forward an `ariaLabel` prop; every consumer (`event/[id].web.tsx`, `profile/[id].web.tsx`, etc.) passes a label string. For the switcher, also add `role="menu"`/`role="menuitem"`, `aria-expanded={switcherOpen}` on the trigger, `aria-haspopup="menu"`, and an ESC handler.
- **Reasoning**: One hook + one prop + three call-site edits closes a systematic gap.

#### H-03: `SC_EVENTS` read unconditionally in interest detail screen (live mode shows fixture events)
- **Affected files**:
  - `scenecheck-expo/app/interests/[tag].web.tsx:20` — imports `SC_EVENTS`
  - `scenecheck-expo/app/interests/[tag].web.tsx:50-52` — `SC_EVENTS.filter(...)` without `api.isMock()` guard
- **Source agents**: R3 (F-R3-006)
- **Category**: mock-leak
- **Description**: The "Events tagged #X" list is filtered from `SC_EVENTS` unconditionally. In live mode this always shows mock events, so a real signed-in user clicking an interest tag from a real event card lands on a page populated with fixture data.
- **Spec reference**: AGENTS.md "Mock vs live mode".
- **Proposed fix**: At minimum, gate the read:
  ```ts
  const events = api.isMock()
    ? SC_EVENTS.filter(e => (e.interests ?? []).includes(i.tag))
    : []; // until /events?tag= hook exists, prefer empty over wrong
  ```
  Better: add a `useInterestEvents(tag)` hook that wraps the existing `useEvents` query with a `tags=[tag]` filter, or extend the `rank_events_query` RPC to accept an `interest_tag` parameter. The R3 comment on line 47 already flags the missing endpoint.
- **Reasoning**: Showing nothing is honest; showing wrong data is misleading. The empty state shouldn't ship long-term, but it correctly conveys "we don't have this data yet."

#### H-04: `create-event.web.tsx` uses `SC_MY_ACCOUNTS` as the live host identity
- **Affected files**:
  - `scenecheck-expo/app/create-event.web.tsx:35` — `import { SC_MY_ACCOUNTS } from '@/data/mocks'`
  - `scenecheck-expo/app/create-event.web.tsx:152-153` — `account = SC_MY_ACCOUNTS.find(...) || SC_MY_ACCOUNTS[0]`
  - `scenecheck-expo/app/create-event.web.tsx:191-193, 209` — `previewEvent.hostId = account.id`, `host = account.name`
- **Source agents**: R4 (F-R4-003)
- **Category**: mock-leak
- **Description**: The "Posting as" switcher is populated from `SC_MY_ACCOUNTS` even in live mode. The active account id is always one of `['me', 'org1', 'org2', ...]` (mock short-IDs), so the preview card's `hostId` is a fixture string, the preview navigation to `/profile/${hostId}` is broken in production, and — depending on the server's contract — the published event may carry the wrong host metadata.
- **Native parity reference**: `scenecheck-expo/app/create-event.tsx` does not import `SC_MY_ACCOUNTS`; the host is derived from the session `me`.
- **Spec reference**: AGENTS.md "Mock vs live mode".
- **Proposed fix**:
  ```ts
  const me = useStore(s => s.me);
  const orgs = useStore(s => s.orgs ?? []); // or however orgs are exposed
  const accountList = useMemo(() => {
    if (api.isMock()) return SC_MY_ACCOUNTS;
    return [
      { id: me.id, type: 'person' as const, name: me.name, handle: me.username ? `@${me.username}` : '' },
      ...orgs.map(o => ({ id: o.id, type: 'org' as const, name: o.name, handle: `@${o.handle ?? ''}` })),
    ];
  }, [me, orgs]);
  const account = accountList.find(a => a.id === activeAccount) ?? accountList[0];
  ```
  Then drop the `SC_MY_ACCOUNTS` import once unused (or keep it scoped to the `api.isMock()` branch).
- **Reasoning**: The store already has `me` and `picture`; org membership needs to be checked — if `useStore` doesn't yet expose owned/admin orgs, that's an open architectural question (see below).
- **Side effects to watch**: `previewEvent.hostId` flows into the live `WebEventListCard` preview; once fixed, also fix the preview's "view profile" target.

#### H-05: `create_event` payload drops `visibility` and `auto_group_chat`
- **Affected files**:
  - `scenecheck-expo/app/create-event.web.tsx:239-255` — `api.createEvent({...})` omits both fields
- **Source agents**: R4 (F-R4-001, F-R4-002, F-R4-005)
- **Category**: wiring-gap
- **Description**: The wizard captures `form.visibility` (Step 3 radio: `'public' | 'private'`) and `form.autoGroupChat` (toggle), the Review step displays both, and the Edge Function presumably has columns for them — but neither key is included in the body passed to `api.createEvent`. Result: a creator who chooses "private" publishes a public event, and a creator who toggles off auto-group-chat still gets one created.
- **Evidence**:
  ```ts
  const result = await api.createEvent({
    title: form.title.trim(),
    /* ... */
    interests: form.interests,
    price_min: priceMin,
    price_max: priceMax,
    price_currency: priceCurrency,
    // ← no visibility, no auto_group_chat
  });
  ```
- **Spec reference**: FR5.1 (creator-set visibility), FR9.4 (opt-in/out of auto group chat).
- **Proposed fix**:
  ```ts
  const result = await api.createEvent({
    /* existing fields */
    visibility: form.visibility,
    auto_group_chat: form.autoGroupChat,
  });
  ```
  Then verify the Edge Function (`supabase/functions/create-event/index.ts`) reads both keys and persists them. If `auto_group_chat` is not yet a column on `events` or a parameter the function recognizes, the gap extends to the server — flag in Open Questions.
- **Reasoning**: A privacy-impacting silent default is one of the highest-severity classes of bugs. The native sibling likely has the same omission; confirm and fix both.
- **Side effects to watch**: Open architectural question — the form models `Visibility` as `'public' | 'private'` only, but the architecture doc may discuss `'friends'` or `'unlisted'` as a third value. Confirm the contract before adding the field.

#### H-06: `WebChatThread` cannot compose FR9.5 announcements
- **Affected files**:
  - `scenecheck-expo/web/WebChatThread.tsx:111` — `const { messages: msgs, send } = useChatMessages(chatId);` — no `canAnnounce` lookup
  - `scenecheck-expo/web/WebChatThread.tsx:141-153, 467-530` — `submit` passes no `messageType`; composer has no toggle UI
- **Source agents**: R3 (F-R3-003)
- **Category**: parity-gap
- **Description**: Receiving and rendering announcements is wired correctly (lines 365, 392-427 — the tinted-card branch checks `m.messageType === 'announcement'`). But composing them is impossible on web. The native screen calls `api.canPostAnnouncement(chatId)` and renders a toggle chip above the composer for hosts; web has no such control.
- **Native parity reference**: `scenecheck-expo/app/chat/[id].tsx:62-76`.
- **Spec reference**: FR9.5.
- **Proposed fix**: Add the toggle pattern from native:
  ```ts
  const [canAnnounce, setCanAnnounce] = useState(false);
  const [announceNext, setAnnounceNext] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.canPostAnnouncement(chatId).then(v => { if (!cancelled) setCanAnnounce(v); });
    return () => { cancelled = true; };
  }, [chatId]);
  // submit():
  await send(text, announceNext ? 'announcement' : undefined);
  setAnnounceNext(false);
  ```
  Render a small `[Announcement]` chip above the textarea when `canAnnounce` is true.
- **Reasoning**: `useChatMessages.send` already accepts `messageType` as a second argument; no new infrastructure needed.

#### H-07: Person profile overlay lacks Block + Report stub-only
- **Affected files**:
  - `scenecheck-expo/app/profile/[id].web.tsx:85-97` — Report button calls `useStore.getState().showToast({ message: 'Report submitted. Thanks.', kind: 'info' })`
  - same file — no Block action exists
- **Source agents**: R3 (F-R3-004)
- **Category**: parity-gap + wiring-gap
- **Description**: The Report button fires a stub toast — `api.submitReport` is never called, so live-mode reports are silently dropped. There is no Block action at all on the web overlay. Native (`profile/[id].tsx:313-358`) has both, gated by `showConfirm` dialogs.
- **Spec reference**: FR11.1 (block), FR11.2 (report).
- **Proposed fix**:
  ```ts
  const showConfirm = useStore(s => s.showConfirm);
  const blockUser = useStore(s => s.blockUser);
  // Report:
  onClick={() => showConfirm({
    title: `Report ${profile.name}?`,
    body: 'Our team will review.',
    confirmLabel: 'REPORT',
    onConfirm: () => api.submitReport(profile.id, null, 'profile-report')
      .then(() => showToast({ message: 'Report submitted. Thanks.', kind: 'info' }))
      .catch(() => showToast({ message: "Couldn't submit report.", kind: 'error' })),
  })}
  // Block: add a second WebButton in the header row.
  ```
- **Reasoning**: Trust-and-safety primitives must reach the server; missing them in production is a moderation regression.

#### H-08: Profile overlay shared-interest diff uses `SC_ME.interests`
- **Affected files**:
  - `scenecheck-expo/app/profile/[id].web.tsx:21` — imports `SC_ME`
  - `scenecheck-expo/app/profile/[id].web.tsx:65-66` — `myInterests = SC_ME.interests ?? []`, `shared = interests.filter(tag => myInterests.includes(tag))`
- **Source agents**: R3 (F-R3-007)
- **Category**: mock-leak
- **Description**: In live mode `SC_ME.interests` is the fixture persona's tags, so the "N shared" label and the primary-toned highlight on shared tags are computed against the wrong set.
- **Spec reference**: AGENTS.md "Mock vs live mode".
- **Proposed fix**: Read from the store (which `AuthBootstrap` hydrates from `useUserInterests(meId)`):
  ```ts
  const myInterests = useStore(s => s.me.interests ?? []);
  const shared = interests.filter(tag => myInterests.includes(tag));
  ```
  Drop the `SC_ME` import.
- **Reasoning**: Same fix that the create-event wizard already uses on line 118 of `create-event.web.tsx`.

---

### Medium (8)

#### M-01: `transformEventRow` labels strangers' events as "FRIEND HOSTING" (not web-specific but more visible there)
- **Affected files**:
  - `scenecheck-expo/lib/api.ts:118-124` — `kind: 'friend'` is the default for non-creator, non-scraped rows
  - `scenecheck-expo/app/(tabs)/map.web.tsx` legend, `scenecheck-expo/web/WebEventListCard.tsx` accent — both render the "Friends" label on these rows
- **Source agents**: R2 (F-R2-004)
- **Category**: bug (cross-platform, but web makes it more visible)
- **Description**: Any event whose creator is not the current user and whose `source` is not `'scraped'` is classified as `kind: 'friend'`. With the web map's explicit "Friends" legend bucket, strangers' events render with the friend-colored pin and "FRIEND HOSTING" label. The architecture FR4.4 requires meaningful visual distinction; the current implementation breaks that promise.
- **Spec reference**: FR4.4.
- **Proposed fix**: Conservative interim — change the fallback to `'other'` (or whatever bucket maps to the neutral "NEARBY EVENT" accent). Real fix — extend `rank_events_query` to return `is_friend_creator: boolean` (join `friendships` server-side) and let `transformEventRow` set `kind: 'friend'` only when that flag is true.
- **Reasoning**: The bucket is consumed by both platforms, so a server-side flag avoids divergence. The conservative interim is safe to ship today.

#### M-02: Web Map has no location-denied affordance
- **Affected files**:
  - `scenecheck-expo/app/(tabs)/map.web.tsx:45` — `const { coords } = useLocation();` (no `status`, `isFallback`, `request`)
- **Source agents**: R2 (F-R2-005)
- **Category**: parity-gap
- **Description**: Native map renders a "TAP TO ENABLE LOCATION" / "LOCATION DENIED · USING UCI DEFAULT" pill when `isFallback` is true. Web map never reads `status`/`isFallback`/`request`, so a user who hasn't granted location silently sees the UCI default with no recovery path. Browsers require a user gesture to surface the geolocation prompt, so without this affordance there is no way to grant permission from the Map tab.
- **Native parity reference**: `scenecheck-expo/app/(tabs)/map.tsx:107-122`.
- **Spec reference**: FR1.5, FR4.1.
- **Proposed fix**:
  ```ts
  const { coords, status, isFallback, request } = useLocation();
  // In the JSX, above the map:
  {isFallback && (
    <button onClick={() => request()} style={{ /* floating pill above map */ }}>
      {status === 'denied' ? 'LOCATION DENIED · USING UCI DEFAULT' : 'ENABLE LOCATION'}
    </button>
  )}
  ```
- **Reasoning**: One-line destructure change + one conditional render.

#### M-03: `useNotifications.markRead` / `markAllRead` errors pollute the global `_initialError` slot
- **Affected files**:
  - `scenecheck-expo/hooks/useNotifications.ts:194-202` — `markRead` catch writes `_initialError`
  - `scenecheck-expo/hooks/useNotifications.ts:208-223` — `markAllRead` catch writes `_initialError`
- **Source agents**: R1 (F-R1-008), R4 (F-R4-006)
- **Category**: bug
- **Description**: A transient PATCH failure on mark-as-read overwrites the same module-level `_initialError` that the page-level fetch error uses. Every consumer (badge, panel, full notifications page) then renders "Couldn't load activity right now" even though the cache is valid.
- **Proposed fix**: Either give mutation errors their own slot, or swallow them silently — the optimistic flip is already in place:
  ```ts
  // markRead catch:
  } catch {
    // Mark-read is best-effort. The optimistic flip stays.
  }
  // markAllRead catch:
  } catch {
    // Best-effort batch update.
  }
  ```
  Or split into `_loadError` (read by consumers as `error`) and `_mutationError` (internal-only).
- **Reasoning**: Mark-read is already documented as best-effort ("a stale-true is less surprising than a flicker back to bold"); the same logic applies to errors. The two consumer reports converge on this same fix.

#### M-04: `WebActivityRow` has no `waitlist_promotion` case
- **Affected files**:
  - `scenecheck-expo/web/WebActivityRow.tsx:117-186` — switch on `n.type` lacks the case
  - `scenecheck-expo/app/notifications.tsx` `titleFor` — same gap on native
- **Source agents**: R4 (F-R4-007)
- **Category**: wiring-gap
- **Description**: The notifications Edge Function emits `'waitlist_promotion'` rows. The renderer's switch covers friend_request, event_invite, event_reminder, event_update, chat_reply/message, rating_received — but not waitlist_promotion. The row falls to the generic default branch (line 174-185), rendering as "waitlist promotion" plain text with a bell icon and no deep link.
- **Spec reference**: Architecture "Push notifications".
- **Proposed fix**:
  ```ts
  case 'waitlist_promotion':
    return {
      icon: 'check-circle',
      accentToken: 'good',
      title: `You're in — ${eventTitle} has a spot for you`,
      body: preview || 'Tap to view event details.',
      cta: 'View event',
      ctaHref: eventId ? `/event/${eventId}` : deepLink,
    };
  ```
- **Reasoning**: Waitlist promotion is the highest-signal notification a user can receive; treating it as generic text wastes the moment.

#### M-05: `requests.web.tsx` cancel-outgoing uses `api.removeFriend`
- **Affected files**:
  - `scenecheck-expo/app/requests.web.tsx:64` — `await api.removeFriend(id)` inside the `cancel` handler
- **Source agents**: R3 (F-R3-008)
- **Category**: bug (maintainability)
- **Description**: Cancelling a pending outgoing request calls `api.removeFriend`, which today happens to work because pending requests are friendship rows. Semantically wrong: a future split between "cancel pending" and "remove existing friend" endpoints would silently miss this call site. The same applies to the native sibling.
- **Proposed fix**: Add `api.cancelFriendRequest(personId)` as an explicit alias even if the implementation forwards to the same DELETE today. Update both web and native call sites.
- **Reasoning**: Defensive abstraction — naming captures intent now so the future refactor doesn't slip.

#### M-06: `WebChatThread` does not destructure `retry` (failed messages are dead ends)
- **Affected files**:
  - `scenecheck-expo/web/WebChatThread.tsx:111` — `const { messages: msgs, send } = useChatMessages(chatId);`
  - `scenecheck-expo/web/WebChatThread.tsx:455-457` — `'failed'` rendered as static text
- **Source agents**: R3 (F-R3-009)
- **Category**: parity-gap
- **Description**: When `m.status === 'failed'` the web bubble shows "failed" as plain text. Native renders a tappable "RETRY" link calling `retry(m.id)`. `useChatMessages` already exports `retry` — it's just not destructured.
- **Proposed fix**:
  ```ts
  const { messages: msgs, send, retry } = useChatMessages(chatId);
  // In the failed branch:
  {m.status === 'failed' && (
    <button onClick={() => void retry(m.id)} style={{ /* small link */ }}>RETRY</button>
  )}
  ```
- **Reasoning**: Trivial wiring, restores user agency on a transient send failure.

#### M-07: Profile overlay missing private-account visibility gate
- **Affected files**:
  - `scenecheck-expo/app/profile/[id].web.tsx:47-319` — entire render, no `privateLocked` computation
- **Source agents**: R3 (F-R3-011)
- **Category**: parity-gap
- **Description**: Native computes `privateLocked = isPrivate && !isFriend && !isSelf` and hides bio, hosted events, ratings, and social actions when true. Web overlay renders everything regardless of privacy. Live-mode RLS limits server-returned fields, but client-side enforcement is still needed for mock mode and for any UI sections derived from joined queries that bypass RLS.
- **Spec reference**: FR2.
- **Proposed fix**: Mirror the native conditional:
  ```ts
  const friends = useStore(s => s.friends);
  const isFriend = friends.has(profile.id);
  const isSelf = profile.id === meId;
  const privateLocked = profile.privacy === 'private' && !isFriend && !isSelf;
  // Hide bio/events/ratings/social when privateLocked is true; keep interests + WebFriendButton.
  ```
- **Reasoning**: Defense-in-depth.

#### M-08: `WebDiscSection` empty-state ignores loading + suppresses passed children
- **Affected files**:
  - `scenecheck-expo/web/WebDiscSection.tsx:35` — `const isEmpty = count === 0`
  - `scenecheck-expo/web/WebDiscSection.tsx:90-102` — branch swaps children for `emptyText` whenever `isEmpty`
  - `scenecheck-expo/app/search.web.tsx:233-238` — passes `eventsLoading ? 'Loading events…' : 'No matching events nearby.'` as `emptyText`
- **Source agents**: R1 (F-R1-010), R2 (F-R2-007)
- **Category**: bug + parity-gap (combined)
- **Description**: Two issues. (1) When loading, `events.length === 0`, so the section renders "Loading events…" as plain body text instead of a skeleton — and the header shows "Events 0" while loading. (2) If a caller ever wants to render a custom empty state via `children`, those children are swallowed because the branch chooses `emptyText` over `children` whenever `count === 0`.
- **Native parity reference**: `scenecheck-expo/app/search.tsx:234` renders `SCListSkeleton rows={5}` while loading.
- **Proposed fix**: Accept a `loading` prop and render a skeleton when true:
  ```tsx
  interface Props { /* ... */ loading?: boolean; }
  // ...
  const isEmpty = !loading && count === 0;
  return (
    <div>...
      {loading ? <SkeletonRows count={3} /> : isEmpty ? <EmptyText /> : children}
    </div>
  );
  ```
  And at the caller (`search.web.tsx`):
  ```tsx
  <WebDiscSection title="Events" count={events.length} loading={eventsLoading} emptyText="No matching events nearby.">
  ```
- **Reasoning**: One signature addition fixes both the loading-flicker UX and the suppressed-children edge case.

---

### Low (4)

#### L-01: `WebTag` renders as `<button>` even with no `onClick`
- **Affected files**: `scenecheck-expo/web/WebTag.tsx:41-51`
- **Source agents**: R1 (F-R1-009)
- **Category**: a11y
- **Description**: Non-interactive tags still render a `<button type="button">` with `cursor: 'default'`. Screen readers announce them as buttons, they take Tab focus, and Enter/Space fires a no-op. Native sibling `SCTag` renders a plain `View` when non-interactive.
- **Proposed fix**: Branch on `onClick`:
  ```tsx
  if (!onClick) return <span style={{ ...baseStyle, cursor: 'default' }}>{contents}</span>;
  return <button type="button" onClick={onClick} style={baseStyle}>{contents}</button>;
  ```

#### L-02: `WebSettingsSection` first-expand snaps from 0 → 10031px
- **Affected files**: `scenecheck-expo/web/WebSettingsSection.tsx:168` (per R1)
- **Source agents**: R1 (F-R1-011)
- **Category**: bug (UX jitter)
- **Description**: Before `ResizeObserver` fires, `bodyHeight` is `null` and the `maxHeight` expression evaluates to `9999 + 32 = 10031px`. First-open animates the full distance and then snaps to the real content height.
- **Proposed fix**: Use `'none'` or omit the constraint until measured:
  ```tsx
  maxHeight: open ? (bodyHeight != null ? bodyHeight + 32 : 'none') : 0,
  ```

#### L-03: `ratings/[hostId].web.tsx` event-title separator never renders
- **Affected files**: `scenecheck-expo/app/ratings/[hostId].web.tsx:281-301`
- **Source agents**: R3 (F-R3-014)
- **Category**: bug (visual)
- **Description**: Inside the same style object, `borderTop: \`1px solid ${t.line}\`` is set, then `border: 'none'` (the button reset) which overrides it. The visual divider never renders.
- **Proposed fix**: Move `border: 'none'` above `borderTop`, or use `borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: t.line` to bypass the shorthand collision.

#### L-04: Settings "Email" row navigates to `/settings` (self-link)
- **Affected files**: `scenecheck-expo/app/settings.web.tsx:495-500`
- **Source agents**: R4 (F-R4-008)
- **Category**: parity-gap
- **Description**: The Account section's Email row's `onClick` calls `router.push('/settings')` — its own page. No change-email flow exists on web; native uses a `ChangeEmailSheet` bottom sheet.
- **Proposed fix**: Either open a web modal mirror of the bottom sheet, navigate to a dedicated `/settings/change-email` route, or at minimum disable the row with a `disabled` state and a "Coming soon" tooltip until the modal is built.

---

## Demoted / dropped findings

- **R1 F-R1-008 (rail badge `requests` decrement)**: Demoted to M-03 — verified the badge updates correctly on store mutation; the only real bug in the area is the shared `_initialError` slot, which R4 also flagged.
- **R1 F-R1-012 (`useFitScale` unused)**: Dropped — purely documentary, no functional impact. The shell's comment already explains the divergence. Keep the hook in place for future scaling needs.
- **R1 F-R1-013 (`WebAvatar` empty-name handling)**: Dropped — verified the DB trigger enforces non-empty names; defensive but not necessary.
- **R2 F-R2-006 (price chip missing on web cards)**: Dropped at this severity tier — kept as a Healthy-Pattern-Gap note rather than a finding. Adding `formatPrice`/`priceState` to `WebEventListCard` and `WebMapHoverCard` is a tracked enhancement, not a regression.
- **R3 F-R3-010 (`(EDITED)` annotation missing)**: Folded into M-06 — both web chat rendering gaps share a single fix branch in `WebChatThread`.
- **R3 F-R3-012 (`WebChatList`/`WebChatThread` SC_EVENT_BY_ID guards)**: Dropped to a note in the mock-leak inventory below — verified the lookups return `undefined` in live mode and the code defensively falls back to `c.title`/`c.members`, so there is no user-visible damage. Still worth gating but not blocking.
- **R3 F-R3-013 (profile tab reads `useStore.me` directly)**: Dropped — matches native pattern, no divergence. Already noted in healthy patterns.
- **R3 F-R3-005 (rate-event affordance missing)**: Kept as an Open Question rather than a finding — no `WebRateEventSheet` exists yet; needs a design decision before a fix is implementable.
- **R4 F-R4-004 (boolean precedence in step-restore)**: Demoted to L-tier replacement; verified it's a readability hazard but works correctly today by accident. Recommended fix:
  ```ts
  setStep(initialDraft.lastStep != null ? Math.min(Math.max(initialDraft.lastStep, 1), 4) : 1);
  ```
- **R4 F-R4-009 (`useNotifications` refcount underflow)**: Dropped to L-tier — verified the underflow is gated by `Math.max(0, ...)` so it cannot go negative; the only real risk is premature `closeSubscription()` if `mock` ever becomes dynamic, which it doesn't today.

---

## Recommended fix order

Each batch is a related cluster that can land in one focused commit. Batches are ordered impact-per-effort.

1. **Batch 1 — Centralize host + recommendation resolution (`web/kind.ts`).**
   - Findings: C-01.
   - Files touched: `web/kind.ts`, plus call-site updates in `web/WebMap.tsx`, `web/WebEventListCard.tsx`, `web/WebSearchAutocomplete.tsx`, `app/event/[id].web.tsx`, `web/WebChatThread.tsx`.
   - Why first: smallest change, biggest fan-out. Removes the dominant mock leak in shared infrastructure.

2. **Batch 2 — Replace `SC_ACCOUNT_BY_ID` privacy lookups with `useProfile` in the two action atoms.**
   - Findings: C-04, C-03 (privacy half).
   - Files touched: `web/WebFriendButton.tsx`, `web/WebFollowButton.tsx`.

3. **Batch 3 — Wire join/leave + follow API calls.**
   - Findings: C-02, C-03 (API half), H-01.
   - Files touched: `app/event/[id].web.tsx`, `web/WebFollowButton.tsx`, new `hooks/useJoinEventHandler.ts`, updates to `app/search.web.tsx`, `app/interests/[tag].web.tsx`, `app/my-hosting.web.tsx`, `app/my-events.web.tsx`, `app/(tabs)/profile.web.tsx`.
   - Why now: unblocks FR5.5, FR7.1, FR7.2, FR7.3, and removes 5 copies of the same buggy pattern.

4. **Batch 4 — `create-event` payload + host identity.**
   - Findings: H-04, H-05.
   - Files touched: `app/create-event.web.tsx`. Verify and possibly update `supabase/functions/create-event/index.ts`.

5. **Batch 5 — A11y on overlay surfaces.**
   - Findings: H-02, L-01.
   - Files touched: new `web/useFocusTrap.ts`, `web/WebSlideOver.tsx` (+ `aria-label` propagation in all overlay routes), `web/WebActivityPanel.tsx`, `web/WebRail.tsx` (switcher), `web/WebTag.tsx`.

6. **Batch 6 — Chat parity + safety actions.**
   - Findings: H-06, H-07, M-06.
   - Files touched: `web/WebChatThread.tsx`, `app/profile/[id].web.tsx`.

7. **Batch 7 — Remaining mock-leak + correctness cleanup.**
   - Findings: H-03, H-8, M-01, M-02, M-03, M-04, M-05, M-07, M-08, L-02, L-03, L-04, demoted L-tier precedence fix.
   - Files touched: many small edits across `app/interests/[tag].web.tsx`, `app/profile/[id].web.tsx`, `lib/api.ts`, `app/(tabs)/map.web.tsx`, `hooks/useNotifications.ts`, `web/WebActivityRow.tsx`, `app/requests.web.tsx`, `web/WebDiscSection.tsx` + `app/search.web.tsx`, `web/WebSettingsSection.tsx`, `app/ratings/[hostId].web.tsx`, `app/settings.web.tsx`, `app/create-event.web.tsx`.
   - Split into 2-3 sub-commits by area if the diff gets unwieldy.

---

## Mock-data leak inventory

| File | Line | Symbol | Replacement source |
|---|---|---|---|
| `scenecheck-expo/web/kind.ts` | 14, 39 | `SC_ME.interests` (default for `subs`) | Empty `Set<string>()`; caller passes `subscribedInterests` |
| `scenecheck-expo/web/kind.ts` | 14, 93 | `SC_ACCOUNT_BY_ID[hostId]` | Caller-supplied `lookup` map / `useProfile` in screen |
| `scenecheck-expo/web/WebFriendButton.tsx` | 15, 34 | `SC_ACCOUNT_BY_ID[personId]` (for `privacy`) | `useProfile(personId)` |
| `scenecheck-expo/web/WebFollowButton.tsx` | 14, 29 | `SC_ACCOUNT_BY_ID[orgId]` (for `privacy`) | `useProfile(orgId)` |
| `scenecheck-expo/app/profile/[id].web.tsx` | 21, 65-66 | `SC_ME.interests` (shared-interest diff) | `useStore(s => s.me.interests)` |
| `scenecheck-expo/app/profile/[id].web.tsx` | 21, 426 | `SC_ACCOUNT_BY_ID[r.reviewerId]` (reviewer fallback) | Gate behind `api.isMock()`; live mode has `reviewerName`/`reviewerPicture` on the row |
| `scenecheck-expo/app/event/[id].web.tsx` | 21, 353 | `SC_ACCOUNT_BY_ID[r.reviewerId]` (reviewer fallback) | Same as above |
| `scenecheck-expo/app/interests/[tag].web.tsx` | 20, 50-52 | `SC_EVENTS.filter(...)` | New `useInterestEvents(tag)` hook; empty list interim |
| `scenecheck-expo/app/create-event.web.tsx` | 35, 152-153 | `SC_MY_ACCOUNTS` (posting-as switcher) | `useStore(s => s.me)` + org membership |
| `scenecheck-expo/web/WebChatList.tsx` | 46-87 | `SC_EVENT_BY_ID`, `SC_VISIBLE_PERSON_BY_ID`, `SC_ACCOUNT_BY_ID` | Gate behind `api.isMock()`; live mode has `c.title` + `c.members` |
| `scenecheck-expo/web/WebChatThread.tsx` | 30-34, 58, 87 | `SC_EVENT_BY_ID`, `SC_ACCOUNT_BY_ID`, `SC_VISIBLE_PERSON_BY_ID` | Same — gate behind `api.isMock()` |

---

## Parity gap inventory

| Native file:line | Web file:line | Feature | Severity | Notes |
|---|---|---|---|---|
| `app/event/[id].tsx:178-278` | `app/event/[id].web.tsx:66-75` | JOIN flow with API + waitlist + calendar | Critical | See C-02 |
| `app/event/[id].tsx:562` | `app/event/[id].web.tsx:183` | "JOIN WAITLIST" label when full | Critical | See C-02 |
| `app/event/[id].tsx:161-176, 543-557` | `app/event/[id].web.tsx` | Rate-event affordance (post-end) | (Open Q) | No `WebRateEventSheet` exists yet |
| `app/(tabs)/map.tsx:107-122` | `app/(tabs)/map.web.tsx:45` | Location-denied affordance | Medium | See M-02 |
| `app/profile/[id].tsx:109-167` | `app/profile/[id].web.tsx:47-319` | Private-account visibility gate | Medium | See M-07 |
| `app/profile/[id].tsx:313-358` | `app/profile/[id].web.tsx:85-97` | Block + Report (real API call) | High | See H-07 |
| `app/chat/[id].tsx:62-76` | `web/WebChatThread.tsx:111` | FR9.5 announcement composer | High | See H-06 |
| `app/chat/[id].tsx:274-282` | `web/WebChatThread.tsx:455-457` | Failed-message RETRY | Medium | See M-06 |
| `app/chat/[id].tsx:229, 252` | `web/WebChatThread.tsx:442` | `(EDITED)` annotation | Low | Folded into M-06 |
| `app/notifications.tsx titleFor` | `web/WebActivityRow.tsx:117-186` | `waitlist_promotion` row | Medium | See M-04 (gap exists on native too) |
| `components/SCEventCard.tsx:98-140` | `web/WebEventListCard.tsx`, `web/WebMap.tsx:680-693` | Price chip on cards | Tracked enhancement | Per R2; not a regression — both surfaces ship without |
| `app/search.tsx:234` | `app/search.web.tsx:233-238` | Skeleton during section loading | Medium | See M-08 |
| `app/settings.tsx` (`ChangeEmailSheet`) | `app/settings.web.tsx:495-500` | Change-email flow | Low | See L-04 |

---

## Open architectural questions

- **Multi-account "posting as" on web in live mode.** `useStore` exposes `activeAccount` and `me`, but does it expose owned/admin orgs for the signed-in user? H-04 needs an `orgs` slice (or a `useUserOrgs` hook) before the switcher can drop `SC_MY_ACCOUNTS`.
- **`visibility` taxonomy.** Wizard models `'public' | 'private'`. Architecture doc and FR5.1 might allow `'friends'` or `'unlisted'` as a third value. Confirm the canonical set before fixing H-05.
- **`auto_group_chat` server contract.** Does the `create-event` Edge Function accept `auto_group_chat`? Does the `events` table have a column? H-05 may extend to a migration.
- **Pending follow-request set.** `WebFollowButton`'s "Request to follow" branch immediately calls `toggleFollow` even for private orgs; there is no `pendingFollowRequests` slice. Needs a store + DB column + RLS update to honor FR7.2.
- **Friendship in `rank_events_query` RPC.** M-01's correct fix requires `is_friend_creator` from the server; without it any web/native split would diverge from server-side truth.
- **`/events?tag=` endpoint or RPC extension.** H-03 currently has no live data source; needs a small server-side decision (filter parameter on `rank_events_query` vs new endpoint vs server-side view).
- **Rate-event web surface.** No `WebRateEventSheet` exists; whether to port the native sheet, build a route, or defer is a product question.

---

## Healthy patterns (preserve these)

- **Live badge wiring in `WebShell`** — `useNotifications`, `useChats`, `useStore.incomingRequests` drive the three rail badges with no hardcoded zeros.
- **`useNotifications` singleton with refcount teardown + listener fan-out** — correctly shares one Realtime channel across the badge, the panel, and the full notifications page; user-switch path tears down cleanly.
- **Optimistic-commit on Home + Map join/leave** (`index.web.tsx:117-149`, `map.web.tsx:85-117`) — exemplar implementations of the AGENTS.md invariant with rollback and a 5-second undo grace period.
- **Overlay routing pattern** — every overlay route wraps `<WebSlideOver open onClose={() => router.back()}>`, with the route's existence being the open state. Registered with `presentation: 'transparentModal'` on web, `'card'` on native via `_layout.tsx`. Clean, consistent, easy to add to.
- **`useEvents` radius wiring** — threads `radiusM` from the persisted store into `rank_events_query` on every refetch; Settings, Home, Map, and the filter popovers all stay in sync.
- **`WebSearchAutocomplete` scoring** — faithful port of the prototype's 5-tier priority (title prefix → title contains → venue → interest tag → host name), with a `MAX_SUGGESTIONS` bound and a graceful `onSearch` fallback.
- **Settings page store sync** — every control writes directly to the same Zustand slice actions native uses; no duplicated local state.
- **`requests.web.tsx` accept/decline/cancel** — cleanest example of the optimistic-commit pattern in the reviewed code; store update first, API call second, error toast on failure, `reload()` on success.
- **Platform split in `_layout.tsx`** — `require('@/web/WebShell').WebShell` under `Platform.OS === 'web'` keeps DOM-dependent code out of the native bundle without needing a `.native.tsx` shadow.
- **`WebActivityRow` accept/decline path** — uses the store's friend-request mutators paired with `api.acceptFriendRequest`/`api.declineFriendRequest`; correctly rolls back via toast on failure.

---

## Appendix — agent reports

- R1 (foundation): `docs/.review-r1.md`
- R2 (home/map/search): `docs/.review-r2.md`
- R3 (chat/profile/overlays): `docs/.review-r3.md`
- R4 (create/settings/notifications): `docs/.review-r4.md`

# SceneCheck — User Flow Traces

End-to-end traces for every use case in the requirements document (FR1–FR11). Each row pairs the user/system action with the function called and the data shape that crosses the connector — matching the "function on a component → data over a connector" pattern.

## How to read this document

Each table row uses the format:

`Component.functionName()` → action with `{data shape}`

**Conventions:**

- `auth.uid()` — Supabase's expression for the authenticated user inside SQL/RLS; read as "the calling user's ID"
- `/rest/v1/...` — auto-generated REST endpoints from the Postgres schema (via PostgREST)
- `/rest/v1/rpc/...` — server-side Postgres functions invoked over HTTPS RPC
- `/functions/v1/...` — Edge Functions (Deno/TypeScript) invoked over HTTPS
- `/realtime/v1/websocket` — Supabase Realtime channels (WSS)
- "(in-process)" — the call stays within the JavaScript runtime, no network

---

## Account creation (FR1)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User submits sign-up form | `AuthScreen.handleSignUp()` → POST `/auth/v1/signup` `{email, password, birthdate}` |
| Step 2 — Auth runs age gate (FR1.2) | `Auth.signUp()` → SQL INSERT INTO `auth.users` `{id, email, encrypted_password}`; rejects if `(now - birthdate) < 18yr` |
| Step 3 — DB trigger creates profile skeleton | `Database.handle_new_user()` → SQL INSERT INTO `profiles` `{user_id, account_type: NULL}` |
| Step 4 — Auth returns JWT to frontend | `Auth` → 200 `{access_token, refresh_token, user: {id, email}}` (JWT) over HTTPS |
| Step 5 — Frontend stores session, prompts location (FR1.5) | `useAuthStore.setSession()` → `expo-location.requestForegroundPermissionsAsync()` (in-process) |
| Step 6 — Onboarding submits questionnaire (FR1.3) | `OnboardingScreen.submitPreferences()` → PATCH `/rest/v1/profiles?user_id=eq.{id}` `{account_type, questionnaire_answers}` |

---

## Profile creation (FR2)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User picks profile picture | `ProfileEditorScreen.handlePickImage()` → `expo-image-picker.launchImageLibraryAsync()` (in-process) |
| Step 2 — Frontend uploads to Storage | `APIClient.storage.from('avatars').upload()` → POST `/storage/v1/object/avatars/{user_id}.jpg` `{file, content-type: image/jpeg}` |
| Step 3 — Storage returns key + public URL | `Storage` → 200 `{Key, Id, publicUrl}` over HTTPS |
| Step 4 — User saves profile | `ProfileEditorScreen.handleSave()` → PATCH `/rest/v1/profiles?user_id=eq.{id}` `{name, bio, avatar_url, visibility}` |
| Step 5 — DB updates row, RLS confirms ownership (FR2.2) | `Database` → UPDATE `profiles` WHERE `user_id = auth.uid()` |
| Step 6 — Frontend updates State Store | `useProfileStore.setProfile()` → re-renders ProfileScreen (in-process) |

---

## Interest selection / subscription (FR3)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User searches for tag | `InterestPickerScreen.handleSearch(query)` → GET `/rest/v1/interests?name=ilike.%{query}%&limit=20` |
| Step 2 — DB returns matching tags | `Database` → 200 `[{id, name, subscriber_count}, ...]` over HTTPS |
| Step 3a — User taps existing tag | `InterestPickerScreen.handleSelect(id)` → POST `/rest/v1/user_interests` `{user_id, interest_id}` |
| Step 3b — User creates new tag (FR3.3) | `InterestPickerScreen.handleCreate(name)` → POST `/rest/v1/interests` `{name}` → then `user_interests` insert |
| Step 4 — Edge Function recomputes related-tag weights (FR3.4) | `EdgeFn.recomputeTagRelations()` → SQL UPDATE `tag_relations` SET `weight = ...` WHERE `source_id IN (...)` |
| Step 5 — Frontend updates user's tag list | `useInterestStore.addInterest()` → re-renders chips (in-process) |

---

## Map / event discovery (FR4)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User opens Map screen | `MapScreen.componentDidMount()` → `useMapStore.fetchRankedEvents(viewport)` (in-process) |
| Step 2 — Frontend invokes ranking RPC | `APIClient.rpc('rank_events')` → POST `/rest/v1/rpc/rank_events` `{user_lat, user_lng, radius_m, user_id}` |
| Step 3 — DB executes PostGIS + score query | `Database.rank_events()` → SQL SELECT *, `score` FROM `events` WHERE `ST_DWithin(geog, point, radius)` ORDER BY `score` DESC LIMIT 200 |
| Step 4 — DB returns ranked results | `Database` → 200 `[{id, title, geog: {lng, lat}, score, source, subscriber_count, is_full}, ...]` |
| Step 5 — Frontend renders pins (FR4.4 distinguishes user vs scraped) | `MapScreen.render()` → `<MapPin/>` per event, color-coded by `source` (in-process) |
| Step 6 — User pulls to refresh | `MapScreen.onRefresh()` → re-invokes Step 2 |

---

## Adding friends & following (FR8)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User searches for username (FR8.1) | `FriendSearchScreen.handleSearch(q)` → GET `/rest/v1/profiles?username=ilike.%{q}%&visibility=eq.public` |
| Step 2 — User taps "Add friend" | `FriendSearchScreen.handleAdd(target_id)` → POST `/rest/v1/rpc/send_friend_request` `{target_id}` |
| Step 3 — Edge Function checks blocks (FR8.3) | `EdgeFn.sendFriendRequest()` → SQL SELECT 1 FROM `blocks` WHERE `blocker_id = target_id AND blocked_id = auth.uid()`; if found → 403 `{error: "Cannot send request"}` |
| Step 4 — Edge Function inserts request | `EdgeFn` → SQL INSERT INTO `friendships` `{from_id, to_id, status: 'pending'}` |
| Step 5 — Edge Function dispatches push (FR10.1) | `EdgeFn` → POST `https://exp.host/--/api/v2/push/send` `{to: target_token, title: "Friend request", body: "{name} wants to connect", data: {deep_link: '/friends/requests'}}` |
| Step 6 — Target taps notification, accepts | `FriendsScreen.handleAccept(request_id)` → PATCH `/rest/v1/friendships?id=eq.{id}` `{status: 'accepted'}` |

---

## User-created events (FR5)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User submits event creation form | `CreateEventScreen.handleCreate()` → POST `/rest/v1/rpc/create_event` `{title, description, start_at, end_at, location: {lng, lat}, interests: [id, ...], capacity}` |
| Step 2 — Edge Function inserts event row | `EdgeFn.createEvent()` → SQL INSERT INTO `events` `{creator_id: auth.uid(), title, geog: ST_MakePoint(lng, lat), capacity, status: 'draft', source: 'user'}` returning `{id}` |
| Step 3 — Edge Function inserts tag joins | `EdgeFn` → SQL INSERT INTO `event_interests` `{event_id, interest_id}` for each tag |
| Step 4 — Publish gate fires when threshold met (FR5.4) | `EdgeFn.checkPublishGate()` → SQL UPDATE `events` SET `status='published'` WHERE `id=? AND subscriber_count >= MIN_SUBSCRIBERS` |
| Step 5 — Edge Function fans out push to nearby matches (FR10.3) | `EdgeFn` → SELECT users WHERE `ST_DWithin(home, event.geog, radius) AND interest_overlap > 0`; → POST Expo Push batch |

---

## App-created events (FR6)

*Triggered by scraper, not user.*

| Step | Function on component → data over connector |
|---|---|
| Step 1 — Scheduled scraper runs | `Worker.scrapeEvents()` → fetches external sources (in-process) |
| Step 2 — Worker posts each candidate | `Worker` → POST `/functions/v1/ingest_scraped` `{Authorization: Bearer {service_role}, payload: {title, description, start_at, end_at, location, source_url}}` |
| Step 3 — Edge Function validates required fields (FR6.3) | `EdgeFn.ingestScraped()` → checks `title && start_at && location`; if missing → log + skip (FR6.4) |
| Step 4 — Edge Function auto-tags (FR6.2) | `EdgeFn.autoTag(description)` → keyword/embedding match → returns `[interest_id, ...]` (in-process) |
| Step 5 — Edge Function inserts event with `source='scraped'` | `EdgeFn` → SQL INSERT INTO `events` `{title, ..., source: 'scraped', creator_id: NULL}`; INSERT `event_interests` for each tag |

---

## Direct & event chat (FR9)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User opens chat thread | `ChatScreen.componentDidMount()` → `useChatStore.subscribeToChat(chat_id)` (in-process) |
| Step 2 — RealtimeSub joins chat channel | `RealtimeSub` → WSS `/realtime/v1/websocket` → `{topic: 'realtime:public:messages:chat_id=eq.{id}', event: 'phx_join'}` |
| Step 3 — User sends message | `ChatScreen.handleSend(text)` → POST `/rest/v1/messages` `{chat_id, sender_id: auth.uid(), body}` |
| Step 4 — DB inserts; RLS verifies membership + no block (FR9.2) | `Database` → INSERT INTO `messages` WHERE EXISTS `chat_members` AND NOT EXISTS `blocks` |
| Step 5 — DB CDC broadcasts row to channel | `Database` → `Realtime` → push `{event: 'INSERT', record: {id, chat_id, sender_id, body, created_at}}` over WSS |
| Step 6 — Recipients' RealtimeSub receives, updates store | `useChatStore.appendMessage()` → ChatScreen re-renders (in-process) |

---

## Group chat creation (FR9.3–9.4)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User subscribes to event with chat opt-in (FR9.4) | `EventDetailScreen.handleSubscribe()` → POST `/rest/v1/rpc/subscribe_to_event` `{event_id, join_chat: true}` |
| Step 2 — Edge Function gets-or-creates chat | `EdgeFn.subscribeToEvent()` → SQL SELECT `id` FROM `chats` WHERE `event_id=?`; if NULL → INSERT INTO `chats` `{type: 'group', event_id}` returning `id` |
| Step 3 — Edge Function adds user as member | `EdgeFn` → SQL INSERT INTO `chat_members` `{chat_id, user_id: auth.uid()}` |
| Step 4 — Edge Function returns chat handle | `EdgeFn` → 200 `{subscription_id, chat_id}` over HTTPS |
| Step 5 — Frontend joins chat channel | `RealtimeSub` → WSS subscribe to `chat:{chat_id}` (handoff to FR9 flow) |

---

## Block users (FR11.1)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User taps "Block" on profile | `ProfileScreen.handleBlock(target_id)` → opens confirmation modal (in-process) |
| Step 2 — User confirms | `ProfileScreen.confirmBlock()` → POST `/rest/v1/blocks` `{blocker_id: auth.uid(), blocked_id: target_id}` |
| Step 3 — DB inserts block row | `Database` → INSERT INTO `blocks` `{blocker_id, blocked_id, created_at}` |
| Step 4 — RLS instantly applies across all queries | All future reads on `messages`, `friendships`, `events`, `profiles` filter via `WHERE NOT EXISTS (block)` |
| Step 5 — Frontend removes target from local lists | `useBlocksStore.addBlock()` → strips target from chats/friends UI (in-process) |

---

## Report & moderate (FR11.2–11.3)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User submits report (FR11.2) | `ReportFormScreen.handleSubmit()` → POST `/rest/v1/reports` `{target_user_id OR target_event_id, reason, details}` |
| Step 2 — DB inserts report | `Database` → INSERT INTO `reports` `{reporter_id: auth.uid(), target_*, reason, status: 'pending'}` |
| Step 3 — Organizer triggers user removal (FR11.3) | `EventManagementScreen.handleRemove(user_id)` → POST `/rest/v1/rpc/organizer_remove` `{event_id, user_id}` |
| Step 4 — Edge Function verifies caller is creator | `EdgeFn.organizerRemove()` → SQL SELECT `creator_id` FROM `events` WHERE `id=? AND creator_id = auth.uid()`; else 403 |
| Step 5 — Edge Function performs cascade | `EdgeFn` → SQL UPDATE `event_subscriptions` SET `status='removed'` WHERE matches; DELETE FROM `chat_members` WHERE `chat_id=event_chat AND user_id=?` |

---

## Event subscription & calendar add (FR7)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — User taps "Subscribe" + toggles "Add to calendar" | `EventDetailScreen.handleSubscribe()` → POST `/rest/v1/rpc/subscribe_to_event` `{event_id, join_chat, add_to_calendar}` |
| Step 2 — Edge Function checks capacity (FR5.5) | `EdgeFn.subscribeToEvent()` → SQL SELECT `capacity, subscriber_count` FROM `events`; if full → INSERT INTO `waitlist` and return 200 `{status: 'waitlisted'}` |
| Step 3 — Edge Function inserts subscription | `EdgeFn` → SQL INSERT INTO `event_subscriptions` `{event_id, user_id, status: 'confirmed'}` |
| Step 4 — Frontend calls Google Calendar (FR7.2) | `APIClient.googleCalendar.events.insert()` → POST `https://www.googleapis.com/calendar/v3/calendars/primary/events` `{Authorization: Bearer {refresh_token_swap}, summary, location, start, end}` |
| Step 5 — Calendar returns event link | `Google Calendar` → 200 `{event_id, htmlLink}` over HTTPS |
| Step 6 — *Later:* waitlist promotion fires (FR5.6) | `EdgeFn.promoteWaitlist()` → SQL UPDATE `event_subscriptions` SET `status='confirmed'`; → POST Expo Push `{title: "You're in!", body: "{event_title} has space"}` |

---

## Rate events (FR5.11)

| Step | Function on component → data over connector |
|---|---|
| Step 1 — Event ends; rating UI gates on time + role | `EventDetailScreen.render()` → checks `(now - end_at) < 24h && was_subscriber && !already_rated` (in-process) |
| Step 2 — User submits rating | `EventDetailScreen.handleRate(stars)` → POST `/rest/v1/ratings` `{event_id, user_id: auth.uid(), stars}` |
| Step 3 — DB inserts with uniqueness constraint | `Database` → INSERT INTO `ratings` `{...}`; UNIQUE(`event_id, user_id`) prevents double-rate |
| Step 4 — Edge Function rolls into creator's average | `EdgeFn.rollupRating()` → SQL UPDATE `profiles` SET `avg_rating = (SELECT AVG(stars) FROM ratings r JOIN events e ON r.event_id = e.id WHERE e.creator_id = ?)` |
| Step 5 — Frontend marks rated, hides UI | `useEventStore.markRated()` → re-renders without rating section (in-process) |

---

## Notifications (FR10)

*System-triggered, multiple entry points.*

| Step | Function on component → data over connector |
|---|---|
| Step 1 — Trigger fires (new event in radius / friend req / waitlist promo / event update) | `EdgeFn.dispatchNotification(trigger_type, payload)` (in-process) |
| Step 2 — Edge Function selects recipients | `EdgeFn` → SQL SELECT `user_id, push_token` FROM `profiles p JOIN user_preferences up ON ... WHERE matches_filter AND push_enabled = true` |
| Step 3 — Edge Function persists in-app record | `EdgeFn` → SQL INSERT INTO `notifications` `{user_id, type, payload_json, read: false}` for each recipient |
| Step 4 — Edge Function batches to Expo Push | `EdgeFn` → POST `https://exp.host/--/api/v2/push/send` `[{to: token, title, body, data: {deep_link, type}}, ...]` |
| Step 5 — Expo routes to OS service | `Expo Push` → APNs (iOS) / FCM (Android) |
| Step 6 — Device shows banner; user taps → deep link (FR10.4) | `Device` → opens app to `{deep_link}`; app refreshes notifications list on foreground via GET `/rest/v1/notifications?user_id=eq.{me}&order=created_at.desc` |

---

## Notes

- Endpoint paths and RPC names above are realistic-but-illustrative — they should be replaced with whatever route conventions the project actually adopts. The structure (function on component → data over connector with named fields) is the assignment-relevant artifact.
- A few flows have implicit branches collapsed for readability — for instance, the FR5 publish gate fires later than the create call (when the subscriber threshold is crossed), not on the same request. If exception/alternative paths need to be enumerated as separate sub-flows (matching the requirements doc's "Basic Flow / Alternative Flow / Exception Flow" structure), each table would be split per branch.
- All flows assume the polled-map + chat-only-WebSocket architecture. The only WSS connector that appears is in the Direct & event chat (FR9) flow.

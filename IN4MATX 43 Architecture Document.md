# HW2: Architecture

**Due** May 13 by 1pm

**Points** 100

**Available** Apr 29 at 1pm - May 13 at 1pm

## Overall Architectural Summary

**Components**

| Component                        | Where It Runs                            | Key Functionalities                                                                                                                     |
| -------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile App/Frontend              | User's iOS or Android device             | Displays home screen, map, event cards,                                                                                                 |
| ---                              | ---                                      | ---                                                                                                                                     |
| Account & Authentication Service | Cloud backend server                     | Manages user sign-up, login, age verification, and account security                                                                     |
| ---                              | ---                                      | ---                                                                                                                                     |
| Profile Service                  | Cloud backend server                     | Stores and updates user profile, bios, profile pictures, visibility settings, mutual friends, and past events                           |
| ---                              | ---                                      | ---                                                                                                                                     |
| Interest Service                 | Cloud backend server                     | Stores user-selected interests, custom tags, organization subscriptions, and interest updates                                           |
| ---                              | ---                                      | ---                                                                                                                                     |
| Recommendation Service           | Cloud backend server                     | Matches users to nearby events based on interests, distance, friends, and subscribed organizations                                      |
| ---                              | ---                                      | ---                                                                                                                                     |
| Event Management Service         | Cloud backend server                     | Creates, edits, stores, and retrieves user-created and app-created events. Manages event details, attendance limits, and joined status. |
| ---                              | ---                                      | ---                                                                                                                                     |
| Map & Location Service           | Mobile device + map API + backend server | Displays events pins and nearby activity on the map using location, radius, and filter data                                             |
| ---                              | ---                                      | ---                                                                                                                                     |
| Friends Service                  | Cloud backend server                     | Handles friend requests, mutual friends, event sharing                                                                                  |
| ---                              | ---                                      | ---                                                                                                                                     |
| Chat Service                     | Cloud backend server                     | Supports direct messaging and group chats for friends or event attendees                                                                |
| ---                              | ---                                      | ---                                                                                                                                     |
| App Created Event Service        | Cloud backend server                     | Collects public event information from the internet and converts it into app-created event listings                                     |
| ---                              | ---                                      | ---                                                                                                                                     |
| Database                         | Cloud database                           | Stores users, events, interests, messages, friendships, organization pages, privacy settings, and notification preferences              |
| ---                              | ---                                      | ---                                                                                                                                     |
| External Services                | Third-party APIs                         | Provides map data, calendar syncing, push notifications                                                                                 |
| ---                              | ---                                      | ---                                                                                                                                     |

**Connectors**

| Connector                       | Components Connected                         | Data Communicated                                                                                              |
| ------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| HTTPS/REST API                  | Mobile App ↔ Backend Services                | Account data, profile updates, interests, event details, search results, friend requests, and settings         |
| ---                             | ---                                          | ---                                                                                                            |
| Database Queries                | Backend Services ↔ Database                  | User records, event records, messages, interests, attendance data, privacy settings, and friend relationships. |
| ---                             | ---                                          | ---                                                                                                            |
| WebSocket / Real-Time Connector | Mobile App ↔ Chat Service                    | Direct messages, group chat messages, message status, and live chat updates.                                   |
| ---                             | ---                                          | ---                                                                                                            |
| Push Notification Connector     | Notification Service ↔ Mobile App            | Event reminders, friend requests, shared event alerts, organization updates, and event changes.                |
| ---                             | ---                                          | ---                                                                                                            |
| Map API Connector               | Mobile App / Backend ↔ Map API               | Coordinates, event pins, map tiles, radius filters, and location-based search results.                         |
| ---                             | ---                                          | ---                                                                                                            |
| Calendar API Connector          | Event Service ↔ Google/Apple Calendar        | Event name, date, time, location, and description.                                                             |
| ---                             | ---                                          | ---                                                                                                            |
| Web Scraping Connector          | Web Scraping Service ↔ Public Event Websites | Public event titles, descriptions, times, dates, locations, and links.                                         |
| ---                             | ---                                          | ---                                                                                                            |

**Design Styles**

| Design Style                   | How It Is Used                                                                                                                                     | Benefits                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Client-Server Architecture     | The mobile app acts as the client, while cloud backend services handle data processing, storage, recommendations, events, chat, and notifications. | Keeps the mobile app lightweight, supports many users, and allows backend updates without requiring users to reinstall the app. |
| ---                            | ---                                                                                                                                                | ---                                                                                                                             |
| Layered Architecture           | The system is separated into a presentation layer, application/business logic layer, data layer, and external services layer.                      | Makes the system easier to organize, test, debug, and maintain.                                                                 |
| ---                            | ---                                                                                                                                                | ---                                                                                                                             |
| Service-Oriented Architecture  | Major features such as profiles, interests, events, recommendations, chat, friends, and notifications are separated into services.                 | Allows each feature to be developed, updated, or scaled independently.                                                          |
| ---                            | ---                                                                                                                                                | ---                                                                                                                             |
| Publish-Subscribe Architecture | Used for notifications when users subscribe to interests or organizations, join events, or receive friend/event updates.                           | Helps users receive relevant updates automatically without constantly checking the app.                                         |
| ---                            | ---                                                                                                                                                | ---                                                                                                                             |
| Model-View Controller          | Used in the mobile app to separate screens/views from app logic and data models.                                                                   | Keeps frontend code organized and makes UI changes easier.                                                                      |
| ---                            | ---                                                                                                                                                | ---                                                                                                                             |

SceneCheck will use a client-server architecture where the mobile app handles the user interface and the backend server manages data, recommendations, event creation, messaging, and notifications. When a user opens SceneCheck, the mobile app requests event and profile data from the backend through secure API calls. The backend checks the user's interests, location radius, friends, and subscribed organizations, then returns recommended nearby events. These events are displayed on the map and in event cards on the home screen. If a user joins or creates an event, the Event Management Service updates the database and can trigger notifications to friends or attendees. If users message each other, the Chat Service sends real-time messages through a WebSocket connection. App-created events are collected by the Web Scraping Service, stored in the database, and displayed alongside user-created events.

# Platforms

| System Part                           | Platform/Hardware                                                                                                                                                                                                        | Why this Platform fits                                                                                                                                                                         | Benefits                                                                                                                                                                                                      | Tradeoffs                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile Client                         | \-iOS 15.1+ (iPhone, A11 chip and newer) and Android 6.0+ / API 23+ (ARM64) smartphones<br><br>\-Hermes JavaScript engine inside a React Native native shell                                                             | FR1.5, FR4.1, and FR10.3 all require GPS hardware, native push tokens, and an always-with-user form factor - only smartphones provide all three                                                | Direct access to native GPS, push, and platform maps (Apple Maps on iOS, Google Maps on Android); Hermes gives ~30% lower memory and faster cold start than legacy JSC, important for the live-map screen     | \-Two app stores and two test matrices<br><br>\-iOS silently throttles background location, so FR10.3 proximity alerts cannot be guaranteed when the app is backgrounded - must be designed around foreground + significant-change events                                                      |
| ---                                   | ---                                                                                                                                                                                                                      | ---                                                                                                                                                                                            | ---                                                                                                                                                                                                           | ---                                                                                                                                                                                                                                                                                            |
| Backend Services                      | AWS-backed Linux instances (Supabase-managed, recommend <span style="color:#188038">us-west-1</span> for Irvine latency)<br><br>\-Three runtimes - PostgreSQL 15, Elixir/Phoenix on the BEAM VM (Realtime), and Deno (Edge Functions)                       | Consolidates Postgres + Auth + Realtime + Storage + Edge Functions into one managed product, so a 5-person student team avoids assembling and operating five separate services                 | Zero ops burden - no Dockerfiles, patching, or Kubernetes; the BEAM VM is purpose-built for high-concurrency WebSockets, so FR9 group chat and FR4.5 live participant counts scale without engineering effort | \-Free-tier caps on Realtime concurrent connections and message rate<br><br>\-No deep Postgres tuning beyond the dashboard knobs<br><br>\-Vendor lock-in around RLS policies and Realtime channel APIs<br><br>\-Supabase exposed                                                               |
| ---                                   | ---                                                                                                                                                                                                                      | ---                                                                                                                                                                                            | ---                                                                                                                                                                                                           | ---                                                                                                                                                                                                                                                                                            |
| Geospatial Data Layer                 | PostgreSQL 15 with PostGIS 3.x extension on the Supabase Linux instance; <span style="color:#188038">geography(Point, 4326)</span> columns with GiST indexes                                                                                                | FR4.2 (discovery radius) and FR10.3 (proximity alerts) need indexed spatial queries that flat tables and app-side math can't deliver at scale                                                  | Single-statement indexed queries: <span style="color:#188038">ST_DWithin(events.location, user_loc, 8047)</span> returns nearby events in **milliseconds** instead of an **O(n) distance loop** in client code                                   | **Real learning curve and difficult implementation** - <span style="color:#188038">geography vs. geometry</span>, SRID 4326 conventions, GiST index strategy, and <span style="color:#188038">ST_Distance</span> returning different units per type will burn at least one teammate's afternoon; document conventions early                                          |
| ---                                   | ---                                                                                                                                                                                                                      | ---                                                                                                                                                                                            | ---                                                                                                                                                                                                           | ---                                                                                                                                                                                                                                                                                            |
| Background Jobs (Web Scraper for FR6) | GitHub-hosted Ubuntu 24.04 runner (4 vCPU, 16 GB); Node.js 20 + Playwright with headless Chromium; triggered on a GitHub Actions cron schedule                                                                           | Most modern event sites (Eventbrite, campus calendars, Meetup-style pages) are JavaScript-rendered, requiring a full browser engine that's too heavy for Supabase Edge Functions' Deno runtime | \-Free for public repos<br><br>\-Runs in the same repo as the app code, version-controlled together<br><br>\-Clean per-run Ubuntu environment with no extra cloud account                                     | \-Cron precision is best-effort **(tasks happening 5-15 min later than schedule is normal)**<br><br>\-6-hour per-job cap<br><br>\-A single hanging target site can time out the entire job, making FR6.4 failure logging plus per-fetch timeouts critical to actually finish                   |
| ---                                   | ---                                                                                                                                                                                                                      | ---                                                                                                                                                                                            | ---                                                                                                                                                                                                           | ---                                                                                                                                                                                                                                                                                            |
| Build & CI Infrastructure             | \-GitHub Actions<br><br>\-Ubuntu runners for ESLint, Prettier, TypeScript typecheck, and unit tests<br><br>\-EAS Build Linux workers for Android <span style="color:#188038">.aab</span> builds and **macOS workers** for iOS <span style="color:#188038">.ipa</span> builds (Xcode + signing) | iOS code-signing only runs on macOS, but a student team can't assume every member owns Apple hardware - EAS provides cloud macOS so anyone can ship iOS builds                                 | \-Frees the team from local Apple hardware<br><br>\-CI catches lint/type errors pre-merge, enforcing the conventional-commits + trunk-based-branching discipline already in the architecture plan             | \-EAS free-tier build queue (10-40 min waits at peak)<br><br>\-macOS minutes are ~10× the cost of Linux minutes on paid tiers, **potentially costly to maintain**<br><br>\-Apple Developer Program membership (\$99/yr) required for TestFlight distribution, **require a hefty startup cost** |
| ---                                   | ---                                                                                                                                                                                                                      | ---                                                                                                                                                                                            | ---                                                                                                                                                                                                           | ---                                                                                                                                                                                                                                                                                            |

# Programming Languages

| **Language**                                   | **Used By**                                                                                                               | **Benefits**                                                                                                                                                                                                                             | **Tradeoffs**                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JavaScript<br><br>(React Native + Expo)        | \-Mobile client<br><br>\-All UI screens<br><br>\-State store (Zustand)<br><br>\-API client<br><br>\-Realtime subscription | \-Single language across the entire frontend<br><br>\-Massive ecosystem (npm)<br><br>\-Expo SDK abstracts iOS/Android platform differences<br><br>\-Hermes engine optimizes JS execution on device                                       | Dynamically typed language, means that it can only catch errors at runtime and prone to type error as operation scaled up →TypeScript is strongly recommended to catch schema mismatches between API responses and UI state at compile time rather than at runtime                                                      |
| ---                                            | ---                                                                                                                       | ---                                                                                                                                                                                                                                      | ---                                                                                                                                                                                                                                                                                                                     |
| TypeScript                                     | \-Mobile client<br><br>\-Edge functions                                                                                   | \-Catches type errors on API payloads, Supabase row types, and RPC return shapes before they reach production<br><br>\-Supabase CLI can auto-generate TypeScript types directly from the database schema                                 | \-Adds a compilation step and tsconfig overhead, which increase compilation time for the purpose of development<br><br>\-Team members unfamiliar with generics may slow down early<br><br>\-Strict null checks require more explicit handling of optional fields<br><br>\=> Initial barrier of entry for implementation |
| ---                                            | ---                                                                                                                       | ---                                                                                                                                                                                                                                      | ---                                                                                                                                                                                                                                                                                                                     |
| SQL + PL/pgSQL                                 | \-Database layer<br><br>\-RPC functions<br><br>\-RLS policies (FR2.2 / FR8.3 / FR9.2)<br><br>\-Triggers, and migrations   | \-PostGIS spatial queries work natively for FR4.2 and FR10.3<br><br>\-RLS enforces authorization at the data layer so app-code bugs can't leak data<br><br>\-PL/pgSQL keeps multi-step transactions atomic                               | \-Niche skill with weak debugging (no breakpoints, only RAISE NOTICE)<br><br>\-Migrations become the system of record and must be version-controlled rigorously<br><br>\-PostGIS gotchas cost time on first encounter                                                                                                   |
| ---                                            | ---                                                                                                                       | ---                                                                                                                                                                                                                                      | ---                                                                                                                                                                                                                                                                                                                     |
| JavaScript<br><br>Node.js 20 | \-Background scraper<br><br>\-GitHub Actions worker running<br><br>\-Playwright + headless Chromium                       | \-Reuses the same language as the frontend, so any teammate can read and maintain the scraper<br><br>\-Node.js async I/O handles concurrent page fetches efficiently<br><br>\-Playwright's JS API is the most mature and well-documented | \-Node.js + Playwright is too heavy for Supabase Edge Functions' Deno runtime, which is why the scraper runs as a separate GitHub Actions job rather than inline with the backend                                                                                                                                       |
| ---                                            | ---                                                                                                                       | ---                                                                                                                                                                                                                                      | ---                                                                                                                                                                                                                                                                                                                     |

# Communication Protocols

SceneCheck uses four distinct communication mechanisms, each chosen for specific properties required by the use case it serves.

#### **1\. HTTPS/REST (synchronous request-response)**

This is the backbone of the system - used whenever the client needs to fetch or mutate data and can tolerate a round-trip. Every call goes through Supabase's PostgREST layer or an Edge Function endpoint, authenticated with a JWT bearer token in the <span style="color:#188038">Authorization</span> header.

**Auth & account**

- <span style="color:#188038">POST /auth/v1/signup</span> - body: <span style="color:#188038">{email, password, birthdate}</span> → returns <span style="color:#188038">{access_token, refresh_token, user}</span>
- <span style="color:#188038">POST /auth/v1/token?grant_type=password</span> - body: <span style="color:#188038">{email, password}</span> → returns JWT pair
- <span style="color:#188038">POST /auth/v1/logout</span> - invalidates refresh token server-side

**Profile & interests**

- <span style="color:#188038">GET /rest/v1/profiles?user_id=eq.{id}</span> → returns <span style="color:#188038">{name, bio, avatar_url, visibility, avg_rating}</span>
- <span style="color:#188038">PATCH /rest/v1/profiles?user_id=eq.{id}</span> - body: <span style="color:#188038">{name, bio, avatar_url, visibility}</span> (RLS ensures only owner can write)
- <span style="color:#188038">GET /rest/v1/interests?name=ilike.%{query}%</span> → returns <span style="color:#188038">[{id, name, subscriber_count}]</span>
- <span style="color:#188038">POST /rest/v1/user_interests</span> - body: <span style="color:#188038">{user_id, interest_id}</span>

**Events**

- <span style="color:#188038">POST /rest/v1/rpc/rank_events</span> - body: <span style="color:#188038">{user_lat, user_lng, radius_m, user_id}</span> → returns <span style="color:#188038">[{id, title, geog, score, source, is_full}]</span> (PostGIS <span style="color:#188038">ST_DWithin</span> + scoring query)
- <span style="color:#188038">POST /rest/v1/rpc/create_event</span> - body: <span style="color:#188038">{title, description, start_at, end_at, location: {lat, lng}, interests: [...], capacity}</span> → returns <span style="color:#188038">{event_id}</span>
- <span style="color:#188038">POST /rest/v1/rpc/subscribe_to_event</span> - body: <span style="color:#188038">{event_id, join_chat, add_to_calendar}</span> → returns {status: 'confirmed' | 'waitlisted', chat_id}
- <span style="color:#188038">POST /rest/v1/ratings</span> - body: <span style="color:#188038">{event_id, user_id, stars}</span>

**Friends & blocking**

- <span style="color:#188038">GET /rest/v1/profiles?username=ilike.%{q}%&visibility=eq.public</span> → returns matching public profiles
- <span style="color:#188038">POST /rest/v1/rpc/send_friend_request</span> - body: <span style="color:#188038">{target_id}</span> → 200 or 403 if blocked
- <span style="color:#188038">PATCH /rest/v1/friendships?id=eq.{id}</span> - body: <span style="color:#188038">{status: 'accepted'}</span>
- <span style="color:#188038">POST /rest/v1/blocks</span> - body: <span style="color:#188038">{blocker_id, blocked_id}</span> → RLS immediately filters blocked user from all subsequent queries
- <span style="color:#188038">POST /rest/v1/reports</span> - body: <span style="color:#188038">{target_user_id OR target_event_id, reason, details}</span>

**Storage (profile pictures)**

- <span style="color:#188038">POST /storage/v1/object/avatars/{user_id}.jpg</span> - multipart image upload → returns <span style="color:#188038">{Key, publicUrl}</span>

**Notifications (read)**

- <span style="color:#188038">GET /rest/v1/notifications?user_id=eq.{me}&order=created_at.desc</span> → returns <span style="color:#188038">[{id, type, payload_json, read}]</span>
- <span style="color:#188038">PATCH /rest/v1/notifications?id=eq.{id}</span> - body: <span style="color:#188038">{read: true}</span>

#### **2\. WebSocket / Supabase Realtime (persistent bidirectional)**

Used exclusively for the chat system (FR9) and any live count updates (FR4.5). The client opens a single multiplexed WebSocket connection and subscribes to named channels using the Phoenix channel protocol underneath.

**Connection handshake**

- Client → <span style="color:#188038">WSS /realtime/v1/websocket</span> with <span style="color:#188038">Authorization: Bearer {access_token}</span>
- Client → <span style="color:#188038">{event: "phx_join", topic: "realtime:public:messages:chat_id=eq.{id}"}</span> to subscribe to a thread
- Server → <span style="color:#188038">{event: "phx_reply", status: "ok"}</span> on successful join

**Message flow**

- Sending: client calls <span style="color:#188038">POST /rest/v1/messages {chat_id, sender_id, body}</span> via REST (not the socket)
- Receiving: Supabase CDC picks up the DB insert and pushes <span style="color:#188038">{event: "INSERT", record: {id, chat_id, sender_id, body, created_at}}</span> over the WebSocket to all subscribers of that channel
- RLS on the <span style="color:#188038">messages</span> table enforces that only members of the chat (and users who haven't been blocked) receive the CDC event

**Live participant count**

- Edge Function updates <span style="color:#188038">events.subscriber_count</span> in the DB; Realtime broadcasts the updated row to any client subscribed to <span style="color:#188038">realtime:public:events:id=eq.{event_id}</span>

#### **3\. Push notifications (Expo → APNs/FCM, fire-and-forget)**

All server-side notification triggers go through a single path: Edge Function → Expo Push API → platform OS service → device. The device never opens a connection to receive these; it's purely server-initiated.

**What triggers a push**

- New friend request received
- Friend request accepted
- Event within proximity radius published (FR10.3)
- Waitlist promotion (spot opened up)
- Event details changed after subscription
- Organizer removes user from event

**Outbound payload (Edge Function → Expo)**

POST `https://exp.host/--/api/v2/push/send`

\[

{

to: "{expo_push_token}",

title: "Friend request",

body: "{name} wants to connect",

data: { deep_link: "/friends/requests", type: "friend_request" }

},

... (batched for multiple recipients)

\]

**Recipient selection** (before the push fires)

sql

SELECT user_id, push_token

FROM profiles

JOIN user_preferences USING (user_id)

WHERE push_enabled = true

AND ST_DWithin(home_location, event.geog, radius) -- for proximity alerts

AND interest_overlap > 0

The <span style="color:#188038">data.deep_link</span> field tells the React Native app which screen to navigate to when the user taps the notification banner.

#### **4\. External API calls (third-party, outbound from server)**

**Google Calendar** (FR7.2)

- Called client-side after the user authorizes via OAuth
- <span style="color:#188038">POST `https://www.googleapis.com/calendar/v3/calendars/primary/events`</span>
- Headers: Authorization: <span style="color:#188038">Bearer {google_oauth_token}</span>
- Body: <span style="color:#188038">{summary, location, start: {dateTime}, end: {dateTime}, description}</span>
- Response: <span style="color:#188038">{event_id, htmlLink}</span> stored locally

**Web Scraper → Supabase ingest** (FR6, async job)

- GitHub Actions cron runs Node.js + Playwright headlessly against Eventbrite, campus calendars, Meetup-style pages
- Each scraped event is validated then posted to the Edge Function:
- <span style="color:#188038">POST /functions/v1/ingest_scraped with Authorization: Bearer {service_role_key}</span>
- Body: <span style="color:#188038">{title, description, start_at, end_at, location, source_url}</span>
- Edge Function validates required fields, runs keyword/embedding auto-tagging, then inserts with <span style="color:#188038">source: 'scraped'</span>

Here's a visual overview of how all these channels connect:
<img width="635" height="742" alt="Screenshot 2026-05-13 121336" src="https://github.com/user-attachments/assets/26980853-7b0f-4980-82e6-8fa1569f0c92" />

# Examples of Component Functions and Connector Communications

## **Account creation (FR1)**

| Step                                                       | Function on component → data over connector                                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User submits sign-up form                         | <span style="color:#188038">AuthScreen.handleSignUp()</span> → <span style="color:#188038">POST /auth/v1/signup {email, password, birthdate} </span>                                       |
| ---                                                        | ---                                                                                                                  |
| Step 2 - Auth runs age gate (FR1.2)                        | <span style="color:#188038">Auth.signUp()</span> → SQL INSERT INTO <span style="color:#188038">auth.users {id, email, encrypted_password}</span>; rejects if <span style="color:#188038">(now - birthdate) < 18yr</span>    |
| ---                                                        | ---                                                                                                                  |
| Step 3 - DB trigger creates profile skeleton               | <span style="color:#188038">Database.handle_new_user()</span> → SQL INSERT INTO <span style="color:#188038">profiles {user_id, account_type: NULL}</span>                                |
| ---                                                        | ---                                                                                                                  |
| Step 4 - Auth returns JWT to frontend                      | <span style="color:#188038">Auth</span> → 200 <span style="color:#188038">{access_token, refresh_token, user: {id, email}}</span> (JWT) over HTTPS                                         |
| ---                                                        | ---                                                                                                                  |
| Step 5 - Frontend stores session, prompts location (FR1.5) | <span style="color:#188038">useAuthStore.setSession()</span> → <span style="color:#188038">expo-location.requestForegroundPermissionsAsync()</span> (in-process)                           |
| ---                                                        | ---                                                                                                                  |
| Step 6 - Onboarding submits questionnaire (FR1.3)          | <span style="color:#188038">OnboardingScreen.submitPreferences()</span> → PATCH <span style="color:#188038">/rest/v1/profiles?user_id=eq.{id} {account_type, questionnaire_answers}</span> |
| ---                                                        | ---                                                                                                                  |

## **Profile creation (FR2)**

| Step                                                    | Function on component → data over connector                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User picks profile picture                     | <span style="color:#188038">ProfileEditorScreen.handlePickImage()</span> → <span style="color:#188038">expo-image-picker.launchImageLibraryAsync()</span> (in-process)                            |
| ---                                                     | ---                                                                                                                         |
| Step 2 - Frontend uploads to Storage                    | <span style="color:#188038">APIClient.storage.from('avatars').upload()</span> → POST <span style="color:#188038">/storage/v1/object/avatars/{user_id}.jpg {file, content-type: image/jpeg}</span> |
| ---                                                     | ---                                                                                                                         |
| Step 3 - Storage returns key + public URL               | <span style="color:#188038">Storage</span> → 200 <span style="color:#188038">{Key, Id, publicUrl}</span> over HTTPS                                                                               |
| ---                                                     | ---                                                                                                                         |
| Step 4 - User saves profile                             | <span style="color:#188038">ProfileEditorScreen.handleSave()</span> → PATCH <span style="color:#188038">/rest/v1/profiles?user_id=eq.{id} {name, bio, avatar_url, visibility}</span>              |
| ---                                                     | ---                                                                                                                         |
| Step 5 - DB updates row, RLS confirms ownership (FR2.2) | <span style="color:#188038">Database</span> → UPDATE <span style="color:#188038">profiles</span> WHERE <span style="color:#188038">user_id = auth.uid()</span>                                                                       |
| ---                                                     | ---                                                                                                                         |
| Step 6 - Frontend updates State Store                   | <span style="color:#188038">useProfileStore.setProfile()</span> → re-renders ProfileScreen (in-process)                                                        |
| ---                                                     | ---                                                                                                                         |

## **Interest selection / subscription (FR3)**

| Step                                                          | Function on component → data over connector                                                           |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Step 1 - User searches for tag                                | <span style="color:#188038">InterestPickerScreen.handleSearch(query)</span> → GET <span style="color:#188038">/rest/v1/interests?name=ilike.%{query}%&limit=20 </span>       |
| ---                                                           | ---                                                                                                   |
| Step 2 - DB returns matching tags                             | <span style="color:#188038">Database</span> → 200 <span style="color:#188038">[{id, name, subscriber_count}, ...]</span> over HTTPS                                       |
| ---                                                           | ---                                                                                                   |
| Step 3a - User taps existing tag                              | <span style="color:#188038">InterestPickerScreen.handleSelect(id)</span> → POST <span style="color:#188038">/rest/v1/user_interests {user_id, interest_id}</span>           |
| ---                                                           | ---                                                                                                   |
| Step 3b - User creates new tag (FR3.3)                        | <span style="color:#188038">InterestPickerScreen.handleCreate(name)</span> → POST <span style="color:#188038">/rest/v1/interests {name}</span> → then <span style="color:#188038">user_interests</span> insert |
| ---                                                           | ---                                                                                                   |
| Step 4 - Edge Function recomputes related-tag weights (FR3.4) | <span style="color:#188038">EdgeFn.recomputeTagRelations()</span> → SQL UPDATE <span style="color:#188038">tag_relations</span> SET <span style="color:#188038">weight = ...</span> WHERE <span style="color:#188038">source_id IN (...)</span>   |
| ---                                                           | ---                                                                                                   |
| Step 5 - Frontend updates user's tag list                     | <span style="color:#188038">useInterestStore.addInterest()</span> → re-renders chips (in-process)                                        |
| ---                                                           | ---                                                                                                   |

## **Map / event discovery (FR4)**

| Step                                                                 | Function on component → data over connector                                                                                   |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User opens Map screen                                       | <span style="color:#188038">MapScreen.componentDidMount()</span> → <span style="color:#188038">useMapStore.fetchRankedEvents(viewport)</span> (in-process)                                          |
| ---                                                                  | ---                                                                                                                           |
| Step 2 - Frontend invokes ranking RPC                                | <span style="color:#188038">APIClient.rpc('rank_events')</span> → POST <span style="color:#188038">/rest/v1/rpc/rank_events {user_lat, user_lng, radius_m, user_id}</span>                          |
| ---                                                                  | ---                                                                                                                           |
| Step 3 - DB executes PostGIS + score query                           | <span style="color:#188038">Database.rank_events()</span> → SQL SELECT \*, <span style="color:#188038">score</span> FROM <span style="color:#188038">events</span> WHERE <span style="color:#188038">ST_DWithin(geog, point, radius)</span> ORDER BY <span style="color:#188038">score</span> DESC LIMIT 200 |
| ---                                                                  | ---                                                                                                                           |
| Step 4 - DB returns ranked results                                   | <span style="color:#188038">Database</span> → 200 <span style="color:#188038">[{id, title, geog: {lng, lat}, score, source, subscriber_count, is_full}, ...]</span>                               |
| ---                                                                  | ---                                                                                                                           |
| Step 5 - Frontend renders pins (FR4.4 distinguishes user vs scraped) | <span style="color:#188038">MapScreen.render()</span> → <span style="color:#188038">&lt;MapPin/&gt;</span> per event, color-coded by <span style="color:#188038">source</span> (in-process)                                            |
| ---                                                                  | ---                                                                                                                           |
| Step 6 - User pulls to refresh                                       | <span style="color:#188038">MapScreen.onRefresh()</span> → re-invokes Step 2                                                                                     |
| ---                                                                  | ---                                                                                                                           |

## **Adding friends & following (FR8)**

| Step                                            | Function on component → data over connector                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User searches for username (FR8.1)     | <span style="color:#188038">FriendSearchScreen.handleSearch(q)</span> → GET <span style="color:#188038">/rest/v1/profiles?username=ilike.%{q}%&visibility=eq.public</span>                                                                      |
| ---                                             | ---                                                                                                                                                                       |
| Step 2 - User taps "Add friend"                 | <span style="color:#188038">FriendSearchScreen.handleAdd(target_id)</span> → POST <span style="color:#188038">/rest/v1/rpc/send_friend_request {target_id}</span>                                                                               |
| ---                                             | ---                                                                                                                                                                       |
| Step 3 - Edge Function checks blocks (FR8.3)    | <span style="color:#188038">EdgeFn.sendFriendRequest()</span> → SQL SELECT 1 FROM <span style="color:#188038">blocks</span> WHERE <span style="color:#188038">blocker_id = target_id AND blocked_id = auth.uid();</span> if found → 403 <span style="color:#188038">{error: "Cannot send request"}</span>             |
| ---                                             | ---                                                                                                                                                                       |
| Step 4 - Edge Function inserts request          | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">friendships {from_id, to_id, status: 'pending'}</span>                                                                                                  |
| ---                                             | ---                                                                                                                                                                       |
| Step 5 - Edge Function dispatches push (FR10.1) | <span style="color:#188038">EdgeFn</span> → POST <span style="color:#188038">`https://exp.host/--/api/v2/push/send` {to: target_token, title: "Friend request", body: "{name} wants to connect", data: {deep_link: '/friends/requests'}}</span> |
| ---                                             | ---                                                                                                                                                                       |
| Step 6 - Target taps notification, accepts      | <span style="color:#188038">FriendsScreen.handleAccept(request_id)</span> → PATCH <span style="color:#188038">/rest/v1/friendships?id=eq.{id} {status: 'accepted'}</span>                                                                       |
| ---                                             | ---                                                                                                                                                                       |

## **User-created events (FR5)**

| Step                                                            | Function on component → data over connector                                                                                                                           |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User submits event creation form                       | <span style="color:#188038">CreateEventScreen.handleCreate()</span> → POST <span style="color:#188038">/rest/v1/rpc/create_event {title, description, start_at, end_at, location: {lng, lat}, interests: [id, ...], capacity}</span>      |
| ---                                                             | ---                                                                                                                                                                   |
| Step 2 - Edge Function inserts event row                        | <span style="color:#188038">EdgeFn.createEvent()</span> → SQL INSERT INTO <span style="color:#188038">events {creator_id: auth.uid(), title, geog: ST_MakePoint(lng, lat), capacity, status: 'draft', source: 'user'}</span> returning <span style="color:#188038">{id}</span> |
| ---                                                             | ---                                                                                                                                                                   |
| Step 3 - Edge Function inserts tag joins                        | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">event_interests {event_id, interest_id}</span> for each tag                                                                                         |
| ---                                                             | ---                                                                                                                                                                   |
| Step 4 - Publish gate fires when threshold met (FR5.4)          | <span style="color:#188038">EdgeFn.checkPublishGate()</span> → SQL UPDATE <span style="color:#188038">events</span> SET <span style="color:#188038">status='published'</span> WHERE <span style="color:#188038">id=? AND subscriber_count >= MIN_SUBSCRIBERS</span>                                               |
| ---                                                             | ---                                                                                                                                                                   |
| Step 5 - Edge Function fans out push to nearby matches (FR10.3) | <span style="color:#188038">EdgeFn</span> → SELECT <span style="color:#188038">users</span> WHERE <span style="color:#188038">ST_DWithin(home, event.geog, radius) AND interest_overlap > 0;</span> → POST Expo Push batch                                                     |
| ---                                                             | ---                                                                                                                                                                   |

## **App-created events (FR6)**

_Triggered by scraper, not user._

| Step                                                       | Function on component → data over connector                                                                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - Scheduled scraper runs                            | <span style="color:#188038">Worker.scrapeEvents()</span> → fetches external sources (in-process)                                                                                            |
| ---                                                        | ---                                                                                                                                                      |
| Step 2 - Worker posts each candidate                       | <span style="color:#188038">Worker</span> → POST <span style="color:#188038">/functions/v1/ingest_scraped {Authorization: Bearer {service_role}, payload: {title, description, start_at, end_at, location, source_url}}</span> |
| ---                                                        | ---                                                                                                                                                      |
| Step 3 - Edge Function validates required fields (FR6.3)   | <span style="color:#188038">EdgeFn.ingestScraped()</span> → checks <span style="color:#188038">title && start_at && location</span>; if missing → log + skip (FR6.4)                                                           |
| ---                                                        | ---                                                                                                                                                      |
| Step 4 - Edge Function auto-tags (FR6.2)                   | <span style="color:#188038">EdgeFn.autoTag(description)</span> → keyword/embedding match → returns <span style="color:#188038">[interest_id, ...]</span> (in-process)                                                        |
| ---                                                        | ---                                                                                                                                                      |
| Step 5 - Edge Function inserts event with source='scraped' | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">events {title, ..., source: 'scraped', creator_id: NULL}</span>; INSERT <span style="color:#188038">event_interests</span> for each tag                                   |
| ---                                                        | ---                                                                                                                                                      |

## **Direct & event chat (FR9)**

| Step                                                            | Function on component → data over connector                                                                       |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Step 1 - User opens chat thread                                 | <span style="color:#188038">ChatScreen.componentDidMount()</span> → <span style="color:#188038">useChatStore.subscribeToChat(chat_id)</span> (in-process)                               |
| ---                                                             | ---                                                                                                               |
| Step 2 - RealtimeSub joins chat channel                         | <span style="color:#188038">RealtimeSub → WSS <span style="color:#188038">/realtime/v1/websocket</span> → <span style="color:#188038">{topic: 'realtime:public:messages:chat_id=eq.{id}', event: 'phx_join'}</span> |
| ---                                                             | ---                                                                                                               |
| Step 3 - User sends message                                     | <span style="color:#188038">ChatScreen.handleSend(text)</span> → POST <span style="color:#188038">/rest/v1/messages {chat_id, sender_id: auth.uid(), body}</span>                       |
| ---                                                             | ---                                                                                                               |
| Step 4 - DB inserts; RLS verifies membership + no block (FR9.2) | <span style="color:#188038">Database</span> → INSERT INTO <span style="color:#188038">messages</span> WHERE EXISTS <span style="color:#188038">chat_members</span> AND NOT EXISTS <span style="color:#188038">blocks</span>                                   |
| ---                                                             | ---                                                                                                               |
| Step 5 - DB CDC broadcasts row to channel                       | <span style="color:#188038">Database</span> → <span style="color:#188038">Realtime</span> → push <span style="color:#188038">{event: 'INSERT', record: {id, chat_id, sender_id, body, created_at}}</span> over WSS         |
| ---                                                             | ---                                                                                                               |
| Step 6 - Recipients' RealtimeSub receives, updates store        | <span style="color:#188038">useChatStore.appendMessage()</span> → ChatScreen re-renders (in-process)                                                 |
| ---                                                             | ---                                                                                                               |

## **Group chat creation (FR9.3-9.4)**

| Step                                                       | Function on component → data over connector                                                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User subscribes to event with chat opt-in (FR9.4) | <span style="color:#188038">EventDetailScreen.handleSubscribe()</span> → POST <span style="color:#188038">/rest/v1/rpc/subscribe_to_event {event_id, join_chat: true}</span>                                    |
| ---                                                        | ---                                                                                                                                       |
| Step 2 - Edge Function gets-or-creates chat                | <span style="color:#188038">EdgeFn.subscribeToEvent()</span> → SQL SELECT <span style="color:#188038">id</span> FROM <span style="color:#188038">chats</span> WHERE <span style="color:#188038">event_id=?;</span> if NULL → INSERT INTO <span style="color:#188038">chats {type: 'group', event_id}</span> returning <span style="color:#188038">id</span> |
| ---                                                        | ---                                                                                                                                       |
| Step 3 - Edge Function adds user as member                 | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">chat_members {chat_id, user_id: auth.uid()}</span>                                                                      |
| ---                                                        | ---                                                                                                                                       |
| Step 4 - Edge Function returns chat handle                 | <span style="color:#188038">EdgeFn9087 → 200 <span style="color:#188038">{subscription_id, chat_id}</span> over HTTPS                                                                                        |
| ---                                                        | ---                                                                                                                                       |
| Step 5 - Frontend joins chat channel                       | <span style="color:#188038">RealtimeSub</span> → WSS subscribe to <span style="color:#188038">chat:{chat_id}</span> (handoff to FR9 flow)                                                                       |
| ---                                                        | ---                                                                                                                                       |

## **Block users (FR11.1)**

| Step                                              | Function on component → data over connector                                                         |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Step 1 - User taps "Block" on profile             | <span style="color:#188038">ProfileScreen.handleBlock(target_id)</span> → opens confirmation modal (in-process)                        |
| ---                                               | ---                                                                                                 |
| Step 2 - User confirms                            | <span style="color:#188038">ProfileScreen.confirmBlock() → POST <span style="color:#188038">/rest/v1/blocks {blocker_id: auth.uid(), blocked_id: target_id}</span> |
| ---                                               | ---                                                                                                 |
| Step 3 - DB inserts block row                     | <span style="color:#188038">Database → INSERT INTO <span style="color:#188038">blocks {blocker_id, blocked_id, created_at}</span>                                  |
| ---                                               | ---                                                                                                 |
| Step 4 - RLS instantly applies across all queries | All future reads on <span style="color:#188038">messages, friendships, events, profiles filter</span> via <span style="color:#188038">WHERE NOT EXISTS (block)</span>     |
| ---                                               | ---                                                                                                 |
| Step 5 - Frontend removes target from local lists | <span style="color:#188038">useBlocksStore.addBlock() → strips target from chats/friends UI (in-process)                        |
| ---                                               | ---                                                                                                 |

## **Report & moderate (FR11.2-11.3)**

| Step                                              | Function on component → data over connector                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User submits report (FR11.2)             | <span style="color:#188038">ReportFormScreen.handleSubmit()</span> → POST <span style="color:#188038">/rest/v1/reports {target_user_id OR target_event_id, reason, details}</span>                                |
| ---                                               | ---                                                                                                                                         |
| Step 2 - DB inserts report                        | <span style="color:#188038">Database</span> → INSERT INTO <span style="color:#188038">reports {reporter_id: auth.uid(), target_*, reason, status: 'pending'}</span>                                              |
| ---                                               | ---                                                                                                                                         |
| Step 3 - Organizer triggers user removal (FR11.3) | <span style="color:#188038">EventManagementScreen.handleRemove(user_id)</span> → POST <span style="color:#188038">/rest/v1/rpc/organizer_remove {event_id, user_id}</span>                                        |
| ---                                               | ---                                                                                                                                         |
| Step 4 - Edge Function verifies caller is creator | <span style="color:#188038">EdgeFn.organizerRemove()</span> → SQL SELECT <span style="color:#188038">creator_id</span> FROM <span style="color:#188038">events</span> WHERE <span style="color:#188038">id=? AND creator_id = auth.uid();</span> else 403                               |
| ---                                               | ---                                                                                                                                         |
| Step 5 - Edge Function performs cascade           | <span style="color:#188038">EdgeFn</span> → SQL UPDATE <span style="color:#188038">event_subscriptions</span> SET <span style="color:#188038">status='removed'</span> WHERE <span style="color:#188038">matches;</span> DELETE FROM <span style="color:#188038">chat_members</span> WHERE <span style="color:#188038">chat_id=event_chat AND user_id=?</span> |
| ---                                               | ---                                                                                                                                         |

## **Event subscription & calendar add (FR7)**

| Step                                                       | Function on component → data over connector                                                                                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - User taps "Subscribe" + toggles "Add to calendar" | <span style="color:#188038">EventDetailScreen.handleSubscribe()</span> → POST <span style="color:#188038">/rest/v1/rpc/subscribe_to_event {event_id, join_chat, add_to_calendar}</span>                                                                             |
| ---                                                        | ---                                                                                                                                                                                           |
| Step 2 - Edge Function checks capacity (FR5.5)             | <span style="color:#188038">EdgeFn.subscribeToEvent()</span> → SQL SELECT <span style="color:#188038">capacity, subscriber_count</span> FROM <span style="color:#188038">events</span>; if full → INSERT INTO <span style="color:#188038">waitlist</span> and return 200 <span style="color:#188038">{status: 'waitlisted'}</span>                                           |
| ---                                                        | ---                                                                                                                                                                                           |
| Step 3 - Edge Function inserts subscription                | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">event_subscriptions {event_id, user_id, status: 'confirmed'}</span>                                                                                                         |
| ---                                                        | ---                                                                                                                                                                                           |
| Step 4 - Frontend calls Google Calendar (FR7.2)            | <span style="color:#188038">APIClient.googleCalendar.events.insert()</span>6 → POST <span style="color:#188038">`https://www.googleapis.com/calendar/v3/calendars/primary/events` {Authorization: Bearer {refresh_token_swap}, summary, location, start, end}</span> |
| ---                                                        | ---                                                                                                                                                                                           |
| Step 5 - Calendar returns event link                       | <span style="color:#188038">Google Calendar</span> → 200 <span style="color:#188038">{event_id, htmlLink}</span> over HTTPS                                                                                                                                         |
| ---                                                        | ---                                                                                                                                                                                           |
| Step 6 - Later: waitlist promotion fires (FR5.6)           | <span style="color:#188038">EdgeFn.promoteWaitlist()</span> → SQL UPDATE <span style="color:#188038">event_subscriptions</span> SET <span style="color:#188038">status='confirmed'</span>; → POST Expo Push <span style="color:#188038">{title: "You're in!", body: "{event_title} has space"}</span>                                     |
| ---                                                        | ---                                                                                                                                                                                           |

## **Rate events (FR5.11)**

| Step                                                | Function on component → data over connector                                                                                                               |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step 1 - Event ends; rating UI gates on time + role | <span style="color:#188038">EventDetailScreen.render()</span> → checks <span style="color:#188038">(now - end_at) < 24h && was_subscriber && !already_rated</span> (in-process)                                                 |
| ---                                                 | ---                                                                                                                                                       |
| Step 2 - User submits rating                        | <span style="color:#188038">EventDetailScreen.handleRate(stars)</span> → POST <span style="color:#188038">/rest/v1/ratings {event_id, user_id: auth.uid(), stars}</span>                                                        |
| ---                                                 | ---                                                                                                                                                       |
| Step 3 - DB inserts with uniqueness constraint      | <span style="color:#188038">Database</span> → INSERT INTO <span style="color:#188038">ratings {...}</span>; UNIQUE(<span style="color:#188038">event_id, user_id</span>) prevents double-rate                                                                      |
| ---                                                 | ---                                                                                                                                                       |
| Step 4 - Edge Function rolls into creator's average | <span style="color:#188038">EdgeFn.rollupRating()</span> → SQL UPDATE <span style="color:#188038">profiles</span> SET <span style="color:#188038">avg_rating = (SELECT AVG(stars) FROM ratings r JOIN events e ON r.event_id = e.id WHERE e.creator_id = ?)</span> |
| ---                                                 | ---                                                                                                                                                       |
| Step 5 - Frontend marks rated, hides UI             | <span style="color:#188038">useEventStore.markRated()</span> → re-renders without rating section (in-process)                                                                                |
| ---                                                 | ---                                                                                                                                                       |

## **Notifications (FR10)**

_System-triggered, multiple entry points._

| Step                                                                                      | Function on component → data over connector                                                                                                            |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Step 1 - Trigger fires (new event in radius / friend req / waitlist promo / event update) | <span style="color:#188038">EdgeFn.dispatchNotification(trigger_type, payload)</span> (in-process)                                                                                        |
| ---                                                                                       | ---                                                                                                                                                    |
| Step 2 - Edge Function selects recipients                                                 | <span style="color:#188038">EdgeFn</span> → SQL SELECT <span style="color:#188038">user_id, push_token</span> FROM <span style="color:#188038">profiles p JOIN user_preferences up ON ... WHERE matches_filter AND push_enabled = true</span>                   |
| ---                                                                                       | ---                                                                                                                                                    |
| Step 3 - Edge Function persists in-app record                                             | <span style="color:#188038">EdgeFn</span> → SQL INSERT INTO <span style="color:#188038">notifications {user_id, type, payload_json, read: false}</span> for each recipient                                                   |
| ---                                                                                       | ---                                                                                                                                                    |
| Step 4 - Edge Function batches to Expo Push                                               | <span style="color:#188038">EdgeFn</span> → POST <span style="color:#188038">`https://exp.host/--/api/v2/push/send` [{to: token, title, body, data: {deep_link, type}}, ...]</span>                                        |
| ---                                                                                       | ---                                                                                                                                                    |
| Step 5 - Expo routes to OS service                                                        | <span style="color:#188038">Expo Push</span> → APNs (iOS) / FCM (Android)                                                                                                                 |
| ---                                                                                       | ---                                                                                                                                                    |
| Step 6 - Device shows banner; user taps → deep link (FR10.4)                              | <span style="color:#188038">Device</span> → opens app to <span style="color:#188038">{deep_link}</span>; app refreshes notifications list on foreground via GET <span style="color:#188038">/rest/v1/notifications?user_id=eq.{me}&order=created_at.desc</span> |
| ---                                                                                       | ---                                                                                                                                                    |

# Prototype Implementation

### [SceneCheck Prototype](https://osu.my.canva.site/scenecheck-v2)

We have learned that the prototyping process is best done as soon as possible in the development cycle due to the fact that it allows your team to think of new ideas and features that they looked over which are integral to any application. Through creating this prototype we have also been able to make further improvements to the UI/UX experience as well as streamlining the handling of our multitude of features (e.g. user vs. organization accounts, chats, friends, different event types) which wouldn't have been possible without being able to quickly iterate on our ideas. The true purpose of prototyping isn't to have a perfect product, but to have a general idea of what some change might look like in production and to make those decisions now before more time and effort is put into it. Some challenges that we encountered were having our changes from each step to the next not interfering with previous iterations (e.g. abandoned ideas) as it often led to needing to clean up the previous changes, to a degree, to ensure stability.

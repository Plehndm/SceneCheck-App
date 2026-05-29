# In4matx 43 Project

## Title: SceneCheck

## 📁 Project structure

| Path | What it is |
|---|---|
| `scenecheck-expo/` | **Active project.** Expo SDK 54 + TypeScript + React Native Web port. Cross-platform (iOS / Android / Web) per the architecture document. Run with `npm start` from inside. |
| `supabase/` | Database migrations, Edge Functions, pgTAP tests. Backend is shared between the legacy prototype and the new Expo project. |
| `docs/` | All project documentation — see below. |
| `legacy/` | **Archived.** Original browser-based prototype (Babel-Standalone + plain JSX) from HW2 / HW3. Kept for reference / comparison. See `legacy/README.md`. |
| `assets/` | Static assets (UI draft images) referenced by the requirements doc. |

### 📚 Documentation (in `docs/`)

All project documents live in the [`docs/`](docs/) folder:

| Document | File |
|---|---|
| Progress snapshot | [`docs/PROGRESS_SNAPSHOT.md`](docs/PROGRESS_SNAPSHOT.md) |
| Test plan | [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) |
| Architecture document | [`docs/IN4MATX 43 Architecture Document.md`](docs/IN4MATX%2043%20Architecture%20Document.md) |
| Requirements document | [`docs/IN4MATX-43-Requirements-Document.md`](docs/IN4MATX-43-Requirements-Document.md) |
| Code reviews | [`docs/CODE_REVIEW_REPORT.md`](docs/CODE_REVIEW_REPORT.md), [`docs/CODE_REVIEW_REPORT_2.md`](docs/CODE_REVIEW_REPORT_2.md) |
| User flow traces | [`docs/user_flow_traces.md`](docs/user_flow_traces.md) |

### Quick start (active project)

> 📱 **Running on a phone?** Install the free **[Expo Go](https://expo.dev/go)** app on your iOS or Android device (App Store / Google Play). Then run `npm start` and scan the QR code with Expo Go (iOS: the Camera app; Android: the Expo Go app) to open SceneCheck on your device. No build step needed. For web, just press `w`.

```bash
cd scenecheck-expo
npm install
npm start          # interactive — press w for web, or scan the QR with Expo Go for iOS/Android
npm test
```

### Quick start (legacy prototype)

```bash
cd legacy
npm install
npm run dev        # serves on http://localhost:5173
npm test           # original prototype tests
```

---

# 📋 Team Meeting Log

> This file documents all team meetings. Update after every meeting.

---

## Meeting #1 — April 17, 2026

**Type: In-person** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| David Plehn | <mark>In-person</mark> / Virtual / Slack / Email |
| Shrujan Sriram | <mark>In-person</mark> / Virtual / Slack / Email |
| Kyle He | <mark>In-person</mark> / Virtual / Slack / Email |
| Duy Tran | <mark>In-person</mark> / Virtual / Slack / Email |
| Kaylee Quinn | <mark>In-person</mark> / Virtual / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->
We discussed what features we thought would be useful and appropriate to build for our version of the friend finder project. 
We came up with 11 key features: 
- Users can subscribe to multiple interests
- Users can have open-ended interests
- Users have a profile
- Add connections with other users
- Limits on location sharing - default is None
- Meet Up Events (Can choose what date range to be shown)
- Block Users
- Group Chat Creation
- Creating an account (minimum age 18)
- Search for specific users to connect (e.g. friends)
- Notification whenever someone else with the same interest is near

**Action Items:**
- [ ] Mock-Up UI — assigned to @Kyle He — due N/A
- [ ] Meeting Summary — assigned to @David Plehn — due 4/17/26

---

## Meeting #2 — April 27, 2026

**Type: Virtual** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| David Plehn | In-person / <mark>Virtual</mark> / Slack / Email |
| Kyle He | In-person / <mark>Virtual</mark> / Slack / Email |
| Duy Tran | In-person / <mark>Virtual</mark> / Slack / Email |
| Kaylee Quinn | In-person / <mark>Virtual</mark> / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->
We finalized what the niche for our app would be which is events, and did more brainstorming on features for how users should interact with the map, events, other users, etc. Here are some of our ideas:
- Select a radius (ie 10 miles) or select a city
- Events shown: your selected interests (loosely matches your interests)
- Subscribe/Register to event you are interested in
   + Once subscribed, have the option to join a groupchat with everyone else subscribed to that event
   + Event coordinator has ability to send announcement to subscribers
   + During/after event, you can meet people there and add them as a friend
- Users who are friends can follow each other's events they attend/attended, create a chat, share events
- After subscribing to an interest you get notified of an event of that type’s creation within your radius
- After subscribing to an organization you get notified of any events created by them
- App made events
   + Web scraper to auto make events, assigned with tags
- User made events, assigned with tags
   + 	If doesnt get enough subscribers within __, cancel event
   + 	Event is made if __ users initially subscribe to it
   + 	User making event can see extra info:
        * What city hosts what types of events
        * What specific location hosts what events
- Users have ability to rate events after

**Action Items:**
- [ ] Update Functional Requirements — assigned to @Kyle He — due 4/29/26
- [ ] Make User Flows — assigned to @Kaylee Quinn, @David Plehn, @Duy Tran, @Kyle He — due 4/29/26
- [ ] Meeting Summary — assigned to @David Plehn — due 4/27/26
- [ ] Write Pros/Cons and Ethic Concerns — assigned to @Kaylee Quinn, @David Plehn, @Duy Tran, @Kyle He, @Shrujan Sriram — due 4/29/26

---

## Meeting #3 — May 8, 2026

**Type: In-person** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| David Plehn | <mark>In-person</mark> / Virtual / Slack / Email |
| Shrujan Sriram | <mark>In-person</mark> / Virtual / Slack / Email |
| Kyle He | <mark>In-person</mark> / Virtual / Slack / Email |
| Duy Tran | <mark>In-person</mark> / Virtual / Slack / Email |
| Kaylee Quinn | <mark>In-person</mark> / Virtual / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->
We discussed architecture decisions about what backend we should use and how to merge that with the frontend. We decided on using Supabase for the backend (as it simplifies our database/backend integration as well as ease of connection with external services) and use JavaScript with React for the frontend. Additionally, we discussed general design decisions with the prototype and refined the event creation process to include a limit on when a user created event is shown to people outside of its tagged interests, the ability to select if a created event is from a user or an organization.

**Action Items:**
- [ ] Meeting Summary — assigned to @David Plehn — due 5/8/26
- [ ] Write Architecture Document — assigned to @Kaylee Quinn, @David Plehn, @Duy Tran, @Kyle He, @Shrujan Sriram — due 5/14/26

---

## Meeting #4 — May 15, 2026

**Type: In-person** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| David Plehn | <mark>In-person</mark> / Virtual / Slack / Email |
| Shrujan Sriram | <mark>In-person</mark> / Virtual / Slack / Email |
| Kyle He | <mark>In-person</mark> / Virtual / Slack / Email |
| Duy Tran | <mark>In-person</mark> / Virtual / Slack / Email |
| Kaylee Quinn | <mark>In-person</mark> / Virtual / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->
We discussed how David Plehn should do the programming as he has access to claude code and the group would collaborativly give edits and bugs to be added or fixed to him and he would make the appropriate changes. We decided to have everyone go over the requirements and architecture document again to refresh what features and functionality we wanted and how the architecture would reflect that.

**Action Items:**
- [ ] Meeting Summary — assigned to @David Plehn — due 5/8/26
- [ ] Port Over Prototype — assigned to @David Plehn — due 5/20/26
- [ ] Review Requirements and Architecture Document — assigned to @Kaylee Quinn, @David Plehn, @Duy Tran, @Kyle He, @Shrujan Sriram — due 5/20/26

---

## Meeting #5 — May 22, 2026

**Type: In-person** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| David Plehn | <mark>In-person</mark> / Virtual / Slack / Email |
| Shrujan Sriram | <mark>In-person</mark> / Virtual / Slack / Email |
| Kyle He | <mark>In-person</mark> / Virtual / Slack / Email |
| Duy Tran | <mark>In-person</mark> / Virtual / Slack / Email |
| Kaylee Quinn | <mark>In-person</mark> / Virtual / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->
We had a group update on the current state of the project, what features were implemented, how they were implemented, and what has not yet been developed. Reports were given both from David's end in a White Box testing format and from group members in a more Black Box fashion which allowed for deep testing on both fronts.

**Action Items:**
- [ ] Meeting Summary — assigned to @David Plehn — due 5/30/26
- [ ] Fix Issues Found From Testing — assigned to @David Plehn — due 5/31/26
- [ ] Test App and Identify Issues — assigned to @Kaylee Quinn, @David Plehn, @Duy Tran, @Kyle He, @Shrujan Sriram — due 5/31/26

---

## Meeting #[N] — [Month Day, Year]

**Type:** <!-- In-person / Virtual / Async -->

**Attendees:**
| Name | Participation |
|------|--------------|
| [Name] | In-person / Virtual / Slack / Email |
| [Name] | In-person / Virtual / Slack / Email |

**Summary:**
<!-- 50–100 words describing what was discussed -->

**Action Items:**
- [ ] [Task] — assigned to @[person] — due [date]
- [ ] [Task] — assigned to @[person] — due [date]

---
<!-- Repeat block above for each meeting -->

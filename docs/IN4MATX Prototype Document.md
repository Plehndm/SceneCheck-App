# HW3: UI Prototyping

# User Interface Mockups and Analysis

**UI Planning:**

Mock UIs:


**COLOR THEORY** - App Design

Reading: <https://uxdesign.cc/basic-color-theory-for-better-mobile-design-522798534a99>

Research Results:

- warmer colors for social media app
  - friendliness
- cooler colors (especially blue) for tech companies
  - signifies trust and calmness
- black/grey for luxury brands
  - apple
- green for natural/agricultural feel



What our app should use:

Preferably warm colors. Even though our app is tech-based, it is mainly comparable to a social media app.

Thus, warmer colors to imbue friendliness would be best.

**Current main colors:**

# ff5b47 -

# 13110f - 

# fffbf5 - 

# fefefe - 



We are close to obtaining a 'warm color palette'.

The black color makes for a good background color / separator between the white colors and the _main_ color. Our current main color is a red-orange variant. Possible experimentation with changing only the main color and seeing what our app would look like. The current white and off-white background color are good for creating the foundation of a warm tone, as opposed to a more blue-ish cool tone.

Diving deeper into specific colors (with emphasis on warmer ones):  
Reading: <https://forum.freecodecamp.org/t/the-basic-principles-of-web-design-the-colour-psychology-moodboard-tutorial/319529m>

- colors are primary, secondary, or tertiary colors
- multiple color models (RYB, CMYK)
  - for web design (our context), we will be using RGB
- although CMYK is commonly used for physical images, like printing, our app will live entirely on a screen, thus we have no need for an extra CMYK color model
- **note**: CMYK "is NOT to be used when you are creating designs for the digital platform!"

**Prototype's UI:**

# Heuristic Evaluation

**H2** marks items introduced or strengthened in the most recent fixes round.

## **1\. Visibility of System Status**

### **How it's addressed**

- Toast system with success / info / error tones for every state change.
- Pending-leave and pending-unfriend grace states with countdowns on the affected rows.
- **H2** Pre-flight conflict chips - event cards show ⚠ OVERLAPS 7:00 AM before you even tap Join, so you can see the conflict in your feed rather than after committing.
- **H2** Inline values in Settings - every section header shows its current value (DISCOVERY · 2 mi, NOTIFICATIONS · 4 of 6 on), so state is visible without opening the section.
- **H2** Drafts presence indicator - Profile → Drafts row shows N saved / None.
- **H2** Resuming-draft banner - Create Event subtitle reads RESUMING DRAFT · STEP 3 OF 4 so users know they're continuing existing work.
- Chat message status: SENDING…, SENT ✓, FAILED · RETRY per message.
- Offline banner, skeleton loaders, and "you are here" pulse on the map.

### **Still lacking**

- The map's filter pills don't show counts. The events-list filter pills do (FRIENDS · 4) - should be consistent.
- No global progress indicator for multi-step async actions outside chat and publish (e.g., accepting a friend request only toasts).

### **Improvements**

- Mirror the events-list counts on the map filter chips.
- Add an unread badge on the Chat tab icon - the dot count exists in the chat list but doesn't bubble up to the tab.

## **2\. Match Between System and the Real World**

### **How it's addressed**

- Plain language throughout: Going, Host, Friends, Followers, Drafts.
- Date / time format is human (Sat May 9 · 7:00 AM).
- **H2** Full time ranges - events now show 7:00 AM - 9:00 AM, matching how people naturally describe events (from X to Y).
- Real campus references (Mesa Court, Aldrich Park, Langson Library) give context that feels native to UCI.

### **Still lacking**

- "Privacy: Public/Private" is still a global mode. Most users think in terms of who can see / add me.
- "Discovery radius" - the (?) tooltip now defines it, but the label itself is still product-y.

### **Improvements**

- Rename the radius row to "How far to look" with the (?) tooltip retained for full explanation.
- Reframe privacy as "Who can add you?" with "Anyone" / "Approval needed" sub-options.

## **3\. User Control and Freedom**

### **How it's addressed**

- **H2** Host actions - events you host have EDIT EVENT / CANCEL EVENT buttons; cancelling shows the affected-attendees count plus a confirm dialog.
- **H2** Message edit / delete - long-press your own chat bubbles to edit or delete.
- **H2** Drafts screen - every unfinished event is recoverable from one place; the CONTINUE EDITING button drops you back at the step you left.
- **H2** Save-changes prompt on exit - when editing a draft you've changed, the exit sheet gives three explicit paths (Save, Discard, Keep editing) and makes clear the draft survives either way.
- **H2** Auto-save on exit - new event creations silently snapshot to Drafts when you back out, so nothing is ever lost.
- **H2** Dedicated 404 / "event no longer exists" screen instead of a silent fallback.
- 5-second undo toasts on Leave Event and Unfriend.

### **Still lacking**

- No undo on Decline Request - once you decline a friend request, it's gone.
- Cancelling an event hard-deletes it from the user's view; no "uncancel" grace.
- No edit history on edited chat messages (just an (EDITED) flag, no way to see the original).

### **Improvements**

- Add a 5-second undo toast on Decline Request (matches the existing unfriend / leave pattern).
- "Cancelled event" lives in a separate state for 24 hours, recoverable by the host (like Gmail's undo-send).

## **4\. Consistency and Standards**

### **How it's addressed**

- **H2** Toggle controls unified - the RowToggle and NotifToggleRow now use the same iOS-style switch (44×26 pill, 22px knob). Fix applied after a misaligned variant was caught.
- **H2** Failure-state language consistent - publish failure, offline chat send, and 404 all use the same red accent and diagnostic code (ERR · NET_UNREACHABLE, ERR · EVENT_NOT_FOUND).
- **H2** Bottom-sheet pattern unified - confirm dialogs, message actions, edit-event, and save-changes all use the same slide-up sheet with a drag handle.
- Reusable primitives (SCCard, SCSection, RowKV, RowMenu, Field, Segmented) used across every screen.
- Mono-caps style for primary commit / destructive actions; sentence case elsewhere.

### **Still lacking**

- "Friend" pending vs "Follow" pending look similar but mean different things.
- Some labels still read PENDING while others say Pending - the casing should commit to one convention per action type.

### **Improvements**

- Tint org follow-pending differently from person friend-pending (perhaps a soft blue ring on orgs, coral on people).
- Audit all status labels - mono-caps for state badges, sentence case for inline UI.

## **5\. Error Prevention**

### **How it's addressed**

- **H2** Pre-flight conflict chips surface the conflict on the card before tap, not after.
- Schedule-conflict modal still intercepts at the moment of Join as a last safety net.
- Confirm dialogs before destructive moves (sign out, cancel event, delete draft, block user).
- Time picker enforces end > start.
- Participant cap slider clamps to 2-60.
- Character counters on title and description.
- **H2** Discovery-radius warning at ≥ 25 mi: "you'll see events across the whole region - expect a busier feed."
- **H2** Save-changes prompt prevents accidental loss of draft edits.

### **Still lacking**

- Date picker doesn't block past dates - you can create an event for last Tuesday.
- Empty Title / Location on Create Event only blocks Continue when you try to advance - no inline indicator earlier.

### **Improvements**

- Disable past dates in the date picker (min = today).
- Light inline error styling (red border + helper text) on required fields the moment they're invalid, not on the Continue tap.

## **6\. Recognition Rather Than Recall**

### **How it's addressed**

- **H2** Drafts list shows preview meta - title, date / time range, location, interests, and a progress bar - so you don't have to remember what each unfinished event was about.
- **H2** Settings summaries - current value visible without opening the section.
- **H2** End times in feed - you don't have to open an event to know how long it runs.
- Recent chats list shows names + last message preview.
- Account switcher shows avatars and names.
- Tag chips on event detail are tappable to find similar events.

### **Still lacking**

- Search has no recent-queries or suggested-tags zero state.
- The Drafts list shows the next step in small uppercase text - could be more prominent.

### **Improvements**

- Search empty state: Recent searches + Popular near you + 8-10 trending tag chips.
- Surface the next step more prominently - e.g., a "Continue at: Tags & Limits" line in larger type.

## **7\. Flexibility and Efficiency of Use (Accelerators)**

### **How it's addressed**

- **H2** Save Draft chip in the Create Event header lets power users persist work without going through publish-failure recovery.
- **H2** Toast UNDO and VIEW actions - quickly recover from a destructive tap, or jump to drafts after a save.
- FAB on Home for one-tap event creation.
- Tweaks panel "Jump to screen" for testing flows.

### **Still lacking**

- No swipe-to-archive / swipe-to-join on event cards.
- No keyboard shortcuts in chat (Enter sends, but no ↑ to edit your last message - though we have long-press now).
- No saved filters in the events list.
- No "Apply to all my events" bulk action for hosts who manage multiple.

### **Improvements**

- Swipe-left on a chat thread to mute or archive.
- Long-press an event in My Hosting to bulk-edit time or location.

## **8\. Aesthetic and Minimalist Design**

### **How it's addressed**

- **H2** Collapsible Settings sections - users can fold the noise they don't care about, leaving just the summaries.
- Restrained type system (Bricolage Grotesque + DM Sans + JetBrains Mono).
- One primary CTA per screen; no competing primaries.
- Generous whitespace, no decorative chrome.
- **H2** Drafts cards are dense but uncluttered - progress bar, three meta lines, two actions. Nothing extra.

### **Still lacking**

- The Create Event header now carries the back button, STEP X OF 4 · RESUMING DRAFT, the step title, and the SAVE DRAFT chip. That's a lot for a small bar.
- Event-detail hero has gradient + map overlay + title chip + back + chat button - visually busy.

### **Improvements**

- Shorten the create-event title to just the step name when space is tight.
- Compress the event hero - fewer pinned chips, push more meta into the body.

## **9\. Help Users Recognize, Diagnose, and Recover from Errors**

### **How it's addressed**

- **H2** Detailed publish failure card - diagnostic code (ERR · NET_UNREACHABLE), explanation that local data is preserved, and explicit Save Draft + Retry buttons. The Save Draft path actually persists into Drafts.
- **H2** 404 screen for missing events - explains the likely cause (host cancelled / lost access), shows an error code, and offers Back + Find Other Events affordances.
- **H2** Upload-failed badge overlay with Cancel + Retry.
- Chat messages show FAILED · RETRY inline.
- Conflict modal explains the what, why, and offers two clear paths.
- Offline banner explains state and offers Retry.
- **H2** Save-changes sheet on draft exit explicitly states "your draft itself stays either way" so users aren't confused about deletion.

### **Still lacking**

- No surfacing of server-side status on a publish retry - the user retries blindly.
- The Block confirm could go deeper on consequences.

### **Improvements**

- On Retry, show a brief "Trying again…" state with a max-attempts indicator.
- Expand the Block confirm: "They won't see your profile, message you, or RSVP to events you host."

## **10\. Help and Documentation**

### **How it's addressed**

- **H2** Replay Welcome Tour row at the top of Help & Feedback - surfaces the onboarding in-app, not just dev-only.
- **H2** Help tooltips (?) next to dense labels (e.g., Discovery radius) - portaled with z-index 9999 so they float above scroll / card clipping consistently.
- FAQ list in Help & Feedback covers the most common questions.
- Inline hints on form fields (e.g., "Up to N attendees. Extras join a waitlist.").
- Onboarding tour walks new users through the map, radius, accounts, and event creation.

### **Still lacking**

- FAQ list isn't searchable.
- (?) tooltips only exist on Discovery for now - other dense settings (Profile Visibility, Linked Calendar consequences, Notifications categories) don't have them.

### **Improvements**

- Add a search input at the top of the FAQ that filters the list as you type.
- Sprinkle (?) tooltips on every settings row with a non-obvious term - Profile Visibility, Friend Activity, Auto-create group chat, etc.

## **Summary - top 5 highest-leverage next fixes**

- Searchable FAQ + more (?) tooltips - finish the help layer.
- Past-date guard + inline validation in Create Event.
- Friend / Follow visual divergence so the two pending states are unmistakable.
- Search empty state with recent + trending suggestions.
- Undo Decline Request to match the unfriend / leave undo pattern.

The biggest wins from the H2 round are around user control (drafts, host actions, message edit / delete) and error recovery (proper failure states with diagnostic + recovery actions). The remaining gaps are largely about polish on edges rather than fundamental UX holes.
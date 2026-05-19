## Requirements Document

## Table of Contents

[Table of Contents](#table-of-contents)

[Title](#title)

[Team](#team)

[Executive Summary](#executive-summary)

[Project Summary and Purpose](#project-summary-and-purpose)

[Application Context](#application-context)

[Users](#users)

[Design and Tech Stack](#design-and-tech-stack)

[Functional Requirements](#functional-requirements)

[Functional Requirements Analysis](#functional-requirements-analysis)

[Use Cases](#use-cases)

[Sketches](#sketches)

[Related Planning Documents](#related-planning-documents)

## Title

**Software Name:** SceneCheck

**Tag Line:** Trying to get as many people on and as many people off!

## Team

-   **Project Manager**: Kaylee Quinn (quinnk1)
-   **Architect**: David Plehn (dplehn)
-   **Programmer**: Shrujan Sriram
-   **UI/UX**: Kyle He (hek13)
-   **Product Designer:** Duy Tran (duynt3)

## Executive Summary

### Project Summary and Purpose

**Problem**

-   Many people want to attend events that align with their interests or
    discover new events in their area. However, it is time consuming and
    difficult to find those events manually.

**Solution**

-   Our project is a mobile app that helps users discover and attend
    interest-based events in their area, allowing connections to form
    naturally through shared experiences. Instead of directly matching
    users with strangers, the app focuses on **event-driven social
    discovery**.
    -   Users can subscribe to interests and hobbies (e.g., fitness,
        food, music, study groups), which personalize a live map
        displaying nearby events. These events come from two sources:
        -   AI-generated events gathered through web scraping (e.g.,
            local happenings, trending activities)
        -   User-created events hosted by individuals or groups
-   Users can view event details, save or join events, and when friends
    invite people to events. The platform also supports profiles,
    messaging, and group chats tied to specific events, making it easier
    to coordinate and continue connections after meeting.
-   By combining interest-based recommendations, real-time mapping, and
    both AI-generated and user-created events, the app creates a more
    natural, low-pressure way for users to meet others and build
    real-world connections.

## Application Context

### Users

-   The primary users of this application are adults ages 18 and older
    who want to meet new people based on shared interests, hobbies,
    activities, or events. This includes college students, young
    professionals, people new to an area, hobbyists, and users looking
    for local communities.

**Explorers (Users Looking for New People)**

Explorers are users who want to discover people nearby who share similar
interests or activities. They should be able to:

-   Create and manage a profile
-   Add a name, profile picture, bio, and interests
-   Subscribe to multiple interests or hashtags
-   Customize how much information is visible on their profile
-   Set a preferred matching radius
-   View nearby users and events on a live map
-   Search for users, interests, or events
-   Receive notifications when users with similar interests are nearby
-   View recommended users based on interests and distance
-   Send friend requests or connection requests
-   Start one-on-one chats or group chats
-   Choose whether to share precise location after connecting
-   Join existing meetup events
-   Link planned events to Google Calendar
-   Block or report users if needed

**Organizers (Users Creating Events and Groups)**

Organizers are users who want to create events, bring together people
with shared interests, and manage group activities. They should be able
to:

-   Create events tied to one or more interests
-   Set event title, description, date, time, location, and participant
    limit
-   Share event visibility settings (public or private)
-   Invite friends or nearby users to join
-   View who has registered for an event
-   Create group chats for event attendees
-   Update event details if plans change
-   See a list of attendees and mutual connections
-   Connect events to Google Calendar
-   Remove or block disruptive users from events or group chats
-   Receive notifications when users register or message within an event

### Design and Tech Stack

Design:
[Figma](https://www.figma.com/design/D92GJ48rIlkEIN874elQP9/Untitled?node-id=0-1&t=ZF4a2660o9xvaER0-1)

-   Figma: Used for wireframing, high-fidelity UI design, user flows,
    and prototyping. Figma allows the team to collaborate on map views,
    profile pages, event creation screens, and messaging flows while
    maintaining a consistent design system.
-   FigJam: Used for brainstorming, user journey mapping, feature
    prioritization, and team collaboration during early planning stages.
-   UI Kit: A reusable design system will be created to maintain
    consistency across profile cards, map pins, buttons, chat screens,
    and event pages. The UI kit will also prioritize accessibility,
    including colorblind-friendly map markers and readable typography.

## Functional Requirements

**FR1 - Account Creation:**

**FR1.1** The system shall allow users to create an account by providing
a valid email address and password.

**FR1.2** The system shall require users to enter their birthday during
registration and shall reject accounts where the user is under 18 years
of age.

**FR1.3** The system shall present a questionnaire upon first login to
collect user preferences.

**FR1.4** The system shall require users to specify their account type:
Individual User or Organization.  
**FR1.5** The system shall prompt users to grant location access as part
of account creation. If location access is denied, the user shall be
notified that core features will be unavailable.

**FR2 - User Profile:**

**FR2.1** The system shall allow users to create and manage a profile
containing: name, picture, mutual friends, an option to show a short
bio, an option to show event creation rating (if applicable), and an
option to display previous events attended/created.

**FR2.2** The system shall allow users to control the visibility of
their profile between public and friends only.

**FR2.3** The system shall allow Organizations to display an
organization name, description, and list of events they have created.

**FR3 - Interest Selection and Subscription:**

**FR3.1** The system shall allow users to subscribe to one or more
interests at any time, including during and after account creation.

**FR3.2** The system shall provide a searchable list of existing
interest tags for users to select from.

**FR3.3** The system shall allow users to create their own interest tag
if a desired tag does not exist.

**FR3.4** The system should match events to subscribed user interests
using related/similar tags in addition to exact matches. The mechanism
for determining tag relatedness must be defined before implementation.

**FR3.5** The system shall allow users to subscribe to specific
Organizations, after which they will receive notifications for any
events created by that organization.

**FR4 - Event Discovery (Map and Search):**

**FR4.1** The system shall provide a live map view displaying nearby
events filtered by the user’s subscribed interests.

**FR4.2** The system shall allow users to set a discovery radius or
search within a specific city to filter map results.

**FR4.3** The system shall provide a search feature allowing users to
find events by keyword.

**FR4.4** The system shall visually distinguish between User Created
Events and App Created Events on the map.

**FR4.5** The system shall display the current number of participants
subscribed to the event. If there is an active waitlist for the event,
the number of users on the waitlist shall also be shown.

**FR5 - User Created Events:**

**FR5.1** The system shall allow any user to create an event by
providing: event title, description, date and time range, location, and
one or more interest tags.

**FR5.2** The system shall allow event creators to set a participant
limit.

**FR5.3** The system shall provide event creators with analytics
showing: what types of events are popular in a given city, and what
types of events have been hosted at a given location.

**FR5.4** A user-created event shall only become publicly visible to
anyone on the app after reaching a minimum number of users who have
initially subscribed to it. Before reaching this number, this event will
only be visible to users with interest tags that exactly match the
event, and will not be able to be discovered as a ‘similar’ event.

**FR5.5** The system shall enforce the participant limit set by the
event creator. This will be determined by how many users subscribe to
the event. When an event reaches capacity, new users shall be prevented
from subscribing. The system shall clearly communicate to the user that
the event is full, but the user will have the option to join a waitlist
for the event.

**FR5.6** The event creator has the ability to adjust the participant
limit. If the limit increases, users currently on the waitlist will
automatically be subscribed to the event. If the limit decreases, users
will be removed from the event and put at the front of the waitlist.
Users will be added/removed from the event in chronological order, such
that the first person to join the waitlist will have priority of
subscribing to the event, and the last person to subscribe to the event
will be removed first. The event creator bears all responsibility for
the changing of participant capacity.

**FR5.7** The system shall allow event creators to update event details
(title, description, time, location) after publication. The event
creator bears all responsibility for any changes after event
publication.

**FR5.8** The system shall allow event creators to view a list of
registered attendees.

**FR5.9** Upon subscription to an event, users will have the option to
join a group chat with other users also subscribed to the event.

**FR5.10** The system shall allow event creators to remove or block
disruptive users from their event and its associated group chat.

**FR5.11** The system shall allow users to rate an event after the event
has finished. Users will have the option to rate an event only once, and
this option will last for a day after the event has finished. The rating
will reflect on the event creator, which can be publicly displayed on
their profile.

**FR6 - App Created Events:**

**FR6.1** The system will automatically generate events by scraping
publicly available event data from the web, extracting: event name,
description, date range, and location.

**FR6.2** App created events shall be automatically assigned relevant
interest tags based on their scraped content.

**FR6.3** The system shall only publish an App created event when
sufficient detail (name, date, location) has been successfully obtained.
Incomplete events shall be discarded.

**FR6.4** In the event that the web scraper fails to obtain a connection
or meaningful data, the system shall log the failure and skip that event
without disrupting other functionality.

**FR7 - Event Subscription and Registration:**

**FR7.1** The system shall allow users to subscribe to events they are
interested in, which registers them as an attendee.

**FR7.2** Upon subscribing to an event, the system shall offer users the
option to add the event to their linked Google Calendar.

**FR7.3** Upon subscribing to an event, the system shall offer users the
option to join the event’s associated group chat.

**FR8 - Social Features (Friends and Followers/Following):**

**FR8.1** The system shall allow users to search for other users by
username.

**FR8.2** The system shall allow users to send, receive, accept, and
decline friend requests/messages.

**FR8.3** The system shall prevent a user from sending a connection
request to another user who has blocked them or has restricted their
privacy settings. The system shall display an appropriate error message
in this case.

**FR8.4** During or after an event, the system shall allow attendees to
follow other attendees.

**FR8.5** The system shall allow users to share events to anyone they
have friended.

**FR9 - Messaging:**

**FR9.1** The system shall provide one-on-one direct messaging between
connected users.

**FR9.2** The system shall prevent messages between users who are not
connected or where a block exists, and shall display an appropriate
error message.

**FR9.3** The system shall allow users to create group chats and add
members from their friends list or from a shared event’s attendee list.

**FR9.4** The system shall automatically create a group chat associated
with each event. Users have the choice to opt in upon subscribing to the
event.

**FR9.5** The system shall allow event coordinators to send
announcements to all members of an event group chat.

**FR10 - Notifications:**

**FR10.1** The system shall send a notification when a user receives a
follow request.

**FR10.2** The system shall send a notification when an event the user
is subscribed to is updated or cancelled.

**FR10.3** The system shall send a notification when a new event
matching a subscribed interest or subscribed organization is created
within the user’s discovery radius or city.

**FR10.4** Notifications shall be tappable and shall navigate the user
to the relevant tab or map node.

**FR10.5** The system shall support both in app notifications and push
notifications. If the user has disabled push notifications at the OS
level, only in app notifications shall be delivered.

**FR11 - Moderation and Safety:**

**FR11.1** The system shall allow any user to block another user,
preventing the blocked user from viewing the blocker’s profile.

**FR11.2** The system shall allow users to report other users or events
for violating community guidelines.

**FR11.3** The system shall allow event creators to remove users from
their event or group chat.

## Functional Requirements Analysis

-   Account Creation Requirement
    -   18+ Restrictions:
        -   Pros:
            -   Dealing with privacy law and restriction involving
                minors restrict the potential design this app could
                partake in
        -   Cons:
            -   This app won’t have as much user compared to other app
                that allowed minor on their platform
    -   Questionaire:
        -   Pros:
            -   Quick and easy way to gather information regarding user
                preferences. Data then could be used to populate the
                list of recommended interests.
        -   Cons:
            -   Questionnaires aren’t the easiest thing to set up. Takes
                time and research to come up with a set of questions
                that could produce useful results.
-   Friends (share events)
    -   Pros:
        -   Makes it easy to invite friends to events
        -   Encourages group participation instead of going alone
        -   Helps users stay connected after meeting at events
    -   Cons:
        -   Can lead to notification overload if too many events are
            shared
        -   Requires users to already have or build a friend network
-   User Profile
    -   Pros:
        -   Helps user build identify and trust
        -   Makes it easier to decide whether to attend events or
            connect with someone
        -   Event history and ratings help users find reliable
            organizers
    -   Cons:
        -   Users may judge others based on limited profile information
        -   Event ratings could be inaccurate or unfair
-   Interest Selection/Subscription
    -   Pros:
        -   Personalizes the app experience based on user interests
        -   Makes event discovery fast and more relevant, Flexible
        -   Tag matching helps users discover new or similar activities
    -   Cons:
        -   Too many tags can clutter the system
        -   User-created tags may lead to duplicate naming
-   Event Discovery (Map)
    -   Pros:
        -   A good way to inform the user about nearby event
        -   Helps user understand their area better
    -   Cons:
        -   May clutter and obfuscate people in the area
        -   Require accurate location data
-   User Created Events
    -   Users:
        -   Pros:
            -   Allowed for a more impromptu gathering, natural
                interaction between users
            -   Low barrier of entry
        -   Cons:
            -   Quality of the event may vary
            -   Potential safety risk if the participant of the event
                are malicious, this may give them more reach
    -   Organization:
        -   Pros:
            -   Organizations would have a bigger budget to host events.
            -   They could tailored made the description, which would
                reflect better with what the event would be as opposed
                to App Created Events
        -   Cons:
            -   Could overshadow smaller User Created Event
            -   Might not be accessible to some due to ticketing or
                restricted access
-   App Created Events
    -   Pros:
        -   If it implemented correctly, this will eliminate some of the
            efforts of publishing an event
        -   Could be optimized and improved using data over the long run
    -   Cons:
        -   Require additional resources (web scrapper) in order to
            function
        -   Can cause slower updates to the map
-   Messaging
    -   Pros:
        -   Can communicate with friends who share similar interests
        -   Can ask questions pertaining to the event and get to know
            fellow event attendees
    -   Cons:
        -   Group chats can be overwhelming with a large notifications
        -   This opens up users to potentially being harassed
-   Notifications
    -   Pros:
        -   Allows for event organizers to notify attendees about any
            additional information or any updates
        -   Allows users to be up to date on events they would be
            interested in
    -   Cons
        -   Repetitive notifications can get irritating
        -   Notifications as updates are a one-way mode of communication
            and further inquiries (e.g. from insufficient info) would
            have to be directed to the event group chat.

## Use Cases

<table>
<colgroup>
<col style="width: 0%" />
<col style="width: 6%" />
<col style="width: 14%" />
<col style="width: 1%" />
<col style="width: 77%" />
</colgroup>
<thead>
<tr>
<th>Category</th>
<th>Feature</th>
<th>Description</th>
<th>Priority</th>
<th>Flows</th>
</tr>
</thead>
<tbody>
<tr>
<td>Feature</td>
<td><strong>User Account Creation (organization, person)</strong></td>
<td>Allows users to create an account to access the platform. Users must
be 18 years or older to register.</td>
<td>Need</td>
<td><strong>Basic Flow</strong>: <br>1. User enters their email and set
a password <br>2. User sets their birthdate <br>3. User do a series of
questionnaire <br>4. User needs to specify whether their account are
Individual User or Organization <br>5. User go through authenticating
their location to confirm if they are where they are <br>6. User Account
created <br><strong>Exception Flow</strong>: <br>1a. Invalid Email
<br>2a. Birthdate would set the user age less than 18, not allowed for
this app <br>5a. Location Authentication failed. Users did not allow the
app to access location data.</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>User Profile Creation</strong></td>
<td>Allows users to build a profile with their name, profile picture,
short bio, and interests.</td>
<td>Need</td>
<td><strong>Basic Flow:</strong> <br>1. User enters profile’s name
<br>2. User upload profile picture <br>3. User write a short bio <br>4.
User select some starting interests (including open-ended/user defined
interest) <br>4a. Select from the recommended list. <br>4b. Search for a
specific interest tag. <br>4c. Create their own interest tag.<br><br>5.
Profile Creation successful and now the profile is public
<br><strong>Alternative Flow:</strong> <br>2-4a. User can optionally
skipping these steps and still could go through with their profile
creation</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Interest Selection/Subscription</strong></td>
<td>Allows users to choose and manage multiple interests or hashtags
they want to match with.</td>
<td>Need</td>
<td><strong>Basic Flow:</strong><br><br>1. User select an interests
(including open-ended/user defined interest) <br>1a. Select from the
recommended list. <br>1b. Search for a specific interest tag. <br>1c.
Create their own interest tag.<br><br>2. User exit and confirm their
selection <br><strong>Alternative Flow:</strong> <br>2a. User could
alternatively return to step 1 to add more interest tags.
<br><strong>Exception Flow:</strong> <br>1b. User could search for a tag
that doesn’t exist currently.</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Map (pull up - Recommendations)</strong></td>
<td>Displays nearby users and events on a live map based on shared
interests and selected radius.</td>
<td>Need</td>
<td><strong>Basic Flow:</strong><br><br>1. User navigated to the Map
tab<br><br>2. Auto populated events and people according to applied
filters<br><br>2a. Filtered by interests tag <br>2b. If there is no
interest tag, populate with every tag</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Adding Friends</strong></td>
<td>Allows users to send, accept, or reject friend requests.</td>
<td>Need</td>
<td><strong>Basic Flow:</strong><br><br>1.User searches for a friend
(ex: after meeting them at an event)<br><br>2.User clicks “Add
Friend”<br><br>3.Friend request is sent<br><br>4.Other user receives the
request<br><br>5.Other user accepts the request<br><br>6.Both users are
added to each other’s friends list<br><br><strong>Alternative
Flow:</strong><br><br>1.User receives a friend request<br><br>2.User
views the request<br><br>3.User declines the request<br><br>4.If
declined → no connection is made<br><br><strong>Exception
Flow:</strong><br><br>1.User tries to send a friend
request<br><br>2.Target user has blocked them or has privacy settings
enabled<br><br>3.Request cannot be sent<br><br>4.App shows error or
restriction message</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Event Creation (events can include multiple
interests)</strong></td>
<td>Allows users to create meetup events tied to one or more interests,
including event details like location and time.</td>
<td>Need</td>
<td><strong>Basic Flow</strong>:<br><br>1. User clicks create
event<br><br>2. User fills in details regarding the event (Name of
Event, Date Range, Description, Location)<br><br>3 User publishes event,
labeled as “User Created Event”<br><br><strong>Alternative
Flow</strong>:<br><br>1. User creates an event<br><br>2. There is
another event happening same time and place<br><br>3. The app lets the
user know as a pop up warning<br><br>4. User can then choose to publish
event<br><br><strong>Exception Flow</strong>:<br><br>1. User clicks
create event<br><br>2. User tries to create an event that is already app
created<br><br>3. User cannot publish event</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>App Created Event</strong></td>
<td>App will also listed its own events based on the potential event
posted on the internet</td>
<td>Want</td>
<td><strong>Basic Flow: <br></strong>1. Server scrape potential
information for an event from the web ( (Name of Event, Date Range,
Description, Location)<br><br>2. Once the server can compose an event
with all of the relevant information, it will send the event details to
the app. <br>3. App will publish the event, labeled as “App Created
Event” <br><strong>Exception Flow: <br></strong>1a. Web scrapper failed
to get a connection <br>1b. Web scrapper failed to obtain meaningful
details from a website <br>2a. There isn’t enough detail regarding the
event</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Direct Messaging / Chat</strong></td>
<td>Allows connected users to message each other to plan meetups or
continue conversations.</td>
<td>Want</td>
<td><strong>Basic Flow:</strong><br><br>1.User opens the chat or
messages tab<br><br>2.User selects an existing conversation or starts a
new one<br><br>3.User types a message<br><br>4.User sends the
message<br><br>5.Message is delivered and appears in the chat
thread<br><br><strong>Alternative Flow:</strong><br><br>1.User opens an
event<br><br>2.User joins or views the event group chat<br><br>3.User
sends a message to the group<br><br><strong>Exception
Flow:</strong><br><br>1. User tries to message someone<br><br>2.The user
is blocked or not connected<br><br>3.Message cannot be sent<br><br>4.App
shows error or restriction message</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Block Users</strong></td>
<td>Allows user to block another users from engaging with their profile,
(maybe hide location of user from blocked profiled)</td>
<td>Want</td>
<td><strong>Basic Flow:</strong> <br>1. User select the profile of the
person of interest <br>2. User press the block button on their profile
<br>3. User confirm the block prompt, which will communicate what
happens to the block profile <br>4. Blocked profile can no longer
interact or see the location of the user</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Group Chat Creation</strong></td>
<td>Allows users to create group chats for event attendees or groups
with shared interests.</td>
<td>Want</td>
<td><strong>Basic Flow:</strong> <br>1. User select the “Create new
group chat” option <br>2. User select the profile to add to group chat
<br>3. Group chat created. <br>4. An invitation is sent to the profile
the user added <br>5. Profile accepted the request to join group
chat<br><br><strong>Alternative Flow: <br></strong>2a. The profile could
be from event attendees <br>2b. The profile could be from profile of
shared interests <br><strong>Exception Flow:</strong> <br>5a. Profile
does not accept the invitation, thus they are not added to the group
chat,</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
<tr>
<td>Feature</td>
<td><strong>Notifications</strong></td>
<td>Sends alerts when a nearby user with shared interests is found, when
a friend request is received, or when an event is updated.</td>
<td>Nice to have</td>
<td><strong>Basic Flow:</strong> <br>1. App sends an in-app
alert/notification to user <br>2. User could click on the alert and it
would take the user to the tab of interest<br><br>2a. Shared interest
found → pull up map → zoom into the node of the person <br>2b. Friend
request received → pull up friend tab <br>2c. Event updated → zoom into
the node of the event <br><strong>Alternate Flow:</strong> <br>1a. App
sends a push alert/notification instead <br><strong>Exception
Flow:</strong> <br>1a. User disable app notification, which won’t allow
the app to send push notification</td>
</tr>
<tr>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
<td>—</td>
</tr>
</tbody>
</table>

## Sketches

![UI Draft](/assets/img/UI-Draft.png)

## Related Planning Documents

[*IN4MATX 43 Group
Project*](https://docs.google.com/document/d/1jP7haC1kw6HrnTifW8Fq7SEJSep1RhYTCWID5rlrvcQ/edit?usp=sharing)

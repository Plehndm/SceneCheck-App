// Mock data for SceneCheck. Ported from src/data.jsx (typed). Used in
// mock-mode (no Supabase configured) and as test fixtures.

import type {
  Account, SCEvent, PastEvent, Review, Chat, Message, Interest,
  FriendRequest, Draft,
} from '@/types/domain';

export const SC_ME: Account = {
  id: 'me',
  type: 'person',
  name: 'Alex Rivera',
  username: 'alexr',
  age: 22,
  bio: "Informatics @ UCI. Always looking for a pickup ride or a 6am coffee. Group 10 forever.",
  interests: ['uci', 'informatics', 'group10', 'biking', 'coffee', 'climbing', 'running', 'study', 'board-games'],
  rating: 4.7,
  events_hosted: 3,
  events_attended: 12,
  city: 'Irvine, CA',
  picture: null,
  privacy: 'public',
};

export const SC_MY_ACCOUNTS: Account[] = [
  { id: 'me', type: 'person', name: 'Alex Rivera', handle: '@alexr', followers: 48, picture: null,
    bio: "Informatics @ UCI. Always looking for a pickup ride or a 6am coffee.",
    interests: ['uci', 'informatics', 'group10', 'biking'], privacy: 'public' },
  { id: 'org1', type: 'org', name: 'UCI Cycling Club', handle: '@ucicycling', followers: 1142, picture: null,
    bio: "Saturday rides, weeknight commutes, and the occasional century. All paces welcome.",
    interests: ['biking', 'running', 'uci'], privacy: 'public' },
  { id: 'org2', type: 'org', name: 'Informatics Council', handle: '@informaticsuci', followers: 612, picture: null,
    bio: "Student org for UCI Informatics. Project nights, study sessions, and the weekly board game social.",
    interests: ['informatics', 'study', 'uci'], privacy: 'public' },
  { id: 'org3', type: 'org', name: 'IN4MATX 43 — Group 10', handle: '@scenecheck', followers: 23, picture: null,
    bio: "Working group for IN4MATX 43, building SceneCheck. Open critique sessions every Wednesday.",
    interests: ['informatics', 'group10'], privacy: 'private' },
];

export const SC_ORGS: Account[] = [
  { id: 'orgA', type: 'org', name: 'TopOut Climbing', handle: '@topoutirvine', followers: 2840, picture: null,
    bio: "Bouldering + ropes in Irvine. Beginner nights every Friday.", interests: ['climbing', 'bouldering'], privacy: 'public' },
  { id: 'orgB', type: 'org', name: 'UCI Cooking Club', handle: '@ucicooks', followers: 412, picture: null,
    bio: "We cook, we eat, we wash dishes together. Mesa Court Kitchen, weekly.", interests: ['cooking', 'uci'], privacy: 'public' },
  { id: 'orgC', type: 'org', name: 'Common Room Coffee', handle: '@commonroom', followers: 1290, picture: null,
    bio: "Cafe + open-mic venue. Acoustic Thursdays, latte art Saturdays.", interests: ['coffee', 'music'], privacy: 'public' },
  { id: 'orgD', type: 'org', name: 'Anteater Run Club', handle: '@anteaterrun', followers: 198, picture: null,
    bio: "Group runs from the Aldrich flagpole, Tuesday 6pm. Couch-to-5K cohort starts each quarter.", interests: ['running', 'uci'], privacy: 'public' },
];

export const SC_PEOPLE: Account[] = [
  { id: 'p1', type: 'person', name: 'Maya Chen', username: 'mayac', age: 21, dist: 0.3, mutual: 4, color1: '#FF8A65', color2: '#FF5B47', interests: ['biking', 'coffee', 'design'], bio: "Industrial design senior. I bring extra helmets to morning rides.", privacy: 'public', picture: null },
  { id: 'p2', type: 'person', name: 'Jordan Park', username: 'jp_park', age: 24, dist: 0.5, mutual: 2, color1: '#A4C8FF', color2: '#2E7BFF', interests: ['climbing', 'informatics', 'running'], bio: "Climbing route-setter at TopOut. Trying to learn Rust on the side.", privacy: 'private', picture: null },
  { id: 'p3', type: 'person', name: 'Sasha Williams', username: 'sashaw', age: 20, dist: 0.7, mutual: 6, color1: '#F7C873', color2: '#E08A2E', interests: ['cooking', 'board-games', 'uci'], bio: "Cooking club president. I will feed you. I will also crush you at Catan.", privacy: 'public', picture: null },
  { id: 'p4', type: 'person', name: 'Theo Nakamura', username: 'theonk', age: 23, dist: 1.1, mutual: 1, color1: '#B6E3C9', color2: '#2BB673', interests: ['running', 'golf', 'informatics'], bio: "Long runs, longer playlists. CS grad. Currently obsessed with golf.", privacy: 'private', picture: null },
  { id: 'p5', type: 'person', name: 'Priya Iyer', username: 'priya.i', age: 22, dist: 1.4, mutual: 3, color1: '#E0B8FF', color2: '#8A4FD0', interests: ['music', 'study', 'informatics'], bio: "Carnatic violinist + study group regular. Trade me for snacks.", privacy: 'public', picture: null },
  { id: 'p6', type: 'person', name: 'Marco Rossi', username: 'rossi_m', age: 25, dist: 1.8, mutual: 0, color1: '#FFB199', color2: '#FF5B47', interests: ['biking', 'coffee', 'climbing'], bio: "New to Irvine. Looking for a Saturday riding group with chill vibes.", privacy: 'public', picture: null, blockedYou: true },
];

export const SC_FRIEND_REQUESTS: FriendRequest[] = [
  { id: 'fr1', personId: 'p4', when: '2h ago', note: "saw you at the Tuesday run — let's link up" },
  { id: 'fr2', personId: 'p6', when: 'yesterday', note: null },
];

export const SC_INTERESTS_SUGGESTED: Interest[] = [
  { tag: 'biking', others: 174, desc: "Biking is the human-powered, pedal-driven act of riding a bicycle for transport, recreation, exercise, or sport. It is a popular, low-impact activity offering significant cardiovascular fitness and mental health benefits.", similar: ['cycling', 'running', 'spin'] },
  { tag: 'cooking', others: 32, desc: "Cooking is the art and science of preparing food using heat, technique, and ingredients. From quick weeknight pasta to multi-day fermentation projects — share recipes, swap kitchens, and host tasting nights.", similar: ['baking', 'dinner-club', 'knife-skills'] },
  { tag: 'golf', others: 2, desc: "Golf is a club-and-ball sport played on a course of (usually) 18 holes. It rewards patience, precision, and a willingness to drive 40 minutes for a tee time. Beginners welcome.", similar: ['driving-range', 'minigolf', 'disc-golf'] },
  { tag: 'climbing', others: 88, desc: "Climbing is the activity of ascending walls, boulders, or routes using grip, balance, and friction. Indoor bouldering is the easiest entry point — most local gyms run beginner nights.", similar: ['bouldering', 'hiking', 'yoga'] },
  { tag: 'study', others: 412, desc: "Study sessions are timed, focused work blocks — solo or in groups. SceneCheck pairs you with study partners by class, major, or pomodoro cadence.", similar: ['library', 'flashcards', 'note-taking'] },
  { tag: 'coffee', others: 256, desc: "Coffee meetups are short, low-stakes gatherings at a cafe. The default move when you meet someone new and want to learn more without committing a whole evening.", similar: ['tea', 'breakfast', 'study'] },
];

export const SC_INTERESTS_DETAILS: Record<string, Interest> = Object.fromEntries(
  SC_INTERESTS_SUGGESTED.map(i => [i.tag, i])
);
SC_INTERESTS_DETAILS['uci'] = { tag: 'uci', others: 18403, desc: "University of California, Irvine. The campus tag covers anything happening at or organized through UCI — clubs, classes, study groups, intramural sports.", similar: ['anteaters', 'uci-clubs'] };
SC_INTERESTS_DETAILS['informatics'] = { tag: 'informatics', others: 612, desc: "The study of how people interact with information and technology. UCI's Informatics program runs project nights, capstone showcases, and a weekly board game session.", similar: ['hci', 'ux', 'cs'] };
SC_INTERESTS_DETAILS['group10'] = { tag: 'group10', others: 5, desc: "Private tag for IN4MATX 43 Group 10. SceneCheck team meetups, working sessions, and the occasional boba run.", similar: ['in4matx-43'] };
SC_INTERESTS_DETAILS['running'] = { tag: 'running', others: 198, desc: "Running covers everything from couch-to-5K to ultras. Weekly group runs leave from the Aldrich Park flagpole on Tuesdays at 6pm.", similar: ['jogging', '5k', 'trail-running'] };
SC_INTERESTS_DETAILS['cycling'] = SC_INTERESTS_DETAILS['biking'];

export const SC_EVENTS: SCEvent[] = [
  { id: 'e1', kind: 'yours', hostId: 'me', title: 'Morning Ride — Back Bay loop', host: 'You', interests: ['biking', 'uci'], when: 'Sat May 9 · 7:00 AM', endTime: '9:00 AM', where: 'Anteater Plaza → Back Bay', attendees: 6, cap: 12, rating: 4.8, x: 0.34, y: 0.42, desc: "Easy 14-mile loop around the Back Bay trail. Casual pace. Bring water. Coffee at Common Room after." },
  { id: 'e9', kind: 'recommended', hostId: 'orgA', title: 'Saturday Sunrise Yoga', host: 'Mind & Movement', interests: ['yoga', 'uci'], when: 'Sat May 9 · 8:00 AM', endTime: '9:00 AM', where: 'Aldrich Park lawn', attendees: 11, cap: 30, rating: 4.8, x: 0.48, y: 0.46, desc: "Posted by @mindmovement. 60-minute all-levels flow on the lawn. Bring a mat — we have a few spares." },
  { id: 'e2', kind: 'friend', hostId: 'p3', title: 'Cooking Club: Dumpling Night', host: 'Sasha W.', interests: ['cooking', 'uci'], when: 'Sat May 9 · 6:30 PM', endTime: '9:00 PM', where: 'Mesa Court Kitchen', attendees: 14, cap: 16, rating: 4.6, x: 0.58, y: 0.30, desc: "We fold, we steam, we eat. $5 to cover ingredients. All skill levels — Sasha will demo the pleat." },
  { id: 'e3', kind: 'friend', hostId: 'p2', title: 'Climbing — Beginner Night', host: 'Jordan P.', interests: ['climbing'], when: 'Fri May 8 · 7:00 PM', endTime: '9:30 PM', where: 'TopOut Irvine', attendees: 9, cap: 20, rating: 4.4, x: 0.18, y: 0.62, desc: "First-timers welcome. Jordan will show you the basics; rentals included with day pass." },
  { id: 'e7', kind: 'recommended', hostId: 'orgA', title: 'Beginner Bouldering Night', host: 'TopOut Climbing', interests: ['climbing'], when: 'Fri May 8 · 7:30 PM', endTime: '10:00 PM', where: 'TopOut Irvine', attendees: 28, cap: 40, rating: 4.7, x: 0.20, y: 0.66, desc: "Posted by @topoutirvine — followers got notified. Free top-rope intro. Day pass + rentals $18." },
  { id: 'e8', kind: 'recommended', hostId: 'orgD', title: 'Tuesday Group Run · 5K', host: 'Anteater Run Club', interests: ['running', 'uci'], when: 'Tue May 12 · 6:00 PM', endTime: '7:30 PM', where: 'Aldrich Park flagpole', attendees: 17, cap: 50, rating: 4.6, x: 0.50, y: 0.42, desc: "Posted by @anteaterrun. Couch-to-5K pace group + open pace group. Stretch + boba after." },
  { id: 'e4', kind: 'recommended', hostId: null, title: 'Pickup Soccer @ Aldrich', host: 'App-created', interests: ['running', 'uci'], when: 'Wed May 6 · 5:00 PM', endTime: '7:00 PM', where: 'Aldrich Park East Field', attendees: 22, cap: 30, rating: null, x: 0.46, y: 0.55, desc: "Open pickup, 5v5 rotating. Cleats not required. Pulled from the UCI Rec calendar.", sourceUrl: 'https://rec.uci.edu/events/pickup-soccer' },
  { id: 'e5', kind: 'recommended', hostId: null, title: 'Open Mic — Common Room', host: 'App-created', interests: ['music'], when: 'Thu May 7 · 8:00 PM', endTime: '10:30 PM', where: 'Common Room Coffee', attendees: 11, cap: 25, rating: null, x: 0.74, y: 0.50, desc: "Acoustic, poetry, comedy — all welcome. Sign-ups at the door from 7:30." },
  { id: 'e6', kind: 'recommended', hostId: null, title: 'Study Block: Finals Week', host: 'App-created', interests: ['study', 'informatics'], when: 'Mon May 11 · 1:00 PM', endTime: '5:00 PM', where: 'Langson Library, 4F', attendees: 38, cap: 60, rating: null, x: 0.62, y: 0.72, desc: "Quiet pomodoros, 50/10 cycles. Bring your own laptop and snacks. Run by the Informatics Student Council." },
];

export const SC_EVENT_BY_ID: Record<string, SCEvent> = Object.fromEntries(
  SC_EVENTS.map(e => [e.id, e])
);

export const SC_DRAFTS_SEED: Draft[] = [
  {
    id: 'd_seed1',
    savedAt: 'Yesterday · 8:42 PM',
    lastStep: 2,
    form: {
      title: 'Sunday Spin — Newport Coast',
      desc: '20-mile rolling loop along Newport Coast. Moderate pace — stretch goal to hit 18mph average. Coffee + bagels after at Common Room.',
      date: 'Sun May 17', timeStart: '7:30 AM', timeEnd: '11:00 AM',
      location: 'Anteater Plaza → Newport Coast', cap: 10,
      interests: ['biking', 'uci'], visibility: 'public',
      minSubs: 2, addToCalendar: true, autoGroupChat: true,
    },
  },
  {
    id: 'd_seed2', savedAt: '3 days ago', lastStep: 0,
    form: {
      title: 'Finals Week Study Block', desc: '',
      date: 'Tue May 19', timeStart: '10:00 AM', timeEnd: '12:00 PM',
      location: '', cap: 20,
      interests: ['study', 'informatics'], visibility: 'public',
      minSubs: 4, addToCalendar: false, autoGroupChat: true,
    },
  },
];

export const SC_PAST_EVENTS: PastEvent[] = [
  { id: 'pe1', hostId: 'me', title: 'Sunday Spin — Newport Coast', when: 'Apr 26', interests: ['biking'] },
  { id: 'pe2', hostId: 'me', title: 'Anteater 5K Recovery Ride', when: 'Apr 19', interests: ['biking', 'uci'] },
  { id: 'pe3', hostId: 'me', title: 'Sunrise Loop — Quail Hill', when: 'Apr 12', interests: ['biking'] },
  { id: 'pe4', hostId: 'p3', title: 'Cooking Club: Hand-pulled Noodles', when: 'Apr 25', interests: ['cooking', 'uci'] },
  { id: 'pe5', hostId: 'p3', title: 'Cooking Club: Korean BBQ Night', when: 'Apr 11', interests: ['cooking'] },
  { id: 'pe6', hostId: 'p2', title: 'Climbing: Outdoor at Joshua Tree', when: 'Apr 5', interests: ['climbing'] },
  { id: 'pe7', hostId: 'p2', title: 'Climbing: Intermediate Routes', when: 'Mar 28', interests: ['climbing'] },
  { id: 'pe8', hostId: 'p1', title: 'Saturday Coffee Crawl — Newport', when: 'Apr 20', interests: ['coffee'] },
  { id: 'pe9', hostId: 'p1', title: 'Design Studio Open House', when: 'Apr 6', interests: ['design'] },
  { id: 'pe10', hostId: 'p4', title: 'Tuesday Track Workout', when: 'Apr 22', interests: ['running', 'uci'] },
  { id: 'pe11', hostId: 'p4', title: 'Long Run — Back Bay', when: 'Apr 15', interests: ['running'] },
  { id: 'pe12', hostId: 'p5', title: 'Carnatic Music Listening Hour', when: 'Apr 18', interests: ['music'] },
  { id: 'pe13', hostId: 'p5', title: 'Study Group: HCI Midterm Review', when: 'Apr 4', interests: ['study', 'informatics'] },
  { id: 'pe14', hostId: 'orgA', title: 'Topout: Spring Send Comp', when: 'Apr 30', interests: ['climbing'] },
  { id: 'pe15', hostId: 'orgD', title: 'Anteater Half Marathon Training', when: 'Apr 14', interests: ['running', 'uci'] },
];

export const SC_ANY_EVENT_BY_ID: Record<string, SCEvent | PastEvent> = Object.fromEntries(
  [...SC_EVENTS, ...SC_PAST_EVENTS].map(e => [e.id, e])
);

export const SC_REVIEWS: Review[] = [
  { id: 'r01', eventId: 'e1', hostId: 'me', reviewerId: 'p3', rating: 5, when: 'last Saturday', text: "chill pace, great regroup at the bridge, alex actually checked in on everyone. easiest 14 miles I've done." },
  { id: 'r02', eventId: 'e1', hostId: 'me', reviewerId: 'p1', rating: 5, when: 'last Saturday', text: "coffee stop made it. would join again." },
  { id: 'r03', eventId: 'pe1', hostId: 'me', reviewerId: 'p4', rating: 4, when: 'Apr 27', text: "newport coast is brutal but alex paced it well. start was a touch chaotic — maybe stagger the group next time." },
  { id: 'r04', eventId: 'pe1', hostId: 'me', reviewerId: 'p2', rating: 5, when: 'Apr 27', text: "sweep rider all the way. nobody got dropped. 10/10." },
  { id: 'r05', eventId: 'pe2', hostId: 'me', reviewerId: 'p1', rating: 4, when: 'Apr 20', text: "recovery pace was real. thanks for not turning it into a hammerfest." },
  { id: 'r06', eventId: 'pe3', hostId: 'me', reviewerId: 'p5', rating: 3, when: 'Apr 13', text: "6am is 6am. ride was fine. would prefer a 7am start." },
  { id: 'r07', eventId: 'e2', hostId: 'p3', reviewerId: 'p1', rating: 5, when: 'Apr 24', text: "sasha is a teaching natural. the pleating tutorial alone was worth it." },
  { id: 'r08', eventId: 'e2', hostId: 'p3', reviewerId: 'p5', rating: 5, when: 'Apr 24', text: "left full + with leftovers. somehow under budget." },
  { id: 'r09', eventId: 'pe4', hostId: 'p3', reviewerId: 'me', rating: 5, when: 'Apr 26', text: "hand-pulled noodles is HARD. sasha made it look easy and patient. amazing." },
  { id: 'r10', eventId: 'pe4', hostId: 'p3', reviewerId: 'p2', rating: 4, when: 'Apr 26', text: "great event. kitchen got a little cramped — maybe cap at 12 next time." },
  { id: 'r11', eventId: 'pe5', hostId: 'p3', reviewerId: 'p4', rating: 2, when: 'Apr 12', text: "the food was great but it ran 90 min over and parking at mesa was a nightmare." },
  { id: 'r12', eventId: 'e3', hostId: 'p2', reviewerId: 'p3', rating: 5, when: 'Apr 18', text: "jordan walked the first-timers through every move. unintimidating. perfect intro." },
  { id: 'r13', eventId: 'e3', hostId: 'p2', reviewerId: 'p5', rating: 4, when: 'Apr 18', text: "loved it. shoes felt huge on me — heads up that the gym only has half sizes." },
  { id: 'r14', eventId: 'pe6', hostId: 'p2', reviewerId: 'me', rating: 5, when: 'Apr 6', text: "first outdoor climb of my life. jordan set up safe top-ropes and explained every knot. unreal day." },
  { id: 'r15', eventId: 'pe7', hostId: 'p2', reviewerId: 'p4', rating: 3, when: 'Mar 29', text: "good routes but the group was way more advanced than i expected. should mark 'intermediate' more clearly." },
  { id: 'r16', eventId: 'pe8', hostId: 'p1', reviewerId: 'me', rating: 5, when: 'Apr 21', text: "4 cafes in 3 hours and i still want more. maya's route was perfect — bonus that she knew the baristas." },
  { id: 'r17', eventId: 'pe8', hostId: 'p1', reviewerId: 'p3', rating: 4, when: 'Apr 21', text: "loved this. 4th stop felt like one too many — but no notes otherwise." },
  { id: 'r18', eventId: 'pe9', hostId: 'p1', reviewerId: 'p5', rating: 5, when: 'Apr 7', text: "saw maya's senior thesis in person. friendly, thoughtful host, fed us snacks." },
  { id: 'r19', eventId: 'pe10', hostId: 'p4', reviewerId: 'me', rating: 4, when: 'Apr 23', text: "theo's track workouts are no-nonsense. clear pacing, good warmup." },
  { id: 'r20', eventId: 'pe10', hostId: 'p4', reviewerId: 'p1', rating: 3, when: 'Apr 23', text: "showed up at 5:58, theo was already on lap 2. would appreciate a 5 min warmup window." },
  { id: 'r21', eventId: 'pe11', hostId: 'p4', reviewerId: 'p2', rating: 5, when: 'Apr 16', text: "theo paced the whole 12mi with me. genuine human." },
  { id: 'r22', eventId: 'pe12', hostId: 'p5', reviewerId: 'p1', rating: 5, when: 'Apr 19', text: "priya curated a beautiful listening set. learned a lot about carnatic structure." },
  { id: 'r23', eventId: 'pe13', hostId: 'p5', reviewerId: 'me', rating: 4, when: 'Apr 5', text: "great study group. priya kept it on track. one off-topic discussion went long." },
  { id: 'r24', eventId: 'e7', hostId: 'orgA', reviewerId: 'p2', rating: 5, when: 'last Friday', text: "staff are pros. routes set thoughtfully for beginners. day pass is a steal at $18." },
  { id: 'r25', eventId: 'e7', hostId: 'orgA', reviewerId: 'p3', rating: 4, when: 'last Friday', text: "loved the night. wait for the top-rope station was long around 8pm." },
  { id: 'r26', eventId: 'pe14', hostId: 'orgA', reviewerId: 'p1', rating: 5, when: 'May 1', text: "comp was a vibe. live commentary, real prizes, fair grading." },
  { id: 'r27', eventId: 'e8', hostId: 'orgD', reviewerId: 'p4', rating: 5, when: 'May 6', text: "both pace groups got real attention. boba after was a nice touch." },
  { id: 'r28', eventId: 'pe15', hostId: 'orgD', reviewerId: 'p5', rating: 4, when: 'Apr 15', text: "the training plan is solid. could use a slow pace group for c25k folks." },
  { id: 'r29', eventId: 'pe15', hostId: 'orgD', reviewerId: 'me', rating: 5, when: 'Apr 15', text: "showed up nervous, left signed up for the half. coaches really know what they're doing." },
];

export const SC_CHATS: Chat[] = [
  { id: 'c1', kind: 'event', eventId: 'e1', title: 'Morning Ride — Back Bay', last: 'Sasha: in! bringing extra tubes 🛞', time: '2m', unread: 2 },
  { id: 'c2', kind: 'dm', personId: 'p1', last: 'Maya: see you at the flagpole', time: '14m', unread: 0 },
  { id: 'c3', kind: 'event', eventId: 'e2', title: 'Dumpling Night', last: 'Sasha: pleating tutorial sent ↑', time: '1h', unread: 0 },
  { id: 'c4', kind: 'dm', personId: 'p3', last: 'Sasha: catan rematch?', time: '3h', unread: 1 },
  { id: 'c5', kind: 'event', eventId: 'e3', title: 'Climbing Beginner Night', last: 'Jordan: rentals are $8', time: '1d', unread: 0 },
  { id: 'c6', kind: 'dm', personId: 'p2', last: 'You: let me check my schedule', time: '2d', unread: 0 },
];

const SC_THREAD_E1: Message[] = [
  { from: 'host', who: 'You', text: "Posted! 7am at Anteater Plaza, easy 14mi pace.", time: 'Wed' },
  { from: 'them', who: 'Sasha W.', text: "in! bringing extra tubes 🛞", time: 'Wed' },
  { from: 'them', who: 'Maya C.', text: "can we add a coffee stop at Common Room after?", time: 'Thu' },
  { from: 'host', who: 'You', text: "yes, locked in. last 30 min is mostly downhill so we earn it.", time: 'Thu' },
  { from: 'them', who: 'Marco R.', text: "first time on this loop — anything I should know?", time: 'Fri' },
  { from: 'host', who: 'You', text: "bring water + a spare tube. we regroup at the bridge.", time: 'Fri' },
];

export const SC_THREADS: Record<string, Message[]> = {
  c1: SC_THREAD_E1,
  c2: [
    { from: 'them', who: 'Maya C.', text: "hey! still up for the Tuesday run?", time: 'Mon' },
    { from: 'host', who: 'You', text: "yes — flagpole at 6?", time: 'Mon' },
    { from: 'them', who: 'Maya C.', text: "perfect. I'll bring the playlist.", time: 'Tue' },
    { from: 'host', who: 'You', text: "deal. no sad bangers this time pls", time: 'Tue' },
    { from: 'them', who: 'Maya C.', text: "see you at the flagpole", time: '14m' },
  ],
  c3: [
    { from: 'them', who: 'Sasha W.', text: "dumpling night locked for sat 6:30 — mesa court kitchen", time: 'Wed' },
    { from: 'host', who: 'You', text: "i'll bring soy + black vinegar", time: 'Wed' },
    { from: 'them', who: 'Priya I.', text: "can someone grab napa cabbage?", time: 'Thu' },
    { from: 'them', who: 'Sasha W.', text: "on it — also pleating tutorial sent ↑", time: '1h' },
  ],
  c4: [
    { from: 'host', who: 'You', text: "that catan game was rigged", time: 'Wed' },
    { from: 'them', who: 'Sasha W.', text: "you had longest road for 3 turns. cope.", time: 'Wed' },
    { from: 'them', who: 'Sasha W.', text: "catan rematch?", time: '3h' },
  ],
  c5: [
    { from: 'them', who: 'Jordan P.', text: "climbing fri 7pm @ TopOut. beginner-friendly route set", time: 'Mon' },
    { from: 'host', who: 'You', text: "do they have rentals? haven't bought shoes yet", time: 'Tue' },
    { from: 'them', who: 'Jordan P.', text: "rentals are $8", time: '1d' },
  ],
  c6: [
    { from: 'them', who: 'Jordan P.', text: "there's a sunday morning bouldering session if you want to try", time: 'Sat' },
    { from: 'host', who: 'You', text: "let me check my schedule", time: '2d' },
  ],
};

export const SC_ACCOUNT_BY_ID: Record<string, Account> = Object.fromEntries(
  [...SC_MY_ACCOUNTS, ...SC_ORGS, ...SC_PEOPLE].map(a => [a.id, a])
);

// Excludes blockers; canonical list for any "people from your perspective" surface.
export const SC_VISIBLE_PEOPLE: Account[] = SC_PEOPLE.filter(p => !p.blockedYou);
export const SC_VISIBLE_PERSON_BY_ID: Record<string, Account> = Object.fromEntries(
  SC_VISIBLE_PEOPLE.map(p => [p.id, p])
);

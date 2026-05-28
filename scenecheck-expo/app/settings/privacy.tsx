// Settings → Privacy policy. In-app privacy text that reflects what the
// app ACTUALLY collects, where it stores it, and who can see it. The
// Help screen used to link out to https://scenecheck.app/privacy, but
// that domain isn't owned by this project — it shows an unrelated demo
// site. This screen replaces the external link so users see accurate
// information about the SceneCheck app they're using.

import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCTopBar } from '@/components/SCTopBar';
import { useTokens } from '@/theme/ThemeProvider';

export default function PrivacyScreen() {
  const t = useTokens();

  return (
    <Screen scroll={false}>
      <SCTopBar onBack={() => router.back()} />

      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="labelCap" color={t.ink3}>SETTINGS</SCText>
        <SCText variant="displayTight" size={28} style={{ marginTop: 4 }}>
          Privacy policy
        </SCText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 32, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        <SCCard style={{ padding: 16, gap: 6 }}>
          <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
            SceneCheck is a course project for IN4MATX 43 at UC Irvine — a
            mobile app for discovering and joining local interest-based
            events. This page explains what data we collect, where it
            lives, and the controls you have over it.
          </SCText>
        </SCCard>

        <Section title="What we collect" t={t}>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Account: </SCText>
              email, password, display name, account type
              (Individual or Organization), and birthdate (we use it
              once to verify you&apos;re 18+).
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Profile: </SCText>
              optional bio, profile picture, visibility setting
              (public or friends-only), and the interests you subscribe
              to.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Events: </SCText>
              events you create, subscribe to, or are placed on the
              waitlist for, plus any organizations you follow.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Social: </SCText>
              friend connections, group-chat memberships, direct
              messages, and ratings you leave on events you attended.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Location: </SCText>
              when you grant permission, your approximate coordinates
              power the live map and filter event discovery by
              distance. Your exact location is never shown to other
              users.
            </SCText>
          </Bullet>
        </Section>

        <Section title="Where it lives" t={t}>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Supabase: </SCText>
              the primary backend — Postgres for accounts, profiles,
              events, chats; Auth for sign-in; Realtime for live chat
              updates; Storage for profile pictures.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Expo Push (APNs / FCM): </SCText>
              the push-notification fan-out for friend requests,
              event updates, and proximity alerts. Your device push
              token is registered with Expo so we can target your
              device.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Google Calendar: </SCText>
              only if you explicitly link your Google account from
              Settings → Linked calendar. Events you opt to add are
              written to your primary calendar. We never read your
              calendar back.
            </SCText>
          </Bullet>
        </Section>

        <Section title="Who can see what" t={t}>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              Public profiles are visible to any signed-in SceneCheck
              user. Private profiles are visible only to accepted
              friends.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              Users you block cannot view your profile, send you
              requests, or message you.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              Direct-message contents are visible only to the
              participants of the chat. Event group-chat messages are
              visible only to confirmed attendees of that event. Both
              are enforced by database-level row-level-security
              policies, not just by the app UI.
            </SCText>
          </Bullet>
        </Section>

        <Section title="Your controls" t={t}>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Visibility: </SCText>
              Settings → Visibility toggles your profile between
              public and friends-only.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Notifications: </SCText>
              Settings → Notifications turns categories on and off.
              You can also disable push at the OS level.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Linked calendar: </SCText>
              Settings → Linked calendar lets you connect or
              disconnect Google Calendar at any time.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Blocked users: </SCText>
              Settings → Blocked lists everyone you&apos;ve blocked,
              with one-tap unblock.
            </SCText>
          </Bullet>
          <Bullet t={t}>
            <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
              <SCText size={13} weight="600">Delete account: </SCText>
              Settings → Delete account removes your profile,
              friendships, event subscriptions, messages, and managed
              data from Supabase.
            </SCText>
          </Bullet>
        </Section>

        <Section title="Contact" t={t}>
          <SCText size={13} color={t.ink2} style={{ lineHeight: 19 }}>
            This is a student course project, not a commercial product.
            For questions or to report an issue, file a ticket on the
            project&apos;s GitHub repository.
          </SCText>
        </Section>

        <View style={{ alignItems: 'center', paddingTop: 10 }}>
          <SCText variant="mono" size={10} color={t.ink3}>
            IN4MATX 43 · UC Irvine
          </SCText>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title, children, t,
}: {
  title: string;
  children: React.ReactNode;
  t: ReturnType<typeof useTokens>;
}) {
  return (
    <SCCard style={{ padding: 16, gap: 8 }}>
      <SCText variant="labelCap" color={t.ink3}>{title}</SCText>
      {children}
    </SCCard>
  );
}

function Bullet({
  children, t,
}: {
  children: React.ReactNode;
  t: ReturnType<typeof useTokens>;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <SCText size={13} color={t.ink3} style={{ lineHeight: 19 }}>•</SCText>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

// Settings — discovery radius, visibility, appearance (palette + dark
// mode), notifications, blocked users, linked calendar, sign-out.
// Tweaks panel exposed at the bottom for dev/heuristic toggles.

import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { Screen } from '@/components/Screen';
import { SCText } from '@/components/SCText';
import { SCCard } from '@/components/SCCard';
import { SCIcon, type IconName } from '@/components/SCIcon';
import { SCSection } from '@/components/SCSection';
import { SCButton } from '@/components/SCAddButton';
import { SCTopBar } from '@/components/SCTopBar';
import { ChangeEmailSheet } from '@/components/ChangeEmailSheet';
import { ChangePasswordSheet } from '@/components/ChangePasswordSheet';
import { useStore } from '@/store/useStore';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useTokens } from '@/theme/ThemeProvider';
import { api } from '@/lib/api';
import { PALETTES, RADIUS, type PaletteName } from '@/theme/tokens';
import type { Tweaks } from '@/store/useStore';
import type { Visibility } from '@/types/domain';

const NOTIF_ROWS: { k: keyof ReturnType<typeof useStore.getState>['notifPrefs']; label: string; desc: string; icon: IconName }[] = [
  { k: 'messages', label: 'Messages', desc: 'Direct messages from friends', icon: 'chat' },
  { k: 'friendRequests', label: 'Friend requests', desc: 'When someone wants to add you', icon: 'user-plus' },
  { k: 'orgEvents', label: 'New events', desc: 'Events from orgs you follow', icon: 'calendar' },
  { k: 'eventReminders', label: 'Event reminders', desc: "Heads-up an hour before events you're going to", icon: 'bell' },
  { k: 'friendActivity', label: 'Friend activity', desc: 'When friends RSVP or post events', icon: 'people' },
  { k: 'weeklyDigest', label: 'Weekly digest', desc: 'A Sunday summary of upcoming local scenes', icon: 'mail' },
];

const TWEAK_ROWS: { k: keyof Tweaks; label: string; desc: string }[] = [
  { k: 'offline', label: 'Simulate offline', desc: 'Fail outbound network calls to demo recovery UIs.' },
  { k: 'showSkeletons', label: 'Show skeletons', desc: 'Force loading skeletons on lists for demo purposes.' },
  { k: 'preflightConflicts', label: 'Pre-flight conflicts', desc: 'Warn when joining overlapping events.' },
  { k: 'inlineSettings', label: 'Inline settings', desc: 'Show live summary chips on collapsible sections.' },
  { k: 'hostEditDelete', label: 'Host edit / delete', desc: 'Hosts can edit or cancel their events.' },
  { k: 'failureStates', label: 'Detailed failures', desc: 'Show diagnostic + retry on errors.' },
  { k: 'helpTooltips', label: 'Help tooltips', desc: 'Inline (?) tips and welcome-tour replay.' },
];

export default function SettingsScreen() {
  const t = useTokens();
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const sessionEmail = useStore(s => s.session?.email);
  const radius = useStore(s => s.radius);
  const setRadius = useStore(s => s.setRadius);
  const visibility = useStore(s => s.visibility);
  const setVisibility = useStore(s => s.setVisibility);
  const notifPrefs = useStore(s => s.notifPrefs);
  const setNotifPref = useStore(s => s.setNotifPref);
  const blocked = useStore(s => s.blocked);
  const linkedCalendar = useStore(s => s.linkedCalendar);
  const tweaks = useStore(s => s.tweaks);
  const setTweak = useStore(s => s.setTweak);
  const palette = useStore(s => s.palette);
  const setPalette = useStore(s => s.setPalette);
  const mode = useStore(s => s.mode);
  const setMode = useStore(s => s.setMode);
  const showConfirm = useStore(s => s.showConfirm);
  const showToast = useStore(s => s.showToast);
  const clearDrafts = useStore(s => s.clearDrafts);

  // Live incoming-request count (matches the /requests screen) instead of a
  // store-set snapshot, so the "waiting on your approval" hint stays accurate.
  const { requests: incomingReqs } = useFriendRequests();
  const requestCount = incomingReqs.length;
  const calLabel = linkedCalendar
    ? linkedCalendar.charAt(0).toUpperCase() + linkedCalendar.slice(1)
    : 'None';

  const handleSignOut = () => {
    showConfirm({
      title: 'Sign out?',
      body: 'You can sign back in any time.',
      confirmLabel: 'SIGN OUT',
      tone: 'danger',
      icon: 'logout',
      onConfirm: async () => {
        try {
          // In live mode this clears the Supabase session + storage; the
          // AuthBootstrap listener resets `me` to SC_ME on the SIGNED_OUT
          // event. In mock mode signOut is a no-op.
          await api.signOut();
          showToast({
            message: api.isMock() ? 'Signed out (mock).' : 'Signed out.',
            kind: 'info',
          });
          router.replace('/auth/sign-in' as never);
        } catch (e) {
          showToast({
            message: e instanceof Error ? e.message : 'Sign-out failed.',
            kind: 'error',
          });
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    showConfirm({
      title: 'Delete account?',
      body: "Your profile, interests, connections, and saved drafts are removed. Events you created and reviews you left stay — reassigned to “[deleted user]” so they remain part of other people's history. This can't be undone.",
      confirmLabel: 'DELETE ACCOUNT',
      cancelLabel: 'KEEP ACCOUNT',
      tone: 'danger',
      icon: 'x',
      onConfirm: async () => {
        try {
          // Reassigns events + reviews to the "[deleted user]" placeholder,
          // deletes the profile row + auth user, then signs out. Drafts are
          // local-only, so we clear them here. AuthBootstrap resets `me` on
          // SIGNED_OUT. Mock mode is a no-op delete + no-op sign-out.
          await api.deleteAccount();
          clearDrafts();
          await api.signOut();
          showToast({ message: 'Account deleted.', kind: 'info' });
          router.replace('/auth/sign-in' as never);
        } catch (e) {
          showToast({
            message: e instanceof Error ? `Couldn't delete account: ${e.message}` : "Couldn't delete account.",
            kind: 'error',
          });
        }
      },
    });
  };

  return (
    <Screen>
      <SCTopBar onBack={() => router.back()} subtitle="ACCOUNT" />
      <View style={{ paddingHorizontal: 18, paddingBottom: 12 }}>
        <SCText variant="displayTight" size={36}>Settings</SCText>
      </View>

      {/* Account credentials — email + password */}
      <SCSection title={`ACCOUNT${sessionEmail ? ` · ${sessionEmail}` : ''}`}>
        <SCCard>
          <RowMenu
            icon="mail"
            label="Email"
            v={sessionEmail || 'Not signed in'}
            onPress={() => setEmailOpen(true)}
          />
          <RowMenu
            icon="lock"
            label="Password"
            v="••••••••"
            onPress={() => setPasswordOpen(true)}
            last
          />
        </SCCard>
      </SCSection>

      {/* Discovery radius */}
      <SCSection title={`DISCOVERY · ${radius} MI RADIUS`}>
        <SCCard style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <SCText size={14} weight="500">Discovery radius</SCText>
            <SCText variant="mono" size={13} weight="600" color={t.primary}>{radius} mi</SCText>
          </View>
          <Slider
            value={radius}
            minimumValue={0.5}
            maximumValue={50}
            step={0.5}
            minimumTrackTintColor={t.primary}
            maximumTrackTintColor={t.line}
            thumbTintColor={t.primary}
            onValueChange={setRadius}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <SCText variant="mono" size={10} color={t.ink3}>0.5 MI</SCText>
            <SCText variant="mono" size={10} color={t.ink3}>50 MI</SCText>
          </View>
          {radius >= 25 && (
            <View style={{
              marginTop: 10, padding: 10, borderRadius: 10,
              backgroundColor: t.warn + '26', borderColor: t.warn + '59', borderWidth: 1,
            }}>
              <SCText size={11} color={t.ink2} style={{ lineHeight: 16 }}>
                Heads up — at {radius} miles you&apos;ll see events across the whole region. Expect a busier feed.
              </SCText>
            </View>
          )}
        </SCCard>
      </SCSection>

      {/* Visibility */}
      <SCSection title={`PROFILE VISIBILITY · ${visibility.toUpperCase()}`}>
        <SCCard style={{ padding: 6 }}>
          {([
            { k: 'public', label: 'Public', desc: 'Anyone in your radius can find and add you', icon: 'globe' },
            { k: 'private', label: 'Private', desc: 'Approval required — people must request to add you and see your profile', icon: 'lock' },
          ] as { k: Visibility; label: string; desc: string; icon: IconName }[]).map((v, i, arr) => (
            <Pressable
              key={v.k}
              onPress={() => setVisibility(v.k)}
              style={({ pressed }) => [{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: RADIUS.md,
                backgroundColor: visibility === v.k ? t.subtle : 'transparent',
                marginBottom: i < arr.length - 1 ? 2 : 0,
              }, pressed && { opacity: 0.85 }]}
            >
              <View style={{
                width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name={v.icon} size={16} color={visibility === v.k ? t.primary : t.ink2} />
              </View>
              <View style={{ flex: 1 }}>
                <SCText size={14} weight="500">{v.label}</SCText>
                <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>{v.desc}</SCText>
              </View>
              {visibility === v.k && (
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: t.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCIcon name="check" size={12} color={t.primaryInk} />
                </View>
              )}
            </Pressable>
          ))}
        </SCCard>
        {visibility === 'private' && (
          <Pressable
            onPress={() => router.push('/requests' as never)}
            style={({ pressed }) => [{ marginTop: 8 }, pressed && { opacity: 0.9 }]}
          >
            <SCCard style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{
                width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name="user-plus" size={16} color={t.ink2} />
              </View>
              <View style={{ flex: 1 }}>
                <SCText size={14} weight="500">Follow requests</SCText>
                <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>
                  {requestCount > 0 ? `${requestCount} waiting on your approval` : 'No pending requests'}
                </SCText>
              </View>
              {requestCount > 0 && (
                <View style={{
                  minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11,
                  backgroundColor: t.primary,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <SCText variant="mono" size={11} weight="700" color={t.primaryInk}>
                    {String(requestCount)}
                  </SCText>
                </View>
              )}
              <SCIcon name="chevron-right" size={16} color={t.ink3} />
            </SCCard>
          </Pressable>
        )}
      </SCSection>

      {/* Appearance */}
      <SCSection title="APPEARANCE">
        <SCCard style={{ padding: 14, gap: 12 }}>
          <SCText variant="mono" size={11} color={t.ink3}>PALETTE</SCText>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {(Object.keys(PALETTES) as PaletteName[]).map(name => (
              <Pressable
                key={name}
                onPress={() => setPalette(name)}
                style={({ pressed }) => [{
                  paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
                  borderWidth: 1,
                  backgroundColor: palette === name ? t.ink : t.card,
                  borderColor: palette === name ? t.ink : t.line,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCText variant="mono" size={11} weight="600" color={palette === name ? 'white' : t.ink}>
                  {PALETTES[name].label.toUpperCase()}
                </SCText>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['light', 'dark'] as const).map(m => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                style={({ pressed }) => [{
                  flex: 1, padding: 12, borderRadius: RADIUS.md,
                  borderWidth: 1.5,
                  borderColor: mode === m ? t.primary : t.line,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                }, pressed && { opacity: 0.85 }]}
              >
                <SCIcon name={m === 'dark' ? 'moon' : 'sun'} size={14} color={mode === m ? t.primary : t.ink2} />
                <SCText size={14} weight={mode === m ? '600' : '500'}>
                  {m === 'dark' ? 'Dark' : 'Light'}
                </SCText>
              </Pressable>
            ))}
          </View>
        </SCCard>
      </SCSection>

      {/* Notifications */}
      <SCSection title="NOTIFICATIONS">
        <SCCard style={{ padding: 4 }}>
          {NOTIF_ROWS.map((row, i, arr) => (
            <View key={row.k} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: t.line,
            }}>
              <View style={{
                width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <SCIcon name={row.icon} size={16} color={notifPrefs[row.k] ? t.primary : t.ink3} />
              </View>
              <View style={{ flex: 1 }}>
                <SCText size={14} weight="500">{row.label}</SCText>
                <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>{row.desc}</SCText>
              </View>
              <Switch
                value={notifPrefs[row.k]}
                onValueChange={(v) => setNotifPref(row.k, v)}
                trackColor={{ false: t.line, true: t.primary }}
                thumbColor="white"
              />
            </View>
          ))}
        </SCCard>
      </SCSection>

      {/* Preferences sub-screens */}
      <SCSection title={`PREFERENCES · ${calLabel} · ${blocked.length} BLOCKED`}>
        <SCCard>
          <RowMenu icon="calendar" label="Linked calendar" v={calLabel} onPress={() => router.push('/settings/linked-calendar' as never)} />
          <RowMenu icon="shield" label="Blocked users" v={String(blocked.length)} onPress={() => router.push('/settings/blocked' as never)} />
          <RowMenu icon="help" label="Help & feedback" v="" last onPress={() => router.push('/settings/help' as never)} />
        </SCCard>
      </SCSection>

      {/* Tweaks (dev) */}
      <SCSection title="TWEAKS · DEV">
        <SCCard style={{ padding: 4 }}>
          {TWEAK_ROWS.map((row, i, arr) => (
            <View key={row.k} style={{
              flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
              borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: t.line,
            }}>
              <View style={{ flex: 1 }}>
                <SCText size={14} weight="500">{row.label}</SCText>
                <SCText size={11} color={t.ink3} style={{ marginTop: 1 }}>{row.desc}</SCText>
              </View>
              <Switch
                value={tweaks[row.k] as boolean}
                onValueChange={(v) => setTweak(row.k, v as never)}
                trackColor={{ false: t.line, true: t.primary }}
                thumbColor="white"
              />
            </View>
          ))}
        </SCCard>
      </SCSection>

      <View style={{ paddingHorizontal: 18, paddingTop: 14 }}>
        <SCButton label="Sign out" onPress={handleSignOut} variant="ghost" />
      </View>
      <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
        <Pressable
          onPress={handleDeleteAccount}
          accessibilityLabel="Delete account"
          style={({ pressed }) => [{ height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}
        >
          <SCText variant="mono" size={12} weight="700" color={t.danger}>DELETE ACCOUNT</SCText>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center' }}>
        <SCText variant="mono" size={11} color={t.ink3}>SceneCheck · v0.4.2</SCText>
      </View>

      <ChangeEmailSheet visible={emailOpen} onClose={() => setEmailOpen(false)} />
      <ChangePasswordSheet visible={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </Screen>
  );
}

interface RowMenuProps {
  icon: IconName;
  label: string;
  v: string;
  onPress: () => void;
  last?: boolean;
}

function RowMenu({ icon, label, v, onPress, last }: RowMenuProps) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: t.line,
      }, pressed && { opacity: 0.85 }]}
    >
      <View style={{
        width: 34, height: 34, borderRadius: RADIUS.md, backgroundColor: t.subtle,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name={icon} size={16} color={t.ink2} />
      </View>
      <SCText size={14} weight="500" style={{ flex: 1 }}>{label}</SCText>
      {!!v && <SCText variant="mono" size={11} color={t.ink3}>{v}</SCText>}
      <SCIcon name="chevron-right" size={14} color={t.ink3} />
    </Pressable>
  );
}

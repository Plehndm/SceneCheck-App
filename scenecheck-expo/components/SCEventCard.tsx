// Horizontal event card used in scroll rails (Home screen, event lists).
// The legacy version had `flex: '0 0 232px'` and was rendered in a
// horizontal scroll container; on RN the parent is a <ScrollView
// horizontal> and we just give it a fixed width.

import { View, Pressable } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCTag } from './SCTag';
import { ConflictChip } from './ConflictChip';
import { whenRange } from '@/lib/date-time';
import { isRecommendedFor } from '@/lib/events';
import { RADIUS } from '@/theme/tokens';
import type { SCEvent } from '@/types/domain';

interface Props {
  event: SCEvent;
  joined: boolean;
  showConflict?: boolean;
  onPress?: () => void;
  // Your subscribed interests — decides whether a scraped/app-discovered
  // event reads as "RECOMMENDED" (matches an interest) or "NEARBY" (doesn't).
  meInterests?: string[];
}

export function SCEventCard({ event, joined, showConflict, onPress, meInterests = [] }: Props) {
  const t = useTokens();
  // A scraped event (kind 'recommended') is only "RECOMMENDED" when it matches
  // one of your interests; otherwise it's just "NEARBY". yours/friend/org keep
  // their intrinsic label + color.
  const recommended = isRecommendedFor(event, meInterests);
  const label =
    event.kind === 'yours' ? 'YOUR EVENT' :
    event.kind === 'friend' ? 'FRIEND HOSTING' :
    event.kind === 'org' ? 'ORG · POSTED' :
    recommended ? 'RECOMMENDED' : 'NEARBY';
  const accent =
    event.kind === 'yours' ? t.primary :
    event.kind === 'friend' ? t.accentFriend :
    event.kind === 'org' ? t.accentBlue :
    recommended ? t.accentBlue : t.mapPinMute;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{
        width: 232, minHeight: 168, padding: 14,
        backgroundColor: t.card, borderColor: t.line, borderWidth: 1,
        borderRadius: RADIUS.xl,
        gap: 10,
      }, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}
    >
      {/* Kind row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        <SCText variant="mono" size={9.5} weight="600" color={accent}>
          {label}
        </SCText>
        {joined && (
          <View style={{
            marginLeft: 'auto',
            backgroundColor: t.good,
            paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999,
          }}>
            <SCText variant="mono" size={9} weight="600" color="white">JOINED</SCText>
          </View>
        )}
      </View>

      <SCText variant="display" size={17}>{event.title}</SCText>

      {showConflict && !joined && <ConflictChip event={event} />}

      <View style={{ marginTop: 'auto', gap: 4 }}>
        <SCText variant="mono" size={11} color={t.ink2}>{whenRange(event)}</SCText>
        <SCText size={12} color={t.ink3}>{event.where}</SCText>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 6, borderTopWidth: 1, borderTopColor: t.line,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <SCText variant="mono" size={11} weight="600">{String(event.attendees)}</SCText>
          <SCText variant="mono" size={11} color={t.ink3}>/{event.cap}</SCText>
        </View>
        {event.interests.slice(0, 1).map(tag => (
          <SCTag key={tag} tag={tag} size="sm" tone="soft" />
        ))}
      </View>
    </Pressable>
  );
}

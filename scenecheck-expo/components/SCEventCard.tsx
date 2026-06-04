// Horizontal event card used in scroll rails (Home screen, event lists).
// The legacy version had `flex: '0 0 232px'` and was rendered in a
// horizontal scroll container; on RN the parent is a <ScrollView
// horizontal> and we just give it a fixed width.

import { useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import { useTokens } from '@/theme/ThemeProvider';
import { SCText } from './SCText';
import { SCTag } from './SCTag';
import { ConflictChip } from './ConflictChip';
import { whenRange } from '@/lib/date-time';
import { formatPrice, priceState } from '@/lib/price';
import { eventCategory, EVENT_CATEGORY_LABEL, isAlsoRecommended } from '@/lib/events';
import { pinColor } from '@/components/Map/types';
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
  // id → event lookup forwarded to ConflictChip so overlap detection resolves
  // real joined events in live mode (not just the SC_* fixtures).
  conflictLookup?: Record<string, SCEvent>;
}

export function SCEventCard({ event, joined, showConflict, onPress, meInterests = [], conflictLookup }: Props) {
  const t = useTokens();
  // Hide the cover image if its URL fails to load (e.g. an expired source CDN
  // link) so the card never shows a broken-image box.
  const [imgFailed, setImgFailed] = useState(false);
  // Label + color both derive from the one category (lib/events) so they
  // always agree: yours / friend / recommended (interest match) / other.
  const label = EVENT_CATEGORY_LABEL[eventCategory(event, meInterests)];
  const accent = pinColor(event, t, meInterests);
  // A friend-hosted event that also matches your interests gets an extra
  // "RECOMMENDED" badge (the pin/label stay the friend colour).
  const alsoRec = isAlsoRecommended(event, meInterests);
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
      {/* Cover image — scraped events carry one from the source CDN. */}
      {event.image && !imgFailed && (
        <Image
          source={{ uri: event.image }}
          onError={() => setImgFailed(true)}
          resizeMode="cover"
          style={{ width: '100%', height: 110, borderRadius: RADIUS.lg, backgroundColor: t.subtle }}
        />
      )}
      {/* Kind row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
        <SCText variant="mono" size={9.5} weight="600" color={accent}>
          {label}
        </SCText>
        {alsoRec && (
          <View style={{
            backgroundColor: t.accentBlue,
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
          }}>
            <SCText variant="mono" size={9} weight="600" color="white">RECOMMENDED</SCText>
          </View>
        )}
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

      {showConflict && !joined && <ConflictChip event={event} eventsById={conflictLookup} />}

      <View style={{ marginTop: 'auto', gap: 4 }}>
        <SCText variant="mono" size={11} color={t.ink2}>{whenRange(event)}</SCText>
        <SCText size={12} color={t.ink3}>{event.where}</SCText>
      </View>

      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 6, borderTopWidth: 1, borderTopColor: t.line, gap: 8,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <SCText variant="mono" size={11} weight="600">{String(event.attendees)}</SCText>
            {/* Scraped events frequently arrive with capacity=null (DB) →
                cap=0 in our domain shape. Treat 0 as "unknown / no
                listed limit" rather than rendering a misleading "0/0".
                Matches the events list (app/events.tsx:187) which has
                the same fallback. */}
            <SCText variant="mono" size={11} color={t.ink3}>/{event.cap > 0 ? event.cap : 'unk'}</SCText>
          </View>
          {/* Price chip next to attendees — surfaces "is there a ticket
              cost?" without making the user open the event. FREE renders
              with the good/green tone; an explicit dollar amount uses
              the neutral ink so it doesn't out-shout the JOINED chip. */}
          <PriceChip event={event} />
        </View>
        {event.interests.slice(0, 1).map(tag => (
          <SCTag key={tag} tag={tag} size="sm" tone="soft" />
        ))}
      </View>
    </Pressable>
  );
}

// Compact price chip used on the card's bottom bar. Renders nothing
// when priceState is 'none' — the event simply has no price information
// to show. Two visual tones: green-tinted FREE for zero-cost events
// (positive affordance, surfaces "no ticket needed" at a glance), and a
// neutral border-only chip for actual money labels.
function PriceChip({ event }: { event: SCEvent }) {
  const t = useTokens();
  const state = priceState(event);
  const label = formatPrice(event);
  if (state === 'none' || !label) return null;
  if (state === 'free') {
    return (
      <View style={{
        backgroundColor: t.good,
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
      }}>
        <SCText variant="mono" size={9} weight="700" color="white">{label}</SCText>
      </View>
    );
  }
  return (
    <View style={{
      borderWidth: 1, borderColor: t.line,
      paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999,
    }}>
      <SCText variant="mono" size={10} weight="600" color={t.ink2}>{label}</SCText>
    </View>
  );
}

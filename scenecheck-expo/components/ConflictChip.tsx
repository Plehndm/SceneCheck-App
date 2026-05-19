// Pre-flight conflict chip. Reads the joined set + tweaks from the store
// and renders a small "OVERLAPS HH:MM" pill if this event clashes with
// one the user has already joined. Reuses the canonical `findConflict`
// from lib/conflicts.ts (no duplicate logic — that was the code-review fix).

import { View } from 'react-native';
import { SCText } from './SCText';
import { SCIcon } from './SCIcon';
import { useStore } from '@/store/useStore';
import { useTokens } from '@/theme/ThemeProvider';
import { findConflict } from '@/lib/conflicts';
import { SC_EVENT_BY_ID } from '@/data/mocks';
import type { SCEvent } from '@/types/domain';

interface Props {
  event: SCEvent;
  compact?: boolean;
}

export function ConflictChip({ event, compact }: Props) {
  const t = useTokens();
  const enabled = useStore(s => s.tweaks.preflightConflicts);
  const joined = useStore(s => s.joined);
  if (!enabled) return null;
  if (joined.has(event.id)) return null;
  const conflict = findConflict(event, joined, SC_EVENT_BY_ID);
  if (!conflict) return null;
  const m = conflict.when.match(/(\d{1,2}:\d{2}\s(?:AM|PM))/);
  const timeStr = m ? m[1] : conflict.when;
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      paddingHorizontal: compact ? 6 : 8, paddingVertical: compact ? 2 : 3,
      borderRadius: 999, borderWidth: 1,
      borderColor: t.warn, backgroundColor: t.warn + '38',
    }}>
      <SCIcon name="clock" size={compact ? 9 : 10} color={t.warn} />
      <SCText variant="mono" size={compact ? 8.5 : 9} weight="700" color={t.warn}>
        OVERLAPS {timeStr}
      </SCText>
    </View>
  );
}

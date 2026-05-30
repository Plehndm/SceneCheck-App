// My-Friends (web) — content column listing every friend, rendered
// with WebPersonRow so the trailing friend pill matches the rest of
// the desktop friend surfaces. useFriends() resolves the friendship
// graph (friendships ⨝ profiles, both directions) in live mode and
// the local Set in mock mode.

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useFriends } from '@/hooks/useFriends';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebPersonRow } from '@/web/WebPersonRow';
import { WebButton } from '@/web/WebButton';

export default function MyFriendsWeb() {
  const t = useTokens();
  const { friends, loading } = useFriends();

  return (
    <div
      className="scroll"
      style={{ height: '100%', overflowY: 'auto', background: t.surface }}
    >
      <div
        style={{
          maxWidth: 1080,
          margin: '0 auto',
          padding: '0 40px 60px',
        }}
      >
        <WebSecondaryHeader
          subtitle="Friends"
          title="Friends"
          hint={`${friends.length} ${friends.length === 1 ? 'connection' : 'connections'}`}
          right={
            <WebButton
              tone="ghost"
              size="md"
              icon="search"
              onClick={() => router.push('/search?tab=people' as never)}
            >
              Find people
            </WebButton>
          }
        />

        {loading && friends.length === 0 ? (
          <div style={{ color: t.ink3, padding: 16 }}>Loading…</div>
        ) : friends.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              border: `1px dashed ${t.line}`,
              borderRadius: 18,
              color: t.ink3,
            }}
          >
            <div style={{ fontSize: 14, color: t.ink2 }}>No friends yet.</div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {friends.map(p => (
              <WebPersonRow key={p.id} person={p} message />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

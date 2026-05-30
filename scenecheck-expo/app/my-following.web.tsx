// My-Following (web) — orgs the active user follows. useFollowedOrgs
// resolves the local `following` Set against profiles (mock: SC_ORGS
// fixtures; live: api.getProfilesByIds).

import { router } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { useFollowedOrgs } from '@/hooks/useFollowedOrgs';
import { WebSecondaryHeader } from '@/web/WebSecondaryHeader';
import { WebOrgRow } from '@/web/WebOrgRow';
import { WebButton } from '@/web/WebButton';

export default function MyFollowingWeb() {
  const t = useTokens();
  const { orgs, loading } = useFollowedOrgs();

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
          subtitle="Following"
          title="Orgs you follow"
          hint={`${orgs.length} ${orgs.length === 1 ? 'organization' : 'organizations'} · you'll get notified when they post.`}
          right={
            <WebButton
              tone="ghost"
              size="md"
              icon="search"
              onClick={() => router.push('/search?tab=orgs' as never)}
            >
              Browse orgs
            </WebButton>
          }
        />

        {loading && orgs.length === 0 ? (
          <div style={{ color: t.ink3, padding: 16 }}>Loading…</div>
        ) : orgs.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              border: `1px dashed ${t.line}`,
              borderRadius: 18,
              color: t.ink3,
            }}
          >
            <div style={{ fontSize: 14, color: t.ink2 }}>
              Not following any organizations yet.
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 12,
            }}
          >
            {orgs.map(o => (
              <WebOrgRow key={o.id} org={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

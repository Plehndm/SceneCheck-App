// Create event (web) — desktop 2-column layout:
//   • Left half: 4-step wizard (Basics → When & Where → Tags & Limits → Review).
//     Step pills jump the user directly to a step. Footer has Back / Next
//     (and on Review: Save Draft + Publish).
//   • Right half: live preview that re-renders as the form changes. The
//     event card uses the same WebEventListCard the home/discover rails
//     render so the host sees exactly how their event will appear to
//     others. A small map slice drops a pin when lat/lng have been set.
//
// Wiring (mirrors create-event.tsx native sibling):
//   • api.createEvent — RPC wrapper that already short-circuits in mock
//     mode and resolves interest tag names → ids in live mode.
//   • useStore.drafts / saveDraft / removeDraft / getDraft — local draft
//     persistence shared with the native flow.
//   • useStore.linkedCalendar — gates the optional Google Calendar
//     fire-and-forget insert after publish.
//   • useInterests(tagQuery) — interest catalog (mock + live).
//   • useLocation() — fallback lat/lng when the host hasn't typed one in.
//
// Location picker: native uses LocationPickerSheet (Maps modal). On web
// we expose a plain text input + a "Use my location" button that fills
// lat/lng from `useLocation()`. Real geocoding (typed address → lat/lng)
// is OUT OF SCOPE for this wave — open issue noted in the agent report.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useTokens } from '@/theme/ThemeProvider';
import { FONT } from '@/theme/tokens';
import { useStore } from '@/store/useStore';
import { useInterests } from '@/hooks/useInterests';
import { useLocation } from '@/hooks/useLocation';
import { DEFAULT_REGION } from '@/components/Map/types';
import { suggestPlaces, type PlaceSuggestion } from '@/lib/geocode';
import { api } from '@/lib/api';
import * as googleCalendar from '@/lib/google-calendar';
import { timeToMin, fmtDate, friendlyToISO, whenRange } from '@/lib/date-time';
import { SC_MY_ACCOUNTS } from '@/data/mocks';
import type { Account, DraftForm, Visibility, SCEvent } from '@/types/domain';
import { WebAvatar } from '@/web/WebAvatar';
import { WebButton } from '@/web/WebButton';
import { WebIcon } from '@/web/WebIcon';
import { WebTag } from '@/web/WebTag';
import { WebToggleRow } from '@/web/WebToggleRow';
import { WebEventListCard } from '@/web/WebEventListCard';
import { WebMap } from '@/web/WebMap';

// ── Form defaults (mirror the native create-event.tsx) ─────────
function makeEmptyForm(meInterests: readonly string[]): DraftForm {
  return {
    title: '',
    desc: '',
    date: fmtDate(new Date()),
    timeStart: '7:00 AM',
    timeEnd: '9:00 AM',
    location: 'Anteater Plaza',
    cap: 12,
    interests: meInterests.length > 0 ? [...meInterests] : ['biking'],
    visibility: 'public',
    minSubs: 3,
    addToCalendar: true,
    autoGroupChat: true,
    priceMode: 'none',
    priceMin: '',
    priceMax: '',
  };
}

const STEPS = [
  { id: 1, label: 'Basics' },
  { id: 2, label: 'When & Where' },
  { id: 3, label: 'Tags & Limits' },
  { id: 4, label: 'Review' },
] as const;

// Convert "Sat May 16" → "2026-05-16" (HTML5 <input type="date"> wants
// ISO yyyy-mm-dd). When the friendly string fails to parse we just
// hand the date input today's date so the form stays usable.
function friendlyToISODate(friendly: string): string {
  const parsed = new Date(`${friendly} ${new Date().getFullYear()}`);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function isoDateToFriendly(iso: string): string {
  if (!iso) return fmtDate(new Date());
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return fmtDate(new Date());
  return fmtDate(d);
}

// Convert "7:00 AM" → "07:00" for <input type="time">.
function friendlyToTime24(friendly: string): string {
  const m = friendly.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return '07:00';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function time24ToFriendly(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(n => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return '7:00 AM';
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

export default function CreateEventWeb() {
  const t = useTokens();
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();

  const drafts = useStore(s => s.drafts);
  const saveDraft = useStore(s => s.saveDraft);
  const removeDraft = useStore(s => s.removeDraft);
  const showToast = useStore(s => s.showToast);
  const showConfirm = useStore(s => s.showConfirm);
  const meInterests = useStore(s => s.me.interests ?? []);
  const linkedCalendar = useStore(s => s.linkedCalendar);
  const activeAccount = useStore(s => s.activeAccount);
  const setActiveAccount = useStore(s => s.setActiveAccount);
  const picture = useStore(s => s.picture);
  const orgPictures = useStore(s => s.orgPictures);
  const subscribedInterests = useStore(s => s.subscribedInterests);
  const me = useStore(s => s.me);

  const { coords } = useLocation();

  // Resolve initial draft once at mount-time so the form's lazy
  // initializer can read it without an effect.
  const initialDraft = useMemo(
    () => (draftId ? drafts.find(d => d.id === draftId) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftId],
  );

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<DraftForm>(
    () => initialDraft?.form ?? makeEmptyForm(meInterests),
  );
  // Track whether the form has unsaved edits so cancel can prompt.
  const initialFormRef = useRef(form);
  const [tagQuery, setTagQuery] = useState('');
  const [publishing, setPublishing] = useState(false);

  const set = <K extends keyof DraftForm>(k: K, v: DraftForm[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // The "Posting as" account — driven by the rail's active-account
  // selector and persisted in the store. We render a small inline
  // switcher in step 1 so the user can change identity without
  // leaving the wizard.
  //
  // In mock mode the legacy fixture list (SC_MY_ACCOUNTS) drives the
  // switcher so demo screens keep working. In live mode we only know
  // about the signed-in `me` account today — feeding the fixture into
  // `previewEvent.hostId` would publish events under a fake UUID.
  // TODO(orgs): hydrate user-managed orgs and concat into accountList.
  const accountList = useMemo<Account[]>(() => {
    if (api.isMock()) return SC_MY_ACCOUNTS;
    return [
      {
        ...me,
        handle: me.handle ?? (me.username ? `@${me.username}` : '@me'),
      } as Account,
    ];
  }, [me]);
  const account =
    accountList.find(a => a.id === activeAccount) ?? accountList[0];
  // Resolve the account avatar the same way the rail does: the locally-picked
  // `picture` (store) wins, then fall back to the account's own `avatar_url`
  // (carried on `account.picture` / `me.picture`). The previous code used only
  // the store `picture`, so a signed-in user whose avatar lives on their
  // profile row — but who hadn't re-picked it this session — showed initials.
  const accountPic =
    account.id === 'me' || account.id === me.id
      ? (picture ?? account.picture ?? null)
      : (orgPictures[account.id] ?? account.picture ?? null);

  const { interests: catalogResults } = useInterests(tagQuery);
  const addableTags = useMemo(() => {
    const catalog = new Set<string>([
      ...catalogResults.map(i => i.tag),
      ...meInterests,
    ]);
    const selected = new Set(form.interests);
    const q = tagQuery.trim().toLowerCase();
    const all = Array.from(catalog).filter(tag => !selected.has(tag));
    return q
      ? all.filter(tag => tag.toLowerCase().includes(q))
      : all.filter(tag => catalogResults.some(i => i.tag === tag));
  }, [form.interests, tagQuery, meInterests, catalogResults]);

  // ── Validation ─────────────────────────────────────────────
  const timesInvalid =
    timeToMin(form.timeEnd) < timeToMin(form.timeStart);
  const titleValid = form.title.trim().length > 0;
  const canPublish = titleValid && !timesInvalid && !publishing;

  const toggleInterest = (tag: string) =>
    set(
      'interests',
      form.interests.includes(tag)
        ? form.interests.filter(x => x !== tag)
        : [...form.interests, tag],
    );

  // ── Live preview event derived from the form ───────────────
  const previewEvent = useMemo<SCEvent>(() => {
    const dateLabel = form.date || fmtDate(new Date());
    return {
      id: '__preview',
      kind: 'yours',
      hostId: account.id,
      title: form.title.trim() || 'Your event title',
      host: account.name,
      interests: form.interests.length ? form.interests : ['uci'],
      when: `${dateLabel} · ${form.timeStart}`,
      endTime: form.timeEnd,
      where: form.location.trim() || 'Add a location',
      attendees: 0,
      cap: form.cap,
      rating: null,
      x: 0.44,
      y: 0.5,
      lat: form.lat,
      lng: form.lng,
      desc:
        form.desc.trim() ||
        'Add a description so people know what to expect.',
    } as SCEvent;
  }, [form, account.id, account.name]);

  // ── Publish ────────────────────────────────────────────────
  const handlePublish = async () => {
    if (!canPublish) {
      if (!titleValid) showToast({ message: 'Add a title before publishing.', kind: 'error' });
      else if (timesInvalid) showToast({ message: 'End time must be after start.', kind: 'error' });
      return;
    }
    let priceMin: number | null = null;
    let priceMax: number | null = null;
    let priceCurrency: string | null = null;
    if (form.priceMode === 'free') {
      priceMin = 0;
      priceMax = 0;
      priceCurrency = 'USD';
    } else if (form.priceMode === 'paid') {
      const lo = parseFloat(form.priceMin || '');
      const hi = form.priceMax ? parseFloat(form.priceMax) : lo;
      if (!Number.isFinite(lo) || lo < 0 || !Number.isFinite(hi) || hi < lo) {
        showToast({ message: 'Enter a valid ticket price (max ≥ min).', kind: 'error' });
        return;
      }
      priceMin = Math.round(lo * 100) / 100;
      priceMax = Math.round(hi * 100) / 100;
      priceCurrency = 'USD';
    }

    setPublishing(true);
    try {
      const result = await api.createEvent({
        title: form.title.trim(),
        description: form.desc.trim(),
        start_at: friendlyToISO(form.date, form.timeStart),
        end_at: friendlyToISO(form.date, form.timeEnd),
        location: {
          lat: form.lat ?? coords.latitude,
          lng: form.lng ?? coords.longitude,
        },
        location_name: form.location.trim(),
        capacity: form.cap,
        min_subscribers: form.minSubs,
        interests: form.interests,
        price_min: priceMin,
        price_max: priceMax,
        price_currency: priceCurrency,
        // FR5.1 — the wizard collects visibility, so forward it on the
        // wire even though the current create-event Edge Function /
        // events table don't read a `visibility` column yet. Once a
        // migration adds it, the function can destructure without a
        // client change. Native parity is the same gap.
        visibility: form.visibility,
        // TODO(server): create-event Edge Function does not yet read
        // auto_group_chat — needs a migration + function update before
        // this flag will be honored server-side (FR9.4).
        auto_group_chat: form.autoGroupChat,
      });
      if (initialDraft) removeDraft(initialDraft.id);
      // FR7.2 fire-and-forget calendar insert.
      if (
        form.addToCalendar &&
        linkedCalendar === 'google' &&
        googleCalendar.isConfigured()
      ) {
        googleCalendar
          .insertEvent({
            summary: form.title.trim(),
            description: form.desc.trim(),
            location: form.location.trim(),
            startISO: friendlyToISO(form.date, form.timeStart),
            endISO: friendlyToISO(form.date, form.timeEnd),
          })
          .catch(() => {
            showToast({
              message: "Event published, but couldn't add to your Calendar.",
              kind: 'info',
            });
          });
      }
      const eventId = (result as { event_id?: string })?.event_id ?? 'e1';
      router.replace({
        pathname: '/event-published',
        params: { eventId, title: form.title },
      } as never);
    } catch (e) {
      showToast({
        message: e instanceof Error ? `Couldn't publish: ${e.message}` : "Couldn't publish.",
        kind: 'error',
      });
      setPublishing(false);
    }
  };

  // ── Cancel / dirty navigation ──────────────────────────────
  const isDirty = useMemo(() => {
    const initial = initialFormRef.current;
    return JSON.stringify(initial) !== JSON.stringify(form);
  }, [form]);

  const handleCancel = () => {
    if (initialDraft) {
      // Quiet-save on the way out when we're editing an existing draft.
      saveDraft(form, { id: initialDraft.id });
      router.back();
      return;
    }
    if (!isDirty) {
      router.back();
      return;
    }
    showConfirm({
      title: 'Save as draft?',
      body: 'You can finish later from the Drafts list.',
      confirmLabel: 'SAVE DRAFT',
      cancelLabel: 'DISCARD',
      onConfirm: () => {
        saveDraft(form);
        showToast({ message: 'Saved to Drafts.', kind: 'success' });
        router.back();
      },
      onCancel: () => router.back(),
    });
  };

  const handleSaveDraft = () => {
    saveDraft(form, { id: initialDraft?.id, lastStep: step });
    showToast({ message: 'Saved to Drafts.', kind: 'info' });
  };

  // Avoid a flash where the form is brand-new but the draft id is still
  // being resolved by useLocalSearchParams — re-seed once the draft lands.
  useEffect(() => {
    if (initialDraft && form === initialFormRef.current) {
      setForm(initialDraft.form);
      initialFormRef.current = initialDraft.form;
      setStep(
        initialDraft.lastStep != null
          ? Math.min(Math.max(initialDraft.lastStep, 1), 4)
          : 1
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDraft]);

  return (
    <div
      className="scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        background: t.surface,
        color: t.ink,
        fontFamily: FONT.body,
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 40px 60px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 22,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: t.ink3,
                textTransform: 'uppercase',
              }}
            >
              {initialDraft ? 'Resuming draft' : 'Host a meetup'}
            </div>
            <div
              style={{
                fontFamily: FONT.display,
                fontSize: 36,
                lineHeight: 0.95,
                marginTop: 6,
                fontWeight: 800,
                letterSpacing: '-0.02em',
              }}
            >
              {initialDraft ? 'Edit draft' : 'Create an event'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Close"
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              border: `1px solid ${t.line}`,
              background: t.card,
              color: t.ink,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <WebIcon name="x" size={18} />
          </button>
        </div>

        {/* Step pills */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          {STEPS.map(s => {
            const on = step === s.id;
            const done = step > s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 36,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${on ? t.primary : t.line}`,
                  background: on ? t.primary : done ? t.subtle : t.card,
                  color: on ? t.primaryInk : done ? t.ink : t.ink2,
                  cursor: 'pointer',
                  fontFamily: FONT.mono,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: on ? t.primaryInk : done ? t.good : t.line,
                    color: on ? t.primary : 'white',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {done ? <WebIcon name="check" size={10} strokeWidth={3} /> : s.id}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Two-column body */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 380px',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* ── LEFT: wizard step content ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {step === 1 && (
              <BasicsStep
                form={form}
                onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
                account={account}
                accountPic={accountPic}
              />
            )}
            {step === 2 && (
              <WhenWhereStep
                form={form}
                onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
                timesInvalid={timesInvalid}
                onUseMyLocation={() =>
                  setForm(f => ({
                    ...f,
                    lat: coords.latitude,
                    lng: coords.longitude,
                  }))
                }
                nearLat={coords?.latitude ?? DEFAULT_REGION.latitude}
                nearLng={coords?.longitude ?? DEFAULT_REGION.longitude}
              />
            )}
            {step === 3 && (
              <TagsLimitsStep
                form={form}
                onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
                tagQuery={tagQuery}
                setTagQuery={setTagQuery}
                toggleInterest={toggleInterest}
                addableTags={addableTags}
                subscribedInterests={subscribedInterests}
              />
            )}
            {step === 4 && (
              <ReviewStep
                form={form}
                account={account}
                accountPic={accountPic}
                onJumpStep={setStep}
              />
            )}

            {/* Footer — back / next on 1-3, full publish row on 4 */}
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                gap: 10,
                paddingTop: 16,
                borderTop: `1px solid ${t.line}`,
              }}
            >
              {step > 1 ? (
                <WebButton
                  tone="ghost"
                  size="lg"
                  icon="back"
                  onClick={() => setStep(s => Math.max(1, s - 1))}
                >
                  Back
                </WebButton>
              ) : (
                <WebButton tone="ghost" size="lg" onClick={handleCancel}>
                  Cancel
                </WebButton>
              )}
              {step < 4 ? (
                <WebButton
                  tone="dark"
                  size="lg"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => setStep(s => Math.min(4, s + 1))}
                >
                  Next: {STEPS[step].label}
                </WebButton>
              ) : (
                <>
                  <WebButton
                    tone="ghost"
                    size="lg"
                    icon="edit"
                    onClick={handleSaveDraft}
                    style={{ marginLeft: 'auto' }}
                  >
                    Save draft
                  </WebButton>
                  <WebButton
                    tone="primary"
                    size="lg"
                    icon="check"
                    onClick={handlePublish}
                    disabled={!canPublish}
                  >
                    {publishing ? 'Publishing…' : 'Publish event'}
                  </WebButton>
                </>
              )}
            </div>
          </div>

          {/* ── RIGHT: live preview ── */}
          <div style={{ position: 'sticky', top: 0 }}>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: t.ink3,
                marginBottom: 10,
                textTransform: 'uppercase',
              }}
            >
              Live preview
            </div>
            <WebEventListCard
              event={previewEvent}
              joined={false}
              active
              onOpen={() => {}}
              onJoin={() => {}}
              onHover={() => {}}
              // Seed the posting account so the preview's host row shows the
              // profile picture (matches the "Posting as" field above).
              hostLookup={{ [account.id]: { ...account, picture: accountPic } }}
            />
            {form.lat != null && form.lng != null ? (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: `1px solid ${t.line}`,
                  height: 180,
                  position: 'relative',
                }}
              >
                <WebMap
                  events={[
                    {
                      ...previewEvent,
                      // The WebMap projects events by lat/lng (via
                      // eventLatLng). Make sure the preview pin lands
                      // on the picked spot rather than the fixture x/y.
                      lat: form.lat,
                      lng: form.lng,
                    } as SCEvent,
                  ]}
                  you={null}
                  joinedSet={new Set()}
                  richHover={false}
                  online
                  // Hide the legend + zoom controls — at 180px they'd cover the
                  // pin; the preview just needs to show where it lands.
                  chrome={false}
                />
              </div>
            ) : (
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  border: `1px dashed ${t.line}`,
                  padding: '22px 14px',
                  textAlign: 'center',
                  color: t.ink3,
                  background: t.subtle,
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                Pin a location on step 2 to see it land on the map preview.
              </div>
            )}
            <p
              style={{
                fontSize: 11.5,
                color: t.ink3,
                lineHeight: 1.5,
                marginTop: 12,
              }}
            >
              This is how your event will appear on the map and in everyone&rsquo;s feed.
              It updates as you type.
            </p>
            {previewEvent.title === 'Your event title' && (
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  borderRadius: 12,
                  background: t.warn + '26',
                  border: `1px solid ${t.warn}59`,
                  color: t.ink2,
                  fontSize: 11.5,
                }}
              >
                Add a title to publish.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── STEPS ───────────────────────────

interface StepChangeProps {
  form: DraftForm;
  onChange: (patch: Partial<DraftForm>) => void;
}

// ── Step 1 — Basics ────────────────────────────────────────
function BasicsStep({
  form,
  onChange,
  account,
  accountPic,
}: StepChangeProps & {
  account: Account;
  accountPic: string | null;
}) {
  const t = useTokens();
  return (
    <>
      <SectionHeader title="Basics" sub="Tell people what this event is and who's hosting." />
      {/* Posting-as: read-only display of the signed-in account.
          Multi-account hosting (managed orgs) isn't hydrated for web
          yet, so we tell the user to sign in as the other account
          instead of exposing a switcher that does nothing in live mode.
          When `useUserOrgs` lands this can become a real switcher. */}
      <Field label="Posting as">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 14px',
            background: t.card,
            border: `1px solid ${t.line}`,
            borderRadius: 14,
            color: t.ink,
            width: 'fit-content',
          }}
        >
          <WebAvatar person={{ ...account, picture: accountPic }} size={36} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{account.name}</div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10,
                color: t.ink3,
              }}
            >
              {account.handle}
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: t.ink3,
            lineHeight: 1.5,
            maxWidth: 520,
          }}
        >
          Want to post under a different account? Sign out and sign back in as
          that account, then come back here to create the event.
        </div>
      </Field>

      <Field label="Event title" hint={`${form.title.length}/60`}>
        <input
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value.slice(0, 60) })}
          placeholder="Morning Ride — Back Bay loop"
          style={inputStyle(t)}
        />
      </Field>
      <Field label="Description" hint={`${form.desc.length}/240`}>
        <textarea
          value={form.desc}
          onChange={(e) => onChange({ desc: e.target.value.slice(0, 240) })}
          rows={4}
          placeholder="What's the plan? Pace, what to bring, where you'll regroup…"
          style={{
            ...inputStyle(t),
            height: 'auto',
            padding: '12px 14px',
            resize: 'vertical',
            lineHeight: 1.5,
            fontFamily: 'inherit',
          }}
        />
      </Field>
    </>
  );
}

// ── Step 2 — When & Where ──────────────────────────────────
function WhenWhereStep({
  form,
  onChange,
  timesInvalid,
  onUseMyLocation,
  nearLat,
  nearLng,
}: StepChangeProps & {
  timesInvalid: boolean;
  onUseMyLocation: () => void;
  nearLat: number;
  nearLng: number;
}) {
  const t = useTokens();
  // Location autocomplete (OpenStreetMap Nominatim, biased to the host's
  // location). Typing ≥3 chars debounces a search; picking a result fills the
  // location name AND the lat/lng, which the right-pane map preview reflects.
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  // Set when WE change the text (selecting a suggestion) so the debounced
  // effect skips one run and the dropdown doesn't immediately reopen.
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = form.location.trim();
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    let cancelled = false;
    const id = setTimeout(async () => {
      const res = await suggestPlaces(q, { latitude: nearLat, longitude: nearLng });
      if (cancelled) return;
      setSuggestions(res);
      setOpen(res.length > 0);
    }, 350);
    return () => { cancelled = true; clearTimeout(id); };
  }, [form.location, nearLat, nearLng]);

  const pick = (s: PlaceSuggestion) => {
    skipNext.current = true;
    setOpen(false);
    setSuggestions([]);
    onChange({ location: s.label, lat: s.lat, lng: s.lng });
  };

  return (
    <>
      <SectionHeader title="When & Where" sub="Date, times, and where folks should show up." />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 12,
        }}
      >
        <Field label="Date">
          <input
            type="date"
            value={friendlyToISODate(form.date)}
            onChange={(e) =>
              onChange({ date: isoDateToFriendly(e.target.value) })
            }
            style={inputStyle(t)}
          />
        </Field>
        <Field label="Start">
          <input
            type="time"
            value={friendlyToTime24(form.timeStart)}
            onChange={(e) =>
              onChange({ timeStart: time24ToFriendly(e.target.value) })
            }
            style={inputStyle(t)}
          />
        </Field>
        <Field label="End">
          <input
            type="time"
            value={friendlyToTime24(form.timeEnd)}
            onChange={(e) =>
              onChange({ timeEnd: time24ToFriendly(e.target.value) })
            }
            style={inputStyle(t)}
          />
        </Field>
      </div>
      {timesInvalid && (
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: t.warn + '26',
            border: `1px solid ${t.warn}59`,
            color: t.ink2,
            fontSize: 12,
          }}
        >
          End time is before start. Adjust to publish.
        </div>
      )}

      <Field label="Location" hint="Start typing — we’ll suggest places near you.">
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: 14,
              top: 24,
              transform: 'translateY(-50%)',
              color: t.ink3,
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <WebIcon name="pin" size={16} />
          </span>
          <input
            value={form.location}
            onChange={(e) => onChange({ location: e.target.value })}
            onFocus={() => { if (suggestions.length) setOpen(true); }}
            // Delay close so a suggestion's onMouseDown registers first.
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            placeholder="Search an address or place…"
            style={{ ...inputStyle(t), paddingLeft: 40 }}
          />
          {open && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 'calc(100% + 6px)',
                zIndex: 30,
                background: t.card,
                border: `1px solid ${t.line}`,
                borderRadius: 12,
                boxShadow: '0 18px 40px -14px rgba(0,0,0,0.35)',
                overflow: 'hidden',
              }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s.lat},${s.lng},${i}`}
                  type="button"
                  // onMouseDown (not onClick) so it fires before the input's
                  // onBlur closes the dropdown.
                  onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 9,
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderTop: i === 0 ? 'none' : `1px solid ${t.line}`,
                    cursor: 'pointer',
                    color: t.ink,
                  }}
                >
                  <span style={{ color: t.ink3, marginTop: 1, flexShrink: 0, display: 'flex' }}>
                    <WebIcon name="pin" size={14} />
                  </span>
                  <span style={{ fontSize: 12.5, lineHeight: 1.35 }}>{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      <Field
        label="Pinned coordinates"
        hint={
          form.lat != null && form.lng != null
            ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}`
            : 'Not set'
        }
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <WebButton tone="ghost" icon="crosshair" onClick={onUseMyLocation}>
            Use my current location
          </WebButton>
          {form.lat != null && form.lng != null && (
            <WebButton
              tone="soft"
              icon="x"
              onClick={() => onChange({ lat: undefined, lng: undefined })}
            >
              Clear pin
            </WebButton>
          )}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 11.5,
            color: t.ink3,
            lineHeight: 1.5,
          }}
        >
          Pick a suggestion above to drop the pin, or use your current location. The map preview
          updates to wherever the pin is set.
        </div>
      </Field>
    </>
  );
}

// ── Step 3 — Tags & Limits ─────────────────────────────────
function TagsLimitsStep({
  form,
  onChange,
  tagQuery,
  setTagQuery,
  toggleInterest,
  addableTags,
  subscribedInterests,
}: StepChangeProps & {
  tagQuery: string;
  setTagQuery: (v: string) => void;
  toggleInterest: (tag: string) => void;
  addableTags: string[];
  subscribedInterests: Set<string>;
}) {
  const t = useTokens();
  return (
    <>
      <SectionHeader
        title="Tags & limits"
        sub="Tags surface your event to the right people. Capacity caps the RSVP list."
      />

      <Field label={`Tags · ${form.interests.length}`}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {form.interests.length === 0 ? (
            <span style={{ fontSize: 12, color: t.ink3 }}>
              No tags yet — search and tap to add.
            </span>
          ) : (
            form.interests.map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleInterest(tag)}
                aria-label={`Remove tag ${tag}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '6px 10px',
                  borderRadius: 999,
                  background: t.primary,
                  color: t.primaryInk,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: FONT.mono,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                #{tag}
                <WebIcon name="x" size={10} />
              </button>
            ))
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 12px',
            background: t.subtle,
            borderRadius: 12,
            height: 40,
          }}
        >
          <WebIcon name="search" size={14} color={t.ink3} />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search tags to add…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 13,
              color: t.ink,
              fontFamily: 'inherit',
            }}
          />
          {tagQuery.length > 0 && (
            <button
              type="button"
              onClick={() => setTagQuery('')}
              aria-label="Clear tag search"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: t.ink3,
                display: 'flex',
                alignItems: 'center',
                padding: 0,
              }}
            >
              <WebIcon name="x" size={12} />
            </button>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {addableTags.length === 0 ? (
            <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink3 }}>
              {tagQuery
                ? 'No tags match that search.'
                : 'All suggested tags are already added.'}
            </span>
          ) : (
            addableTags.map(tag => (
              <WebTag
                key={tag}
                tag={tag}
                size="sm"
                tone={subscribedInterests.has(tag) ? 'primary' : 'soft'}
                onClick={() => {
                  toggleInterest(tag);
                  setTagQuery('');
                }}
              />
            ))
          )}
        </div>
      </Field>

      <Field label="Capacity">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => onChange({ cap: Math.max(2, form.cap - 1) })}
            aria-label="Decrease capacity"
            style={stepperStyle(t)}
          >
            <WebIcon name="x" size={14} />
          </button>
          <input
            type="number"
            min={2}
            max={500}
            value={form.cap}
            onChange={(e) =>
              onChange({
                cap: Math.max(2, Math.min(500, parseInt(e.target.value || '0', 10) || 2)),
              })
            }
            style={{
              ...inputStyle(t),
              width: 96,
              textAlign: 'center',
              fontFamily: FONT.display,
              fontSize: 22,
            }}
          />
          <button
            type="button"
            onClick={() => onChange({ cap: Math.min(500, form.cap + 1) })}
            aria-label="Increase capacity"
            style={stepperStyle(t)}
          >
            <WebIcon name="plus" size={14} />
          </button>
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink3 }}>
            spots
          </span>
        </div>
      </Field>

      <Field
        label="Visibility"
        hint="Public events surface to the whole map; private ones need an invite."
      >
        <div style={{ display: 'flex', gap: 10 }}>
          {(
            [
              { k: 'public', icon: 'globe', t: 'Public', d: 'Anyone nearby can find & join' },
              { k: 'private', icon: 'lock', t: 'Private', d: 'Only people you invite' },
            ] as { k: Visibility; icon: string; t: string; d: string }[]
          ).map(o => {
            const on = form.visibility === o.k;
            return (
              <button
                key={o.k}
                type="button"
                onClick={() => onChange({ visibility: o.k })}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  padding: 14,
                  borderRadius: 14,
                  cursor: 'pointer',
                  background: t.card,
                  border: `1.5px solid ${on ? t.primary : t.line}`,
                  color: t.ink,
                  fontFamily: 'inherit',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                    color: on ? t.primary : t.ink,
                  }}
                >
                  <WebIcon name={o.icon} size={16} />
                  <span style={{ fontFamily: FONT.display, fontSize: 15, fontWeight: 700 }}>
                    {o.t}
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: t.ink3 }}>{o.d}</div>
              </button>
            );
          })}
        </div>
      </Field>

      <Field
        label="Publish gate (min. subscribers)"
        hint="FR5.4 — your event stays hidden from public search until this many people have joined."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <input
            type="number"
            min={0}
            max={Math.max(1, form.cap)}
            value={form.minSubs}
            onChange={(e) =>
              onChange({
                minSubs: Math.max(
                  0,
                  Math.min(form.cap, parseInt(e.target.value || '0', 10) || 0),
                ),
              })
            }
            style={{ ...inputStyle(t), width: 96, textAlign: 'center' }}
          />
          <span style={{ fontFamily: FONT.mono, fontSize: 11, color: t.ink3 }}>
            of {form.cap} spots
          </span>
        </div>
      </Field>

      <WebToggleRow
        label="Add to my calendar"
        sub="Sync to your linked Google Calendar after publish."
        value={form.addToCalendar}
        onChange={(v) => onChange({ addToCalendar: v })}
        icon="calendar"
      />
      <WebToggleRow
        label="Auto-create group chat"
        sub="Attendees get a shared event chat the moment they RSVP."
        value={form.autoGroupChat}
        onChange={(v) => onChange({ autoGroupChat: v })}
        icon="chat"
      />
    </>
  );
}

// ── Step 4 — Review ────────────────────────────────────────
function ReviewStep({
  form,
  account,
  accountPic,
  onJumpStep,
}: {
  form: DraftForm;
  account: Account;
  accountPic: string | null;
  onJumpStep: (n: number) => void;
}) {
  const t = useTokens();
  const time = `${form.date} · ${form.timeStart} – ${form.timeEnd}`;
  const range = whenRange({ when: `${form.date} · ${form.timeStart}`, endTime: form.timeEnd });
  return (
    <>
      <SectionHeader title="Review" sub="Final check before going live." />
      <ReviewCard
        title="Basics"
        onEdit={() => onJumpStep(1)}
        rows={[
          {
            label: 'Posting as',
            value: (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <WebAvatar person={{ ...account, picture: accountPic }} size={26} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{account.name}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 10, color: t.ink3 }}>
                  {account.handle}
                </span>
              </div>
            ),
          },
          { label: 'Title', value: form.title || <Muted>Not set yet</Muted> },
          { label: 'Description', value: form.desc || <Muted>—</Muted> },
        ]}
      />
      <ReviewCard
        title="When & Where"
        onEdit={() => onJumpStep(2)}
        rows={[
          { label: 'When', value: range || time },
          { label: 'Where', value: form.location || <Muted>Add a location</Muted> },
          {
            label: 'Pinned',
            value:
              form.lat != null && form.lng != null
                ? `${form.lat.toFixed(4)}, ${form.lng.toFixed(4)}`
                : <Muted>Using host&rsquo;s location</Muted>,
          },
        ]}
      />
      <ReviewCard
        title="Tags & limits"
        onEdit={() => onJumpStep(3)}
        rows={[
          {
            label: 'Tags',
            value:
              form.interests.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {form.interests.map(tag => (
                    <WebTag key={tag} tag={tag} size="sm" tone="soft" />
                  ))}
                </div>
              ) : (
                <Muted>None</Muted>
              ),
          },
          { label: 'Capacity', value: `${form.cap} spots` },
          {
            label: 'Visibility',
            value: form.visibility === 'public' ? 'Public' : 'Private',
          },
          {
            label: 'Publish gate',
            value: `${form.minSubs} of ${form.cap} subscribers`,
          },
          {
            label: 'Add to calendar',
            value: form.addToCalendar ? 'Yes' : 'No',
          },
          {
            label: 'Group chat',
            value: form.autoGroupChat ? 'Auto-create' : 'Off',
          },
        ]}
      />
    </>
  );
}

// ─────────────────────── shared building blocks ───────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const t = useTokens();
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: t.ink3,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontFamily: FONT.mono,
              fontSize: 10,
              color: t.ink3,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  const t = useTokens();
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          fontFamily: FONT.display,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: t.ink,
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: t.ink3, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

interface ReviewRow {
  label: string;
  value: React.ReactNode;
}

function ReviewCard({
  title,
  onEdit,
  rows,
}: {
  title: string;
  onEdit: () => void;
  rows: ReviewRow[];
}) {
  const t = useTokens();
  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.line}`,
        borderRadius: 16,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontFamily: FONT.display,
            fontSize: 16,
            fontWeight: 700,
            flex: 1,
          }}
        >
          {title}
        </div>
        <button
          type="button"
          onClick={onEdit}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: t.primary,
            fontFamily: FONT.mono,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 0,
          }}
        >
          <WebIcon name="edit" size={13} /> EDIT
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div
            key={r.label}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              alignItems: 'baseline',
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 10.5,
                color: t.ink3,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {r.label}
            </div>
            <div style={{ fontSize: 13.5, color: t.ink, lineHeight: 1.4 }}>
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  const t = useTokens();
  return (
    <span style={{ color: t.ink3, fontStyle: 'italic' }}>{children}</span>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>): CSSProperties {
  return {
    width: '100%',
    height: 46,
    padding: '0 14px',
    borderRadius: 12,
    border: `1px solid ${t.line}`,
    background: t.card,
    color: t.ink,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
  };
}

function stepperStyle(t: ReturnType<typeof useTokens>): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 11,
    border: `1px solid ${t.line}`,
    background: t.card,
    color: t.ink,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

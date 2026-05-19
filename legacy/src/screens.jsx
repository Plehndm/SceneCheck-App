// SceneCheck — screen components

const { useState: useStateS, useMemo: useMemoS, useEffect: useEffectS, useRef: useRefS, useLayoutEffect: useLayoutEffectS } = React;

// ── HOME ─────────────────────────────────────────────────────
function SCHomeScreen({ go, joined, pendingLeave, toggleJoin, offline, showSkeletons }) {
  // While a leave is pending the event still lives in `joined`, but we want
  // the UI to read "unjoined" right away — the toast lets the user undo.
  const isJoinedNow = (id) => joined.has(id) && !(pendingLeave && pendingLeave.has && pendingLeave.has(id));
  // (search button below routes to the discover/search surface)
  const events = SC_EVENTS;
  const people = SC_VISIBLE_PEOPLE;
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      {/* header */}
      <div style={{ padding: '8px 18px 2px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="label-cap">Sat May 9 · Irvine</div>
          <div className="display-tight" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>
            What's the<br/>scene?
          </div>
        </div>
        <button onClick={() => go('search')} className="press" aria-label="Search events" style={{
          width: 40, height: 40, borderRadius: 12, border: '1px solid var(--line)',
          background: 'var(--card)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="search" size={18}/>
        </button>
      </div>

      {/* Map preview card */}
      <div style={{ padding: '18px 14px 0' }}>
        <SCCard style={{ overflow: 'hidden', position: 'relative' }}>
          <div onClick={() => go('map')} style={{ position: 'relative', cursor: 'pointer' }}>
            <SCMap width={373} height={210} pins={events} compact showHover
              onPinTap={(p) => go({ name: 'event', eventId: p.id })}/>
            {/* overlay chips */}
            <div style={{
              position: 'absolute', left: 12, top: 12, display: 'flex', gap: 6,
            }}>
              <span style={{
                background: 'var(--ink)', color: 'var(--card)', padding: '5px 10px',
                fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em',
                borderRadius: 999, fontWeight: 600,
              }}>LIVE · 6 EVENTS NEARBY</span>
            </div>
            <div style={{
              position: 'absolute', right: 12, bottom: 12,
              background: 'var(--card)', color: 'var(--ink)',
              padding: '8px 12px', borderRadius: 12, border: '1px solid var(--line)',
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              OPEN MAP <SCIcon name="chevron-right" size={12}/>
            </div>
          </div>
          {/* legend strip */}
          <div style={{
            display: 'flex', gap: 14, padding: '12px 14px',
            borderTop: '1px solid var(--line)', alignItems: 'center',
            flexWrap: 'wrap',
          }}>
            <LegendDot color="var(--primary)" label="Your events"/>
            <LegendDot color="var(--accent-friend)" label="Friends"/>
            <LegendDot color="var(--accent-blue)" label="Recommended"/>
            <LegendDot color="var(--map-pin-mute)" label="Other"/>
          </div>
        </SCCard>
      </div>

      {/* Events near you */}
      <SCSection title="HAPPENING NEAR YOU" action={
        <button className="press" onClick={() => go('events-list')} style={{
          background: 'transparent', border: 'none', color: 'var(--ink-2)',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', cursor: 'pointer',
        }}>SEE ALL →</button>
      }>
        {offline ? (
          <SCErrorState
            compact
            title="Can't load events right now"
            body="We can't reach the SceneCheck server. Check your connection and try again."
            onRetry={() => window.scToast && window.scToast({ message: 'Still offline. Turn off Offline mode in Tweaks to reconnect.', kind: 'error' })}
          />
        ) : showSkeletons ? (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scroll">
            {[0,1,2,3].map(i => <SCEventCardSkeleton key={i}/>)}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }} className="scroll">
            {events.slice(0, 5).map(e => (
              <SCEventCard key={e.id} event={e} joined={isJoinedNow(e.id)} joinedSet={joined}
                onClick={() => go({ name: 'event', eventId: e.id })}/>
            ))}
          </div>
        )}
      </SCSection>

      {/* Nearby people */}
      <SCSection title="PEOPLE WITH SHARED INTERESTS" action={
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
          {people.length} match
        </span>
      }>
        <SCCard style={{ padding: '4px 0' }}>
          {people.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <SCPersonRow person={p}
                onClick={() => go({ name: 'profile-other', personId: p.id })}
                right={
                  <button onClick={(ev) => { ev.stopPropagation(); go({ name: 'profile-other', personId: p.id }); }}
                    className="press"
                    style={{
                      width: 32, height: 32, borderRadius: 10, border: '1px solid var(--line)',
                      background: 'var(--surface)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <SCIcon name="chevron-right" size={14}/>
                  </button>
                }/>
            </div>
          ))}
        </SCCard>
      </SCSection>
    </div>
  );
}

function LegendDot({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', letterSpacing: '0.04em' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }}/>
      {label}
    </span>
  );
}

function SCEventCard({ event, joined, joinedSet, onClick }) {
  const accent = event.kind === 'yours' ? 'var(--primary)'
              : event.kind === 'friend' ? 'var(--accent-friend)'
              : 'var(--accent-blue)';
  const label = event.kind === 'yours' ? 'YOUR EVENT'
              : event.kind === 'friend' ? 'FRIEND HOSTING'
              : 'RECOMMENDED';
  return (
    <div onClick={onClick} className="press" style={{
      flex: '0 0 232px', background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: 18, padding: 14, cursor: 'pointer',
      display: 'flex', flexDirection: 'column', gap: 10, minHeight: 168,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }}/>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.16em', fontWeight: 600, color: accent }}>{label}</span>
        {joined && (
          <span style={{
            marginLeft: 'auto', background: 'var(--good)', color: 'white',
            fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', fontWeight: 600,
            padding: '3px 7px', borderRadius: 999,
          }}>JOINED</span>
        )}
      </div>
      <div className="display" style={{ fontSize: 17, lineHeight: 1.15 }}>{event.title}</div>
      {/* H2 FIX #1 — pre-flight conflict chip */}
      {joinedSet && !joined && (
        <div style={{ marginTop: -4 }}>
          <ConflictChip event={event} joined={joinedSet}/>
        </div>
      )}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)' }}>{scWhenRange(event)}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{event.where}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 6, borderTop: '1px solid var(--line)' }}>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600 }}>
          {event.attendees}<span style={{ color: 'var(--ink-3)' }}>/{event.cap}</span>
        </span>
        {event.interests.slice(0,1).map(t => <SCTag key={t} tag={t} size="sm" tone="soft"/>)}
      </div>
    </div>
  );
}

// ── EVENTS LIST (all happening events, vertical list) ───────
// What the "SEE ALL" link on the home screen opens. The map already exists for
// browsing pins spatially — this surface is for skimming everything as a list,
// reading details without committing to a pin tap, and filtering by kind.
function SCEventsList({ go, back, joined, pendingLeave, toggleJoin }) {
  const [filter, setFilter] = useStateS('all');
  const isJoinedNow = (id) => joined.has(id) && !(pendingLeave && pendingLeave.has && pendingLeave.has(id));
  const isRecommended = (e) => e.kind === 'recommended'
    || (e.interests || []).some(t => (SC_ME?.interests || []).includes(t));
  const list = SC_EVENTS.filter(e =>
    filter === 'all' ? true
    : filter === 'recommended' ? isRecommended(e)
    : e.kind === filter
  );
  const counts = {
    all: SC_EVENTS.length,
    yours: SC_EVENTS.filter(e => e.kind === 'yours').length,
    friend: SC_EVENTS.filter(e => e.kind === 'friend').length,
    recommended: SC_EVENTS.filter(isRecommended).length,
  };
  const accentFor = (e) => e.kind === 'yours' ? 'var(--primary)'
    : e.kind === 'friend' ? 'var(--accent-friend)'
    : isRecommended(e) ? 'var(--accent-blue)'
    : 'var(--map-pin-mute)';
  const kindLabel = (e) => e.kind === 'yours' ? 'YOUR EVENT'
    : e.kind === 'friend' ? 'FRIEND HOSTING'
    : isRecommended(e) ? 'RECOMMENDED'
    : 'NEARBY';
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('home')}
        subtitle="HAPPENING NEAR YOU" title=""
        right={
          <button onClick={() => go('map')} className="press" style={{
            height: 34, padding: '0 12px', borderRadius: 999,
            background: 'var(--card)', border: '1px solid var(--line)',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
            color: 'var(--ink-2)',
          }}>
            <SCIcon name="pin" size={12}/> MAP
          </button>
        }/>
      <div style={{ padding: '0 18px 14px' }}>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95 }}>
          Events nearby
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)' }}>
          {list.length} {list.length === 1 ? 'event' : 'events'} happening · Sat May 9 · Irvine
        </div>
      </div>

      {/* filter chips — same kinds as the map */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: 6, overflowX: 'auto' }} className="scroll">
        {[
          { k: 'all',         label: `ALL · ${counts.all}` },
          { k: 'yours',       label: `YOURS · ${counts.yours}` },
          { k: 'friend',      label: `FRIENDS · ${counts.friend}` },
          { k: 'recommended', label: `FOR YOU · ${counts.recommended}` },
        ].map(c => (
          <button key={c.k} onClick={() => setFilter(c.k)} className="press" style={{
            flexShrink: 0,
            padding: '8px 12px', borderRadius: 999,
            background: filter === c.k ? 'var(--ink)' : 'var(--card)',
            color: filter === c.k ? 'white' : 'var(--ink)',
            border: '1px solid ' + (filter === c.k ? 'var(--ink)' : 'var(--line)'),
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            cursor: 'pointer',
          }}>{c.label}</button>
        ))}
      </div>

      {/* event rows */}
      {list.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <SCCard style={{ padding: 24, textAlign: 'center' }}>
            <div className="display-tight" style={{ fontSize: 20, marginBottom: 6 }}>Nothing in this slice</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>
              No {filter === 'yours' ? 'events you\'re hosting' : filter === 'friend' ? 'friend-hosted events' : 'recommended events'} right now. Try a different filter.
            </div>
          </SCCard>
        </div>
      ) : (
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map(e => {
            const accent = accentFor(e);
            const joinedNow = isJoinedNow(e.id);
            return (
              <div key={e.id} onClick={() => go({ name: 'event', eventId: e.id })} className="press" style={{
                display: 'flex', gap: 12, padding: 14, alignItems: 'stretch',
                background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
                cursor: 'pointer',
              }}>
                {/* left rail — accent + pin */}
                <div style={{
                  width: 44, flexShrink: 0, borderRadius: 12, background: accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  position: 'relative',
                }}>
                  <SCIcon name="pin" size={20}/>
                  {e.kind === 'yours' && (
                    <span style={{
                      position: 'absolute', top: -6, right: -6,
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'var(--card)', color: accent,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--display)', fontSize: 11, fontWeight: 800,
                      border: '1.5px solid ' + accent,
                    }}>★</span>
                  )}
                </div>
                {/* center — meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent }}/>
                    <span className="mono" style={{ fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, color: accent }}>
                      {kindLabel(e)}
                    </span>
                    {joinedNow && (
                      <span style={{
                        marginLeft: 6, background: 'var(--good)', color: 'white',
                        fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em', fontWeight: 600,
                        padding: '2px 6px', borderRadius: 999,
                      }}>JOINED</span>
                    )}
                    {!joinedNow && <ConflictChip event={e} joined={joined} compact/>}
                  </div>
                  <div className="display" style={{ fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>
                    {e.title}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                    {scWhenRange(e)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                    {e.where}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>
                      {e.attendees}<span style={{ color: 'var(--ink-3)' }}>/{e.cap}</span>
                    </span>
                    {(e.interests || []).slice(0, 2).map(t => (
                      <SCTag key={t} tag={t} size="sm" tone="soft"/>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <SCIcon name="chevron-right" size={16} color="var(--ink-3)"/>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── MAP (full) ───────────────────────────────────────────────
function SCMapScreen({ go, back, joined, pendingLeave, toggleJoin, focusEventId = null }) {
  const [filter, setFilter] = useStateS('all');
  // Helper: an event is "recommended" if it's app-discovered OR it shares
  // at least one interest tag with the current user.
  const isRecommended = (e) => e.kind === 'recommended'
    || (e.interests || []).some(t => (SC_ME?.interests || []).includes(t));
  const filtered = SC_EVENTS.filter(e =>
    filter === 'all' ? true
    : filter === 'recommended' ? isRecommended(e)
    : e.kind === filter
  );
  const counts = {
    all: SC_EVENTS.length,
    yours: SC_EVENTS.filter(e => e.kind === 'yours').length,
    friend: SC_EVENTS.filter(e => e.kind === 'friend').length,
    recommended: SC_EVENTS.filter(isRecommended).length,
  };
  // Pan/zoom state
  const [tx, setTx] = useStateS(0);
  const [ty, setTy] = useStateS(0);
  const [zoom, setZoom] = useStateS(1);

  // ── Search-on-map state ───────────────────────────────────
  // Lives entirely inside this screen so the user never loses map context.
  // Picking a result pans+zooms to the pin AND keeps the result selected
  // (focusedId) so the bottom sheet swaps to that event's details.
  const [searchQ, setSearchQ] = useStateS('');
  const [searchOpen, setSearchOpen] = useStateS(false);
  const [focusedId, setFocusedId] = useStateS(focusEventId);
  const searchInputRef = React.useRef(null);
  const focusedEvent = focusedId ? SC_EVENTS.find(e => e.id === focusedId) : null;
  // Search across event title, location and tag list. Cheap substring match.
  // Results are independent of the kind-filter chips — a search match should
  // always surface even if the chip would hide its pin (we untoggle the chip
  // back to "all" in that case to keep the pin visible).
  const searchResults = React.useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    if (!q) return [];
    return SC_EVENTS.filter(e =>
      e.title.toLowerCase().includes(q)
      || (e.where || '').toLowerCase().includes(q)
      || (e.interests || []).some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [searchQ]);

  // Center the map on a pin. Pins use normalized (x, y) in [0,1] inside a
  // 402×874 base map; the wrapper applies translate(tx, ty) then scale(zoom)
  // about center, so to bring (px, py) to viewport center we need:
  //   tx = MAP_W * zoom * (0.5 - px),   ty = MAP_H * zoom * (0.5 - py)
  const MAP_W = 402, MAP_H = 874;
  const focusPin = (p, opts = {}) => {
    const targetZoom = opts.zoom != null ? opts.zoom : Math.max(1.2, zoom);
    setZoom(targetZoom);
    setTx(MAP_W * targetZoom * (0.5 - p.x));
    setTy(MAP_H * targetZoom * (0.5 - p.y));
  };
  // When the screen is entered with `focusEventId` (e.g. from Event Detail's
  // location row), pan + zoom to that pin on mount so the user lands directly
  // on it. We run this once — manual interactions afterward are free to move
  // the camera anywhere.
  React.useEffect(() => {
    if (!focusEventId) return;
    const p = SC_EVENTS.find(x => x.id === focusEventId);
    if (p) focusPin(p, { zoom: 1.5 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEventId]);
  const pickResult = (e) => {
    setFocusedId(e.id);
    // If the kind-filter would hide this pin, drop it back to "all" so the
    // selected pin remains visible after focusing.
    if (filter !== 'all'
        && !(filter === 'recommended' ? isRecommended(e) : e.kind === filter)) {
      setFilter('all');
    }
    focusPin(e);
    setSearchOpen(false);
    setSearchQ('');
  };
  const clearFocus = () => { setFocusedId(null); };

  // `tracking` = pointer is down but we haven't crossed the drag threshold yet,
  // so we let the underlying pin receive the click. `active` = real drag in
  // progress, pointer captured by the pan surface. The ref drives per-frame
  // pointer math; the mirror state below drives styling so React re-renders.
  const dragRef = React.useRef({ tracking: false, active: false, sx: 0, sy: 0, ox: 0, oy: 0, pointerId: null });
  const [dragActive, setDragActive] = useStateS(false);
  const onPointerDown = (e) => {
    dragRef.current = { tracking: true, active: false, sx: e.clientX, sy: e.clientY, ox: tx, oy: ty, pointerId: e.pointerId };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d.tracking) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.active) {
      // Only promote to a real drag once the pointer has moved a bit. This
      // keeps taps on pins as clicks rather than swallowing them via pointer
      // capture on the outer pan surface.
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      d.active = true;
      setDragActive(true);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
    }
    // Clamp pan so map stays roughly in view. Search-pan can briefly push the
    // map past the manual-drag cap; we still clamp on drag because a user
    // panning by hand shouldn't be able to wander off the canvas.
    const maxPanX = MAP_W/2 * zoom + 80;
    const maxPanY = MAP_H/2 * zoom + 80;
    setTx(Math.max(-maxPanX, Math.min(maxPanX, d.ox + dx)));
    setTy(Math.max(-maxPanY, Math.min(maxPanY, d.oy + dy)));
  };
  const onPointerUp = (e) => {
    const d = dragRef.current;
    if (d.active) {
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
    d.tracking = false;
    d.active = false;
    setDragActive(false);
  };
  const reset = () => { setTx(0); setTy(0); setZoom(1); setFocusedId(null); };
  // Wheel/trackpad zoom — anchors on the cursor so the point under the
  // pointer stays put as you scroll. Math: world point under cursor is
  //   world = (vx - tx) / z_old
  // After zoom we want the same world point at the same viewport pos vx:
  //   tx_new = vx - z_new * world  = vx - z_new * (vx - tx) / z_old
  const onWheel = (e) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = e.clientX - cx; // cursor relative to map-viewport center
    const vy = e.clientY - cy;
    // Trackpads send small deltaY values; mice send ±100. Normalize either
    // to a smooth multiplicative factor. Negative deltaY = scroll up = zoom in.
    const factor = Math.exp(-e.deltaY * 0.0018);
    const zNew = Math.max(0.6, Math.min(2.5, +(zoom * factor).toFixed(3)));
    if (zNew === zoom) return;
    setZoom(zNew);
    setTx(vx - zNew * (vx - tx) / zoom);
    setTy(vy - zNew * (vy - ty) / zoom);
  };
  return (
    <div className="fade-in" style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* full map — pan & zoom */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ position: 'absolute', inset: 0, background: 'var(--map-land)', overflow: 'hidden', cursor: dragActive ? 'grabbing' : 'grab', touchAction: 'none' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${zoom})`,
          transformOrigin: 'center center',
          transition: dragActive ? 'none' : 'transform 360ms cubic-bezier(.2,.7,.2,1)',
        }}>
          <SCMap width={MAP_W} height={MAP_H}
            pins={filtered}
            activeId={focusedId}
            showHover
            onPinTap={(p) => {
              // Tapping a pin selects + centers it but doesn't immediately
              // navigate, so the user can read the bottom card first. A
              // second tap on the same pin opens the event.
              if (focusedId === p.id) {
                go({ name: 'event', eventId: p.id });
              } else {
                setFocusedId(p.id);
                focusPin(p);
              }
            }}
          />
        </div>
      </div>

      {/* zoom controls */}
      <div style={{ position: 'absolute', right: 14, top: 110, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button onClick={() => setZoom(z => Math.min(2.5, +(z + 0.25).toFixed(2)))} className="press" aria-label="Zoom in" style={zoomBtn}><SCIcon name="plus" size={16}/></button>
        <button onClick={() => setZoom(z => Math.max(0.6, +(z - 0.25).toFixed(2)))} className="press" aria-label="Zoom out" style={zoomBtn}><span style={{ fontWeight:700, fontSize:18, lineHeight:1 }}>−</span></button>
        <button onClick={reset} className="press" style={zoomBtn} aria-label="Recenter map"><SCIcon name="crosshair" size={16}/></button>
      </div>

      {/* top overlay */}
      <div style={{ position: 'relative', zIndex: 10, padding: '10px 14px 0' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => back ? back() : go('home')} className="press" aria-label="Go back" style={{
            width: 42, height: 42, borderRadius: 14, background: 'var(--card)',
            border: '1px solid var(--line)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="back" size={18}/>
          </button>
          {/* Inline search — stays in the map. Tapping focuses the input;
              typing reveals a dropdown of matching events; picking one pans
              the map and selects the pin. */}
          <div style={{ flex: 1, position: 'relative' }}>
            <div onPointerDown={(e) => e.stopPropagation()} style={{
              height: 42, background: 'var(--card)', borderRadius: 14,
              border: '1px solid ' + (searchOpen ? 'var(--ink)' : 'var(--line)'),
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 12px',
              transition: 'border-color 160ms ease',
            }}>
              <SCIcon name="search" size={16} color="var(--ink-3)"/>
              <input
                ref={searchInputRef}
                value={searchQ}
                onFocus={() => setSearchOpen(true)}
                onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
                placeholder="Search events, places…"
                style={{
                  flex: 1, height: '100%', minWidth: 0,
                  background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)',
                }}/>
              {(searchQ || searchOpen) && (
                <button onClick={() => { setSearchQ(''); setSearchOpen(false); searchInputRef.current?.blur(); }} className="press" style={{
                  width: 26, height: 26, borderRadius: 8, border: 'none',
                  background: 'var(--subtle)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--ink-2)',
                }}>
                  <SCIcon name="x" size={12}/>
                </button>
              )}
            </div>
            {/* Results dropdown */}
            {searchOpen && (
              <div onPointerDown={(e) => e.stopPropagation()} style={{
                position: 'absolute', top: 48, left: 0, right: 0,
                background: 'var(--card)', border: '1px solid var(--line)',
                borderRadius: 14, padding: 6,
                boxShadow: '0 12px 40px -10px rgba(0,0,0,0.25)',
                maxHeight: 320, overflowY: 'auto',
                zIndex: 20,
              }} className="scroll">
                {searchQ.trim() === '' ? (
                  <div style={{ padding: 12 }}>
                    <div className="label-cap" style={{ marginBottom: 8 }}>Suggestions</div>
                    {SC_EVENTS.slice(0, 5).map(e => (
                      <SCSearchResultRow key={e.id} event={e} onPick={() => pickResult(e)}/>
                    ))}
                  </div>
                ) : searchResults.length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginBottom: 4 }}>
                      No matches on the map
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      Try a tag (<span className="mono">#climbing</span>, <span className="mono">#biking</span>), a venue, or a host name.
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="label-cap" style={{ padding: '8px 10px 4px' }}>
                      {searchResults.length} match{searchResults.length === 1 ? '' : 'es'}
                    </div>
                    {searchResults.map(e => (
                      <SCSearchResultRow key={e.id} event={e} onPick={() => pickResult(e)}/>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => go({ name:'create-event' })} className="press" aria-label="Create a new event" style={{
            width: 42, height: 42, borderRadius: 14, background: 'var(--ink)',
            color: 'var(--card)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="plus" size={18}/>
          </button>
        </div>
        {/* filter chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10, overflowX: 'auto' }} className="scroll">
          {[
            { k: 'all', label: `ALL · ${counts.all}` },
            { k: 'yours', label: `YOURS · ${counts.yours}` },
            { k: 'friend', label: `FRIENDS · ${counts.friend}` },
            { k: 'recommended', label: `FOR YOU · ${counts.recommended}` },
          ].map(c => (
            <button key={c.k} onClick={() => setFilter(c.k)} className="press" style={{
              flexShrink: 0,
              padding: '8px 12px', borderRadius: 999,
              background: filter === c.k ? 'var(--ink)' : 'var(--card)',
              color: filter === c.k ? 'white' : 'var(--ink)',
              border: '1px solid ' + (filter === c.k ? 'var(--ink)' : 'var(--line)'),
              fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
              cursor: 'pointer',
            }}>{c.label}</button>
          ))}
        </div>
      </div>

      {/* Backdrop to dismiss search dropdown on outside tap */}
      {searchOpen && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={() => setSearchOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 5, background: 'transparent',
        }}/>
      )}

      {/* bottom sheet — KEY + nearest, OR focused-event card */}
      <div style={{
        position: 'absolute', left: 12, right: 12, bottom: 24, zIndex: 10,
      }}>
        {focusedEvent ? (
          <SCCard style={{ padding: 14, boxShadow: '0 12px 40px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div className="label-cap">Focused on map</div>
              <button onClick={clearFocus} className="press" style={{
                background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
              }}>
                <SCIcon name="x" size={11}/> CLEAR
              </button>
            </div>
            {(() => {
              const e = focusedEvent;
              const sharesTag = (e.interests || []).some(t => (SC_ME?.interests || []).includes(t));
              const isRec = e.kind === 'recommended' || sharesTag;
              const pinColor = e.kind === 'yours' ? 'var(--primary)'
                             : e.kind === 'friend' ? (isRec ? 'var(--accent-friend)' : 'var(--map-pin-mute)')
                             : isRec ? 'var(--accent-blue)'
                             : 'var(--map-pin-mute)';
              return (
                <div onClick={() => go({ name: 'event', eventId: e.id })} className="press"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12,
                    background: pinColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}>
                    <SCIcon name="pin" size={20}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display" style={{ fontSize: 15, lineHeight: 1.15, marginBottom: 2 }}>{e.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{scWhenRange(e)}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{e.where}</div>
                  </div>
                  <SCIcon name="chevron-right" size={16}/>
                </div>
              );
            })()}
          </SCCard>
        ) : (
          <SCCard style={{ padding: 14, boxShadow: '0 12px 40px -12px rgba(0,0,0,0.25)' }}>
            <div className="label-cap" style={{ marginBottom: 10 }}>Key</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <KeyRow color="var(--primary)" label="Your events"/>
              <KeyRow color="var(--accent-friend)" label="Friend hosting"/>
              <KeyRow color="var(--accent-blue)" label="Recommended"/>
              <KeyRow color="var(--map-pin-mute)" label="Nearby (other)"/>
              <KeyRow color="white" stroke="var(--accent-blue)" label="You are here"/>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.35 }}>
              Pins show <em>events</em> only. People's locations are never displayed.
            </div>
            <div className="label-cap" style={{ marginBottom: 6 }}>Closest event</div>
            {(() => {
              const e = filtered[0] || SC_EVENTS[0];
              const sharesTag = (e.interests || []).some(t => (SC_ME?.interests || []).includes(t));
              const isRec = e.kind === 'recommended' || sharesTag;
              const pinColor = e.kind === 'yours' ? 'var(--primary)'
                             : e.kind === 'friend' ? (isRec ? 'var(--accent-friend)' : 'var(--map-pin-mute)')
                             : isRec ? 'var(--accent-blue)'
                             : 'var(--map-pin-mute)';
              return (
                <div onClick={() => { setFocusedId(e.id); focusPin(e); }} className="press"
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 12,
                    background: pinColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}>
                    <SCIcon name="pin" size={18}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="display" style={{ fontSize: 14, lineHeight: 1.15 }}>{e.title}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{scWhenRange(e)}</div>
                  </div>
                  <SCIcon name="chevron-right" size={16}/>
                </div>
              );
            })()}
          </SCCard>
        )}
      </div>
    </div>
  );
}

// Compact row used inside the map's inline search dropdown. Same DNA as the
// search screen's result rows but tuned for the small popout.
function SCSearchResultRow({ event, onPick }) {
  const isRecommended = event.kind === 'recommended'
    || (event.interests || []).some(t => (SC_ME?.interests || []).includes(t));
  const accent = event.kind === 'yours' ? 'var(--primary)'
    : event.kind === 'friend' ? 'var(--accent-friend)'
    : isRecommended ? 'var(--accent-blue)'
    : 'var(--map-pin-mute)';
  return (
    <button onClick={onPick} className="press" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 10px', background: 'transparent', border: 'none', cursor: 'pointer',
      textAlign: 'left', borderRadius: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        background: accent, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <SCIcon name="pin" size={14}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{event.title}</div>
        <div className="mono" style={{
          fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '0.04em', marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {scWhenRange(event)} · {event.where}
        </div>
      </div>
      <SCIcon name="chevron-right" size={13} color="var(--ink-3)"/>
    </button>
  );
}

const zoomBtn = {
  width: 38, height: 38, borderRadius: 12, background: 'var(--card)',
  border: '1px solid var(--line)', cursor: 'pointer', color: 'var(--ink)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 4px 10px -4px rgba(0,0,0,0.18)',
};

// ── Date + Time pickers (used by Create Event) ───────────────
// Helpers for parsing & formatting the friendly strings we keep on the form
// ("Sat May 16" and "7:00 AM"). State lives as plain strings/Dates; the popouts
// just translate user gestures into them.
// Date/time utilities (scFmtDate, scParseDate, scParseTime, scFmtTime,
// scTimeToMin, scMinToTime) and month/day constants live in src/date-time.jsx
// and are exposed on window before this file loads.

// Calendar popover — month grid with prev/next.
function SCDatePicker({ value, onChange }) {
  const [open, setOpen] = useStateS(false);
  const d = scParseDate(value);
  const [view, setView] = useStateS({ y: d.getFullYear(), m: d.getMonth() });
  const wrapRef = useRefS(null);
  useEffectS(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  // Re-anchor the view to the selected month whenever the picker opens.
  useEffectS(() => { if (open) setView({ y: d.getFullYear(), m: d.getMonth() }); /* eslint-disable-next-line */ }, [open]);

  const firstDay = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m+1, 0).getDate();
  const today = new Date(); today.setHours(0,0,0,0);
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(i);

  const stepMonth = (dir) => setView(v => {
    const nm = v.m + dir;
    if (nm < 0)  return { y: v.y - 1, m: 11 };
    if (nm > 11) return { y: v.y + 1, m: 0 };
    return { y: v.y, m: nm };
  });

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="press"
        style={{ ...inputCss, display:'flex', alignItems:'center', gap: 10, cursor:'pointer', textAlign:'left' }}>
        <SCIcon name="calendar" size={16} color="var(--ink-3)"/>
        <span style={{ flex: 1 }}>{scFmtDate(d)}</span>
        <span style={{ display:'inline-flex', transition:'transform 160ms ease', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
        </span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
          background:'var(--card)', border:'1px solid var(--line)', borderRadius: 16,
          padding: 14, boxShadow:'0 18px 40px -12px rgba(0,0,0,0.32)',
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
            {(() => {
              const atOrBeforeCurrent = view.y < today.getFullYear()
                || (view.y === today.getFullYear() && view.m <= today.getMonth());
              return (
                <button type="button" onClick={() => stepMonth(-1)} className="press"
                  disabled={atOrBeforeCurrent}
                  style={{ ...scNavBtn, opacity: atOrBeforeCurrent ? 0.35 : 1, cursor: atOrBeforeCurrent ? 'not-allowed' : 'pointer' }}>
                  <SCIcon name="back" size={14}/>
                </button>
              );
            })()}
            <div className="display" style={{ fontSize: 14, fontWeight: 700, letterSpacing:'-0.01em' }}>
              {SC_MON_LONG[view.m]} {view.y}
            </div>
            <button type="button" onClick={() => stepMonth(1)} className="press" style={scNavBtn}>
              <SCIcon name="chevron-right" size={14}/>
            </button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 2, marginBottom: 6 }}>
            {['S','M','T','W','T','F','S'].map((c, i) => (
              <div key={i} className="mono" style={{ textAlign:'center', fontSize: 10, color:'var(--ink-3)', fontWeight: 600, letterSpacing:'0.08em' }}>{c}</div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((day, i) => {
              if (day === null) return <div key={i} style={{ height: 34 }}/>;
              const date = new Date(view.y, view.m, day);
              const sel = date.toDateString() === d.toDateString();
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today;
              return (
                <button key={i} type="button" className="press"
                  disabled={isPast}
                  onClick={() => { if (isPast) return; onChange(scFmtDate(date)); setOpen(false); }}
                  style={{
                    height: 34, borderRadius: 10,
                    background: sel ? 'var(--ink)' : 'transparent',
                    color: sel ? 'white'
                         : isPast ? 'var(--ink-3)'
                         : isToday ? 'var(--primary)' : 'var(--ink)',
                    fontWeight: sel || isToday ? 700 : 500,
                    fontFamily:'var(--mono)', fontSize: 13,
                    border: (!sel && isToday) ? '1.5px solid var(--primary)' : '1px solid transparent',
                    cursor: isPast ? 'not-allowed' : 'pointer',
                    opacity: isPast ? 0.35 : 1,
                    textDecoration: isPast ? 'line-through' : 'none',
                  }}>{day}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const scNavBtn = {
  width: 30, height: 30, borderRadius: 9, background:'var(--subtle)', border:'none', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center',
};

// One column of an iOS clock-style scroll picker. Behaves like the iPhone
// timer/clock wheel: scrub-to-select with momentum, snap on release, and the
// "active" row updates live as you scroll (not just on idle).
function SCWheel({ items, value, onChange, format = (x) => String(x).padStart(2,'0') }) {
  const ROW = 36;
  const VIS = 5;
  const H = ROW * VIS;
  const PAD = (H - ROW) / 2;
  const scrollRef = useRefS(null);
  const idleRef = useRefS(null);
  const externalIdx = Math.max(0, items.indexOf(value));
  // Local "what row is centered right now" — drives the bold/active styling
  // while the user is mid-scroll. Reconciles back to the prop on idle.
  const [localIdx, setLocalIdx] = useStateS(externalIdx);

  // When the parent value changes (e.g. wheel just mounted, or another part
  // of the form pushed a new value), sync our scroll position to match.
  useLayoutEffectS(() => {
    setLocalIdx(externalIdx);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = externalIdx * ROW;
    }
  }, [externalIdx]);

  const onScroll = () => {
    if (!scrollRef.current) return;
    const visIdx = Math.round(scrollRef.current.scrollTop / ROW);
    const clamped = Math.max(0, Math.min(items.length - 1, visIdx));
    if (clamped !== localIdx) setLocalIdx(clamped);

    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      if (!scrollRef.current) return;
      // Hard-snap precisely to the row in case CSS scroll-snap left us a
      // sub-pixel off, then emit the value upward.
      scrollRef.current.scrollTop = clamped * ROW;
      const next = items[clamped];
      if (next !== value) onChange(next);
    }, 90);
  };

  return (
    <div style={{ position:'relative', flex: 1, height: H, overflow:'hidden' }}>
      {/* highlight band (behind text) */}
      <div style={{
        position:'absolute', left: 0, right: 0, top: PAD, height: ROW,
        background:'var(--subtle)', borderRadius: 10, zIndex: 0,
      }}/>
      <div ref={scrollRef} onScroll={onScroll}
        className="sc-wheel-list"
        style={{
          position:'relative', zIndex: 1, height: H, overflowY:'auto',
          scrollSnapType:'y mandatory',
          scrollbarWidth:'none', msOverflowStyle:'none',
          overscrollBehavior:'contain',
          touchAction:'pan-y',
          WebkitOverflowScrolling:'touch',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, black 22%, black 78%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, black 22%, black 78%, transparent 100%)',
        }}
        onWheel={(e) => { e.stopPropagation(); }}>
        <style>{`.sc-wheel-list::-webkit-scrollbar{display:none}`}</style>
        <div style={{ height: PAD }}/>
        {items.map((x, i) => {
          const dist = Math.abs(i - localIdx);
          // iPhone-style depth feel: items further from center are smaller,
          // dimmer, and lighter weight.
          const scale = dist === 0 ? 1 : dist === 1 ? 0.92 : dist === 2 ? 0.84 : 0.78;
          const opacity = dist === 0 ? 1 : dist === 1 ? 0.55 : dist === 2 ? 0.3 : 0.18;
          return (
            <div key={i}
              onClick={() => {
                if (!scrollRef.current) return;
                scrollRef.current.scrollTo({ top: i * ROW, behavior: 'smooth' });
              }}
              style={{
                height: ROW, display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--mono)',
                fontWeight: dist === 0 ? 700 : 500,
                fontSize: dist === 0 ? 19 : 17,
                color: 'var(--ink)',
                opacity,
                transform: `scale(${scale})`,
                transition: 'opacity 120ms ease, transform 120ms ease, font-weight 120ms ease',
                scrollSnapAlign:'center', cursor:'pointer', userSelect:'none',
              }}>{format(x)}</div>
          );
        })}
        <div style={{ height: PAD }}/>
      </div>
    </div>
  );
}

// Three-column clock-app style time picker.
function SCTimePicker({ value, onChange }) {
  const [open, setOpen] = useStateS(false);
  const parts = scParseTime(value);
  const wrapRef = useRefS(null);
  useEffectS(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
  const MINS  = Array.from({ length: 12 }, (_, i) => i * 5); // 5-min steps
  const AP    = ['AM', 'PM'];
  const setPart = (k, v) => onChange(scFmtTime({ ...parts, [k]: v }));

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="press"
        style={{ ...inputCss, display:'flex', alignItems:'center', gap: 10, cursor:'pointer', textAlign:'left' }}>
        <SCIcon name="clock" size={16} color="var(--ink-3)"/>
        <span style={{ flex: 1 }}>{scFmtTime(parts)}</span>
        <span style={{ display:'inline-flex', transition:'transform 160ms ease', transform: open ? 'rotate(90deg)' : 'rotate(0)' }}>
          <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
        </span>
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
          background:'var(--card)', border:'1px solid var(--line)', borderRadius: 16,
          padding: 12, boxShadow:'0 18px 40px -12px rgba(0,0,0,0.32)',
        }}>
          <div style={{ display:'flex', gap: 6, alignItems:'stretch' }}>
            <SCWheel items={HOURS} value={parts.h} onChange={(v) => setPart('h', v)} format={(x) => String(x)}/>
            <div style={{ alignSelf:'center', fontFamily:'var(--mono)', fontWeight: 800, fontSize: 18, color:'var(--ink-3)' }}>:</div>
            <SCWheel items={MINS} value={parts.m} onChange={(v) => setPart('m', v)}/>
            <SCWheel items={AP} value={parts.ap} onChange={(v) => setPart('ap', v)} format={(x) => x}/>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CREATE EVENT (multi-step) ────────────────────────────────
function SCCreateEvent({ go, activeAccount, setAccountSwitcherOpen, picture, orgPictures, requestDiscardDraft, offline, draftId, drafts, saveDraft, removeDraft }) {
  // If we're resuming a saved draft, locate it once on mount so we can
  // pre-fill the form, the step the user had reached, and remember the
  // id so publish/save-draft can update or remove the existing entry.
  const initialDraft = React.useMemo(() => {
    if (!draftId || !drafts) return null;
    return drafts.find(d => d.id === draftId) || null;
  }, [draftId]);
  const draftRefId = useRefS(initialDraft ? initialDraft.id : null);
  // Snapshot of the form as it looked when we started resuming the draft.
  // Used to detect whether the user has actually edited anything so the
  // exit prompt only appears when there are unsaved changes to decide on.
  const originalFormRef = useRefS(initialDraft ? initialDraft.form : null);
  // Save-changes sheet state — only used when resuming a draft and exiting
  // with edits the user hasn't decided what to do with yet.
  const [saveChangesOpen, setSaveChangesOpen] = useStateS(false);
  const [step, setStep] = useStateS(initialDraft ? (initialDraft.lastStep ?? 0) : 0);
  const [publishing, setPublishing] = useStateS(false);
  const [publishError, setPublishError] = useStateS(false);
  const [form, setForm] = useStateS(initialDraft ? initialDraft.form : {
    title: '',
    desc: '',
    date: 'Sat May 16',
    timeStart: '7:00 AM',
    timeEnd: '9:00 AM',
    location: 'Anteater Plaza',
    cap: 12,
    interests: ['biking'],
    visibility: 'public',
    minSubs: 3, // legacy — auto-derived as ceil(cap/5)
    addToCalendar: true,
    autoGroupChat: true,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleInterest = (t) => set('interests', form.interests.includes(t) ? form.interests.filter(x => x !== t) : [...form.interests, t]);
  // The host is whichever account is currently signed in. To host as another
  // account the user must switch accounts (from Profile → account switcher).
  const hostAccount = SC_MY_ACCOUNTS.find(a => a.id === activeAccount) || SC_MY_ACCOUNTS[0];
  const hostIsPersonal = hostAccount.id === 'me';
  const hostPic = hostIsPersonal ? picture : (orgPictures && orgPictures[hostAccount.id]) || null;

  // Time guardrail: end must be on or after start. We do NOT auto-adjust —
  // the user is free to pick any combination — but the warning stays visible
  // for as long as the times are out of order, and the Continue button
  // refuses to advance until they're reconciled.
  const startMin = scTimeToMin(form.timeStart);
  const endMin   = scTimeToMin(form.timeEnd);
  const timesInvalid = endMin < startMin;

  // DEMO ONLY — hardcoded so the conflict-warning state is reachable during
  // walkthroughs. A real implementation would check overlapping windows in
  // SC_EVENTS / the events table for the chosen location and date.
  const conflict = form.location.toLowerCase().includes('aldrich') && form.date.includes('May 16');

  const steps = ['Basics', 'When & Where', 'Tags & Limits', 'Review'];
  const TITLE_MAX = 60;
  const DESC_MAX  = 240;
  const isDirty = !!(form.title.trim() || form.desc.trim());
  // When resuming an existing draft, compare current form to its original
  // snapshot to know if the user has unsaved edits. JSON.stringify is fine
  // for this small flat-ish object; field order is stable.
  const hasUnsavedDraftEdits = () => {
    if (!originalFormRef.current) return false;
    try { return JSON.stringify(form) !== JSON.stringify(originalFormRef.current); }
    catch { return true; }
  };
  // Exit handler. Two cases:
  //   1) Resuming an existing draft: if there are no edits, go straight
  //      back to Drafts. If there are edits, open the Save / Discard /
  //      Keep-editing sheet so the user explicitly decides.
  //   2) Brand-new event flow: silently snapshot any in-progress content
  //      into Drafts and return home — no prompt (was confusing).
  const handleCancel = () => {
    if (draftRefId.current) {
      if (hasUnsavedDraftEdits()) { setSaveChangesOpen(true); return; }
      go('drafts');
      return;
    }
    if (isDirty && saveDraft) {
      const id = saveDraft(form, { id: draftRefId.current, lastStep: step });
      draftRefId.current = id;
      window.scToast && window.scToast({
        message: 'Saved to Drafts.',
        kind: 'info',
        action: { label: 'VIEW', onClick: () => go('drafts') },
      });
    }
    go('home');
  };
  // Resolution paths from the Save Changes sheet.
  const saveAndExit = () => {
    if (saveDraft) {
      const id = saveDraft(form, { id: draftRefId.current, lastStep: step });
      draftRefId.current = id;
    }
    setSaveChangesOpen(false);
    window.scToast && window.scToast({ message: 'Changes saved to draft.', kind: 'success' });
    go('drafts');
  };
  const discardAndExit = () => {
    setSaveChangesOpen(false);
    window.scToast && window.scToast({ message: 'Changes discarded — draft kept as-is.', kind: 'info' });
    go('drafts');
  };
  const handleBack = () => {
    if (step === 0) { handleCancel(); return; }
    setStep(step - 1);
  };
  const handlePublish = async () => {
    setPublishError(false);
    setPublishing(true);
    // Short-circuit offline state before hitting the API — the UI was already
    // built around this and the API layer doesn't yet model offline failure.
    if (offline) {
      setPublishing(false);
      setPublishError(true);
      window.scToast && window.scToast({ message: "Couldn't publish — you're offline.", kind: 'error' });
      return;
    }
    try {
      const result = await window.SC_API.createEvent({
        title: form.title,
        description: form.desc,
        location_name: form.location,
        capacity: form.cap,
        interests: form.interests,
        visibility: form.visibility,
      });
      const newEventId = result && result.event_id;
      // If we were resuming a draft, remove it from the store on success.
      if (draftRefId.current && removeDraft) removeDraft(draftRefId.current);
      window.scToast && window.scToast({ message: `"${form.title}" is live.`, kind: 'success' });
      go({ name: 'event-published', form, eventId: newEventId });
    } catch (err) {
      setPublishError(true);
      window.scToast && window.scToast({ message: "Couldn't publish — try again.", kind: 'error' });
    } finally {
      setPublishing(false);
    }
  };
  // Save the in-progress form to the drafts store and exit. Used by the
  // publish-failure recovery flow ("SAVE DRAFT" button on the error card)
  // and by the top-bar SAVE DRAFT shortcut. Reuses the draft id if we're
  // resuming, so the same draft updates in place instead of duplicating.
  const handleSaveDraft = () => {
    if (!saveDraft) { go('home'); return; }
    const newId = saveDraft(form, { id: draftRefId.current, lastStep: step });
    draftRefId.current = newId;
    setPublishError(false);
    window.scToast && window.scToast({
      message: 'Saved as draft. Find it in Profile → Drafts.',
      kind: 'success',
    });
    go('home');
  };
  const canNext = (
    (step === 0 && form.title.trim() && form.desc.trim()) ||
    (step === 1 && form.location.trim() && !timesInvalid) ||
    (step === 2 && form.interests.length > 0) ||
    (step === 3)
  );

  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <SCTopBar onBack={handleCancel}
        subtitle={`${draftRefId.current ? 'RESUMING DRAFT · ' : ''}STEP ${step+1} OF ${steps.length}`}
        title={`Create event — ${steps[step]}`}
        right={isDirty ? (
          <button onClick={handleSaveDraft} className="press" style={{
            height: 32, padding: '0 12px', borderRadius: 999, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer', color: 'var(--ink-2)',
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
            display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
            <SCIcon name="edit" size={11}/> SAVE DRAFT
          </button>
        ) : null}/>
      {/* progress bar */}
      <div style={{ padding:'0 18px 8px' }}>
        <div style={{ height: 4, background:'var(--subtle)', borderRadius: 2, overflow:'hidden' }}>
          <div style={{ width: `${((step+1)/steps.length)*100}%`, height:'100%', background:'var(--primary)', transition:'width 220ms ease' }}/>
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 16px' }}>
        {step === 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
            <Field label="Event title" hint={`What's it called? · ${form.title.length}/${TITLE_MAX}`}>
              <input value={form.title}
                onChange={e => set('title', e.target.value.slice(0, TITLE_MAX))}
                maxLength={TITLE_MAX}
                placeholder="Morning Ride — Back Bay loop"
                style={inputCss}/>
            </Field>
            <Field label="Description" hint={`A few sentences for attendees · ${form.desc.length}/${DESC_MAX}`}>
              <textarea value={form.desc}
                onChange={e => set('desc', e.target.value.slice(0, DESC_MAX))}
                maxLength={DESC_MAX}
                rows={4}
                placeholder="Easy 14-mile loop. Casual pace. Bring water. Coffee at Common Room after."
                style={{ ...inputCss, resize:'none', height: 110, paddingTop: 10 }}/>
            </Field>
            <Field label="Hosting as" hint={hostIsPersonal
              ? 'Posting under your personal profile. To host as one of your organizations, switch accounts from your profile.'
              : `Posting on behalf of ${hostAccount.name}. To host as a different account, switch accounts from your profile.`}>
              <div style={{
                display:'flex', alignItems:'center', gap: 10, padding:'10px 12px',
                background:'var(--subtle)', borderRadius: 12, marginTop: 4,
              }}>
                {hostPic ? (
                  <img src={hostPic} alt="" style={{ width: 36, height: 36, borderRadius: 11, objectFit:'cover' }}/>
                ) : (
                  <div style={{
                    width: 36, height: 36, borderRadius: 11,
                    background: hostIsPersonal
                      ? 'var(--ink)'
                      : 'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
                    color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:'var(--display)', fontWeight: 800, fontSize: 14,
                  }}>{hostAccount.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{hostAccount.name}</span>
                    <span className="mono" style={{
                      fontSize: 9, fontWeight: 700, letterSpacing:'0.12em',
                      padding:'2px 6px', borderRadius: 999,
                      background: hostIsPersonal ? 'var(--primary-soft)' : 'var(--subtle)',
                      color: hostIsPersonal ? 'var(--primary)' : 'var(--ink-2)',
                      border: hostIsPersonal ? 'none' : '1px solid var(--line)',
                    }}>{hostIsPersonal ? 'PERSONAL' : 'ORGANIZATION'}</span>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color:'var(--ink-3)', letterSpacing:'0.03em', marginTop: 2 }}>
                    {hostAccount.handle} · signed in
                  </div>
                </div>
                <button onClick={() => { setAccountSwitcherOpen && setAccountSwitcherOpen(true); go('profile'); }}
                  className="press"
                  style={{
                    flexShrink: 0,
                    padding:'8px 10px', borderRadius: 10,
                    background:'var(--card)', border:'1px solid var(--line)', cursor:'pointer',
                    fontFamily:'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing:'0.12em',
                    color:'var(--ink-2)',
                    display:'inline-flex', alignItems:'center', gap: 4,
                  }}>
                  <SCIcon name="back" size={12}/> SWITCH
                </button>
              </div>
            </Field>
          </div>
        )}

        {step === 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap: 16 }}>
            <Field label="Date">
              <SCDatePicker value={form.date} onChange={v => set('date', v)}/>
            </Field>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap: 12 }}>
              <Field label="Starts"><SCTimePicker value={form.timeStart} onChange={v => set('timeStart', v)}/></Field>
              <Field label="Ends"><SCTimePicker value={form.timeEnd} onChange={v => set('timeEnd', v)}/></Field>
            </div>
            {timesInvalid && (
              <div className="mono" style={{
                fontSize: 11, color:'var(--ink)', letterSpacing:'0.06em',
                background:'color-mix(in oklch, var(--warn) 18%, transparent)',
                border:'1px solid color-mix(in oklch, var(--warn) 55%, transparent)',
                padding:'10px 12px', borderRadius: 10,
                display:'flex', alignItems:'center', gap: 8,
                fontWeight: 600,
              }}>
                <span style={{ color:'color-mix(in oklch, var(--warn) 65%, var(--ink) 35%)', display:'inline-flex' }}>
                  <SCIcon name="clock" size={13}/>
                </span>
                <span>End time can't be before start time. Adjust one to continue.</span>
              </div>
            )}
            <Field label="Location" hint="Address or place name">
              <input value={form.location} onChange={e => set('location', e.target.value)} style={inputCss}/>
            </Field>
            {/* Mini map preview */}
            <div style={{ borderRadius: 16, overflow:'hidden', border:'1px solid var(--line)' }}>
              <SCMap width={336} height={140} compact pins={[{ id:'new', kind:'yours', x: 0.5, y: 0.5, title: form.title || 'New event' }]}/>
            </div>
            {conflict && (
              <div style={{ padding: 12, background:'#FFF3D9', border:'1px solid #F2B33C', borderRadius: 12, display:'flex', gap: 10 }}>
                <SCIcon name="bell" size={18} color="#A87100"/>
                <div style={{ fontSize: 12, color:'#7A5300', lineHeight: 1.4 }}>
                  <b>Heads up — possible conflict.</b> Another event is scheduled near here at the same time. You can still publish; attendees will see both.
                </div>
              </div>
            )}
            <RowToggle label="Add to my Google Calendar" v={form.addToCalendar} onChange={v => set('addToCalendar', v)}/>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:'flex', flexDirection:'column', gap: 18 }}>
            <Field label="Interest tags" hint="Pick at least one. Events are matched to subscribers via these.">
              <div style={{ display:'flex', flexWrap:'wrap', gap: 6 }}>
                {['biking','running','climbing','study','coffee','cooking','music','golf','informatics','uci'].map(t => (
                  <button key={t} onClick={() => toggleInterest(t)} className="press" style={{
                    padding:'8px 12px', borderRadius: 999, cursor:'pointer',
                    background: form.interests.includes(t) ? 'var(--primary)' : 'var(--subtle)',
                    color: form.interests.includes(t) ? 'var(--primary-ink)' : 'var(--ink)',
                    border:'none', fontFamily:'var(--mono)', fontSize: 13, fontWeight: 500,
                  }}>
                    <span style={{ opacity: 0.55 }}>#</span>{t}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Participant limit" hint={`Up to ${form.cap} attendees. Extras join a waitlist.`}>
              <div style={{ display:'flex', alignItems:'center', gap: 10 }}>
                <input type="range" min="2" max="60" value={form.cap} onChange={e => set('cap', parseInt(e.target.value))}
                  style={{ flex: 1, accentColor:'var(--primary)' }}/>
                <span className="mono" style={{ minWidth: 36, textAlign:'right', fontWeight: 600, color:'var(--primary)' }}>{form.cap}</span>
              </div>
            </Field>
            <Field label={<>Threshold to publish publicly <SCHelpTip title="WHAT IS THIS?" body={"Your event stays semi-private at first. We only show it to non-tag-matching users once this many people RSVP. It's calculated automatically as 1/5 of your capacity — so a 12-person event needs 3 subscribers before going public."}/></>} hint="Until this many users subscribe, the event is hidden from non-tag-matching users. Calculated as 1/5 of capacity.">
              <div style={{ display:'flex', alignItems:'baseline', gap: 10, padding: '6px 2px' }}>
                <span className="display-tight" style={{ fontSize: 36, lineHeight: 1, color:'var(--primary)' }}>{Math.max(1, Math.ceil(form.cap/5))}</span>
                <span className="mono" style={{ fontSize: 12, color:'var(--ink-3)' }}>
                  / {form.cap} cap · auto-derived
                </span>
              </div>
            </Field>
            <Field label="Visibility">
              <Segmented value={form.visibility} options={[{k:'public', label:'Public'},{k:'friends', label:'Friends'},{k:'private', label:'Private'}]} onChange={v => set('visibility', v)}/>
            </Field>
            <RowToggle label="Auto-create group chat for attendees" v={form.autoGroupChat} onChange={v => set('autoGroupChat', v)}/>
          </div>
        )}

        {step === 3 && (
          <div style={{ display:'flex', flexDirection:'column', gap: 14 }}>
            {/* H2 FIX #4 — detailed publish failure with diagnostic + recovery */}
            {publishError && (
              <PublishFailureCard
                reason="We couldn't reach the SceneCheck server. Your details are saved on this device."
                onRetry={handlePublish}
                onSaveDraft={handleSaveDraft}/>
            )}
            <SCCard style={{ padding: 16 }}>
              <span style={{ display:'inline-block', background:'var(--primary)', color:'var(--primary-ink)', padding:'4px 8px', borderRadius: 999, fontFamily:'var(--mono)', fontSize: 9, letterSpacing:'0.16em', fontWeight: 600, marginBottom: 10 }}>YOUR EVENT · DRAFT</span>
              <div className="display-tight" style={{ fontSize: 24, lineHeight: 1.05 }}>{form.title || 'Untitled event'}</div>
              <div style={{ marginTop: 10, display:'flex', flexWrap:'wrap', gap: 5 }}>
                {form.interests.map(t => <SCTag key={t} tag={t} size="sm" tone="soft"/>)}
              </div>
              <p style={{ fontSize: 13, color:'var(--ink-2)', lineHeight: 1.4, marginTop: 12 }}>{form.desc || 'No description yet.'}</p>
            </SCCard>
            <SCCard>
              <RowKV k="Hosted by" v={`${hostAccount.name} (${hostAccount.handle})`}/>
              <RowKV k="When" v={`${form.date} · ${form.timeStart}–${form.timeEnd}`}/>
              <RowKV k="Where" v={form.location}/>
              <RowKV k="Capacity" v={`${form.cap} (waitlist after)`}/>
              <RowKV k="Min. to publish" v={`${Math.max(1, Math.ceil(form.cap/5))} subscribers (1/5 of cap)`}/>
              <RowKV k="Visibility" v={form.visibility}/>
              <RowKV k="Group chat" v={form.autoGroupChat ? 'Auto-created on subscribe' : 'Off'}/>
              <RowKV k="Calendar" v={form.addToCalendar ? 'Added to Google Calendar' : 'Not added'} last/>
            </SCCard>
            <div style={{ fontSize: 12, color:'var(--ink-3)', lineHeight: 1.4, padding:'4px 4px' }}>
              By publishing, you confirm responsibility for any future changes to this event's details, capacity, and attendees per the SceneCheck community guidelines.
            </div>
          </div>
        )}
      </div>

      {/* footer CTA */}
      <div style={{ padding: '12px 18px 24px', display:'flex', gap: 10, borderTop:'1px solid var(--line)', background:'var(--surface)' }}>
        <button onClick={handleBack} className="press" style={{
          flex: 1, height: 50, borderRadius: 14, border:'1px solid var(--line)',
          background:'var(--card)', cursor:'pointer',
          fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
        }}>{step === 0 ? 'CANCEL' : '← BACK'}</button>
        {step < steps.length - 1 ? (
          <button disabled={!canNext} onClick={() => canNext && setStep(step+1)} className="press" style={{
            flex: 2, height: 50, borderRadius: 14, border:'none',
            background: canNext ? 'var(--ink)' : 'var(--subtle)',
            color: canNext ? 'white' : 'var(--ink-3)',
            cursor: canNext ? 'pointer' : 'not-allowed',
            fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
          }}>CONTINUE →</button>
        ) : publishError ? (
          <button onClick={handlePublish} className="press" style={{
            flex: 2, height: 50, borderRadius: 14, border:'none', background:'#C73B2B', color:'white', cursor:'pointer',
            fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
            display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
          }}>
            <SCIcon name="rotate-ccw" size={14}/> RETRY PUBLISH
          </button>
        ) : (
          <button disabled={publishing} onClick={handlePublish} className="press" style={{
            flex: 2, height: 50, borderRadius: 14, border:'none',
            background: publishing ? 'var(--subtle)' : 'var(--good)',
            color: publishing ? 'var(--ink-3)' : 'white',
            cursor: publishing ? 'wait' : 'pointer',
            fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
          }}>{publishing ? 'PUBLISHING…' : 'PUBLISH EVENT'}</button>
        )}
      </div>

      {/* Save-changes sheet — only shown when resuming an existing draft
          AND the user has unsaved edits. Three explicit paths so nothing
          happens by accident. */}
      {saveChangesOpen && (
        <div onClick={() => setSaveChangesOpen(false)} style={{
          position: 'absolute', inset: 0, zIndex: 87,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
            width: '100%', padding: '22px 20px 30px',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
            animation: 'slideUp 240ms ease both',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 12,
                background: 'var(--primary-soft)', color: 'var(--primary)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}><SCIcon name="edit" size={18}/></div>
              <div className="display-tight" style={{ fontSize: 22, lineHeight: 1.05 }}>
                Save changes to this draft?
              </div>
            </div>
            <p style={{ fontSize: 14, color:'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
              You've made edits to <b>{form.title?.trim() || 'this draft'}</b>. Save them, discard them, or keep editing — your draft itself stays either way.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap: 8, marginTop: 18 }}>
              <button onClick={saveAndExit} className="press" style={{
                width: '100%', height: 50, borderRadius: 14, border: 'none',
                background: 'var(--primary)', color: 'var(--primary-ink)', cursor: 'pointer',
                fontFamily:'var(--mono)', fontSize: 12, fontWeight: 700, letterSpacing:'0.14em',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap: 8,
              }}>
                <SCIcon name="check" size={14}/> SAVE CHANGES
              </button>
              <button onClick={discardAndExit} className="press" style={{
                width: '100%', height: 50, borderRadius: 14,
                border: '1px solid color-mix(in oklch, #C73B2B 35%, var(--line))',
                background: 'var(--card)', color: '#C73B2B', cursor: 'pointer',
                fontFamily:'var(--mono)', fontSize: 12, fontWeight: 700, letterSpacing:'0.14em',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap: 8,
              }}>
                <SCIcon name="x" size={14}/> DISCARD CHANGES
              </button>
              <button onClick={() => setSaveChangesOpen(false)} className="press" style={{
                width: '100%', height: 44, borderRadius: 14, border: '1px solid var(--line)',
                background: 'var(--card)', color: 'var(--ink-2)', cursor: 'pointer',
                fontFamily:'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing:'0.14em',
              }}>
                KEEP EDITING
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCss = {
  width:'100%', boxSizing:'border-box', height: 48, background:'var(--card)',
  border:'1px solid var(--line)', borderRadius: 14, padding:'0 14px',
  fontFamily:'var(--body)', fontSize: 15, color:'var(--ink)', outline:'none',
};

function Field({ label, hint, children }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap: 6 }}>
      <span className="label-cap">{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color:'var(--ink-3)', lineHeight: 1.35 }}>{hint}</span>}
    </div>
  );
}

function OrgChip({ org }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', gap: 10, padding:'10px 12px',
      background:'var(--subtle)', borderRadius: 12, marginTop: 4,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        background:'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
        color:'white', display:'flex', alignItems:'center', justifyContent:'center',
        fontFamily:'var(--display)', fontWeight: 800, fontSize: 13,
      }}>{org.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{org.name}</div>
        <div className="mono" style={{ fontSize: 10, color:'var(--ink-3)', letterSpacing:'0.04em' }}>{org.handle} · {org.members} members</div>
      </div>
    </div>
  );
}

function OrgDropdown({ orgs, value, open, setOpen, onChange }) {
  const sel = orgs.find(o => o.id === value) || orgs[0];
  return (
    <div style={{ position:'relative', marginTop: 4 }}>
      <button onClick={() => setOpen(!open)} className="press" style={{
        width:'100%', display:'flex', alignItems:'center', gap: 10, padding:'10px 12px',
        background:'var(--card)', border:'1px solid var(--line)', borderRadius: 12, cursor:'pointer',
        textAlign:'left',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background:'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
          color:'white', display:'flex', alignItems:'center', justifyContent:'center',
          fontFamily:'var(--display)', fontWeight: 800, fontSize: 13,
        }}>{sel.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{sel.name}</div>
          <div className="mono" style={{ fontSize: 10, color:'var(--ink-3)', letterSpacing:'0.04em' }}>{sel.handle}</div>
        </div>
        <span style={{
          fontFamily:'var(--mono)', fontSize: 10, color:'var(--ink-3)', letterSpacing:'0.14em',
          fontWeight: 600, padding:'4px 8px', background:'var(--subtle)', borderRadius: 999,
        }}>{orgs.length} ORGS</span>
        <span style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition:'transform 160ms ease' }}>
          <SCIcon name="chevron-right" size={16} color="var(--ink-3)"/>
        </span>
      </button>
      {open && (
        <div style={{
          position:'absolute', left: 0, right: 0, top:'calc(100% + 6px)', zIndex: 20,
          background:'var(--card)', border:'1px solid var(--line)', borderRadius: 14,
          boxShadow:'0 18px 40px -12px rgba(0,0,0,0.28)', overflow:'hidden',
        }}>
          {orgs.map((o, i) => (
            <button key={o.id} onClick={() => onChange(o.id)} className="press" style={{
              width:'100%', display:'flex', alignItems:'center', gap: 10, padding:'12px 12px',
              border:'none', borderTop: i===0 ? 'none' : '1px solid var(--line)',
              background: o.id === value ? 'var(--subtle)' : 'transparent',
              cursor:'pointer', textAlign:'left',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background:'linear-gradient(135deg, var(--primary) 0%, var(--accent-blue) 100%)',
                color:'white', display:'flex', alignItems:'center', justifyContent:'center',
                fontFamily:'var(--display)', fontWeight: 800, fontSize: 12,
              }}>{o.name.split(' ').map(w => w[0]).slice(0,2).join('')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{o.name}</div>
                <div className="mono" style={{ fontSize: 10, color:'var(--ink-3)' }}>{o.handle} · {o.members} members</div>
              </div>
              {o.id === value && (
                <div style={{
                  width: 22, height: 22, borderRadius: 11, background:'var(--primary)', color:'var(--primary-ink)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                }}><SCIcon name="check" size={12}/></div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Segmented({ value, options, onChange }) {
  return (
    <div style={{ display:'flex', background:'var(--subtle)', padding: 4, borderRadius: 12, gap: 4 }}>
      {options.map(o => (
        <button key={o.k} onClick={() => onChange(o.k)} className="press" style={{
          flex: 1, height: 40, borderRadius: 9, border:'none', cursor:'pointer',
          background: value === o.k ? 'var(--card)' : 'transparent',
          color: value === o.k ? 'var(--ink)' : 'var(--ink-3)',
          fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.06em',
          boxShadow: value === o.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        }}>{o.label}</button>
      ))}
    </div>
  );
}

function RowToggle({ label, v, onChange }) {
  const handleKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!v); }
  };
  return (
    <div
      role="switch"
      aria-checked={v}
      aria-label={label}
      tabIndex={0}
      onClick={() => onChange(!v)}
      onKeyDown={handleKey}
      className="press"
      style={{
        display:'flex', alignItems:'center', justifyContent:'space-between', gap: 12,
        padding: 14, borderRadius: 14, background:'var(--card)', border:'1px solid var(--line)', cursor:'pointer',
      }}
    >
      <span style={{ fontSize: 14, flex: 1, minWidth: 0 }}>{label}</span>
      {/* iOS-style switch — matches NotifToggleRow */}
      <div style={{
        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
        background: v ? 'var(--good)' : 'var(--line)',
        position: 'relative', transition: 'background 160ms ease',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: v ? 20 : 2,
          width: 22, height: 22, borderRadius: 11, background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 160ms ease',
        }}/>
      </div>
    </div>
  );
}

// ── EVENT PUBLISHED (success) ────────────────────────────────
function SCEventPublished({ go, form, eventId }) {
  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', padding: 28, textAlign:'center', gap: 18 }}>
      <div style={{
        width: 84, height: 84, borderRadius: 42, background:'var(--good)', color:'white',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 12px 28px -8px rgba(43,182,115,0.5)',
      }}>
        <SCIcon name="check" size={40}/>
      </div>
      <div>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 1.05 }}>You're live!</div>
        <p style={{ fontSize: 14, color:'var(--ink-2)', marginTop: 10, lineHeight: 1.5 }}>
          <b>{form?.title || 'Your event'}</b> is published. Once {Math.max(1, Math.ceil((form?.cap||10)/5))} subscribers join, it'll appear publicly on the map.
        </p>
      </div>
      <div style={{ display:'flex', gap: 10, width:'100%' }}>
        <button onClick={() => go('home')} className="press" style={{
          flex: 1, height: 48, borderRadius: 14, border:'1px solid var(--line)', background:'var(--card)', cursor:'pointer',
          fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
        }}>HOME</button>
        <button onClick={() => go({ name:'event', eventId: eventId || 'e1' })} className="press" style={{
          flex: 1, height: 48, borderRadius: 14, border:'none', background:'var(--ink)', color:'var(--card)', cursor:'pointer',
          fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
        }}>VIEW EVENT</button>
      </div>
    </div>
  );
}

function KeyRow({ color, stroke, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 12, height: 12, borderRadius: '50%', background: color,
        boxShadow: stroke ? `0 0 0 2px ${stroke}` : 'none', border: stroke ? '1px solid white' : 'none',
      }}/>
      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{label}</span>
    </div>
  );
}

// ── PROFILE (other person) ───────────────────────────────────
function SCProfileOther({ go, back, personId, friends, friendStatus, toggleFriend }) {
  // If this person has blocked you, you can't see their profile — bounce.
  const raw = SC_PEOPLE.find(x => x.id === personId);
  if (raw && raw.blockedYou) {
    return (
      <div className="fade-in">
        <SCTopBar onBack={() => back ? back() : go('home')} title=""/>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--subtle)', margin: '0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <SCIcon name="lock" size={24}/>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Account unavailable</div>
          <div style={{ fontSize: 13, color:'var(--ink-3)', lineHeight: 1.5 }}>This profile can't be shown.</div>
        </div>
      </div>
    );
  }
  const p = raw || SC_VISIBLE_PEOPLE[0];
  const status = friendStatus ? friendStatus(p.id) : (friends && friends.has(p.id) ? 'friend' : 'none');
  const isFriend = status === 'friend';
  const isPending = status === 'pending';
  // Safety sheet (block / report) — opens from the shield button.
  // step: 'menu' (initial), 'block-confirm', 'report-pick', 'done'
  const [safetySheet, setSafetySheet] = useStateS(null); // null | { step, reason? }
  const closeSafety = () => setSafetySheet(null);
  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <SCTopBar onBack={() => back ? back() : go('home')}
        right={<button className="press" style={btnIcon}><SCIcon name="x" size={18}/></button>}/>
      {/* picture */}
      <div style={{ padding: '0 18px' }}>
        <div style={{
          aspectRatio: '4 / 5', borderRadius: 24, overflow: 'hidden', position: 'relative',
          background: `linear-gradient(135deg, ${p.color1} 0%, ${p.color2} 100%)`,
          backgroundImage: p.picture ? `url(${p.picture})` : undefined,
          backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {!p.picture && (
            <span className="display-tight" style={{ fontSize: 140, color: 'rgba(255,255,255,0.9)' }}>
              {p.name.split(' ').map(w => w[0]).slice(0,2).join('')}
            </span>
          )}
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(0,0,0,0.55)', color: 'white', padding: '6px 10px', borderRadius: 999,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}>
            {p.mutual} MUTUAL · {(p.interests||[]).filter(t => SC_ME.interests.includes(t)).length} SHARED
          </div>
          <div style={{
            position: 'absolute', top: 12, right: 12,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,0,0,0.55)', color: 'white', padding: '6px 10px', borderRadius: 999,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}>
            <SCIcon name={p.privacy === 'private' ? 'lock' : 'globe'} size={11}/> {p.privacy === 'private' ? 'PRIVATE' : 'PUBLIC'}
          </div>
        </div>
      </div>

      {!isFriend && p.privacy === 'private' && !isPending && (
        <div style={{ padding: '14px 18px 0' }}>
          <div style={{ display:'flex', gap: 10, padding: 12, background:'var(--subtle)', borderRadius: 12 }}>
            <SCIcon name="lock" size={16} color="var(--ink-2)"/>
            <div style={{ fontSize: 12, color:'var(--ink-2)', lineHeight: 1.4 }}>
              <b>{p.name} is private.</b> Sending a request requires their approval before you can chat.
            </div>
          </div>
        </div>
      )}

      {/* name + age */}
      <div style={{ padding: '18px 18px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div className="display-tight" style={{ fontSize: 32, lineHeight: 1 }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>@{p.username}</div>
        </div>
        <div className="display" style={{ fontSize: 28, color: 'var(--ink-2)' }}>{p.age}</div>
      </div>

      {/* bio block */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 6 }}>Bio</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4, color: 'var(--ink)' }}>{p.bio}</p>
      </div>

      {/* interests */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 8 }}>Interests</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {p.interests.map(t => (
            <SCTag key={t} tag={t} size="md" tone={SC_ME.interests.includes(t) ? 'primary' : 'soft'}
              onClick={() => go({ name: 'interest-detail', tag: t })}/>
          ))}
        </div>
      </div>

      {/* other & etc */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 8 }}>Other</div>
        <SCCard>
          <RowKV k="Last event" v="Dumpling Night · Apr 26"/>
          <RowKV k="Mutual friends" v={`${p.mutual} (Maya, Theo, …)`}/>
          <RowKV k="Member since" v="Sep 2024"/>
          {(() => {
            // Live rating + count from reviews for any events this person hosted.
            const myReviews = (window.SC_REVIEWS || []).filter(r => r.hostId === p.id);
            if (myReviews.length === 0) {
              return <RowKV k="Rating" v="No reviews yet" last/>;
            }
            const avg = myReviews.reduce((s, r) => s + r.rating, 0) / myReviews.length;
            const events = new Set(myReviews.map(r => r.eventId)).size;
            return (
              <RowKV k="Rating"
                v={`${avg.toFixed(1)} ★ · ${myReviews.length} review${myReviews.length === 1 ? '' : 's'} · ${events} event${events === 1 ? '' : 's'}`}
                onClick={() => go({ name: 'ratings', hostId: p.id })}
                last/>
            );
          })()}
        </SCCard>
      </div>

      <div style={{ padding: '18px 18px 0', display: 'flex', gap: 10 }}>
        <button
          onClick={() => {
            if (!isFriend) return;
            // Open the existing DM thread with this person, or create a virtual one
            // (SCChatThread will fall back to personId lookup when chatId isn't found).
            const existing = SC_CHATS.find(x => x.kind === 'dm' && x.personId === p.id);
            go({ name: 'chat-thread', chatId: existing ? existing.id : 'dm-' + p.id, personId: p.id });
          }}
          disabled={!isFriend}
          className={isFriend ? 'press' : ''}
          style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: isFriend ? 'var(--card)' : 'var(--subtle)',
            color: isFriend ? 'var(--ink)' : 'var(--ink-3)',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
            cursor: isFriend ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          <SCIcon name={isFriend ? 'chat' : 'lock'} size={16}/> {isFriend ? 'MESSAGE' : 'CHAT LOCKED'}
        </button>
        <button onClick={() => setSafetySheet({ step: 'menu' })} className="press" style={{
          width: 48, height: 48, borderRadius: 14, border: '1px solid var(--line)', background: 'var(--card)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="shield" size={18}/>
        </button>
      </div>
      {!isFriend && (
        <div className="label-cap" style={{ padding: '8px 18px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
          You can chat once you're friends
        </div>
      )}

      <div style={{
        position: 'sticky', bottom: 0, padding: '18px',
        background: 'linear-gradient(to top, var(--surface) 60%, transparent)',
        marginTop: 24,
      }}>
        <FriendActionButton status={status} privacy={p.privacy} onClick={() => toggleFriend(p.id)}/>
      </div>

      {safetySheet && (
        <SCSafetySheet person={p} sheet={safetySheet} setSheet={setSafetySheet} onClose={closeSafety}/>
      )}
    </div>
  );
}

// Bottom sheet that handles Block / Report flows from the shield button.
// Two-step: action menu → confirmation (block) or reason picker (report) → done.
function SCSafetySheet({ person, sheet, setSheet, onClose }) {
  const step = sheet.step;
  const reasons = ['Spam or scam', 'Harassment or bullying', 'Inappropriate content', 'Impersonation', 'Something else'];

  const overlay = (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, background: 'rgba(15,15,15,0.42)',
      zIndex: 60, display: 'flex', alignItems: 'flex-end',
      animation: 'fadeIn 140ms ease-out',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', background: 'var(--surface)',
        borderTopLeftRadius: 22, borderTopRightRadius: 22,
        padding: '10px 0 24px',
        animation: 'slideUp 220ms cubic-bezier(.2,.8,.2,1)',
        boxShadow: '0 -10px 32px -8px rgba(0,0,0,0.18)',
      }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--line)', margin: '6px auto 14px' }}/>
        {renderBody()}
      </div>
    </div>
  );

  function renderBody() {
    if (step === 'menu') {
      return (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <div className="label-cap" style={{ color: 'var(--ink-3)' }}>SAFETY</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>{person.name}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>@{person.username}</div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            <SafetyRow icon="lock" label="Mute notifications from this person" sub="You won't get pings from their events" onClick={() => { onClose(); }}/>
            <SafetyRow icon="flag" label="Report" sub="Send to the safety team for review" onClick={() => setSheet({ step: 'report-pick' })}/>
            <SafetyRow icon="shield" label={`Block @${person.username}`} sub="They won't see you, message you, or join your events" danger onClick={() => setSheet({ step: 'block-confirm' })} last/>
          </div>
          <div style={{ padding: '14px 20px 0' }}>
            <button onClick={onClose} className="press" style={sheetCancelBtn}>CANCEL</button>
          </div>
        </>
      );
    }
    if (step === 'block-confirm') {
      return (
        <div style={{ padding: '0 20px' }}>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Block @{person.username}?</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 18 }}>
            They won't be able to see your profile, message you, or join events you host. You can unblock anyone from Settings → Blocked users.
          </div>
          <button onClick={() => setSheet({ step: 'done', kind: 'block' })} className="press" style={sheetDangerBtn}>BLOCK</button>
          <button onClick={() => setSheet({ step: 'menu' })} className="press" style={{ ...sheetCancelBtn, marginTop: 10 }}>CANCEL</button>
        </div>
      );
    }
    if (step === 'report-pick') {
      return (
        <>
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Why are you reporting @{person.username}?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Reports are anonymous.</div>
          </div>
          <div style={{ borderTop: '1px solid var(--line)' }}>
            {reasons.map((r, i) => (
              <SafetyRow key={r} label={r} onClick={() => setSheet({ step: 'done', kind: 'report', reason: r })} last={i === reasons.length - 1}/>
            ))}
          </div>
          <div style={{ padding: '14px 20px 0' }}>
            <button onClick={() => setSheet({ step: 'menu' })} className="press" style={sheetCancelBtn}>CANCEL</button>
          </div>
        </>
      );
    }
    // done
    const isBlock = sheet.kind === 'block';
    return (
      <div style={{ padding: '4px 24px 0', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%',
          background: 'var(--subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name={isBlock ? 'shield' : 'flag'} size={26}/>
        </div>
        <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
          {isBlock ? `Blocked @${person.username}` : 'Report sent'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5, marginBottom: 18 }}>
          {isBlock
            ? "You won't see them or hear from them again."
            : `Thanks — our team will review "${sheet.reason}" within 24 hours.`}
        </div>
        <button onClick={onClose} className="press" style={sheetCancelBtn}>DONE</button>
      </div>
    );
  }

  return overlay;
}

function SafetyRow({ icon, label, sub, danger, onClick, last }) {
  return (
    <button onClick={onClick} className="press" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 20px', background: 'transparent', border: 'none',
      borderBottom: last ? 'none' : '1px solid var(--line)',
      textAlign: 'left', cursor: 'pointer',
      color: danger ? '#c2410c' : 'var(--ink)',
    }}>
      {icon && (
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: danger ? 'rgba(194,65,12,0.08)' : 'var(--subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <SCIcon name={icon} size={16}/>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
      </div>
    </button>
  );
}

const sheetCancelBtn = {
  width: '100%', height: 48, borderRadius: 14, border: '1px solid var(--line)',
  background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer',
  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
};
const sheetDangerBtn = {
  width: '100%', height: 48, borderRadius: 14, border: 'none',
  background: '#c2410c', color: '#fff', cursor: 'pointer',
  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
};

function FriendActionButton({ status, privacy, onClick }) {
  const isFriend = status === 'friend';
  const isPending = status === 'pending';
  const bg = isFriend ? 'var(--ink)'
           : isPending ? 'var(--card)'
           : (privacy === 'private' ? 'var(--accent-friend, #6B5BD6)' : 'var(--good)');
  const fg = isPending ? 'var(--ink)' : 'white';
  const border = isPending ? '1px solid var(--line)' : 'none';
  const label = isFriend ? <><SCIcon name="user-check" size={16}/> FRIENDS · TAP TO UNFRIEND</>
              : isPending ? <><SCIcon name="clock" size={16}/> REQUEST SENT · TAP TO CANCEL</>
              : (privacy === 'private'
                  ? <><SCIcon name="user-plus" size={16}/> SEND FRIEND REQUEST</>
                  : <><SCIcon name="user-plus" size={16}/> ADD FRIEND</>);
  return (
    <button onClick={onClick} className="press" style={{
      width: '100%', height: 56, borderRadius: 16,
      background: bg, color: fg, border,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.14em',
      boxShadow: !isFriend && !isPending ? '0 6px 14px -6px rgba(0,0,0,0.3)' : 'none',
    }}>{label}</button>
  );
}

const btnIcon = {
  width: 38, height: 38, borderRadius: 12, border: '1px solid var(--line)',
  background: 'var(--card)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function RowKV({ k, v, last, onClick }) {
  const clickable = !!onClick;
  return (
    <div onClick={onClick} className={clickable ? 'press' : ''} style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 14px', borderBottom: last ? 'none' : '1px solid var(--line)',
      cursor: clickable ? 'pointer' : 'default',
    }}>
      <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{k}</span>
      <span style={{ fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {v}{clickable && <SCIcon name="chevron-right" size={12} color="var(--ink-3)"/>}
      </span>
    </div>
  );
}

// ── MY PROFILE ───────────────────────────────────────────────
function SCMyProfile({ go, activeAccount, setActiveAccount, accountSwitcherOpen, setAccountSwitcherOpen,
  picture, setPicture, orgPictures, setOrgPicture, following, followStatus, toggleFollow, friends, privacy, drafts }) {
  const account = SC_MY_ACCOUNTS.find(a => a.id === activeAccount) || SC_MY_ACCOUNTS[0];
  const isPersonal = account.id === 'me';
  // Picture for current account
  const accountPicture = isPersonal ? picture : (orgPictures[account.id] || null);
  const fileInputRef = React.useRef(null);
  const onPickFile = () => fileInputRef.current?.click();
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      if (isPersonal) setPicture(url); else setOrgPicture(account.id, url);
    };
    reader.readAsDataURL(f);
    e.target.value = '';
  };
  const removePicture = () => {
    if (isPersonal) setPicture(null); else setOrgPicture(account.id, null);
  };

  // Stats vary per account type
  const myEvents = SC_EVENTS.filter(e => e.hostId === account.id);
  const followingOrgs = [...SC_ORGS, ...SC_MY_ACCOUNTS.filter(a => a.type === 'org' && a.id !== account.id)]
    .filter(o => following && following.has(o.id));

  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      {/* Account switcher header — Instagram-style */}
      <div style={{ padding: '4px 14px 10px', position: 'relative' }}>
        <button
          onClick={() => setAccountSwitcherOpen(!accountSwitcherOpen)}
          className="press"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 14, cursor: 'pointer', textAlign: 'left',
          }}>
          <SCAvatar person={{ ...account, picture: accountPicture }} size={32}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="display" style={{ fontSize: 15, lineHeight: 1.1 }}>{account.handle}</span>
              {account.type === 'org' && (
                <span style={{
                  fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '0.16em', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 4, background: 'var(--ink)', color: 'var(--surface)',
                }}>ORG</span>
              )}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 1 }}>
              {account.type === 'org'
                ? `${account.followers.toLocaleString()} followers`
                : `${account.followers} followers`}
            </div>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', color: 'var(--ink-3)', fontWeight: 600,
          }}>
            <SCIcon name="switch" size={14}/> SWITCH
          </span>
        </button>

        {accountSwitcherOpen && (
          <div style={{
            position: 'absolute', left: 14, right: 14, top: 'calc(100% - 4px)', zIndex: 30,
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
            boxShadow: '0 18px 40px -12px rgba(0,0,0,0.28)', overflow: 'hidden',
          }}>
            <div className="label-cap" style={{ padding: '12px 14px 6px' }}>SWITCH ACCOUNT</div>
            {SC_MY_ACCOUNTS.map((a, i) => {
              const pic = a.id === 'me' ? picture : (orgPictures[a.id] || null);
              const isActive = a.id === activeAccount;
              return (
                <button key={a.id} onClick={() => { setActiveAccount(a.id); setAccountSwitcherOpen(false); }} className="press" style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: 'none', borderTop: '1px solid var(--line)',
                  background: isActive ? 'var(--subtle)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}>
                  <SCAvatar person={{ ...a, picture: pic }} size={36}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      {a.handle}{a.type === 'org' ? ' · org' : ''}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--primary)', color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <SCIcon name="check" size={12}/>
                    </div>
                  )}
                </button>
              );
            })}
            <button onClick={() => setAccountSwitcherOpen(false)} className="press" style={{
              width: '100%', padding: '12px 14px', background: 'transparent',
              border: 'none', borderTop: '1px solid var(--line)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 600,
              color: 'var(--ink-3)', textAlign: 'center',
            }}>+ ADD ANOTHER ORG ACCOUNT</button>
          </div>
        )}
      </div>

      <div style={{ padding: '0 18px' }}>
        {/* Picture block — replaces gradient when user has uploaded one */}
        <div style={{
          aspectRatio: '5 / 4', borderRadius: 24, overflow: 'hidden', position: 'relative',
          backgroundColor: account.type === 'org' ? '#1A1714' : '#FF8A65',
          backgroundImage: accountPicture
            ? `url(${accountPicture})`
            : (account.type === 'org'
                ? 'linear-gradient(135deg, #2A1F18 0%, #1A1714 100%)'
                : 'linear-gradient(135deg, #FFD0B5 0%, #FF8A65 50%, #FF5B47 100%)'),
          backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', padding: 20,
        }}>
          {!accountPicture && (
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent 60%)' }}/>
          )}
          {accountPicture && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.55) 100%)' }}/>
          )}
          <div style={{ position: 'relative' }}>
            {!accountPicture && (
              <div className="display-tight" style={{ fontSize: 96, lineHeight: 0.85, color: 'white' }}>
                {account.name.split(' ').map(w => w[0]).slice(0,2).join('')}
              </div>
            )}
            <div className="mono" style={{
              color: accountPicture ? 'white' : 'rgba(255,255,255,0.85)',
              fontSize: 12, letterSpacing: '0.16em', marginTop: 6, fontWeight: 600,
            }}>
              {account.type === 'org'
                ? `${account.followers.toLocaleString()} FOLLOWERS · ${myEvents.length} EVENTS`
                : `★ 4.7  ·  3 HOSTED  ·  12 ATTENDED`}
            </div>
          </div>

          {/* Edit picture button */}
          <button onClick={onPickFile} className="press" style={{
            position: 'absolute', right: 14, bottom: 14,
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 12px', borderRadius: 999,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
            color: 'white', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
          }}>
            <SCIcon name="camera" size={14}/> {accountPicture ? 'CHANGE PHOTO' : 'ADD PHOTO'}
          </button>
          {accountPicture && (
            <button onClick={removePicture} className="press" style={{
              position: 'absolute', right: 14, top: 14,
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
              color: 'white', border: '1px solid rgba(255,255,255,0.18)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name="x" size={14}/>
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: 'none' }}/>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="display-tight" style={{ fontSize: 30, lineHeight: 1 }}>{account.name}</div>
          <div className="mono" style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            {account.handle}{isPersonal ? ` · ${SC_ME.city}` : ''}
          </div>
        </div>
        {isPersonal && <div className="display" style={{ fontSize: 28, color: 'var(--ink-2)' }}>{SC_ME.age}</div>}
      </div>

      {/* Counters row — personal: followers / friends / following.
          org: followers / events. POSTS removed since the app has no posts. */}
      <div style={{
        padding: '14px 18px 0',
        display: 'grid',
        gridTemplateColumns: isPersonal ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
        gap: 8,
      }}>
        <StatCell label="FOLLOWERS" value={account.followers.toLocaleString()}
          onClick={() => {}}/>
        {isPersonal
          ? <StatCell label="FRIENDS" value={friends ? friends.size : 0} onClick={() => go('my-friends')}/>
          : <StatCell label="EVENTS" value={myEvents.length} onClick={() => go('my-hosting')}/>}
        {isPersonal && (
          <StatCell label="FOLLOWING"
            value={following ? following.size : 0}
            onClick={() => go('my-following')}/>
        )}
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 6 }}>Bio</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>{account.bio}</p>
      </div>

      <SCSection title="INTERESTS" action={
        isPersonal ? <button onClick={() => go('interests')} className="press" style={{
          background: 'transparent', border: 'none', color: 'var(--primary)',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em', cursor: 'pointer',
        }}>MANAGE →</button> : null
      }>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {account.interests.map(t => (
            <SCTag key={t} tag={t} size="md" tone="primary" onClick={() => go({ name:'interest-detail', tag: t })}/>
          ))}
        </div>
      </SCSection>

      {account.type === 'org' && (
        <SCSection title="EVENTS POSTED">
          {myEvents.length === 0 ? (
            <SCCard style={{ padding: 16, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No events posted yet. <span style={{ color:'var(--primary)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => go({ name:'create-event' })}>Create one →</span>
            </SCCard>
          ) : (
            <SCCard>
              {myEvents.map((e, i) => (
                <div key={e.id} onClick={() => go({ name:'event', eventId: e.id })} className="press" style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px',
                  borderBottom: i < myEvents.length-1 ? '1px solid var(--line)' : 'none', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12, background: 'var(--primary)',
                    color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}><SCIcon name="calendar" size={18}/></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{scWhenRange(e)} · {e.attendees}/{e.cap}</div>
                  </div>
                  <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
                </div>
              ))}
            </SCCard>
          )}
        </SCSection>
      )}

      <SCSection title={isPersonal ? 'PRIVACY' : 'ORG SETTINGS'}>
        <SCCard>
          {isPersonal ? (
            <>
              <RowKV k="Privacy" v={privacy === 'public' ? 'Public — anyone can add you' : 'Private — approval required'}/>
              <RowKV k="Discovery radius" v="2 mi"/>
              <RowKV k="Linked calendar" v="Google"/>
              <RowKV k="Joined" v="Sep 2024" last/>
            </>
          ) : (
            <>
              <RowKV k="Account type" v="Organization"/>
              <RowKV k="Privacy" v={account.privacy === 'public' ? 'Public — anyone can follow' : 'Private — approve follow requests'}/>
              <RowKV k="Followers" v={account.followers.toLocaleString()} last/>
            </>
          )}
        </SCCard>
      </SCSection>

      {isPersonal && (
        <SCSection title="ETC.">
          <SCCard>
            <RowMenu icon="calendar" label="Events I'm hosting" v={String(myEvents.length)}
              onClick={() => go('my-hosting')}/>
            <RowMenu icon="edit" label="Drafts" v={drafts && drafts.length ? `${drafts.length} saved` : 'None'}
              onClick={() => go('drafts')}/>
            <RowMenu icon="user-check" label="Friends" v={String(friends ? friends.size : 0)}
              onClick={() => go('my-friends')}/>
            <RowMenu icon="people" label="Orgs you follow" v={String(following ? following.size : 0)}
              onClick={() => go('my-following')}/>
            {(() => {
              const mine = (window.SC_REVIEWS || []).filter(r => r.hostId === account.id);
              const v = mine.length === 0
                ? 'No reviews yet'
                : `${(mine.reduce((s, r) => s + r.rating, 0) / mine.length).toFixed(1)} ★ · ${mine.length} review${mine.length === 1 ? '' : 's'}`;
              return <RowMenu icon="star" label="My ratings" v={v}
                onClick={() => go({ name: 'ratings', hostId: account.id })} last/>;
            })()}
          </SCCard>
        </SCSection>
      )}
    </div>
  );
}

function StatCell({ label, value, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'press' : ''} style={{
      padding: '12px 10px', borderRadius: 14, background: 'var(--card)',
      border: '1px solid var(--line)', textAlign: 'center', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div className="display-tight" style={{ fontSize: 22, lineHeight: 1 }}>{value}</div>
      <div className="label-cap" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

function RowMenu({ icon, label, v, last, onClick }) {
  return (
    <div onClick={onClick} className="press" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px', borderBottom: last ? 'none' : '1px solid var(--line)', cursor: 'pointer',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
      }}>
        <SCIcon name={icon} size={16}/>
      </div>
      <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-3)' }}>{v}</span>
      <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
    </div>
  );
}

// ── INTERESTS ────────────────────────────────────────────────
function SCInterestsScreen({ go, back, subscribed, toggleSub }) {
  const [q, setQ] = useStateS('');
  const [showAll, setShowAll] = useStateS(false);
  const list = SC_INTERESTS_SUGGESTED.filter(i => i.tag.includes(q.toLowerCase()));
  const COLLAPSE_THRESHOLD = 6;
  const subsArr = [...subscribed];
  const isTruncated = subsArr.length > COLLAPSE_THRESHOLD && !showAll;
  const visibleSubs = isTruncated ? subsArr.slice(0, COLLAPSE_THRESHOLD) : subsArr;
  const hiddenCount = subsArr.length - COLLAPSE_THRESHOLD;
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('profile')} subtitle="INTERESTS" title=""/>
      <div style={{ padding: '0 18px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="label-cap">Your current interests</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.05em' }}>
            {subsArr.length}
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18, alignItems: 'center' }}>
          {visibleSubs.map(t => (
            <SCTag key={t} tag={t} size="lg" tone="primary"
              onClick={() => go({ name: 'interest-detail', tag: t })}/>
          ))}
          {subsArr.length > COLLAPSE_THRESHOLD && (
            <button onClick={() => setShowAll(!showAll)} className="press"
              style={{
                padding: '9px 14px', borderRadius: 999, background: 'transparent',
                border: '1.5px solid var(--line)', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', fontWeight: 600,
                letterSpacing: '0.08em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              {showAll ? 'SHOW LESS' : `SHOW ALL +${hiddenCount}`}
            </button>
          )}
          {subsArr.length === 0 && (
            <div className="mono" style={{ fontSize: 12, color: 'var(--ink-3)', padding: '6px 2px' }}>
              No interests yet — add some from below.
            </div>
          )}
        </div>

        {/* search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
          background: 'var(--subtle)', borderRadius: 14, height: 48, marginBottom: 14,
        }}>
          <SCIcon name="search" size={16} color="var(--ink-3)"/>
          <input id="sc-search-input"
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search interests…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)',
            }}/>
          {q && <button onClick={() => setQ('')} className="press" style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
          }}><SCIcon name="x" size={14}/></button>}
        </div>

        <div className="label-cap" style={{ marginBottom: 8 }}>
          {q ? `MATCHING "${q}"` : 'SUGGESTED FOR YOU'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(i => (
            <div key={i.tag} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 14px', background: 'var(--card)',
              border: '1px solid var(--line)', borderRadius: 16,
            }}>
              <button onClick={() => go({ name:'interest-detail', tag: i.tag })} className="press"
                style={{
                  flex: 1, textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', gap: 3, padding: 0,
                }}>
                <span className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                  <span style={{ opacity: 0.5 }}>#</span>{i.tag}
                </span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                  {i.others.toLocaleString()} others nearby
                </span>
              </button>
              <button onClick={() => toggleSub(i.tag)} className="press" style={{
                padding: '8px 14px', borderRadius: 10,
                background: subscribed.has(i.tag) ? 'var(--ink)' : 'var(--good)',
                color: subscribed.has(i.tag) ? 'var(--card)' : 'white', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {subscribed.has(i.tag) ? <><SCIcon name="check" size={12}/> ADDED</> : 'ADD'}
              </button>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--ink-3)' }}>
              No tag found. <button onClick={() => { toggleSub(q.toLowerCase()); setQ(''); }} style={{
                background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600,
              }}>Create #{q.toLowerCase()}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── INTEREST DETAIL ──────────────────────────────────────────
function SCInterestDetail({ go, back, tag, subscribed, toggleSub }) {
  const i = SC_INTERESTS_DETAILS[tag] || { tag, others: 0, desc: 'A user-created interest tag.', similar: [] };
  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <SCTopBar onBack={() => back ? back() : go('interests')}/>
      <div style={{ padding: '0 22px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 56, fontWeight: 700, color: 'var(--primary)', letterSpacing: '-0.04em' }}>#</span>
          <span className="display-tight" style={{ fontSize: 56, lineHeight: 1, fontStyle: 'italic' }}>{i.tag}</span>
        </div>
        <div className="mono" style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>
          {i.others.toLocaleString()} others
        </div>

        {/* description */}
        <p style={{ fontSize: 16, lineHeight: 1.45, color: 'var(--ink)', marginTop: 18 }}>{i.desc}</p>

        {/* mini activity */}
        <div style={{ marginTop: 22, marginBottom: 22 }}>
          <div className="label-cap" style={{ marginBottom: 8 }}>Activity in your area</div>
          <SCCard style={{ padding: '14px 16px' }}>
            <ActivityBar/>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>
              <span>JAN</span><span>MAR</span><span>MAY</span><span>JUL</span><span>SEP</span><span>NOV</span>
            </div>
          </SCCard>
        </div>

        {/* CTA */}
        <SCAddButton joined={subscribed.has(i.tag)} onToggle={() => toggleSub(i.tag)}/>

        {/* similar */}
        <div style={{ marginTop: 28 }}>
          <div className="label-cap" style={{ marginBottom: 10 }}>Similar interests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {i.similar.map(s => (
              <button key={s} onClick={() => go({ name:'interest-detail', tag: s })} className="press"
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 6,
                  background: 'transparent', border: 'none', padding: '6px 0', cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 22, color: 'var(--ink-2)', fontStyle: 'italic' }}>
                  <span style={{ opacity: 0.5 }}>#</span>{s}
                </span>
                <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityBar() {
  // DEMO ONLY — static placeholder bars. Replace with a real
  // per-hour activity rollup once the analytics endpoint exists.
  const bars = [3,5,4,6,7,8,9,11,9,7,5,4];
  const max = 12;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
      {bars.map((b, i) => (
        <div key={i} style={{
          flex: 1,
          height: `${(b/max)*100}%`,
          background: i === 4 ? 'var(--primary)' : 'var(--subtle)',
          borderRadius: 4,
        }}/>
      ))}
    </div>
  );
}

// ── EVENT DETAIL ─────────────────────────────────────────────
function SCEventScreen({ go, back, eventId, joined, pendingLeave, toggleJoin }) {
  const fixes = useFixes ? useFixes() : {};
  const rawEvent = SC_EVENT_BY_ID[eventId];
  // H2 FIX #4 — proper 404 when the event no longer exists. Without the fix
  // tweak, we fall back to the first event so the screen still renders.
  if (!rawEvent) {
    if (fixes.failureStates) return <SCEventNotFound go={go} back={back}/>;
  }
  const baseE = rawEvent || SC_EVENTS[0];
  // Apply in-memory host edits (Fix #3) so saved changes survive navigation.
  const override = (window.SC_EVENT_OVERRIDES || {})[baseE.id] || {};
  const e = { ...baseE, ...override };
  const isLeavePending = !!(pendingLeave && pendingLeave.has && pendingLeave.has(e.id));
  // While in the 5s undo grace, render as not-joined so the user sees the
  // change land immediately. Tapping again during grace cancels (un-leaves).
  const isJoined = joined.has(e.id) && !isLeavePending;
  // H2 FIX #3 — host edit / cancel UI
  const [editOpen, setEditOpen] = useStateS(false);
  const [cancelOpen, setCancelOpen] = useStateS(false);
  const [, forceRender] = useStateS(0);
  const isHost = e.kind === 'yours' || e.hostId === 'me';
  const accent = e.kind === 'yours' ? 'var(--primary)'
              : e.kind === 'friend' ? 'var(--accent-friend)'
              : 'var(--accent-blue)';
  const label = e.kind === 'yours' ? 'YOUR EVENT'
              : e.kind === 'friend' ? 'FRIEND HOSTING'
              : 'RECOMMENDED · APP-CREATED';
  return (
    <div className="fade-in" style={{ paddingBottom: 120 }}>
      {/* hero with mini-map */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden', background: accent }}>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.45, pointerEvents: 'none' }}>
          <SCMap width={402} height={240} pins={[e]} you={{ x: e.x, y: e.y }} compact />
        </div>
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, transparent 30%, ${accent} 100%)`, pointerEvents: 'none' }}/>
        <SCTopBar onBack={() => back ? back() : go('home')}
          right={<button className="press" onClick={() => {
            // Each event has at most one group chat in SC_CHATS, keyed by eventId.
            // If it exists (event is active / others have joined), open it; otherwise
            // tell the user the thread hasn't been spun up yet so the button never
            // dead-ends silently.
            const chat = SC_CHATS.find(c => c.kind === 'event' && c.eventId === e.id);
            if (chat) {
              go({ name: 'chat-thread', chatId: chat.id });
            } else if (window.scToast) {
              window.scToast({
                message: 'No group chat yet — it opens once attendees join.',
                kind: 'info',
              });
            }
          }} style={{ ...btnIcon, background: 'rgba(255,255,255,0.9)' }} aria-label="Open event group chat"><SCIcon name="send" size={16}/></button>}/>
        <div style={{ position: 'absolute', bottom: 16, left: 18, right: 18 }}>
          <div style={{
            display: 'inline-block', background: 'white', color: 'var(--ink)',
            padding: '5px 10px', borderRadius: 999,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
          }}>{label}</div>
        </div>
      </div>

      <div style={{ padding: '20px 18px 0' }}>
        <h1 className="display-tight" style={{ fontSize: 30, lineHeight: 1.05, margin: 0 }}>{e.title}</h1>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {e.interests.map(t => <SCTag key={t} tag={t} size="md" tone="soft" onClick={() => go({ name:'interest-detail', tag: t })}/>)}
        </div>
      </div>

      {/* details */}
      <div style={{ padding: '18px 18px 0' }}>
        <SCCard>
          <DetailRow icon="calendar" k={scWhenRange(e)} v={`${e.attendees}/${e.cap} going` + (e.attendees >= e.cap ? ' · waitlist' : '')}/>
          <DetailRow icon="pin" k={e.where} v="0.4 mi from you · Open on map →"
            onClick={() => go({ name: 'map', focusEventId: e.id })}/>
          <DetailRow icon="people" k={`Hosted by ${e.host}`} v={e.kind === 'recommended' ? 'Auto-discovered' : 'See attendees →'} last/>
        </SCCard>
      </div>

      {/* description */}
      <div style={{ padding: '18px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 6 }}>About</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>{e.desc}</p>
      </div>

      {/* H2 FIX #3 — host edit / cancel actions (only for events the user hosts) */}
      {isHost && fixes.hostEditDelete && (
        <HostActionsRow event={e} onEdit={() => setEditOpen(true)} onCancel={() => setCancelOpen(true)}/>
      )}

      {/* attendees */}
      <button
        onClick={() => go({ name:'attendees', eventId: e.id })}
        className="press"
        style={{
          display:'block', width:'calc(100% - 36px)', margin:'18px 18px 0',
          padding: '14px 14px', background:'var(--card)', border:'1px solid var(--line)',
          borderRadius: 14, cursor:'pointer', textAlign:'left',
        }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 8 }}>
          <div className="label-cap">{e.attendees} going</div>
          <div style={{ display:'flex', alignItems:'center', gap: 4, fontFamily:'var(--mono)', fontSize: 11, color:'var(--ink-3)' }}>
            VIEW ALL <SCIcon name="chevron-right" size={12} color="var(--ink-3)"/>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {SC_VISIBLE_PEOPLE.slice(0, 4).map((p, i) => (
            <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <SCAvatar person={p} size={36} ring={false}/>
            </div>
          ))}
          <span style={{
            width: 36, height: 36, borderRadius: '50%', background: 'var(--subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -8,
            fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600,
          }}>+{Math.max(0, e.attendees - 4)}</span>
        </div>
      </button>

      {/* sticky CTA */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 402, padding: '18px',
        background: 'linear-gradient(to top, var(--surface) 65%, transparent)',
        zIndex: 30,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => go({ name:'chat-thread', chatId:'c1' })} className="press" style={{
            width: 56, height: 56, borderRadius: 16, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <SCIcon name="chat" size={20}/>
          </button>
          <div style={{ flex: 1 }}>
            <SCAddButton joined={isJoined} onToggle={() => toggleJoin(e.id)} label={e.attendees >= e.cap ? 'JOIN WAITLIST' : 'JOIN EVENT'}/>
          </div>
        </div>
      </div>

      {/* H2 FIX #3 — host edit/cancel sheets */}
      <EditEventSheet open={editOpen} event={e}
        onClose={() => setEditOpen(false)}
        onSave={(patch) => {
          window.SC_EVENT_OVERRIDES = window.SC_EVENT_OVERRIDES || {};
          window.SC_EVENT_OVERRIDES[e.id] = { ...(window.SC_EVENT_OVERRIDES[e.id] || {}), ...patch };
          setEditOpen(false);
          forceRender(x => x + 1);
          window.scToast && window.scToast({
            message: `Saved · attendees notified of changes.`,
            kind: 'success',
          });
        }}/>
      <SCConfirmDialog
        open={cancelOpen}
        title="Cancel this event?"
        body={`"${e.title}" will be removed from the map and all ${e.attendees} attendees will be notified. This can't be undone.`}
        confirmLabel="CANCEL EVENT" cancelLabel="KEEP IT"
        tone="danger" icon="x"
        onConfirm={() => {
          setCancelOpen(false);
          window.scToast && window.scToast({
            message: `"${e.title}" cancelled. Attendees notified.`,
            kind: 'info',
          });
          if (back) back(); else go('home');
        }}
        onCancel={() => setCancelOpen(false)}/>
    </div>
  );
}

function DetailRow({ icon, k, v, last, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'press' : ''} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: 14, borderBottom: last ? 'none' : '1px solid var(--line)',
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: onClick ? 'var(--primary-soft)' : 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: onClick ? 'var(--primary)' : 'var(--ink-2)',
      }}>
        <SCIcon name={icon} size={16}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{k}</div>
        <div style={{ fontSize: 12, color: onClick ? 'var(--primary)' : 'var(--ink-3)', marginTop: 1, fontWeight: onClick ? 600 : 400 }}>{v}</div>
      </div>
      {onClick && <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>}
    </div>
  );
}

// ── CHAT LIST ────────────────────────────────────────────────
function SCChatList({ go }) {
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 18px 12px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div className="label-cap">{SC_CHATS.length} active</div>
          <div className="display-tight" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>Chats</div>
        </div>
        <button onClick={() => go({ name:'new-chat' })} className="press" aria-label="Start a new chat" style={btnIcon}><SCIcon name="edit" size={16}/></button>
      </div>

      <div style={{ padding: '0 14px' }}>
        <SCCard style={{ padding: '4px 0' }}>
          {SC_CHATS.filter(c => c.kind !== 'dm' || SC_VISIBLE_PERSON_BY_ID[c.personId]).map((c, i) => {
            const ev = c.kind === 'event' ? SC_EVENT_BY_ID[c.eventId] : null;
            const p = c.kind === 'dm' ? SC_VISIBLE_PERSON_BY_ID[c.personId] : null;
            const accent = ev ? (ev.kind === 'yours' ? 'var(--primary)' : ev.kind === 'friend' ? 'var(--accent-friend)' : 'var(--accent-blue)') : null;
            return (
              <div key={c.id} onClick={() => go({ name:'chat-thread', chatId: c.id })} className="press" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: 14,
                borderTop: i === 0 ? 'none' : '1px solid var(--line)', cursor: 'pointer',
              }}>
                {ev ? (
                  <div style={{
                    width: 44, height: 44, borderRadius: 14, background: accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}><SCIcon name="people" size={18}/></div>
                ) : (
                  <SCAvatar person={p} size={44}/>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span className="display" style={{ fontSize: 15, lineHeight: 1.2 }}>
                      {ev ? c.title : p.name}
                    </span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', flexShrink: 0 }}>{c.time}</span>
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 3,
                  }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.last}
                    </span>
                    {c.unread > 0 && (
                      <span style={{
                        background: 'var(--primary)', color: 'var(--primary-ink)',
                        fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                        minWidth: 18, height: 18, borderRadius: 9, padding: '0 6px',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{c.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </SCCard>
      </div>
    </div>
  );
}

// ── CHAT THREAD ──────────────────────────────────────────────
function SCChatThread({ go, back, chatId, personId, personIds, offline }) {
  // Look up by chatId first; if not found (e.g. user came from a profile MESSAGE
  // button for someone with no existing thread), fall back to personId and
  // synthesize an empty DM chat for them.
  let c = SC_CHATS.find(x => x.id === chatId);
  if (!c && personIds && personIds.length > 1) {
    // Synthesized group chat from the new-chat composer
    c = { id: 'group-' + personIds.join('-'), kind: 'group', personIds, last: '', time: 'now', unread: 0 };
  }
  if (!c && (personId || (personIds && personIds.length === 1))) {
    const pid = personId || personIds[0];
    c = SC_CHATS.find(x => x.kind === 'dm' && x.personId === pid)
        || { id: 'dm-' + pid, kind: 'dm', personId: pid, last: '', time: 'now', unread: 0 };
  }
  if (!c) c = SC_CHATS[0];
  const ev = c.kind === 'event' ? SC_EVENT_BY_ID[c.eventId] : null;
  const p = c.kind === 'dm' ? SC_VISIBLE_PERSON_BY_ID[c.personId] : null;
  const groupMembers = c.kind === 'group'
    ? (c.personIds || []).map(id => SC_VISIBLE_PERSON_BY_ID[id]).filter(Boolean)
    : null;
  // If this is a DM with someone who has blocked you, show an unavailable stub.
  if (c.kind === 'dm' && !p) {
    return (
      <div className="fade-in">
        <SCTopBar onBack={() => back ? back() : go('chat')} title="" subtitle="DIRECT MESSAGE"/>
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--subtle)', margin: '0 auto 16px', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <SCIcon name="lock" size={24}/>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>Conversation unavailable</div>
          <div style={{ fontSize: 13, color:'var(--ink-3)', lineHeight: 1.5 }}>You can't message this account right now.</div>
        </div>
      </div>
    );
  }
  // Per-chat seed messages — keyed by chat id; synthesized chats start blank.
  // Each outgoing message carries a status: 'sending' | 'sent' | 'failed'.
  // The simulated offline tweak flips new sends to 'failed' with a Retry CTA.
  const seedRaw = (SC_THREADS && SC_THREADS[c.id]) || [];
  const seed = seedRaw.map(m => m.from === 'host' ? { ...m, status: 'sent' } : m);
  const [msgs, setMsgs] = useStateS(seed);
  const [draft, setDraft] = useStateS('');
  const nextId = useRefS(1);
  const send = () => {
    if (!draft.trim()) return;
    const id = `m${nextId.current++}`;
    const text = draft.trim();
    setMsgs(prev => [...prev, { id, from: 'host', who: 'You', text, time: 'now', status: 'sending' }]);
    setDraft('');
    setTimeout(() => {
      setMsgs(prev => prev.map(m => m.id === id
        ? { ...m, status: offline ? 'failed' : 'sent' }
        : m));
      if (offline) {
        window.scToast && window.scToast({ message: "Couldn't send — you're offline.", kind: 'error' });
      }
    }, 650);
  };
  const retry = (id) => {
    setMsgs(prev => prev.map(m => m.id === id ? { ...m, status: 'sending' } : m));
    setTimeout(() => {
      setMsgs(prev => prev.map(m => m.id === id
        ? { ...m, status: offline ? 'failed' : 'sent' }
        : m));
    }, 650);
  };
  // H2 FIX #3 — long-press → message actions (Edit / Delete)
  const fixes = useFixes ? useFixes() : {};
  const [actionMsg, setActionMsg] = useStateS(null); // {id, text, ...}
  const [editingMsg, setEditingMsg] = useStateS(null);
  const longPressTimer = useRefS(null);
  const longPressFiredRef = useRefS(false);
  const startLongPress = (m) => {
    if (!fixes.hostEditDelete) return;
    longPressFiredRef.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressFiredRef.current = true;
      setActionMsg(m);
    }, 420);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const deleteMsg = (m) => {
    setMsgs(prev => prev.filter(x => x.id !== m.id));
    setActionMsg(null);
    window.scToast && window.scToast({ message: 'Message deleted.', kind: 'info' });
  };
  const saveEditedMsg = (newText) => {
    if (!editingMsg) return;
    setMsgs(prev => prev.map(x => x.id === editingMsg.id ? { ...x, text: newText, edited: true } : x));
    setEditingMsg(null);
  };
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <SCTopBar onBack={() => back ? back() : go('chat')}
        right={ev ? <button onClick={() => go({ name:'event', eventId: ev.id })} className="press" style={btnIcon}><SCIcon name="pin" size={16}/></button> : null}
        subtitle={ev ? 'EVENT GROUP CHAT' : c.kind === 'group' ? `GROUP · ${groupMembers.length + 1}` : 'DIRECT MESSAGE'}
        title={ev ? c.title : c.kind === 'group' ? (c.title || groupMembers.map(m => m.name.split(' ')[0]).join(', ')) : p.name}/>
      {ev && (
        <div onClick={() => go({ name:'event', eventId: ev.id })} className="press" style={{
          margin: '0 14px 8px', padding: 12, background: 'var(--subtle)', borderRadius: 14,
          display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
        }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-ink)' }}>
            <SCIcon name="calendar" size={14}/>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{scWhenRange(ev)} · {ev.where}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{ev.attendees} going · tap to view</div>
          </div>
          <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
        </div>
      )}
      <div className="scroll" style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.from === 'host' ? 'flex-end' : 'flex-start',
            maxWidth: '78%',
          }}>
            {m.from === 'them' && (i === 0 || msgs[i-1].who !== m.who) && (
              <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginLeft: 12, marginBottom: 2 }}>{m.who} · {m.time}</div>
            )}
            <div
              onMouseDown={() => m.from === 'host' && startLongPress(m)}
              onMouseUp={cancelLongPress}
              onMouseLeave={cancelLongPress}
              onTouchStart={() => m.from === 'host' && startLongPress(m)}
              onTouchEnd={cancelLongPress}
              onTouchCancel={cancelLongPress}
              onClick={(ev) => { if (longPressFiredRef.current) { ev.stopPropagation(); ev.preventDefault(); longPressFiredRef.current = false; } }}
              style={{
              padding: '10px 14px', borderRadius: 16,
              background: m.from === 'host'
                ? (m.status === 'failed' ? 'color-mix(in oklch, #C73B2B 88%, transparent)' : 'var(--primary)')
                : 'var(--card)',
              color: m.from === 'host' ? 'var(--primary-ink)' : 'var(--ink)',
              border: m.from === 'them' ? '1px solid var(--line)' : 'none',
              fontSize: 14, lineHeight: 1.35,
              opacity: m.status === 'sending' ? 0.7 : 1,
              transition: 'opacity 200ms ease, background 200ms ease',
              cursor: m.from === 'host' && fixes.hostEditDelete ? 'pointer' : 'default',
              userSelect: 'none',
            }}>
              {m.text}
              {m.edited && (
                <span style={{
                  marginLeft: 6, opacity: 0.55,
                  fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em', fontWeight: 600,
                }}>(EDITED)</span>
              )}
            </div>
            {m.from === 'host' && m.status && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
                marginTop: 3, marginRight: 4,
                fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.1em',
                color: m.status === 'failed' ? '#C73B2B' : 'var(--ink-3)',
                fontWeight: 600,
              }}>
                {m.status === 'sending' && <>SENDING…</>}
                {m.status === 'sent' && <><SCIcon name="check" size={10}/> SENT</>}
                {m.status === 'failed' && (
                  <>
                    <span>FAILED</span>
                    <button onClick={() => retry(m.id)} className="press" style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '0.14em',
                      fontWeight: 700, color: '#C73B2B', textDecoration: 'underline',
                      padding: 0,
                    }}>RETRY</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* composer */}
      <div style={{ padding: '8px 14px 28px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Message…"
          style={{
            flex: 1, height: 44, background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 14, padding: '0 14px', outline: 'none',
            fontFamily: 'var(--body)', fontSize: 14,
          }}/>
        <button onClick={send} className="press" style={{
          width: 44, height: 44, borderRadius: 14, background: 'var(--primary)', border: 'none', color: 'var(--primary-ink)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="send" size={16}/>
        </button>
      </div>
      {/* H2 FIX #3 — message action sheets */}
      <MessageActionsSheet open={!!actionMsg} message={actionMsg}
        onClose={() => setActionMsg(null)}
        onEdit={(m) => { setActionMsg(null); setEditingMsg(m); }}
        onDelete={deleteMsg}/>
      <EditMessageSheet open={!!editingMsg} message={editingMsg}
        onClose={() => setEditingMsg(null)}
        onSave={saveEditedMsg}/>
    </div>
  );
}
// ── SETTINGS ─────────────────────────────────────────────────
function NotifToggleRow({ row, on, onToggle, last }) {
  return (
    <button onClick={onToggle} className="press" style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
      background: 'transparent', border: 'none',
      borderBottom: last ? 'none' : '1px solid var(--line)',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10, background: 'var(--subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: on ? 'var(--primary)' : 'var(--ink-3)', flexShrink: 0,
      }}>
        <SCIcon name={row.icon} size={16}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{row.label}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{row.desc}</div>
      </div>
      {/* iOS-style switch */}
      <div style={{
        width: 42, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? 'var(--primary)' : 'var(--line)',
        position: 'relative', transition: 'background 160ms ease',
      }}>
        <div style={{
          position: 'absolute', top: 2, left: on ? 18 : 2,
          width: 22, height: 22, borderRadius: 11, background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          transition: 'left 160ms ease',
        }}/>
      </div>
    </button>
  );
}

// ── SETTINGS SUB-SCREENS (linked calendar, blocked users, help) ──────────────
function SCLinkedCalendar({ onBack, value, setValue }) {
  const options = [
    { k:'google',  label:'Google Calendar', desc:'Sync events to your Google account', icon:'calendar' },
    { k:'apple',   label:'Apple Calendar',  desc:'Sync to iCloud across your devices', icon:'calendar' },
    { k:'outlook', label:'Outlook',         desc:'Microsoft 365 / Outlook.com',         icon:'calendar' },
  ];
  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <SCTopBar onBack={onBack}/>
      <div style={{ padding: '4px 18px 18px' }}>
        <div className="label-cap" style={{ color:'var(--ink-3)' }}>SETTINGS</div>
        <h1 style={{ fontSize: 28, margin: '4px 0 6px', letterSpacing: '-0.02em' }}>Linked calendar</h1>
        <div style={{ fontSize: 13, color:'var(--ink-3)', lineHeight: 1.5 }}>
          Events you RSVP to will be added automatically. Disconnect anytime.
        </div>
      </div>
      <div style={{ padding: '0 18px' }}>
        <SCCard style={{ padding: 6 }}>
          {options.map((o, i) => (
            <button key={o.k} onClick={() => setValue(o.k)} className="press" style={{
              width:'100%', display:'flex', alignItems:'center', gap: 12, padding: 12,
              background: value === o.k ? 'var(--subtle)' : 'transparent',
              border:'none', borderRadius: 12, cursor:'pointer', textAlign:'left',
              marginBottom: i < options.length - 1 ? 2 : 0,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background:'var(--subtle)',
                display:'flex', alignItems:'center', justifyContent:'center',
                color: value === o.k ? 'var(--primary)' : 'var(--ink-2)',
              }}>
                <SCIcon name={o.icon} size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 11, color:'var(--ink-3)', marginTop: 1 }}>{o.desc}</div>
              </div>
              {value === o.k && (
                <div style={{ width: 22, height: 22, borderRadius: 11, background:'var(--primary)', color:'var(--primary-ink)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <SCIcon name="check" size={12}/>
                </div>
              )}
            </button>
          ))}
        </SCCard>
        {value && (
          <button onClick={() => setValue(null)} className="press" style={{
            width:'100%', height: 44, marginTop: 12, borderRadius: 12,
            background:'transparent', border:'1px solid var(--line)', cursor:'pointer',
            fontFamily:'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing:'0.14em', color:'var(--ink-2)',
          }}>DISCONNECT</button>
        )}
      </div>
    </div>
  );
}

function SCBlockedUsers({ onBack, blocked, setBlocked }) {
  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <SCTopBar onBack={onBack}/>
      <div style={{ padding: '4px 18px 18px' }}>
        <div className="label-cap" style={{ color:'var(--ink-3)' }}>SETTINGS</div>
        <h1 style={{ fontSize: 28, margin: '4px 0 6px', letterSpacing: '-0.02em' }}>Blocked users</h1>
        <div style={{ fontSize: 13, color:'var(--ink-3)', lineHeight: 1.5 }}>
          Blocked accounts can't see your profile, message you, or join events you host.
        </div>
      </div>
      <div style={{ padding: '0 18px' }}>
        {blocked.length === 0 ? (
          <SCCard style={{ padding: 28, textAlign:'center' }}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No one blocked</div>
            <div style={{ fontSize: 12, color:'var(--ink-3)' }}>You haven't blocked anyone yet.</div>
          </SCCard>
        ) : (
          <SCCard>
            {blocked.map((b, i) => (
              <div key={b.id} style={{
                display:'flex', alignItems:'center', gap: 12, padding: 12,
                borderBottom: i < blocked.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 20,
                  background:'var(--subtle)', display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, color:'var(--ink-2)',
                }}>{b.name.split(' ').map(s => s[0]).join('').slice(0,2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color:'var(--ink-3)' }}>@{b.username} · {b.reason}</div>
                </div>
                <button onClick={() => setBlocked(blocked.filter(x => x.id !== b.id))} className="press" style={{
                  height: 32, padding:'0 12px', borderRadius: 10,
                  background:'var(--card)', border:'1px solid var(--line)', cursor:'pointer',
                  fontFamily:'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing:'0.12em', color:'var(--ink-2)',
                }}>UNBLOCK</button>
              </div>
            ))}
          </SCCard>
        )}
      </div>
    </div>
  );
}

function SCHelpFeedback({ onBack }) {
  const [sent, setSent] = useStateS(false);
  const [msg, setMsg] = useStateS('');
  const faqs = [
    { q:'How does the discovery radius work?',     a:'We only show events within the radius you set in Settings. Increase it to see more, decrease for hyper-local.' },
    { q:'Why are some events visible to friends only?', a:'Hosts choose who can see and join — public, friends-only, or invite-only.' },
    { q:'Can I host as my organization?',          a:'Yes — switch to your org account from the profile tab, then tap + to create.' },
    { q:'How do I report unsafe behavior?',         a:'Open the profile of the user or event, tap the shield icon, and choose "Report." Our safety team reviews every submission within 24 hours.' },
    { q:'Can I block someone?',                     a:'Yes. From their profile, tap the shield → Block. Blocked accounts cannot see your profile, message you, or RSVP to events you host. Manage them anytime in Settings → Blocked users.' },
    { q:'What data do my friends see?',             a:'Friends see your name, handle, interests, and events you\'ve joined or are hosting. They never see your exact location — only event locations you choose to attend.' },
    { q:'What happens if an event hits capacity?',  a:'New attendees join a waitlist in the order they tap Join. If someone leaves, the next person on the waitlist is auto-promoted and gets a notification.' },
    { q:'How do I delete my account?',             a:'Email support@scenecheck.app from your registered address. We process deletions within 30 days.' },
  ];
  const [openIdx, setOpenIdx] = useStateS(-1);
  return (
    <div className="fade-in" style={{ paddingBottom: 120 }}>
      <SCTopBar onBack={onBack}/>
      <div style={{ padding: '4px 18px 18px' }}>
        <div className="label-cap" style={{ color:'var(--ink-3)' }}>SETTINGS</div>
        <h1 style={{ fontSize: 28, margin: '4px 0 6px', letterSpacing: '-0.02em' }}>Help &amp; feedback</h1>
        <div style={{ fontSize: 13, color:'var(--ink-3)', lineHeight: 1.5 }}>
          Common questions, and a direct line to the team.
        </div>
      </div>

      <div style={{ padding:'0 18px' }}>
        {/* H2 FIX #5 — replay onboarding tour, surfaced in-app */}
        <HelpReplayRow onReplay={() => { onBack(); window.scReplayOnboarding && window.scReplayOnboarding(); }}/>
        <SCSection title="FAQ">
          <SCCard>
            {faqs.map((f, i) => {
              const open = openIdx === i;
              return (
                <div key={i} style={{ borderBottom: i < faqs.length - 1 ? '1px solid var(--line)' : 'none' }}>
                  <button onClick={() => setOpenIdx(open ? -1 : i)} className="press" style={{
                    width:'100%', display:'flex', alignItems:'center', gap: 12, padding: 14,
                    background:'transparent', border:'none', cursor:'pointer', textAlign:'left',
                  }}>
                    <span style={{ flex:1, fontSize: 14, fontWeight: 500 }}>{f.q}</span>
                    <SCIcon name="chevron-right" size={14} style={{ color:'var(--ink-3)', transform: open ? 'rotate(90deg)' : 'none', transition:'transform 160ms' }}/>
                  </button>
                  {open && (
                    <div style={{ padding:'0 14px 14px', fontSize: 13, color:'var(--ink-2)', lineHeight: 1.55 }}>{f.a}</div>
                  )}
                </div>
              );
            })}
          </SCCard>
        </SCSection>

        <SCSection title="SEND FEEDBACK">
          <SCCard style={{ padding: 14 }}>
            {sent ? (
              <div style={{ textAlign:'center', padding:'14px 0' }}>
                <div style={{
                  width: 48, height: 48, margin:'0 auto 10px', borderRadius: 24,
                  background:'var(--subtle)', display:'flex', alignItems:'center', justifyContent:'center',
                }}>
                  <SCIcon name="check" size={22}/>
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Thanks — we got it</div>
                <div style={{ fontSize: 12, color:'var(--ink-3)' }}>The team reads every message.</div>
                <button onClick={() => { setSent(false); setMsg(''); }} className="press" style={{
                  marginTop: 14, height: 38, padding:'0 16px', borderRadius: 10,
                  background:'var(--card)', border:'1px solid var(--line)', cursor:'pointer',
                  fontFamily:'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing:'0.12em',
                }}>SEND ANOTHER</button>
              </div>
            ) : (
              <>
                <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Tell us what's working, what's broken, or what you'd love to see…" style={{
                  width:'100%', boxSizing:'border-box', display:'block',
                  minHeight: 110, padding: 12, borderRadius: 10,
                  border:'1px solid var(--line)', background:'var(--surface)', color:'var(--ink)',
                  fontSize: 14, fontFamily:'inherit', resize:'vertical', outline:'none',
                }}/>
                <button onClick={() => msg.trim() && setSent(true)} className="press" disabled={!msg.trim()} style={{
                  width:'100%', height: 44, marginTop: 10, borderRadius: 12,
                  background: msg.trim() ? 'var(--primary)' : 'var(--subtle)',
                  color: msg.trim() ? 'var(--primary-ink)' : 'var(--ink-3)',
                  border:'none', cursor: msg.trim() ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing:'0.14em',
                }}>SEND FEEDBACK</button>
              </>
            )}
          </SCCard>
        </SCSection>

        <SCSection title="CONTACT">
          <SCCard>
            <RowMenu icon="mail" label="Email support" v="support@scenecheck.app"/>
            <RowMenu icon="globe" label="Status page" v="all systems"/>
            <RowMenu icon="help" label="Community guidelines" v="" last/>
          </SCCard>
        </SCSection>
      </div>
    </div>
  );
}

function SCSettingsScreen({ go, radius, setRadius, visibility, setVisibility, notifPrefs, setNotifPref, incomingRequestList, dark, setDark, requestSignOut }) {
  const requestCount = (incomingRequestList || []).length;
  // Sub-screens for Linked calendar / Blocked users / Help & feedback. They live
  // here rather than as separate routes so the back button returns to settings.
  const [subView, setSubView] = useStateS(null); // null | 'calendar' | 'blocked' | 'help'
  const [linkedCal, setLinkedCal] = useStateS('google'); // 'google' | 'apple' | 'outlook' | null
  const [blocked, setBlocked] = useStateS([
    { id:'b1', name:'Casey Morgan',  username:'casey_m',  reason:'Blocked Mar 14' },
    { id:'b2', name:'Riley Tanaka',  username:'rileyt',   reason:'Blocked Feb 02' },
  ]);

  if (subView === 'calendar') return <SCLinkedCalendar onBack={() => setSubView(null)} value={linkedCal} setValue={setLinkedCal}/>;
  if (subView === 'blocked')  return <SCBlockedUsers   onBack={() => setSubView(null)} blocked={blocked} setBlocked={setBlocked}/>;
  if (subView === 'help')     return <SCHelpFeedback   onBack={() => setSubView(null)}/>;

  const calLabel = linkedCal === 'google' ? 'Google' : linkedCal === 'apple' ? 'Apple' : linkedCal === 'outlook' ? 'Outlook' : 'None';
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 18px 12px' }}>
        <div className="label-cap">Account</div>
        <div className="display-tight" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>Settings</div>
      </div>

      <SettingsSection title="DISCOVERY" summary={`${radius} mi radius`}>
        <SCCard style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, display: 'inline-flex', alignItems: 'center' }}>
              <LabelWithTip
                tipTitle="DISCOVERY RADIUS"
                tipBody="The maximum distance from your current location for events to appear in your feed and on the map. Smaller = hyper-local; larger = more variety, but a busier feed.">
                Discovery radius
              </LabelWithTip>
            </span>
            <span className="mono" style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>{radius} mi</span>
          </div>
          <input type="range" min="0.5" max="50" step="0.5" value={radius}
            onChange={(e) => setRadius(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)' }}/>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
            <span>0.5 MI</span><span>50 MI</span>
          </div>
          {radius >= 25 && (
            <div style={{
              marginTop: 10, padding: '8px 10px',
              background: 'color-mix(in oklch, var(--warn) 15%, transparent)',
              border: '1px solid color-mix(in oklch, var(--warn) 35%, transparent)',
              borderRadius: 10, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.4,
            }}>
              Heads up — at {radius} miles you'll see events across the whole region. Expect a busier feed.
            </div>
          )}
        </SCCard>
      </SettingsSection>

      <SettingsSection title="PROFILE VISIBILITY" summary={visibility === 'public' ? 'Public — anyone can add you' : `Private${requestCount ? ` · ${requestCount} pending` : ''}`}>
        <SCCard style={{ padding: 6 }}>
          {[
            { k:'public',  label:'Public',  desc:'Anyone in your radius can find and add you', icon:'globe' },
            { k:'private', label:'Private', desc:'Approval required — people must request to add you and see your profile', icon:'lock' },
          ].map((v, i, arr) => (
            <button key={v.k} onClick={() => setVisibility(v.k)} className="press" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              padding: 12, background: visibility === v.k ? 'var(--subtle)' : 'transparent',
              border: 'none', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
              marginBottom: i < arr.length-1 ? 2 : 0,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: 'var(--subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: visibility === v.k ? 'var(--primary)' : 'var(--ink-2)',
              }}>
                <SCIcon name={v.icon} size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{v.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{v.desc}</div>
              </div>
              {visibility === v.k && (
                <div style={{ width: 22, height: 22, borderRadius: 11, background: 'var(--primary)', color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SCIcon name="check" size={12}/>
                </div>
              )}
            </button>
          ))}
        </SCCard>
        {visibility === 'private' && (
          <SCCard style={{ marginTop: 8 }}>
            <button onClick={() => go('requests')} className="press" style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, background: 'var(--subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
              }}>
                <SCIcon name="user-plus" size={16}/>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Follow requests</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                  {requestCount > 0 ? `${requestCount} waiting on your approval` : 'No pending requests'}
                </div>
              </div>
              {requestCount > 0 && (
                <div className="mono" style={{
                  minWidth: 22, height: 22, padding: '0 7px', borderRadius: 11,
                  background: 'var(--primary)', color: 'var(--primary-ink)',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{requestCount}</div>
              )}
              <SCIcon name="chevron-right" size={16} style={{ color: 'var(--ink-3)' }}/>
            </button>
          </SCCard>
        )}
      </SettingsSection>

      <SettingsSection title="APPEARANCE" summary={dark ? 'Dark mode' : 'Light mode'}>
        <SCCard style={{ padding: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[
              { k:false, label:'Light', icon:'sun',  swatchBg:'#FFFBF5', swatchInk:'#14110F', swatchLine:'#ECE3D2' },
              { k:true,  label:'Dark',  icon:'moon', swatchBg:'#16120E', swatchInk:'#F4ECDD', swatchLine:'#332A22' },
            ].map(opt => {
              const selected = !!dark === !!opt.k;
              return (
                <button key={String(opt.k)} onClick={() => setDark(opt.k)} className="press" style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8,
                  padding: 10, background: 'transparent',
                  border: '1.5px solid ' + (selected ? 'var(--primary)' : 'var(--line)'),
                  borderRadius: 14, cursor: 'pointer', textAlign: 'left',
                }}>
                  {/* Mini preview swatch */}
                  <div style={{
                    height: 64, borderRadius: 10, position: 'relative',
                    background: opt.swatchBg, border: '1px solid ' + opt.swatchLine,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 8, left: 8, right: 8, height: 8, borderRadius: 4,
                      background: opt.swatchInk, opacity: 0.85,
                    }}/>
                    <div style={{
                      position: 'absolute', top: 22, left: 8, width: '55%', height: 5, borderRadius: 3,
                      background: opt.swatchInk, opacity: 0.45,
                    }}/>
                    <div style={{
                      position: 'absolute', bottom: 8, left: 8, right: 8, height: 18, borderRadius: 6,
                      background: opt.swatchLine,
                    }}/>
                    <div style={{
                      position: 'absolute', bottom: 11, left: 12, width: 28, height: 12, borderRadius: 4,
                      background: '#FF5B47',
                    }}/>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 9,
                      background: selected ? 'var(--primary)' : 'var(--subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: selected ? 'var(--primary-ink)' : 'var(--ink-2)',
                      transition: 'background 160ms ease, color 160ms ease',
                    }}>
                      <SCIcon name={opt.icon} size={14}/>
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: selected ? 600 : 500 }}>{opt.label}</div>
                    {selected && (
                      <div style={{
                        width: 20, height: 20, borderRadius: 10, background: 'var(--primary)',
                        color: 'var(--primary-ink)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <SCIcon name="check" size={11}/>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </SCCard>
      </SettingsSection>

      <SettingsSection title="NOTIFICATIONS" summary={`${Object.values(notifPrefs || {}).filter(Boolean).length} of ${Object.keys(notifPrefs || {}).length} on`}>
        <SCCard style={{ padding: 4 }}>
          {[
            { k:'messages',       label:'Messages',          desc:'Direct messages from friends',                 icon:'chat'   },
            { k:'friendRequests', label:'Friend requests',   desc:"When someone wants to add you",                icon:'user-plus' },
            { k:'orgEvents',      label:'New events',        desc:'Events from orgs you follow',                  icon:'calendar' },
            { k:'eventReminders', label:'Event reminders',   desc:"Heads-up an hour before events you're going to", icon:'bell' },
            { k:'friendActivity', label:'Friend activity',   desc:'When friends RSVP or post events',             icon:'people' },
            { k:'weeklyDigest',   label:'Weekly digest',     desc:'A Sunday summary of upcoming local scenes',    icon:'mail'   },
          ].map((row, i, arr) => (
            <NotifToggleRow key={row.k} row={row}
              on={!!notifPrefs?.[row.k]}
              onToggle={() => setNotifPref(row.k, !notifPrefs?.[row.k])}
              last={i === arr.length - 1}/>
          ))}
        </SCCard>
      </SettingsSection>

      <SettingsSection title="PREFERENCES" summary={`${calLabel} · ${blocked.length} blocked`}>
        <SCCard>
          <RowMenu icon="calendar" label="Linked calendar" v={calLabel} onClick={() => setSubView('calendar')}/>
          <RowMenu icon="shield" label="Blocked users" v={String(blocked.length)} onClick={() => setSubView('blocked')}/>
          <RowMenu icon="help" label="Help & feedback" v="" last onClick={() => setSubView('help')}/>
        </SCCard>
      </SettingsSection>

      <div style={{ padding: '14px 18px 0' }}>
        <button onClick={() => requestSignOut && requestSignOut()} className="press" style={{
          width: '100%', height: 48, borderRadius: 14,
          background: 'transparent', border: '1px solid var(--line)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em', color: 'var(--ink-2)',
        }}>
          <SCIcon name="logout" size={16}/> SIGN OUT
        </button>
      </div>
      <div style={{ padding: '14px 18px', textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 11 }}>
        SceneCheck · v0.4.2
      </div>
    </div>
  );
}

// ── FOLLOW REQUESTS (people who want to add you when your account is private) ─────
function SCRequestsScreen({ go, incomingRequestList = [], acceptRequest, declineRequest }) {
  const requests = (incomingRequestList || []).map(r => ({
    ...r,
    person: SC_VISIBLE_PERSON_BY_ID[r.personId],
  })).filter(r => r.person);

  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 18px 12px' }}>
        <div className="label-cap">Inbox</div>
        <div className="display-tight" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>Follow requests</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, letterSpacing: '0.04em' }}>
          {requests.length} {requests.length === 1 ? 'PERSON WANTS' : 'PEOPLE WANT'} TO ADD YOU
        </div>
      </div>

      {requests.length === 0 && (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: 'var(--subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--ink-3)', margin: '0 auto 14px',
          }}>
            <SCIcon name="user-check" size={28}/>
          </div>
          <div style={{ fontSize: 16, fontWeight: 600 }}>You're all caught up</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
            New requests will show here.
          </div>
        </div>
      )}

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map(r => (
          <div key={r.id} style={{
            background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <button onClick={() => go({ name: 'profile-other', personId: r.person.id })} className="press" style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left',
            }}>
              <SCAvatar person={r.person} size={48}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{r.person.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  @{r.person.username} · {r.when}
                </div>
              </div>
            </button>
            {r.note && (
              <div style={{
                fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.4,
                padding: '10px 12px', background: 'var(--subtle)', borderRadius: 12,
              }}>
                "{r.note}"
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => acceptRequest(r.id)} className="press" style={{
                flex: 1, height: 40, borderRadius: 12,
                background: 'var(--primary)', color: 'var(--primary-ink)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              }}>
                <SCIcon name="check" size={14}/> ACCEPT
              </button>
              <button onClick={() => declineRequest(r.id)} className="press" style={{
                flex: 1, height: 40, borderRadius: 12,
                background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--line)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              }}>
                <SCIcon name="x" size={14}/> DECLINE
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SEARCH / DISCOVER (people + orgs, with tag filters) ──────────────────────
// Primary surface for adding new friends + orgs you follow.
function SCSearchScreen({ go, friends, friendStatus, toggleFriend, following, followStatus, toggleFollow }) {
  const [q, setQ] = useStateS('');
  const [type, setType] = useStateS('all'); // 'all' | 'org' | 'person'
  const [tags, setTags] = useStateS([]); // selected tag filters
  const [recent, setRecent] = useStateS(() => {
    try { return JSON.parse(localStorage.getItem('sc-recent-searches') || '[]'); }
    catch { return []; }
  });
  const pushRecent = (term) => {
    const v = term.trim(); if (!v) return;
    setRecent(prev => {
      const next = [v, ...prev.filter(x => x.toLowerCase() !== v.toLowerCase())].slice(0, 6);
      try { localStorage.setItem('sc-recent-searches', JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const clearRecent = () => {
    setRecent([]);
    try { localStorage.removeItem('sc-recent-searches'); } catch {}
  };
  const TRENDING_TAGS = ['biking', 'study', 'climbing', 'coffee', 'music'];

  // Union of interests across orgs + people, with frequency
  const allTags = React.useMemo(() => {
    const counts = {};
    [...SC_ORGS, ...SC_VISIBLE_PEOPLE].forEach(a => (a.interests || []).forEach(t => { counts[t] = (counts[t]||0)+1; }));
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).map(([t]) => t);
  }, []);

  const toggleTag = (t) => setTags(curr => curr.includes(t) ? curr.filter(x => x !== t) : [...curr, t]);
  const clearTags = () => setTags([]);

  const matchesQ = (a) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase().trim();
    return (a.name || '').toLowerCase().includes(needle)
        || (a.handle || '').toLowerCase().includes(needle)
        || ('@' + (a.username || '')).toLowerCase().includes(needle)
        || (a.bio || '').toLowerCase().includes(needle)
        || (a.interests || []).some(t => t.includes(needle));
  };
  const matchesTags = (a) => tags.length === 0 || tags.every(t => (a.interests || []).includes(t));

  const orgs = (type === 'person') ? [] : SC_ORGS.filter(o => matchesQ(o) && matchesTags(o));
  const people = (type === 'org') ? [] : SC_VISIBLE_PEOPLE.filter(p => matchesQ(p) && matchesTags(p));

  const totalResults = orgs.length + people.length;
  const hasFilters = q || tags.length > 0 || type !== 'all';

  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 18px 12px' }}>
        <div className="label-cap">Discover</div>
        <div className="display-tight" style={{ fontSize: 36, lineHeight: 0.95, marginTop: 4 }}>Search</div>
        <div style={{ marginTop: 4, fontSize: 13, color: 'var(--ink-3)' }}>
          Find people to friend and organizations to follow.
        </div>
      </div>

      {/* Search input */}
      <div style={{ padding: '0 18px 10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px',
          background: 'var(--subtle)', borderRadius: 14, height: 48,
        }}>
          <SCIcon name="search" size={16} color="var(--ink-3)"/>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') pushRecent(q); }}
            onBlur={() => pushRecent(q)}
            placeholder="Search by name, handle, or interest…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink)',
            }}/>
          {q && <button onClick={() => setQ('')} className="press" style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)',
            display: 'flex', alignItems: 'center',
          }}><SCIcon name="x" size={14}/></button>}
        </div>
      </div>

      {/* Type filter — segmented */}
      <div style={{ padding: '0 18px', display: 'flex', gap: 6, marginBottom: 10 }}>
        {[
          { k: 'all',    label: 'ALL',    n: SC_ORGS.length + SC_VISIBLE_PEOPLE.length },
          { k: 'org',    label: 'ORGS',   n: SC_ORGS.length },
          { k: 'person', label: 'PEOPLE', n: SC_VISIBLE_PEOPLE.length },
        ].map(t => {
          const active = type === t.k;
          return (
            <button key={t.k} onClick={() => setType(t.k)} className="press" style={{
              flex: 1, padding: '10px 0', borderRadius: 12, cursor: 'pointer',
              background: active ? 'var(--ink)' : 'var(--card)',
              color: active ? 'var(--surface)' : 'var(--ink-2)',
              border: '1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              {t.label}
              <span style={{
                fontSize: 10, fontWeight: 600,
                padding: '2px 6px', borderRadius: 999,
                background: active ? 'rgba(255,255,255,0.15)' : 'var(--subtle)',
                color: active ? 'var(--surface)' : 'var(--ink-3)',
              }}>{t.n}</span>
            </button>
          );
        })}
      </div>

      {/* Tag filter chips — horizontal scroll */}
      <div style={{ padding: '4px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div className="label-cap">Filter by tag</div>
        {tags.length > 0 && (
          <button onClick={clearTags} className="press" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
            color: 'var(--primary)',
          }}>CLEAR ({tags.length})</button>
        )}
      </div>
      <div className="scroll" style={{
        padding: '0 18px 12px', display: 'flex', gap: 6, overflowX: 'auto',
      }}>
        {allTags.map(t => {
          const active = tags.includes(t);
          return (
            <button key={t} onClick={() => toggleTag(t)} className="press" style={{
              padding: '8px 12px', borderRadius: 999, flexShrink: 0, cursor: 'pointer',
              background: active ? 'var(--primary)' : 'var(--card)',
              color: active ? 'var(--primary-ink)' : 'var(--ink-2)',
              border: '1px solid ' + (active ? 'var(--primary)' : 'var(--line)'),
              fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
            }}>
              #{t}
            </button>
          );
        })}
      </div>

      {/* First-launch surface: when nothing typed and no tags selected, show
          recent searches + trending tags instead of dumping all results. */}
      {!q && tags.length === 0 && type === 'all' && (
        <div style={{ padding: '0 14px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {recent.length > 0 && (
            <SCSection title="RECENT" padding={4} action={
              <button onClick={clearRecent} className="press" style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                color: 'var(--ink-3)',
              }}>CLEAR</button>
            }>
              <SCCard style={{ padding: '4px 0' }}>
                {recent.map((r, i) => (
                  <button key={i} onClick={() => setQ(r)} className="press" style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 14px', borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9, background: 'var(--subtle)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--ink-3)',
                    }}>
                      <SCIcon name="rotate-ccw" size={13}/>
                    </div>
                    <span style={{ flex: 1, fontSize: 14 }}>{r}</span>
                    <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
                  </button>
                ))}
              </SCCard>
            </SCSection>
          )}
          <SCSection title="TRENDING TAGS" padding={4}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TRENDING_TAGS.map(t => (
                <button key={t} onClick={() => toggleTag(t)} className="press" style={{
                  padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
                  background: 'var(--card)', color: 'var(--ink)',
                  border: '1px solid var(--line)',
                  fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600,
                }}>
                  #{t}
                </button>
              ))}
            </div>
          </SCSection>
          <div style={{
            margin: '0 4px', padding: '12px 14px',
            background: 'var(--subtle)', borderRadius: 12,
            fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <SCIcon name="search" size={14} color="var(--ink-3)"/>
            <span>Try typing a name, <span className="mono">@handle</span>, or pick a tag above to filter people and orgs.</span>
          </div>
        </div>
      )}

      {/* Results */}
      {(q || tags.length > 0 || type !== 'all') && (
        totalResults === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>—</div>
          <div style={{ fontSize: 14, color: 'var(--ink-2)', fontWeight: 500 }}>No results</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {hasFilters ? 'Try removing filters or a different search term.' : 'Type something to start searching.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {orgs.length > 0 && (
            <SCSection title={`ORGANIZATIONS · ${orgs.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {orgs.map(o => (
                  <SCSearchOrgRow key={o.id} org={o}
                    status={followStatus ? followStatus(o.id) : 'none'}
                    onOpen={() => go({ name:'org-profile', orgId: o.id })}
                    onToggle={() => toggleFollow && toggleFollow(o.id)}/>
                ))}
              </div>
            </SCSection>
          )}
          {people.length > 0 && (
            <SCSection title={`PEOPLE · ${people.length}`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {people.map(p => (
                  <SCSearchPersonRow key={p.id} person={p}
                    status={friendStatus ? friendStatus(p.id) : 'none'}
                    onOpen={() => go({ name:'profile-other', personId: p.id })}
                    onToggle={() => toggleFriend && toggleFriend(p.id)}/>
                ))}
              </div>
            </SCSection>
          )}
        </div>
      )
      )}
    </div>
  );
}

function SCSearchOrgRow({ org, status, onOpen, onToggle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 12,
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
    }}>
      <button onClick={onOpen} className="press" style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <SCAvatar person={{ ...org, type: 'org' }} size={44}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {org.name}
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
            {org.handle} · {(org.followers || 0).toLocaleString()} followers
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
            {(org.interests || []).slice(0, 3).map(t => (
              <span key={t} className="mono" style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                padding: '2px 6px', borderRadius: 999,
                background: 'var(--subtle)', color: 'var(--ink-3)',
              }}>#{t}</span>
            ))}
          </div>
        </div>
      </button>
      <button onClick={onToggle} className="press" style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 700,
        padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
        background: status === 'following' ? 'var(--ink)' : status === 'pending' ? 'var(--card)' : 'var(--primary)',
        color: status === 'following' ? 'var(--surface)' : status === 'pending' ? 'var(--ink-3)' : 'var(--primary-ink)',
        border: status === 'pending' ? '1px solid var(--line)' : 'none',
        whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {status === 'following' ? 'FOLLOWING' : status === 'pending' ? 'REQUESTED' : 'FOLLOW'}
      </button>
    </div>
  );
}

function SCSearchPersonRow({ person, status, onOpen, onToggle, pendingUnfriendUntil }) {
  // When the unfriend button has been tapped recently, this row goes into a
  // 30-second grace state — the row remains in the friends list but pulses
  // and the action button shows "UNDO · Xs".
  const isPendingUnfriend = !!pendingUnfriendUntil;
  const [, force] = React.useState(0);
  React.useEffect(() => {
    if (!isPendingUnfriend) return;
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [isPendingUnfriend]);
  const secondsLeft = isPendingUnfriend
    ? Math.max(0, Math.ceil((pendingUnfriendUntil - Date.now()) / 1000))
    : null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: 12,
      background: 'var(--card)', border: '1px solid ' + (isPendingUnfriend ? 'var(--primary)' : 'var(--line)'),
      borderRadius: 14, opacity: isPendingUnfriend ? 0.7 : 1, transition: 'opacity 200ms, border-color 200ms',
    }}>
      <button onClick={onOpen} className="press" style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0,
        background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0,
      }}>
        <SCAvatar person={person} size={44}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: isPendingUnfriend ? 'line-through' : 'none' }}>
            {person.name}
          </div>
          <div className="mono" style={{ fontSize: 11, color: isPendingUnfriend ? 'var(--primary)' : 'var(--ink-3)', marginTop: 2 }}>
            {isPendingUnfriend
              ? <>Removing in {secondsLeft}s</>
              : <>@{person.username} · {person.mutual} mutual</>}
          </div>
          {!isPendingUnfriend && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {(person.interests || []).slice(0, 3).map(t => (
                <span key={t} className="mono" style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '0.04em',
                  padding: '2px 6px', borderRadius: 999,
                  background: 'var(--subtle)', color: 'var(--ink-3)',
                }}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      </button>
      <button onClick={onToggle} className="press" style={{
        fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 700,
        padding: '8px 12px', borderRadius: 999, cursor: 'pointer',
        background: isPendingUnfriend ? 'var(--primary)'
          : status === 'friend' ? 'var(--ink)'
          : status === 'pending' ? 'var(--card)' : 'var(--primary)',
        color: isPendingUnfriend ? 'var(--primary-ink)'
          : status === 'friend' ? 'var(--surface)'
          : status === 'pending' ? 'var(--ink-3)' : 'var(--primary-ink)',
        border: (!isPendingUnfriend && status === 'pending') ? '1px solid var(--line)' : 'none',
        whiteSpace: 'nowrap', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {isPendingUnfriend ? <><SCIcon name="rotate-ccw" size={12}/> UNDO · {secondsLeft}s</>
          : status === 'friend' ? <><SCIcon name="user-check" size={12}/> FRIENDS</>
          : status === 'pending' ? <><SCIcon name="clock" size={12}/> SENT</>
          : <><SCIcon name="plus" size={12}/> ADD</>}
      </button>
    </div>
  );
}

// ── DRAFTS (in-progress event forms saved from the publish-failure flow) ─────
function SCDraftsScreen({ go, back, drafts = [], removeDraft }) {
  const STEP_LABELS = ['Basics', 'When & Where', 'Tags & Limits', 'Review'];
  const [confirmDel, setConfirmDel] = useStateS(null);
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('profile')} subtitle="HOSTING" title=""/>
      <div style={{ padding: '0 18px 14px' }}>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95 }}>Drafts</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.45 }}>
          {drafts.length === 0
            ? "Events you start but don't publish are saved here so you can finish them later."
            : `${drafts.length} unpublished ${drafts.length === 1 ? 'event' : 'events'}. Tap to continue where you left off.`}
        </div>
      </div>

      {drafts.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <SCCard style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: 'var(--subtle)',
              color: 'var(--ink-3)', margin: '0 auto 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SCIcon name="edit" size={26}/>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>No drafts saved</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
              When you start creating an event and step away, we'll save it here so you can pick it up later.
            </div>
            <button onClick={() => go({ name:'create-event' })} className="press" style={{
              marginTop: 18, padding: '10px 16px', borderRadius: 999,
              background: 'var(--ink)', color: 'var(--card)', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <SCIcon name="plus" size={14}/> NEW EVENT
            </button>
          </SCCard>
        </div>
      ) : (
        <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {drafts.map(d => {
            const f = d.form || {};
            const progress = ((d.lastStep ?? 0) + 1) / STEP_LABELS.length;
            const stepLabel = STEP_LABELS[d.lastStep ?? 0] || 'Basics';
            return (
              <div key={d.id} style={{
                background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16,
                padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'var(--primary-soft)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <SCIcon name="edit" size={18}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 9, letterSpacing: '0.16em', color: 'var(--ink-3)', fontWeight: 600 }}>
                      DRAFT · SAVED {d.savedAt.toUpperCase()}
                    </div>
                    <div className="display" style={{ fontSize: 16, lineHeight: 1.2, marginTop: 2 }}>
                      {f.title?.trim() || 'Untitled draft'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, lineHeight: 1.4 }}>
                      {(f.date || '—')} · {(f.timeStart || '—')}{f.timeEnd ? ` – ${f.timeEnd}` : ''}
                      {f.location ? ` · ${f.location}` : ''}
                    </div>
                    {(f.interests || []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                        {f.interests.slice(0, 3).map(t => <SCTag key={t} tag={t} size="sm" tone="soft"/>)}
                      </div>
                    )}
                  </div>
                </div>
                {/* progress strip */}
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5,
                    fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.1em',
                  }}>
                    <span>NEXT STEP · {stepLabel.toUpperCase()}</span>
                    <span>{Math.round(progress * 100)}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--subtle)', overflow: 'hidden' }}>
                    <div style={{
                      width: `${progress * 100}%`, height: '100%', background: 'var(--primary)',
                      transition: 'width 220ms ease',
                    }}/>
                  </div>
                </div>
                {/* actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setConfirmDel(d)} className="press" style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    border: '1px solid var(--line)', background: 'var(--card)',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
                  }} aria-label="Delete draft">
                    <SCIcon name="x" size={16}/>
                  </button>
                  <button onClick={() => go({ name: 'create-event', draftId: d.id })} className="press" style={{
                    flex: 1, height: 44, borderRadius: 12, border: 'none',
                    background: 'var(--primary)', color: 'var(--primary-ink)', cursor: 'pointer',
                    fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    CONTINUE EDITING →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <SCConfirmDialog
        open={!!confirmDel}
        title="Delete this draft?"
        body={`"${confirmDel?.form?.title?.trim() || 'Untitled draft'}" will be removed. This can't be undone.`}
        confirmLabel="DELETE" cancelLabel="KEEP"
        tone="danger" icon="x"
        onConfirm={() => { if (confirmDel) removeDraft && removeDraft(confirmDel.id); setConfirmDel(null); window.scToast && window.scToast({ message: 'Draft deleted.', kind: 'info' }); }}
        onCancel={() => setConfirmDel(null)}/>
    </div>
  );
}

// ── MY HOSTING (events I'm hosting under the active account) ─────────────────
function SCMyHosting({ go, back, activeAccount }) {
  const account = SC_MY_ACCOUNTS.find(a => a.id === activeAccount) || SC_MY_ACCOUNTS[0];
  const myEvents = SC_EVENTS.filter(e => e.hostId === account.id);
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('profile')} subtitle="HOSTING" title=""/>
      <div style={{ padding: '0 18px 12px' }}>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95 }}>Events I'm hosting</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)' }}>
          As <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>{account.name}</span> · {myEvents.length} {myEvents.length === 1 ? 'event' : 'events'}
        </div>
      </div>
      {myEvents.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <SCCard style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>No events posted yet</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Create your first event to start filling this list.</div>
            <button onClick={() => go({ name:'create-event' })} className="press" style={{
              padding: '10px 16px', borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-ink)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <SCIcon name="plus" size={14}/> NEW EVENT
            </button>
          </SCCard>
        </div>
      ) : (
        <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myEvents.map(e => (
            <button key={e.id} onClick={() => go({ name:'event', eventId: e.id })} className="press" style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: 12,
              background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
              cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: 'var(--subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)',
              }}>
                <SCIcon name="calendar" size={20}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                  {scWhenRange(e)} · {e.attendees}/{e.cap} going
                </div>
              </div>
              <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MY FRIENDS (people in your friends set) ──────────────────────────────────
function SCMyFriends({ go, back, friends, friendStatus, toggleFriend, pendingUnfriend }) {
  const list = SC_VISIBLE_PEOPLE.filter(p => friends && friends.has(p.id));
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('profile')} subtitle="FRIENDS" title=""/>
      <div style={{ padding: '0 18px 12px' }}>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95 }}>Friends</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)' }}>
          {list.length} {list.length === 1 ? 'connection' : 'connections'}
        </div>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <SCCard style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>No friends yet</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Find people from your interests, mutual events, or campus.</div>
            <button onClick={() => go('search')} className="press" style={{
              padding: '10px 16px', borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-ink)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <SCIcon name="search" size={14}/> FIND PEOPLE
            </button>
          </SCCard>
        </div>
      ) : (
        <>
          <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(p => (
              <SCSearchPersonRow key={p.id} person={p}
                status={friendStatus ? friendStatus(p.id) : 'friend'}
                pendingUnfriendUntil={pendingUnfriend && pendingUnfriend.get && pendingUnfriend.get(p.id)}
                onOpen={() => go({ name:'profile-other', personId: p.id })}
                onToggle={() => toggleFriend && toggleFriend(p.id)}/>
            ))}
          </div>
          <div style={{ padding: '0 18px' }}>
            <button onClick={() => go('search')} className="press" style={{
              width: '100%', padding: '12px', borderRadius: 14,
              background: 'transparent', border: '1.5px dashed var(--line)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 600,
              color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <SCIcon name="search" size={14}/> FIND MORE PEOPLE
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── MY FOLLOWING (orgs you follow — filtered) ────────────────────────────────
function SCMyFollowing({ go, back, following, followStatus, toggleFollow }) {
  // Only orgs in the following set. Pull from SC_ORGS plus other managed
  // org accounts the user has chosen to follow.
  const all = [...SC_ORGS, ...SC_MY_ACCOUNTS.filter(a => a.type === 'org')];
  const list = all.filter(o => following && following.has(o.id));
  return (
    <div className="fade-in" style={{ paddingBottom: 110 }}>
      <SCTopBar onBack={() => back ? back() : go('profile')} subtitle="FOLLOWING" title=""/>
      <div style={{ padding: '0 18px 12px' }}>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95 }}>Orgs you follow</div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--ink-3)' }}>
          {list.length} {list.length === 1 ? 'organization' : 'organizations'} · You'll get notified when they post.
        </div>
      </div>
      {list.length === 0 ? (
        <div style={{ padding: '0 18px' }}>
          <SCCard style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>Not following anyone yet</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>Browse organizations and follow ones whose events you'd want to see.</div>
            <button onClick={() => go('search')} className="press" style={{
              padding: '10px 16px', borderRadius: 999, background: 'var(--primary)', color: 'var(--primary-ink)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              <SCIcon name="search" size={14}/> BROWSE ORGS
            </button>
          </SCCard>
        </div>
      ) : (
        <>
          <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map(o => (
              <SCSearchOrgRow key={o.id} org={o}
                status={followStatus ? followStatus(o.id) : 'following'}
                onOpen={() => go({ name:'org-profile', orgId: o.id })}
                onToggle={() => toggleFollow && toggleFollow(o.id)}/>
            ))}
          </div>
          <div style={{ padding: '0 18px' }}>
            <button onClick={() => go('search')} className="press" style={{
              width: '100%', padding: '12px', borderRadius: 14,
              background: 'transparent', border: '1.5px dashed var(--line)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.14em', fontWeight: 600,
              color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <SCIcon name="search" size={14}/> DISCOVER MORE ORGS
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── ATTENDEES LIST ───────────────────────────────────────────
function SCAttendees({ go, back, eventId, friendStatus, toggleFriend, pendingUnfriend }) {
  const e = SC_EVENT_BY_ID[eventId] || SC_EVENTS[0];
  // Filter out anyone who has blocked you — they don't appear in your view
  // of the attendee list (per their privacy preference).
  const visible = SC_VISIBLE_PEOPLE;
  return (
    <div className="fade-in" style={{ paddingBottom: 28 }}>
      <SCTopBar onBack={() => back ? back() : go({ name:'event', eventId: e.id })} title="Going" subtitle={e.title.toUpperCase()}/>
      <div style={{ padding: '8px 18px 12px' }}>
        <div className="label-cap">{visible.length} of {e.attendees} going</div>
        <div className="display-tight" style={{ fontSize: 32, lineHeight: 0.95, marginTop: 4 }}>Attendees</div>
      </div>
      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(p => (
          <SCSearchPersonRow key={p.id} person={p}
            status={friendStatus ? friendStatus(p.id) : 'none'}
            pendingUnfriendUntil={pendingUnfriend && pendingUnfriend.get && pendingUnfriend.get(p.id)}
            onOpen={() => go({ name:'profile-other', personId: p.id })}
            onToggle={() => toggleFriend && toggleFriend(p.id)}/>
        ))}
      </div>
    </div>
  );
}

// ── NEW CHAT (compose) ───────────────────────────────────────
function SCNewChat({ go, back, friends }) {
  const [picked, setPicked] = useStateS([]); // ordered array of personIds
  const [q, setQ] = useStateS('');
  // Suggest friends first, then everyone else (still excluding blockers).
  const ordered = React.useMemo(() => {
    const fs = [], rest = [];
    for (const p of SC_VISIBLE_PEOPLE) {
      ((friends && friends.has(p.id)) ? fs : rest).push(p);
    }
    return [...fs, ...rest];
  }, [friends]);
  const visible = ordered.filter(p => {
    if (!q.trim()) return true;
    const s = q.trim().toLowerCase();
    return p.name.toLowerCase().includes(s) || (p.username || '').toLowerCase().includes(s);
  });
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  const start = () => {
    if (picked.length === 0) return;
    if (picked.length === 1) {
      // DMs already have a "back to chat list" feel via history.
      go({ name:'chat-thread', personId: picked[0] });
    } else {
      // Groups: replace the new-chat composer in history with the chat list,
      // so back from the freshly-created group goes to the user's inbox
      // (not back into the composer they just finished).
      go({ name:'chat-thread', personIds: picked }, { replaceWith: 'chat' });
    }
  };
  const ctaLabel = picked.length <= 1 ? 'START CHAT' : `START GROUP · ${picked.length}`;
  return (
    <div className="fade-in" style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <SCTopBar onBack={() => back ? back() : go('chat')} title="New chat" subtitle={picked.length === 0 ? 'PICK ONE OR MORE PEOPLE' : picked.length === 1 ? 'DIRECT MESSAGE' : `GROUP CHAT · ${picked.length} SELECTED`}/>
      {/* Selected chips */}
      {picked.length > 0 && (
        <div style={{ padding:'4px 14px 10px', display:'flex', flexWrap:'wrap', gap: 6 }}>
          {picked.map(id => {
            const p = SC_VISIBLE_PERSON_BY_ID[id]; if (!p) return null;
            return (
              <button key={id} onClick={() => toggle(id)} className="press" style={{
                display:'inline-flex', alignItems:'center', gap: 8, padding:'4px 10px 4px 4px',
                background:'var(--subtle)', border:'1px solid var(--line)', borderRadius: 999,
                fontSize: 13, fontWeight: 600, cursor:'pointer',
              }}>
                <SCAvatar person={p} size={24} ring={false}/>
                {p.name.split(' ')[0]}
                <SCIcon name="x" size={12} color="var(--ink-3)"/>
              </button>
            );
          })}
        </div>
      )}
      {/* Search */}
      <div style={{ padding:'0 14px 10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap: 8, padding:'0 12px',
          background:'var(--card)', border:'1px solid var(--line)', borderRadius: 12, height: 40 }}>
          <SCIcon name="search" size={14} color="var(--ink-3)"/>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people…"
            style={{ flex:1, height:'100%', border:'none', outline:'none', background:'transparent', fontSize: 14 }}/>
        </div>
      </div>
      {/* List */}
      <div className="scroll" style={{ flex: 1, overflowY:'auto', padding:'0 14px 90px' }}>
        <SCCard style={{ padding: '4px 0' }}>
          {visible.length === 0 ? (
            <div style={{ padding: 20, textAlign:'center', color:'var(--ink-3)', fontSize: 13 }}>No matches.</div>
          ) : visible.map((p, i) => {
            const on = picked.includes(p.id);
            const isFriend = friends && friends.has(p.id);
            return (
              <div key={p.id} onClick={() => toggle(p.id)} className="press" style={{
                display:'flex', alignItems:'center', gap: 12, padding: 12, cursor:'pointer',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
              }}>
                <SCAvatar person={p} size={40}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</div>
                  <div className="mono" style={{ fontSize: 11, color:'var(--ink-3)' }}>
                    @{p.username}{isFriend ? ' · friend' : ''}
                  </div>
                </div>
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: '1.5px solid ' + (on ? 'var(--primary)' : 'var(--line)'),
                  background: on ? 'var(--primary)' : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  color: 'var(--primary-ink)',
                }}>
                  {on && <SCIcon name="check" size={14}/>}
                </div>
              </div>
            );
          })}
        </SCCard>
      </div>
      {/* Sticky CTA */}
      <div style={{
        position:'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 402, padding: 18,
        background: 'linear-gradient(to top, var(--surface) 65%, transparent)',
      }}>
        <button onClick={start} disabled={picked.length === 0} className={picked.length ? 'press' : ''} style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: picked.length ? 'pointer' : 'not-allowed',
          background: picked.length ? 'var(--primary)' : 'var(--subtle)',
          color: picked.length ? 'var(--primary-ink)' : 'var(--ink-3)',
          fontFamily:'var(--mono)', fontSize: 12, fontWeight: 700, letterSpacing:'0.14em',
          display:'flex', alignItems:'center', justifyContent:'center', gap: 8,
        }}>
          <SCIcon name={picked.length > 1 ? 'people' : 'chat'} size={16}/> {ctaLabel}
        </button>
      </div>
    </div>
  );
}

// ── RATINGS — host's review history ──────────────────────────
// Shows every review left for events this account (person or org) has hosted.
// Two filters compose: star rating (any/1–5) and event (any/specific id).
// Each row tells the reviewer + which event it was for; the event chip is
// tappable so the user can jump to the event detail screen.
function SCRatingsScreen({ go, back, hostId }) {
  const host = SC_ACCOUNT_BY_ID[hostId] || SC_ME;
  const allReviews = (window.SC_REVIEWS || []).filter(r => r.hostId === hostId);
  // Most-recent first by id (ids are ordered in data.jsx as r01, r02…).
  const ordered = React.useMemo(() => [...allReviews].sort((a, b) => b.id.localeCompare(a.id)), [allReviews]);

  const [stars, setStars] = useStateS(0);    // 0 = all stars, otherwise 1–5
  const [eventId, setEventId] = useStateS('all'); // 'all' or an event id
  const [eventPickerOpen, setEventPickerOpen] = useStateS(false);

  // EVERY event this host has hosted — current + past — used to populate the
  // event filter. Events with zero reviews are included so the user can pick
  // them and see "no reviews yet" rather than the filter pretending they
  // don't exist. Events that have reviews come first (sorted by review count),
  // then unreviewed events.
  const hostEvents = React.useMemo(() => {
    const byId = new Map();
    // Count reviews per event for sort order + display.
    const reviewCount = {};
    const reviewSum = {};
    for (const r of ordered) {
      reviewCount[r.eventId] = (reviewCount[r.eventId] || 0) + 1;
      reviewSum[r.eventId]   = (reviewSum[r.eventId]   || 0) + r.rating;
    }
    // Pull every event the host actually owns (current + past).
    const current = (window.SC_EVENTS      || []).filter(e => e.hostId === hostId);
    const past    = (window.SC_PAST_EVENTS || []).filter(e => e.hostId === hostId);
    for (const ev of [...current, ...past]) {
      if (!byId.has(ev.id)) byId.set(ev.id, ev);
    }
    // Plus any event referenced by a review that we somehow missed (e.g. a
    // review for an event that's been removed from the canonical lists).
    for (const r of ordered) {
      if (!byId.has(r.eventId)) {
        const ev = SC_ANY_EVENT_BY_ID[r.eventId];
        if (ev) byId.set(ev.id, ev);
      }
    }
    const list = [...byId.values()].map(ev => ({
      ...ev,
      reviewCount: reviewCount[ev.id] || 0,
      avg: reviewCount[ev.id] ? reviewSum[ev.id] / reviewCount[ev.id] : null,
    }));
    // Reviewed events first (most reviews → fewest), then unreviewed.
    list.sort((a, b) => {
      if ((b.reviewCount > 0) !== (a.reviewCount > 0)) return (b.reviewCount > 0) - (a.reviewCount > 0);
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      return 0;
    });
    return list;
  }, [ordered, hostId]);
  // Kept for the header subtitle (events that actually contributed a review).
  const reviewedEvents = hostEvents.filter(e => e.reviewCount > 0);

  const filtered = ordered.filter(r => {
    if (stars && r.rating !== stars) return false;
    if (eventId !== 'all' && r.eventId !== eventId) return false;
    return true;
  });

  // Counts for filter chips (respecting the OTHER filter so the numbers reflect
  // what you'd actually see after toggling).
  const countsByStar = React.useMemo(() => {
    const base = eventId === 'all' ? ordered : ordered.filter(r => r.eventId === eventId);
    const c = { 0: base.length, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of base) c[r.rating] = (c[r.rating] || 0) + 1;
    return c;
  }, [ordered, eventId]);

  // Summary numbers, ALWAYS computed off the full review set (header is the
  // host's overall rating, not the filtered slice).
  const overall = ordered.length
    ? ordered.reduce((s, r) => s + r.rating, 0) / ordered.length
    : 0;
  const dist = [5,4,3,2,1].map(n => ({
    n,
    pct: ordered.length ? (ordered.filter(r => r.rating === n).length / ordered.length) * 100 : 0,
    count: ordered.filter(r => r.rating === n).length,
  }));

  // Avatar fallback (the same gradient swatch SCAvatar uses) — kept inline so
  // we don't need to look up a full person record for `me` reviews.
  const reviewerOf = (r) => {
    if (r.reviewerId === 'me') return { name: SC_ME.name, picture: null, id: 'me' };
    const p = SC_VISIBLE_PERSON_BY_ID[r.reviewerId];
    if (p) return p;
    return { name: r.reviewerName || 'Former member', picture: null, id: null };
  };

  return (
    <>
    <div className="fade-in" style={{ paddingBottom: 28 }}>
      <SCTopBar onBack={() => back ? back() : go(hostId === 'me' ? 'profile' : { name: 'profile-other', personId: hostId })}
        subtitle="RATINGS" title={host.name}/>

      {/* Summary card */}
      <div style={{ padding: '0 14px' }}>
        <SCCard style={{ padding: '18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
            <div style={{ minWidth: 110 }}>
              <div className="display-tight" style={{ fontSize: 54, lineHeight: 0.95, letterSpacing: '-0.03em' }}>
                {ordered.length ? overall.toFixed(1) : '—'}
              </div>
              <div style={{ display: 'flex', gap: 2, marginTop: 6 }}>
                {[1,2,3,4,5].map(n => (
                  <SCIcon key={n} name="star" size={14}
                    color={overall >= n - 0.25 ? 'var(--primary)' : 'var(--line)'}/>
                ))}
              </div>
              <div className="label-cap" style={{ marginTop: 8, color: 'var(--ink-3)' }}>
                {ordered.length} review{ordered.length === 1 ? '' : 's'} · {reviewedEvents.length} event{reviewedEvents.length === 1 ? '' : 's'}
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
              {dist.map(d => (
                <div key={d.n} style={{ display:'flex', alignItems:'center', gap: 8 }}>
                  <span className="mono" style={{ fontSize: 11, color:'var(--ink-3)', width: 14, textAlign: 'right' }}>{d.n}</span>
                  <SCIcon name="star" size={11} color="var(--primary)"/>
                  <div style={{
                    flex: 1, height: 6, borderRadius: 999, background:'var(--subtle)', overflow:'hidden',
                  }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background:'var(--primary)', transition: 'width 320ms ease' }}/>
                  </div>
                  <span className="mono" style={{ fontSize: 11, color:'var(--ink-3)', width: 22, textAlign:'right' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </SCCard>
      </div>

      {/* Star filter chips */}
      <div style={{ padding: '14px 14px 0' }}>
        <div className="label-cap" style={{ marginBottom: 8 }}>Filter by stars</div>
        <div style={{ display:'flex', gap: 6, overflowX: 'auto' }} className="scroll">
          {[0,5,4,3,2,1].map(n => {
            const active = stars === n;
            const c = countsByStar[n] || 0;
            return (
              <button key={n} onClick={() => setStars(n)} className="press" style={{
                flexShrink: 0,
                padding: '8px 12px', borderRadius: 999,
                background: active ? 'var(--ink)' : 'var(--card)',
                color: active ? 'white' : 'var(--ink)',
                border: '1px solid ' + (active ? 'var(--ink)' : 'var(--line)'),
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {n === 0 ? `ALL · ${c}` : (
                  <>
                    <span>{n}</span>
                    <SCIcon name="star" size={11} color={active ? 'white' : 'var(--primary)'}/>
                    <span style={{ opacity: 0.7 }}>· {c}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event filter — dropdown sheet, since the list can be long */}
      <div style={{ padding: '14px 14px 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="label-cap">Filter by event</div>
          {eventId !== 'all' && (
            <button onClick={() => setEventId('all')} className="press" style={{
              background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer',
              fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
              padding: 0,
            }}>SHOW ALL ·</button>
          )}
        </div>
        <button onClick={() => setEventPickerOpen(true)} className="press" style={{
          width: '100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10,
          padding:'12px 14px', borderRadius: 12,
          background: eventId === 'all' ? 'var(--card)' : 'var(--primary-soft)',
          border:'1px solid ' + (eventId === 'all' ? 'var(--line)' : 'var(--primary)'),
          cursor:'pointer', textAlign:'left',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <SCIcon name="pin" size={14}
              color={eventId === 'all' ? 'var(--ink-3)' : 'var(--primary)'}/>
            <span style={{
              fontSize: 13, fontWeight: eventId === 'all' ? 500 : 600,
              color: eventId === 'all' ? 'var(--ink)' : 'var(--primary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {eventId === 'all'
                ? `All events · ${hostEvents.length} hosted`
                : (SC_ANY_EVENT_BY_ID[eventId]?.title || 'Event')}
            </span>
          </div>
          <SCIcon name="chevron-right" size={14}
            color={eventId === 'all' ? 'var(--ink-3)' : 'var(--primary)'}/>
        </button>
      </div>

      {/* Active-filter summary */}
      <div style={{ padding: '12px 18px 8px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div className="label-cap">
          {filtered.length} {filtered.length === 1 ? 'review' : 'reviews'}
          {stars ? ` · ${stars}★` : ''}
          {eventId !== 'all' ? ' · filtered' : ''}
        </div>
        {(stars || eventId !== 'all') && (
          <button onClick={() => { setStars(0); setEventId('all'); }} className="press" style={{
            background: 'transparent', border: 'none', color: 'var(--ink-2)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          }}>CLEAR ·</button>
        )}
      </div>

      {/* Review list */}
      <div style={{ padding: '0 14px', display:'flex', flexDirection:'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <SCCard style={{ padding: '28px 18px', textAlign:'center' }}>
            <div className="display-tight" style={{ fontSize: 20, marginBottom: 6 }}>
              {eventId !== 'all' && SC_ANY_EVENT_BY_ID[eventId] && !ordered.some(r => r.eventId === eventId)
                ? 'No reviews yet for this event'
                : 'No reviews match'}
            </div>
            <div style={{ fontSize: 13, color:'var(--ink-3)' }}>
              {eventId !== 'all' && SC_ANY_EVENT_BY_ID[eventId] && !ordered.some(r => r.eventId === eventId)
                ? `Nobody's left a review for ${SC_ANY_EVENT_BY_ID[eventId].title} yet.`
                : `Try clearing a filter — ${ordered.length} total review${ordered.length === 1 ? '' : 's'} for ${host.name}.`}
            </div>
          </SCCard>
        ) : filtered.map(r => {
          const ev = SC_ANY_EVENT_BY_ID[r.eventId];
          const evIsLive = !!SC_EVENT_BY_ID[r.eventId];
          const reviewer = reviewerOf(r);
          return (
            <SCCard key={r.id} style={{ padding: '14px 16px' }}>
              {/* header — reviewer + stars */}
              <div style={{ display:'flex', alignItems:'center', gap: 10, marginBottom: 10 }}>
                <SCAvatar person={reviewer} size={36} ring={false}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {reviewer.name}
                  </div>
                  <div className="mono" style={{ fontSize: 10.5, color:'var(--ink-3)', letterSpacing:'0.08em', marginTop: 2 }}>
                    {r.when ? r.when.toUpperCase() : ''}
                  </div>
                </div>
                <div style={{ display:'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(n => (
                    <SCIcon key={n} name="star" size={13}
                      color={n <= r.rating ? 'var(--primary)' : 'var(--line)'}/>
                  ))}
                </div>
              </div>
              {/* event chip — tappable when the event is still live */}
              <button
                onClick={evIsLive ? () => go({ name: 'event', eventId: r.eventId }) : undefined}
                disabled={!evIsLive}
                className={evIsLive ? 'press' : ''}
                style={{
                  display:'inline-flex', alignItems:'center', gap: 6, maxWidth:'100%',
                  background:'var(--subtle)', border:'none', borderRadius: 999,
                  padding:'6px 10px 6px 8px', marginBottom: 10,
                  cursor: evIsLive ? 'pointer' : 'default', textAlign:'left',
                }}>
                <SCIcon name="pin" size={11} color="var(--ink-2)"/>
                <span style={{
                  fontFamily:'var(--mono)', fontSize: 11, fontWeight: 600,
                  color:'var(--ink)', letterSpacing:'0.02em',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                }}>
                  {ev ? ev.title : 'Past event'}
                </span>
                {ev?.when && (
                  <span className="mono" style={{ fontSize: 10, color:'var(--ink-3)', letterSpacing:'0.04em' }}>
                    · {ev.when.split(' · ')[0]}
                  </span>
                )}
                {evIsLive && <SCIcon name="chevron-right" size={11} color="var(--ink-3)"/>}
              </button>
              {/* body */}
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink)' }}>
                {r.text}
              </p>
            </SCCard>
          );
        })}
      </div>
    </div>

    {/* Event picker sheet — rendered OUTSIDE the .fade-in wrapper because
        fade-in retains a transform after animating, which would make IT the
        containing block for our position:absolute overlay and push the sheet
        below the visible device area. */}
    {eventPickerOpen && (
        <div onClick={() => setEventPickerOpen(false)} style={{
          position:'absolute', inset: 0, zIndex: 90,
          background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', background:'var(--card)',
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding:'14px 0 28px',
            maxHeight:'70%', overflowY:'auto',
            boxShadow:'0 -10px 40px rgba(0,0,0,0.2)',
          }}>
            <div style={{
              width: 40, height: 4, background:'var(--line)', borderRadius: 2,
              margin: '0 auto 12px',
            }}/>
            <div className="label-cap" style={{ padding: '0 18px 8px' }}>Filter by event</div>
            <PickerRow
              label={`All events · ${ordered.length} review${ordered.length === 1 ? '' : 's'}`}
              hint={`${hostEvents.length} event${hostEvents.length === 1 ? '' : 's'} hosted${reviewedEvents.length !== hostEvents.length ? ` · ${reviewedEvents.length} with reviews` : ''}`}
              selected={eventId === 'all'}
              onClick={() => { setEventId('all'); setEventPickerOpen(false); }}/>
            {/* Reviewed events first */}
            {hostEvents.filter(e => e.reviewCount > 0).map(ev => (
              <PickerRow key={ev.id}
                label={ev.title}
                hint={`${ev.reviewCount} review${ev.reviewCount === 1 ? '' : 's'} · ${ev.avg.toFixed(1)}★${ev.when ? ' · ' + ev.when.split(' · ')[0] : ''}`}
                selected={eventId === ev.id}
                onClick={() => { setEventId(ev.id); setEventPickerOpen(false); }}/>
            ))}
            {/* Unreviewed events — kept in the list so the user has a full menu
                of the host's events. Picking one shows the "no reviews match"
                empty state, which is the truthful answer. */}
            {hostEvents.some(e => e.reviewCount === 0) && (
              <div className="label-cap" style={{ padding: '14px 18px 6px', color: 'var(--ink-3)' }}>
                No reviews yet
              </div>
            )}
            {hostEvents.filter(e => e.reviewCount === 0).map(ev => (
              <PickerRow key={ev.id}
                label={ev.title}
                hint={`0 reviews${ev.when ? ' · ' + ev.when.split(' · ')[0] : ''}`}
                selected={eventId === ev.id}
                onClick={() => { setEventId(ev.id); setEventPickerOpen(false); }}/>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PickerRow({ label, hint, selected, onClick }) {
  return (
    <button onClick={onClick} className="press" style={{
      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', gap: 10,
      padding:'12px 18px', background: selected ? 'var(--subtle)' : 'transparent',
      border:'none', cursor:'pointer', textAlign:'left',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{label}</div>
        {hint && <div className="mono" style={{ fontSize: 10.5, color:'var(--ink-3)', letterSpacing:'0.06em', marginTop: 2 }}>{hint}</div>}
      </div>
      {selected && <SCIcon name="check" size={16} color="var(--primary)"/>}
    </button>
  );
}

// ── ORG PROFILE (public org page — for orgs you don't manage) ──────────────────
function SCOrgProfile({ go, back, orgId, following, followStatus, toggleFollow,
  activeAccount, setActiveAccount, accountSwitcherOpen, setAccountSwitcherOpen }) {
  const org = SC_ACCOUNT_BY_ID[orgId] || SC_ORGS[0];
  const status = followStatus ? followStatus(org.id) : 'none';
  const isFollowing = status === 'following';
  const isPending = status === 'pending';
  const isManaged = SC_MY_ACCOUNTS.some(a => a.id === org.id);
  const orgEvents = SC_EVENTS.filter(e => e.hostId === org.id);
  const reviews = (window.SC_REVIEWS || []).filter(r => r.hostId === org.id);
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null;

  return (
    <div className="fade-in" style={{ paddingBottom: 40 }}>
      <SCTopBar onBack={() => back ? back() : go('home')}/>
      {/* Hero */}
      <div style={{ padding: '0 18px' }}>
        <div style={{
          aspectRatio: '5 / 3', borderRadius: 24, overflow: 'hidden', position: 'relative',
          background: 'linear-gradient(135deg, #2A1F18 0%, #1A1714 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="display-tight" style={{ fontSize: 72, color: 'rgba(255,255,255,0.9)' }}>
            {org.name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase()}
          </div>
          <div style={{
            position: 'absolute', top: 12, right: 12,
            background: 'rgba(0,0,0,0.55)', color: 'white', padding: '6px 10px', borderRadius: 999,
            fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
            backdropFilter: 'blur(10px)',
          }}>
            {org.privacy === 'private' ? 'PRIVATE ORG' : 'PUBLIC ORG'}
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 18px 0' }}>
        <div className="display-tight" style={{ fontSize: 30, lineHeight: 1 }}>{org.name}</div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
          {org.handle} · {(org.followers || 0).toLocaleString()} followers
        </div>
      </div>

      <div style={{ padding: '14px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 6 }}>About</div>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.4 }}>{org.bio}</p>
      </div>

      <div style={{ padding: '14px 18px 0' }}>
        <div className="label-cap" style={{ marginBottom: 8 }}>Interests</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {(org.interests || []).map(t => (
            <SCTag key={t} tag={t} size="md" tone={SC_ME.interests.includes(t) ? 'primary' : 'soft'}
              onClick={() => go({ name: 'interest-detail', tag: t })}/>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ padding: '14px 18px 0', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCell label="FOLLOWERS" value={(org.followers || 0).toLocaleString()}/>
        <StatCell label="EVENTS" value={orgEvents.length}/>
        <StatCell label="RATING" value={avgRating ? `${avgRating} ★` : '—'}
          onClick={reviews.length ? () => go({ name: 'ratings', hostId: org.id }) : undefined}/>
      </div>

      {/* Events by this org */}
      {orgEvents.length > 0 && (
        <SCSection title="EVENTS">
          <SCCard>
            {orgEvents.map((e, i) => (
              <div key={e.id} onClick={() => go({ name:'event', eventId: e.id })} className="press" style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px',
                borderBottom: i < orgEvents.length-1 ? '1px solid var(--line)' : 'none', cursor: 'pointer',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: 'var(--primary)',
                  color: 'var(--primary-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}><SCIcon name="calendar" size={18}/></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{e.title}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{scWhenRange(e)} · {e.attendees}/{e.cap}</div>
                </div>
                <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
              </div>
            ))}
          </SCCard>
        </SCSection>
      )}

      {/* Follow CTA */}
      <div style={{
        position: 'sticky', bottom: 0, padding: '18px',
        background: 'linear-gradient(to top, var(--surface) 60%, transparent)',
        marginTop: 24,
      }}>
        {isManaged ? (
          <button onClick={() => { setActiveAccount && setActiveAccount(org.id); go('profile'); }} className="press" style={{
            width: '100%', height: 56, borderRadius: 16,
            background: 'var(--ink)', color: 'var(--card)', border: 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.14em',
          }}>
            <SCIcon name="switch" size={16}/> SWITCH TO THIS ACCOUNT
          </button>
        ) : (
          <button onClick={() => toggleFollow && toggleFollow(org.id)} className="press" style={{
            width: '100%', height: 56, borderRadius: 16,
            background: isFollowing ? 'var(--ink)' : isPending ? 'var(--card)' : 'var(--primary)',
            color: isFollowing ? 'var(--card)' : isPending ? 'var(--ink)' : 'var(--primary-ink)',
            border: isPending ? '1px solid var(--line)' : 'none',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, letterSpacing: '0.14em',
            boxShadow: !isFollowing && !isPending ? '0 6px 14px -6px rgba(0,0,0,0.3)' : 'none',
          }}>
            {isFollowing ? <><SCIcon name="check" size={16}/> FOLLOWING · TAP TO UNFOLLOW</>
              : isPending ? <><SCIcon name="clock" size={16}/> REQUESTED · TAP TO CANCEL</>
              : <><SCIcon name="plus" size={16}/> FOLLOW</>}
          </button>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  SCHomeScreen, SCMapScreen, SCProfileOther, SCMyProfile,
  SCInterestsScreen, SCInterestDetail, SCEventScreen, SCAttendees,
  SCChatList, SCChatThread, SCNewChat, SCSettingsScreen,
  SCCreateEvent, SCEventPublished,
  SCRequestsScreen,
  SCSearchScreen, SCMyHosting, SCMyFriends, SCMyFollowing,
  SCEventsList,
  SCRatingsScreen,
  SCOrgProfile,
  SCDraftsScreen,
  SCEventCard,
});

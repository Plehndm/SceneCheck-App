// SceneCheck — heuristic-fix mockups (toggleable via Tweaks panel)
// Each fix maps to a Nielsen-heuristic gap surfaced in the eval.

const { useState: useStateF, useRef: useRefF, useEffect: useEffectF } = React;

// Read tweaks via a global so we don't have to prop-drill through every
// screen component. App.jsx writes window.scFixes and fires sc-fixes-updated.
function useFixes() {
  const [, bump] = useStateF(0);
  useEffectF(() => {
    const h = () => bump(x => x + 1);
    window.addEventListener('sc-fixes-updated', h);
    return () => window.removeEventListener('sc-fixes-updated', h);
  }, []);
  return window.scFixes || {};
}

// ───────────────────────────────────────────────────────────────
// FIX 1 — PRE-FLIGHT CONFLICT WARNINGS ON EVENT CARDS
// ───────────────────────────────────────────────────────────────
// Helper: given an event and the user's joined-set, return the joined event
// that overlaps (same date, < 2hr apart) or null. Mirrors the eventsOverlap
// logic in app.jsx so the chip stays in sync with the real conflict modal.
function scFindConflict(event, joined) {
  if (!event || !joined || !joined.size) return null;
  const parse = (w) => {
    const m = w && w.match(/^(.+?)\s·\s(\d{1,2}):(\d{2})\s(AM|PM)/);
    if (!m) return null;
    let h = parseInt(m[2]);
    const min = parseInt(m[3]);
    if (m[4] === 'PM' && h !== 12) h += 12;
    if (m[4] === 'AM' && h === 12) h = 0;
    return { date: m[1].trim(), mins: h*60 + min };
  };
  const a = parse(event.when);
  if (!a) return null;
  for (const id of joined) {
    if (id === event.id) continue;
    const other = SC_EVENT_BY_ID[id];
    if (!other) continue;
    const b = parse(other.when);
    if (!b) continue;
    if (a.date === b.date && Math.abs(a.mins - b.mins) < 120) return other;
  }
  return null;
}

// Small chip — shows on cards & list rows when an event overlaps a joined one.
function ConflictChip({ event, joined, compact = false }) {
  const fx = useFixes();
  if (!fx.preflightConflicts) return null;
  if (joined && joined.has && joined.has(event.id)) return null; // no need to warn yourself
  const conflict = scFindConflict(event, joined);
  if (!conflict) return null;
  const t = conflict.when.match(/(\d{1,2}:\d{2}\s(?:AM|PM))/);
  const timeStr = t ? t[1] : conflict.when;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: 'color-mix(in oklch, #F2B33C 22%, transparent)',
      color: 'color-mix(in oklch, #F2B33C 65%, var(--ink) 35%)',
      padding: compact ? '2px 6px' : '3px 8px',
      borderRadius: 999,
      fontFamily: 'var(--mono)', fontSize: compact ? 8.5 : 9,
      fontWeight: 700, letterSpacing: '0.12em',
      whiteSpace: 'nowrap',
      border: '1px solid color-mix(in oklch, #F2B33C 40%, transparent)',
    }} title={`Conflicts with "${conflict.title}" at ${timeStr}`}>
      <SCIcon name="clock" size={compact ? 9 : 10}/>
      OVERLAPS {timeStr}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────
// FIX 2 — INLINE VALUES + COLLAPSIBLE SETTINGS SECTIONS
// ───────────────────────────────────────────────────────────────
// Drop-in replacement for SCSection used inside Settings. When the tweak is
// on, the section header shows a live summary of its current value(s) and
// can collapse to save scroll. When off, behaves exactly like SCSection.
function SettingsSection({ title, summary, children, defaultOpen = true, padding = 14 }) {
  const fx = useFixes();
  const enhanced = !!fx.inlineSettings;
  const [open, setOpen] = useStateF(defaultOpen);
  if (!enhanced) {
    return <SCSection title={title}>{children}</SCSection>;
  }
  return (
    <div style={{ padding: `0 ${padding}px` }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="press"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 4px 8px', background: 'transparent', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
          <span className="label-cap" style={{ flexShrink: 0 }}>{title}</span>
          {summary && (
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--ink-2)',
              fontWeight: 600, letterSpacing: '0.04em',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>· {summary}</span>
          )}
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: 11, color: 'var(--ink-3)',
          background: 'var(--subtle)',
          transform: open ? 'rotate(90deg)' : 'rotate(0)',
          transition: 'transform 200ms ease',
        }}>
          <SCIcon name="chevron-right" size={12}/>
        </span>
      </button>
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? 2000 : 0,
        opacity: open ? 1 : 0,
        transition: 'max-height 320ms ease, opacity 220ms ease',
      }}>
        <div style={{ paddingBottom: open ? 4 : 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// FIX 3 — HOST EDIT / DELETE FOR EVENTS + CHAT MESSAGES
// ───────────────────────────────────────────────────────────────

// In-memory store of "edited" events. Keyed by event id. Lets the mock
// reflect host edits across navigation without mutating SC_EVENTS.
window.SC_EVENT_OVERRIDES = window.SC_EVENT_OVERRIDES || {};
function applyEventOverride(eventId) {
  // Components call this to merge overrides into their displayed event.
  return window.SC_EVENT_OVERRIDES[eventId] || null;
}

function HostActionsRow({ event, onEdit, onCancel }) {
  const fx = useFixes();
  if (!fx.hostEditDelete) return null;
  return (
    <div style={{
      display: 'flex', gap: 10, padding: '0 18px', marginTop: 16,
    }}>
      <button onClick={onEdit} className="press" style={{
        flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--line)',
        background: 'var(--card)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
        color: 'var(--ink)',
      }}>
        <SCIcon name="edit" size={13}/> EDIT EVENT
      </button>
      <button onClick={onCancel} className="press" style={{
        flex: 1, height: 44, borderRadius: 12,
        border: '1px solid color-mix(in oklch, #C73B2B 35%, var(--line))',
        background: 'var(--card)', color: '#C73B2B', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, letterSpacing: '0.14em',
      }}>
        <SCIcon name="x" size={13}/> CANCEL EVENT
      </button>
    </div>
  );
}

// Bottom-sheet form for editing a hosted event. Mock — saves to overrides.
function EditEventSheet({ open, event, onClose, onSave }) {
  const [title, setTitle] = useStateF('');
  const [when, setWhen] = useStateF('');
  const [where, setWhere] = useStateF('');
  const [cap, setCap] = useStateF(12);
  useEffectF(() => {
    if (open && event) {
      setTitle(event.title); setWhen(event.when);
      setWhere(event.where); setCap(event.cap);
    }
  }, [open, event && event.id]);
  if (!open || !event) return null;
  const inputStyle = {
    width:'100%', boxSizing:'border-box', height: 44, background:'var(--surface)',
    border:'1px solid var(--line)', borderRadius: 12, padding:'0 12px',
    fontFamily:'var(--body)', fontSize: 14, color:'var(--ink)', outline:'none',
    marginTop: 4,
  };
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 88,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        width: '100%', padding: '22px 20px 30px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 240ms ease both',
        maxHeight: '85%', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><SCIcon name="edit" size={16}/></div>
          <div>
            <div className="mono" style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--ink-3)', fontWeight: 600 }}>EDIT EVENT</div>
            <div className="display-tight" style={{ fontSize: 22, lineHeight: 1.05 }}>{event.title}</div>
          </div>
        </div>
        <div style={{ background: 'var(--subtle)', borderRadius: 12, padding: '10px 12px', marginBottom: 14,
                       fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.4 }}>
          Attendees will get a notification when you save changes.
        </div>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span className="label-cap">Title</span>
          <input value={title} onChange={e => setTitle(e.target.value)} style={inputStyle}/>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span className="label-cap">When</span>
          <input value={when} onChange={e => setWhen(e.target.value)} style={inputStyle}/>
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>
          <span className="label-cap">Where</span>
          <input value={where} onChange={e => setWhere(e.target.value)} style={inputStyle}/>
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span className="label-cap">Capacity · {cap}</span>
          <input type="range" min="2" max="60" value={cap}
            onChange={e => setCap(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--primary)', marginTop: 8 }}/>
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>CANCEL</button>
          <button onClick={() => onSave({ title, when, where, cap })} className="press" style={{
            flex: 2, height: 48, borderRadius: 14, border: 'none',
            background: 'var(--primary)', color: 'var(--primary-ink)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>SAVE CHANGES</button>
        </div>
      </div>
    </div>
  );
}

// Chat message — long-press → action sheet (Edit / Delete / Cancel)
function MessageActionsSheet({ open, message, onClose, onEdit, onDelete }) {
  if (!open || !message) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 88,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        width: '100%', padding: '14px 14px 30px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 220ms ease both',
      }}>
        {/* drag handle */}
        <div style={{ width: 38, height: 4, background: 'var(--line)', borderRadius: 2, margin: '0 auto 14px' }}/>
        {/* the message preview */}
        <div style={{
          padding: '10px 14px', borderRadius: 14, background: 'var(--subtle)',
          fontSize: 13, color: 'var(--ink-2)', marginBottom: 14, lineHeight: 1.35,
          maxHeight: 80, overflow: 'hidden',
        }}>{message.text}</div>
        <button onClick={() => { onEdit(message); }} className="press" style={msgActionRow()}>
          <div style={msgActionIcon('var(--ink)')}><SCIcon name="edit" size={15}/></div>
          <span style={{ flex: 1, textAlign: 'left' }}>Edit message</span>
        </button>
        <button onClick={() => { onDelete(message); }} className="press" style={msgActionRow('#C73B2B')}>
          <div style={msgActionIcon('#C73B2B')}><SCIcon name="x" size={15}/></div>
          <span style={{ flex: 1, textAlign: 'left', color: '#C73B2B', fontWeight: 600 }}>Delete message</span>
        </button>
        <button onClick={onClose} className="press" style={{
          width: '100%', height: 50, borderRadius: 14, border: '1px solid var(--line)',
          background: 'var(--card)', cursor: 'pointer', marginTop: 6,
          fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
        }}>CANCEL</button>
      </div>
    </div>
  );
}
function msgActionRow(color) {
  return {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14, border: '1px solid var(--line)',
    background: 'var(--card)', cursor: 'pointer', marginBottom: 6,
    fontSize: 14, color: color || 'var(--ink)',
  };
}
function msgActionIcon(color) {
  return {
    width: 32, height: 32, borderRadius: 10,
    background: color === '#C73B2B' ? 'color-mix(in oklch, #C73B2B 12%, transparent)' : 'var(--subtle)',
    color: color || 'var(--ink)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  };
}

// Edit-message inline sheet — just lets you tweak the text & save.
function EditMessageSheet({ open, message, onClose, onSave }) {
  const [text, setText] = useStateF('');
  useEffectF(() => { if (open && message) setText(message.text); }, [open, message && message.id]);
  if (!open || !message) return null;
  return (
    <div onClick={onClose} style={{
      position: 'absolute', inset: 0, zIndex: 89,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--card)', borderTopLeftRadius: 24, borderTopRightRadius: 24,
        width: '100%', padding: '20px 20px 28px',
        boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
        animation: 'slideUp 240ms ease both',
      }}>
        <div className="display-tight" style={{ fontSize: 22, lineHeight: 1.05, marginBottom: 6 }}>Edit message</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.14em', marginBottom: 12 }}>
          OTHERS WILL SEE THE EDITED LABEL
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={3} style={{
          width: '100%', boxSizing: 'border-box', background: 'var(--surface)',
          border: '1px solid var(--line)', borderRadius: 12, padding: 12,
          fontFamily: 'var(--body)', fontSize: 14, color: 'var(--ink)', outline: 'none', resize: 'none',
        }}/>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={onClose} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>CANCEL</button>
          <button onClick={() => onSave(text)} className="press" style={{
            flex: 2, height: 48, borderRadius: 14, border: 'none',
            background: 'var(--primary)', color: 'var(--primary-ink)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>SAVE</button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// FIX 4 — DETAILED FAILURE STATES (publish, upload, 404)
// ───────────────────────────────────────────────────────────────

// In-line publish-failure card with diagnostic + recovery actions.
function PublishFailureCard({ reason, onRetry, onSaveDraft }) {
  const fx = useFixes();
  if (!fx.failureStates) return null;
  return (
    <div style={{
      margin: '0 0 14px',
      background: 'color-mix(in oklch, #C73B2B 8%, var(--card))',
      border: '1px solid color-mix(in oklch, #C73B2B 35%, transparent)',
      borderRadius: 14, padding: 14,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12, flexShrink: 0,
          background: 'color-mix(in oklch, #C73B2B 15%, transparent)',
          color: '#C73B2B',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><SCIcon name="bell" size={16}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Couldn't publish event</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 4, lineHeight: 1.4 }}>
            {reason || "We couldn't reach the SceneCheck server. Your details are saved on this device."}
          </div>
        </div>
      </div>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.08em',
        background: 'var(--surface)', borderRadius: 8, padding: '6px 10px',
      }}>
        ERR · NET_UNREACHABLE · TRY AGAIN IN A MOMENT
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSaveDraft} className="press" style={{
          flex: 1, height: 40, borderRadius: 10, border: '1px solid var(--line)',
          background: 'var(--card)', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
        }}>SAVE DRAFT</button>
        <button onClick={onRetry} className="press" style={{
          flex: 1, height: 40, borderRadius: 10, border: 'none',
          background: '#C73B2B', color: 'white', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}><SCIcon name="rotate-ccw" size={12}/> RETRY</button>
      </div>
    </div>
  );
}

// 404-style "event no longer exists" screen — shown when the user taps an
// event from chat/profile that's been deleted by the host.
function SCEventNotFound({ go, back }) {
  return (
    <div className="fade-in">
      <SCTopBar onBack={() => back ? back() : go('home')}/>
      <div style={{ padding: '40px 24px 30px', textAlign: 'center' }}>
        <div style={{
          width: 76, height: 76, borderRadius: 22,
          background: 'var(--subtle)', color: 'var(--ink-3)',
          margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <SCIcon name="calendar" size={30}/>
        </div>
        <div className="display-tight" style={{ fontSize: 28, lineHeight: 1.05 }}>This event is gone</div>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 12, lineHeight: 1.5, maxWidth: 300, margin: '12px auto 0' }}>
          The host may have cancelled it, or you may have lost access. It's been removed from the map and from your joined list.
        </p>
        <div style={{
          marginTop: 22, padding: 12, background: 'var(--subtle)', borderRadius: 12,
          fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)',
          letterSpacing: '0.08em', display: 'inline-block',
        }}>ERR · EVENT_NOT_FOUND</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 24, padding: '0 6px' }}>
          <button onClick={() => back ? back() : go('home')} className="press" style={{
            flex: 1, height: 48, borderRadius: 14, border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
          }}>← BACK</button>
          <button onClick={() => go('map')} className="press" style={{
            flex: 2, height: 48, borderRadius: 14, border: 'none',
            background: 'var(--ink)', color: 'var(--card)', cursor: 'pointer',
            fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, letterSpacing: '0.14em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}><SCIcon name="pin" size={14}/> FIND OTHER EVENTS</button>
        </div>
      </div>
    </div>
  );
}

// Upload-failed badge — overlays a profile picture (or any image slot) when
// the most recent upload couldn't be completed.
function UploadFailedBadge({ onRetry, onCancel }) {
  const fx = useFixes();
  if (!fx.failureStates) return null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 8, padding: 20, color: 'white', textAlign: 'center',
      borderRadius: 'inherit',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: 'rgba(255,255,255,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><SCIcon name="bell" size={20} color="white"/></div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>Upload failed</div>
      <div style={{ fontSize: 11, opacity: 0.85, lineHeight: 1.4 }}>Couldn't save your new photo.</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={onCancel} className="press" style={{
          height: 34, padding: '0 14px', borderRadius: 10,
          background: 'rgba(255,255,255,0.18)', color: 'white', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
        }}>CANCEL</button>
        <button onClick={onRetry} className="press" style={{
          height: 34, padding: '0 14px', borderRadius: 10,
          background: 'white', color: 'var(--ink)', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}><SCIcon name="rotate-ccw" size={11}/> RETRY</button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// FIX 5 — IN-APP HELP REPLAY + (?) TOOLTIPS
// ───────────────────────────────────────────────────────────────

// Wraps a settings-row label and conditionally appends an inline help (?)
// tooltip. The actual popover is reused from additions.jsx (SCHelpTip).
function LabelWithTip({ children, tipTitle, tipBody }) {
  const fx = useFixes();
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {children}
      {fx.helpTooltips && tipBody && <SCHelpTip title={tipTitle} body={tipBody}/>}
    </span>
  );
}

// Row added to the in-app Help & Feedback screen — lets the user re-run
// the welcome tour without digging into the dev tweaks panel.
function HelpReplayRow({ onReplay }) {
  const fx = useFixes();
  if (!fx.helpTooltips) return null;
  return (
    <div style={{ padding: '0 18px 14px' }}>
      <button onClick={onReplay} className="press" style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px', background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 14, cursor: 'pointer', textAlign: 'left',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12, background: 'var(--primary-soft)', color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}><SCIcon name="rotate-ccw" size={16}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Replay welcome tour</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2, lineHeight: 1.4 }}>
            Walk back through the 4-step intro to the map, radius, accounts, and creating events.
          </div>
        </div>
        <SCIcon name="chevron-right" size={14} color="var(--ink-3)"/>
      </button>
    </div>
  );
}

// Export everything to window so screens.jsx can use it.
Object.assign(window, {
  useFixes,
  scFindConflict, ConflictChip,
  SettingsSection,
  HostActionsRow, EditEventSheet,
  MessageActionsSheet, EditMessageSheet,
  PublishFailureCard, SCEventNotFound, UploadFailedBadge,
  LabelWithTip, HelpReplayRow,
});

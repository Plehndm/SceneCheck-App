// Shared components for SceneCheck

const { useState, useEffect, useRef, useMemo } = React;

// ── Avatar (gradient circle, or photo if person has one) ──
function SCAvatar({ person, size = 44, ring = false, square = false }) {
  const c1 = person?.color1 || '#FFB199';
  const c2 = person?.color2 || '#FF5B47';
  const initials = (person?.name || '?').split(' ').map(w => w[0]).slice(0,2).join('');
  const radius = square ? Math.max(8, size * 0.22) : '50%';
  const isOrg = person?.type === 'org';
  // Org accounts: square-rounded, dark/ink background, distinguishable from person avatars
  const hasPic = !!person?.picture;
  const bgColor = hasPic
    ? 'transparent'
    : isOrg
      ? 'var(--ink)'
      : c2;
  const bgImage = hasPic
    ? `url(${person.picture})`
    : (isOrg ? 'none' : `linear-gradient(135deg, ${c1} 0%, ${c2} 100%)`);
  return (
    <div style={{
      width: size, height: size, borderRadius: isOrg && !square ? Math.max(8, size * 0.28) : radius,
      backgroundColor: bgColor,
      backgroundImage: bgImage,
      backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: isOrg ? 'var(--surface)' : 'white',
      fontFamily: 'var(--display)', fontWeight: isOrg ? 800 : 700,
      fontStretch: isOrg ? '70%' : '100%',
      fontSize: size * (isOrg ? 0.34 : 0.36),
      letterSpacing: '-0.02em', flexShrink: 0,
      overflow: 'hidden',
      boxShadow: ring ? `0 0 0 3px var(--card), 0 0 0 ${3 + 2}px var(--primary)` : 'none',
    }}>{!hasPic && initials}</div>
  );
}

// ── Hashtag chip ──────────────────────────────────────────
function SCTag({ tag, size = 'md', tone = 'soft', onClick }) {
  const sizes = {
    sm: { fs: 12, py: 4, px: 9, gap: 1 },
    md: { fs: 14, py: 6, px: 11, gap: 1 },
    lg: { fs: 18, py: 9, px: 14, gap: 2 },
  };
  const s = sizes[size];
  const tones = {
    soft: { bg: 'var(--subtle)', fg: 'var(--ink)' },
    primary: { bg: 'var(--primary)', fg: 'var(--primary-ink)' },
    ghost: { bg: 'transparent', fg: 'var(--ink-2)' },
    outline: { bg: 'transparent', fg: 'var(--ink)', border: '1px solid var(--line)' },
  };
  const t = tones[tone];
  return (
    <button
      onClick={onClick}
      className="press"
      style={{
        display: 'inline-flex', alignItems: 'baseline', gap: s.gap,
        padding: `${s.py}px ${s.px}px`,
        background: t.bg, color: t.fg,
        border: t.border || 'none',
        borderRadius: 999, cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'var(--mono)', fontSize: s.fs, fontWeight: 500,
        letterSpacing: '-0.01em',
      }}>
      <span style={{ opacity: 0.55 }}>#</span><span>{tag}</span>
    </button>
  );
}

// ── Stylized map (SVG) ─────────────────────────────────────
// Drawn to suggest UCI-area aesthetics: ring road, Aldrich Park oval, scatter of buildings, water, road grid.
function SCMap({ width, height, pins = [], onPinTap, you = { x: 0.45, y: 0.5 }, compact = false, showHover = false, activeId = null }) {
  const W = width, H = height;
  const [hoverId, setHoverId] = useState(null);
  const hovered = showHover && hoverId ? pins.find(p => p.id === hoverId) : null;
  return (
    <div style={{ position: 'relative', width: W, height: H }}>
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
      <defs>
        <pattern id="mapgrain" width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill="var(--map-land)"/>
          <circle cx="1" cy="1" r="0.4" fill="rgba(0,0,0,0.04)" />
        </pattern>
        <radialGradient id="mapShade" cx="50%" cy="40%" r="80%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
      </defs>
      {/* land */}
      <rect width={W} height={H} fill="url(#mapgrain)"/>
      {/* water ribbon top-left */}
      <path d={`M0,0 L${W*0.32},0 Q${W*0.22},${H*0.14} ${W*0.28},${H*0.26} T0,${H*0.32} Z`} fill="var(--map-water)"/>
      {/* park ovals */}
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.18} ry={H*0.13} fill="var(--map-park)" />
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.14} ry={H*0.10} fill="rgba(0,0,0,0.06)" />
      {/* secondary park */}
      <path d={`M${W*0.78},${H*0.78} q${W*0.06},-${H*0.05} ${W*0.14},0 q-${W*0.04},${H*0.08} -${W*0.14},0`} fill="var(--map-park)"/>
      {/* ring road around park */}
      <ellipse cx={W*0.5} cy={H*0.45} rx={W*0.27} ry={H*0.21} fill="none" stroke="var(--map-road)" strokeWidth="6" />
      {/* main roads */}
      <path d={`M0,${H*0.78} L${W},${H*0.74}`} stroke="var(--map-road)" strokeWidth="7" />
      <path d={`M${W*0.18},0 L${W*0.22},${H}`} stroke="var(--map-road)" strokeWidth="6" />
      <path d={`M${W*0.82},0 L${W*0.78},${H}`} stroke="var(--map-road)" strokeWidth="6" />
      <path d={`M0,${H*0.18} L${W},${H*0.22}`} stroke="var(--map-road)" strokeWidth="5" />
      {/* small connectors */}
      <path d={`M${W*0.5},${H*0.66} L${W*0.5},${H*0.95}`} stroke="var(--map-road)" strokeWidth="3" />
      <path d={`M${W*0.22},${H*0.45} L${W*0.78},${H*0.45}`} stroke="rgba(255,255,255,0.45)" strokeWidth="3" strokeDasharray="6 6"/>
      {/* buildings — small rects */}
      {[
        [0.06,0.30,0.04,0.05],[0.11,0.32,0.03,0.04],[0.06,0.40,0.05,0.04],
        [0.30,0.18,0.05,0.04],[0.36,0.16,0.04,0.05],[0.42,0.20,0.05,0.04],
        [0.62,0.18,0.04,0.05],[0.68,0.20,0.05,0.04],[0.74,0.16,0.04,0.05],
        [0.30,0.78,0.04,0.04],[0.36,0.80,0.05,0.04],[0.42,0.78,0.04,0.05],
        [0.62,0.86,0.04,0.04],[0.68,0.84,0.05,0.04],
        [0.10,0.66,0.04,0.04],[0.14,0.68,0.04,0.04],
        [0.86,0.62,0.04,0.04],[0.90,0.66,0.03,0.04],
      ].map((b, i) => (
        <rect key={i} x={W*b[0]} y={H*b[1]} width={W*b[2]} height={H*b[3]} rx={2} fill="var(--map-build)" />
      ))}
      {/* park label */}
      {!compact && (
        <text x={W*0.5} y={H*0.46}
          textAnchor="middle"
          fontFamily="var(--display)" fontWeight="700" fontSize={Math.max(10, W*0.022)}
          letterSpacing="0.16em" fill="rgba(0,0,0,0.32)">
          ALDRICH PARK
        </text>
      )}
      {/* shade */}
      <rect width={W} height={H} fill="url(#mapShade)" pointerEvents="none"/>
      {/* you-are-here pulse */}
      <g style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx={W*you.x} cy={H*you.y} r={compact ? 14 : 20} fill="var(--accent-blue)" opacity="0.18" className="pulse-ring" />
      </g>
      {/* pins */}
      {pins.map(p => {
        // An event is "recommended" if it's app-discovered, OR it shares at
        // least one interest tag with the current user. Friend events that
        // share a tag are still recommended — but keep their friend color.
        const sharesTag = (p.interests || []).some(t => (SC_ME?.interests || []).includes(t));
        const isRecommended = p.kind === 'recommended' || sharesTag;
        const fill = p.kind === 'yours' ? 'var(--primary)'
                   : p.kind === 'friend' ? (isRecommended ? 'var(--accent-friend)' : 'var(--map-pin-mute)')
                   : isRecommended ? 'var(--accent-blue)'
                   : 'var(--map-pin-mute)';
        const isActive = activeId === p.id;
        const r = (compact ? 8 : 12) * (hoverId === p.id || isActive ? 1.25 : 1);
        return (
          <g key={p.id} style={{ cursor: onPinTap ? 'pointer' : 'default' }}
             onMouseEnter={() => showHover && setHoverId(p.id)}
             onMouseLeave={() => showHover && setHoverId(null)}
             onClick={(e) => { if (onPinTap) { e.stopPropagation(); onPinTap(p); } }}>
            {isActive && (
              <>
                {/* outer focus halo — pulses */}
                <circle cx={W*p.x} cy={H*p.y} r={r*2.6} fill={fill} opacity="0.18" className="pulse-ring"/>
                {/* solid ring to mark the focused pin even when pulse is between beats */}
                <circle cx={W*p.x} cy={H*p.y} r={r*1.9} fill="none" stroke={fill} strokeWidth="2" opacity="0.55"/>
              </>
            )}
            <circle cx={W*p.x} cy={H*p.y + (compact?0:3)} fill="rgba(0,0,0,0.18)" r={r*0.6}/>
            <circle cx={W*p.x} cy={H*p.y} r={r} fill={fill} stroke="white" strokeWidth={compact ? 2 : 3}/>
            {!compact && p.kind === 'yours' && (
              <text x={W*p.x} y={H*p.y + 4} textAnchor="middle" fontSize="11" fill="white" fontWeight="800" fontFamily="var(--display)">★</text>
            )}
          </g>
        );
      })}
      {/* you-are-here dot — drawn above pins so it always reads as your location */}
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={W*you.x} cy={H*you.y + (compact?1:2)} r={compact?7:10} fill="rgba(0,0,0,0.22)"/>
        <circle cx={W*you.x} cy={H*you.y} r={compact?7:10} fill="var(--accent-blue)"/>
        <circle cx={W*you.x} cy={H*you.y} r={compact?4:6} fill="white"/>
      </g>
    </svg>
    {hovered && (() => {
      const tipW = 220;
      const left = Math.max(8, Math.min(W - tipW - 8, W * hovered.x - tipW/2));
      const above = H * hovered.y > H * 0.55;
      const top = above ? H * hovered.y - 10 - 130 : H * hovered.y + 18;
      const sharesTag = (hovered.interests || []).some(t => (SC_ME?.interests || []).includes(t));
      const isRecommended = hovered.kind === 'recommended' || sharesTag;
      const accent = hovered.kind === 'yours' ? 'var(--primary)'
                   : hovered.kind === 'friend' ? (isRecommended ? 'var(--accent-friend)' : 'var(--map-pin-mute)')
                   : isRecommended ? 'var(--accent-blue)'
                   : 'var(--map-pin-mute)';
      const kindLabel = hovered.kind === 'yours' ? 'YOUR EVENT'
                      : hovered.kind === 'friend' ? (isRecommended ? 'FRIEND · RECOMMENDED' : 'FRIEND HOSTING')
                      : isRecommended ? 'RECOMMENDED'
                      : 'NEARBY EVENT';
      return (
        <div style={{
          position: 'absolute', left, top, width: tipW, zIndex: 5,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 14, padding: 12,
          boxShadow: '0 14px 36px -12px rgba(0,0,0,0.32)',
          pointerEvents: 'none',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: accent }}/>
            <span style={{ fontFamily:'var(--mono)', fontSize: 9, letterSpacing:'0.16em', fontWeight: 600, color: accent }}>
              {kindLabel}
            </span>
          </div>
          <div className="display" style={{ fontSize: 14, lineHeight: 1.15, marginBottom: 4 }}>{hovered.title}</div>
          <div style={{ fontFamily:'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginBottom: 8 }}>{hovered.when}</div>
          <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.4, color: 'var(--ink-2)',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {hovered.desc}
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap: 4, marginTop: 8 }}>
            {hovered.interests.map(t => (
              <span key={t} style={{
                fontFamily:'var(--mono)', fontSize: 10, padding: '3px 7px',
                background:'var(--subtle)', borderRadius: 999,
              }}><span style={{ opacity:0.55 }}>#</span>{t}</span>
            ))}
          </div>
        </div>
      );
    })()}
    </div>
  );
}

// ── Bottom tab bar ─────────────────────────────────────────
function SCBottomTabs({ active, onChange }) {
  const tabs = [
    { key: 'home',     label: 'HOME',     icon: 'home' },
    { key: 'chat',     label: 'CHAT',     icon: 'chat' },
    { key: 'profile',  label: 'PROFILE',  icon: 'profile' },
    { key: 'settings', label: 'SETTINGS', icon: 'settings' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      paddingBottom: 28, paddingTop: 10, paddingInline: 14,
      background: 'linear-gradient(to top, var(--card) 70%, transparent)',
      zIndex: 30,
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
        background: 'var(--ink)', borderRadius: 22, padding: 6,
        boxShadow: '0 12px 30px -10px rgba(0,0,0,0.4)',
      }}>
        {tabs.map(t => {
          const isActive = t.key === active;
          return (
            <button key={t.key}
              onClick={() => onChange(t.key)}
              className="press"
              style={{
                appearance: 'none', border: 'none',
                background: isActive ? 'var(--primary)' : 'transparent',
                color: isActive
                  ? 'var(--primary-ink)'
                  : 'color-mix(in oklab, var(--card) 78%, transparent)',
                borderRadius: 16, padding: '10px 6px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 10, letterSpacing: '0.14em', fontWeight: 600,
              }}>
              <SCIcon name={t.icon} size={18} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Top bar (back + title) ─────────────────────────────────
function SCTopBar({ onBack, right, title, subtitle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 14px 12px',
    }}>
      {onBack && (
        <button onClick={onBack} className="press" style={{
          width: 38, height: 38, borderRadius: 12, border: '1px solid var(--line)',
          background: 'var(--card)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <SCIcon name="back" size={18}/>
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {subtitle && <div className="label-cap">{subtitle}</div>}
        {title && <div className="display" style={{ fontSize: 18, lineHeight: 1.1 }}>{title}</div>}
      </div>
      {right}
    </div>
  );
}

// ── Inline icons ───────────────────────────────────────────
function SCIcon({ name, size = 20, color = 'currentColor' }) {
  const s = size;
  const props = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home':
      return <svg {...props}><path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z"/></svg>;
    case 'chat':
      return <svg {...props}><path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>;
    case 'profile':
      return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>;
    case 'back':
      return <svg {...props}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'plus':
      return <svg {...props}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    case 'check':
      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'search':
      return <svg {...props}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case 'pin':
      return <svg {...props}><path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z"/><circle cx="12" cy="9" r="3"/></svg>;
    case 'calendar':
      return <svg {...props}><rect x="3" y="4" width="18" height="18" rx="3"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>;
    case 'people':
      return <svg {...props}><path d="M16 21a4 4 0 0 0-8 0"/><circle cx="12" cy="7" r="4"/><path d="M22 21a4 4 0 0 0-3-3.87"/><path d="M2 21a4 4 0 0 1 3-3.87"/></svg>;
    case 'star':
      return <svg {...props}><polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/></svg>;
    case 'send':
      return <svg {...props}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
    case 'chevron-right':
      return <svg {...props}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'globe':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>;
    case 'lock':
      return <svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></svg>;
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>;
    case 'logout':
      return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'shield':
      return <svg {...props}><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z"/></svg>;
    case 'flag':
      return <svg {...props}><path d="M4 21V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>;
    case 'help':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></svg>;
    case 'x':
      return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'edit':
      return <svg {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z"/></svg>;
    case 'mic':
      return <svg {...props}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v3"/></svg>;
    case 'camera':
      return <svg {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
    case 'switch':
      return <svg {...props}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
    case 'user-plus':
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>;
    case 'user-check':
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'lock-open':
      return <svg {...props}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></svg>;
    case 'mail':
      return <svg {...props}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 6 12 13 22 6"/></svg>;
    case 'rotate-ccw':
      return <svg {...props}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>;
    case 'crosshair':
      return <svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>;
    case 'sun':
      return <svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>;
    case 'moon':
      return <svg {...props}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>;
    default:
      return <svg {...props}><circle cx="12" cy="12" r="10"/></svg>;
  }
}

// ── ADD button (toggleable) ────────────────────────────────
function SCAddButton({ joined, onToggle, label = 'ADD', size = 'lg' }) {
  const sizes = {
    sm: { h: 36, fs: 12, px: 14, r: 10 },
    md: { h: 44, fs: 13, px: 18, r: 12 },
    lg: { h: 56, fs: 15, px: 22, r: 16 },
  };
  const s = sizes[size];
  return (
    <button onClick={onToggle} className="press" style={{
      width: '100%', height: s.h, borderRadius: s.r,
      background: joined ? 'var(--ink)' : 'var(--good)',
      color: joined ? 'var(--card)' : 'white', border: 'none', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: 'var(--mono)', fontSize: s.fs, fontWeight: 600,
      letterSpacing: '0.14em', textTransform: 'uppercase',
      boxShadow: joined ? 'inset 0 0 0 1px rgba(255,255,255,0.1)' : '0 6px 14px -6px rgba(43,182,115,0.6)',
    }}>
      {joined ? <><SCIcon name="check" size={16}/> JOINED</> : label}
    </button>
  );
}

// ── Card ───────────────────────────────────────────────────
function SCCard({ children, style, onClick }) {
  return (
    <div onClick={onClick} className={onClick ? 'press' : ''} style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18,
      cursor: onClick ? 'pointer' : 'default', ...style,
    }}>
      {children}
    </div>
  );
}

// ── Person row (used in Home + chat list) ──────────────────
function SCPersonRow({ person, onClick, right }) {
  // Shared interests between me and this person
  const shared = (person.interests || []).filter(t => SC_ME.interests.includes(t));
  const sharedText = shared.length
    ? `${shared.length} shared interest${shared.length>1?'s':''}`
    : `${person.interests?.[0] || ''} · ${person.interests?.[1] || ''}`.replace(/^ · | · $/g,'');
  return (
    <div onClick={onClick} className={onClick ? 'press' : ''} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', cursor: onClick ? 'pointer' : 'default',
    }}>
      <SCAvatar person={person} size={42}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="display" style={{ fontSize: 15, lineHeight: 1.15 }}>{person.name}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '0.02em', marginTop: 2 }}>
          @{person.username} · {person.mutual} mutual · {sharedText}
        </div>
      </div>
      {right}
    </div>
  );
}

// ── Section header ─────────────────────────────────────────
function SCSection({ title, action, children, padding = 14, style = {} }) {
  return (
    <div style={{ padding: `0 ${padding}px`, ...style }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        padding: '14px 2px 8px',
      }}>
        <div className="label-cap">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

Object.assign(window, {
  SCAvatar, SCTag, SCMap, SCBottomTabs, SCTopBar, SCIcon,
  SCAddButton, SCCard, SCPersonRow, SCSection,
});

// Inline SVG icons. The legacy version used raw <svg> + DOM elements; this
// version uses react-native-svg, which works on both native (iOS/Android)
// and web. Every icon shares the same 24×24 stroke-based viewBox.
//
// Adding a new icon: drop a case in the switch with the path/shape JSX.

import Svg, {
  Circle, Line, Path, Polyline, Polygon, Rect,
} from 'react-native-svg';

export type IconName =
  | 'home' | 'chat' | 'profile' | 'settings'
  | 'back' | 'plus' | 'minus' | 'check' | 'search' | 'pin' | 'calendar'
  | 'people' | 'star' | 'send' | 'chevron-right' | 'globe'
  | 'lock' | 'bell' | 'logout' | 'shield' | 'flag' | 'help'
  | 'x' | 'edit' | 'mic' | 'camera' | 'switch'
  | 'user-plus' | 'user-check' | 'clock' | 'lock-open' | 'mail'
  | 'rotate-ccw' | 'crosshair' | 'sun' | 'moon';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

export function SCIcon({ name, size = 20, color = 'currentColor' }: Props) {
  const strokeProps = {
    stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none',
  };
  switch (name) {
    case 'home':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2z" {...strokeProps} /></Svg>;
    case 'chat':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" {...strokeProps} /></Svg>;
    case 'profile':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="8" r="4" {...strokeProps} /><Path d="M4 22a8 8 0 0 1 16 0" {...strokeProps} /></Svg>;
    case 'settings':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="3" {...strokeProps} /><Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" {...strokeProps} /></Svg>;
    case 'back':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="15 18 9 12 15 6" {...strokeProps} /></Svg>;
    case 'plus':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Line x1="12" y1="5" x2="12" y2="19" {...strokeProps} /><Line x1="5" y1="12" x2="19" y2="12" {...strokeProps} /></Svg>;
    case 'minus':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Line x1="5" y1="12" x2="19" y2="12" {...strokeProps} /></Svg>;
    case 'check':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="20 6 9 17 4 12" {...strokeProps} /></Svg>;
    case 'search':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="11" cy="11" r="8" {...strokeProps} /><Line x1="21" y1="21" x2="16.65" y2="16.65" {...strokeProps} /></Svg>;
    case 'pin':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 22s8-7.5 8-13a8 8 0 1 0-16 0c0 5.5 8 13 8 13z" {...strokeProps} /><Circle cx="12" cy="9" r="3" {...strokeProps} /></Svg>;
    case 'calendar':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="3" y="4" width="18" height="18" rx="3" {...strokeProps} /><Line x1="3" y1="10" x2="21" y2="10" {...strokeProps} /><Line x1="8" y1="2" x2="8" y2="6" {...strokeProps} /><Line x1="16" y1="2" x2="16" y2="6" {...strokeProps} /></Svg>;
    case 'people':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M16 21a4 4 0 0 0-8 0" {...strokeProps} /><Circle cx="12" cy="7" r="4" {...strokeProps} /><Path d="M22 21a4 4 0 0 0-3-3.87" {...strokeProps} /><Path d="M2 21a4 4 0 0 1 3-3.87" {...strokeProps} /></Svg>;
    case 'star':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" {...strokeProps} /></Svg>;
    case 'send':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Line x1="22" y1="2" x2="11" y2="13" {...strokeProps} /><Polygon points="22 2 15 22 11 13 2 9 22 2" {...strokeProps} /></Svg>;
    case 'chevron-right':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="9 18 15 12 9 6" {...strokeProps} /></Svg>;
    case 'globe':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" {...strokeProps} /><Path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" {...strokeProps} /></Svg>;
    case 'lock':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="11" width="16" height="10" rx="2" {...strokeProps} /><Path d="M8 11V7a4 4 0 1 1 8 0v4" {...strokeProps} /></Svg>;
    case 'bell':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...strokeProps} /><Path d="M10 21a2 2 0 0 0 4 0" {...strokeProps} /></Svg>;
    case 'logout':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" {...strokeProps} /><Polyline points="16 17 21 12 16 7" {...strokeProps} /><Line x1="21" y1="12" x2="9" y2="12" {...strokeProps} /></Svg>;
    case 'shield':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z" {...strokeProps} /></Svg>;
    case 'flag':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M4 21V4" {...strokeProps} /><Path d="M4 4h12l-2 4 2 4H4" {...strokeProps} /></Svg>;
    case 'help':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" {...strokeProps} /><Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" {...strokeProps} /><Line x1="12" y1="17" x2="12" y2="17" {...strokeProps} /></Svg>;
    case 'x':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Line x1="18" y1="6" x2="6" y2="18" {...strokeProps} /><Line x1="6" y1="6" x2="18" y2="18" {...strokeProps} /></Svg>;
    case 'edit':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" {...strokeProps} /><Path d="M18.5 2.5a2.1 2.1 0 1 1 3 3L12 15l-4 1 1-4z" {...strokeProps} /></Svg>;
    case 'mic':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="9" y="2" width="6" height="12" rx="3" {...strokeProps} /><Path d="M5 10a7 7 0 0 0 14 0M12 19v3" {...strokeProps} /></Svg>;
    case 'camera':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" {...strokeProps} /><Circle cx="12" cy="13" r="4" {...strokeProps} /></Svg>;
    case 'switch':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="17 1 21 5 17 9" {...strokeProps} /><Path d="M3 11V9a4 4 0 0 1 4-4h14" {...strokeProps} /><Polyline points="7 23 3 19 7 15" {...strokeProps} /><Path d="M21 13v2a4 4 0 0 1-4 4H3" {...strokeProps} /></Svg>;
    case 'user-plus':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} /><Circle cx="8.5" cy="7" r="4" {...strokeProps} /><Line x1="20" y1="8" x2="20" y2="14" {...strokeProps} /><Line x1="23" y1="11" x2="17" y2="11" {...strokeProps} /></Svg>;
    case 'user-check':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" {...strokeProps} /><Circle cx="8.5" cy="7" r="4" {...strokeProps} /><Polyline points="17 11 19 13 23 9" {...strokeProps} /></Svg>;
    case 'clock':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" {...strokeProps} /><Polyline points="12 6 12 12 16 14" {...strokeProps} /></Svg>;
    case 'lock-open':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="4" y="11" width="16" height="10" rx="2" {...strokeProps} /><Path d="M8 11V7a4 4 0 0 1 8 0" {...strokeProps} /></Svg>;
    case 'mail':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Rect x="2" y="4" width="20" height="16" rx="2" {...strokeProps} /><Polyline points="2 6 12 13 22 6" {...strokeProps} /></Svg>;
    case 'rotate-ccw':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Polyline points="1 4 1 10 7 10" {...strokeProps} /><Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" {...strokeProps} /></Svg>;
    case 'crosshair':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="9" {...strokeProps} /><Circle cx="12" cy="12" r="2" {...strokeProps} /><Line x1="12" y1="2" x2="12" y2="5" {...strokeProps} /><Line x1="12" y1="19" x2="12" y2="22" {...strokeProps} /><Line x1="2" y1="12" x2="5" y2="12" {...strokeProps} /><Line x1="19" y1="12" x2="22" y2="12" {...strokeProps} /></Svg>;
    case 'sun':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="4" {...strokeProps} /><Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" {...strokeProps} /></Svg>;
    case 'moon':
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" {...strokeProps} /></Svg>;
    default:
      return <Svg width={size} height={size} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="10" {...strokeProps} /></Svg>;
  }
}

// Current on-screen keyboard height (0 when hidden). Lets a bottom-anchored
// surface — e.g. a bottom-sheet modal that KeyboardAvoidingView/adjustResize
// don't cover — sit its bottom edge at the top of the keyboard so the focused
// input stays visible. No-op on web (no soft keyboard fires these events).

import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    // iOS exposes the smoother "Will" events (fire with the show/hide
    // animation); Android only emits "Did".
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  return height;
}

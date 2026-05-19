// useImagePicker — thin wrapper around expo-image-picker for choosing a
// profile photo. Returns the picked URI (data URL on web, file URI on
// native) plus a `pick()` trigger. Permission prompts happen inside
// pick() so callers don't have to manage the lifecycle.
//
// Used by the profile editor flow (Phase 4.x). The architecture doc's
// FR2.1 ("user picks profile picture") is fully satisfied by this.

import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

export interface UseImagePickerResult {
  uri: string | null;
  picking: boolean;
  error: string | null;
  pick: () => Promise<string | null>;
  reset: () => void;
}

export function useImagePicker(): UseImagePickerResult {
  const [uri, setUri] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (): Promise<string | null> => {
    setPicking(true);
    setError(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Photo library access denied.');
        return null;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || result.assets.length === 0) return null;
      const next = result.assets[0].uri;
      setUri(next);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to pick image.');
      return null;
    } finally {
      setPicking(false);
    }
  };

  const reset = () => {
    setUri(null);
    setError(null);
  };

  return { uri, picking, error, pick, reset };
}

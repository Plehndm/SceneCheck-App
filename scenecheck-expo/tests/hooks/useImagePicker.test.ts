// Tests for useImagePicker. The expo-image-picker module is mocked in
// jest.setup.ts — we just verify our wrapper handles permission denial,
// cancellation, and the happy path.

import { renderHook, act, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useImagePicker } from '@/hooks/useImagePicker';

describe('useImagePicker', () => {
  beforeEach(() => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///mock/image.jpg' }],
    });
  });

  test('initial state has no uri and no error', () => {
    const { result } = renderHook(() => useImagePicker());
    expect(result.current.uri).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.picking).toBe(false);
  });

  test('pick() returns the URI on success', async () => {
    const { result } = renderHook(() => useImagePicker());
    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.pick();
    });
    expect(returned).toBe('file:///mock/image.jpg');
    await waitFor(() => expect(result.current.uri).toBe('file:///mock/image.jpg'));
  });

  test('pick() returns null and sets error when permission denied', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });
    const { result } = renderHook(() => useImagePicker());
    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.pick();
    });
    expect(returned).toBeNull();
    await waitFor(() => expect(result.current.error).toMatch(/denied/i));
  });

  test('pick() returns null when user cancels', async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });
    const { result } = renderHook(() => useImagePicker());
    let returned: string | null = null;
    await act(async () => {
      returned = await result.current.pick();
    });
    expect(returned).toBeNull();
    expect(result.current.uri).toBeNull();
  });

  test('reset() clears uri and error', async () => {
    const { result } = renderHook(() => useImagePicker());
    await act(async () => {
      await result.current.pick();
    });
    await waitFor(() => expect(result.current.uri).not.toBeNull());
    act(() => result.current.reset());
    expect(result.current.uri).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

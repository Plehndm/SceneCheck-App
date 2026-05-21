// Component tests for the event location picker. The underlying <Map> is
// mocked (jest.setup stubs react-native-maps), so we can't drive a real
// pan — but we verify the sheet renders when visible and that confirming
// returns the current center (the `initial` coords when no pan occurs).

import { fireEvent } from '@testing-library/react-native';
import { LocationPickerSheet } from '@/components/LocationPickerSheet';
import { renderScreen } from '../test-utils';

describe('LocationPickerSheet', () => {
  test('renders the picker chrome when visible', () => {
    const { getByText } = renderScreen(
      <LocationPickerSheet visible onClose={() => {}} onConfirm={() => {}} />,
    );
    expect(getByText('Pin the spot')).toBeTruthy();
    expect(getByText('USE THIS LOCATION')).toBeTruthy();
  });

  test('confirms with the center coordinates (the initial point with no pan)', () => {
    const onConfirm = jest.fn();
    const { getByText } = renderScreen(
      <LocationPickerSheet
        visible
        initial={{ lat: 33.5, lng: -117.7 }}
        onClose={() => {}}
        onConfirm={onConfirm}
      />,
    );
    fireEvent.press(getByText('USE THIS LOCATION'));
    expect(onConfirm).toHaveBeenCalledWith({ lat: 33.5, lng: -117.7 });
  });
});

// Integration tests for SCBottomTabs (src/components.jsx:230)
// FR coverage: FR4 (navigation), general UX

const React = require('react');
const { render, fireEvent } = require('@testing-library/react');

const SCBottomTabs = global.SCBottomTabs;

describe('SCBottomTabs', () => {
  test('renders all 4 tab labels', () => {
    const { container } = render(
      <SCBottomTabs active="home" onChange={() => {}} />
    );
    const text = container.textContent;
    expect(text).toContain('HOME');
    expect(text).toContain('CHAT');
    expect(text).toContain('PROFILE');
    expect(text).toContain('SETTINGS');
  });

  test('renders exactly 4 tab buttons', () => {
    const { container } = render(
      <SCBottomTabs active="home" onChange={() => {}} />
    );
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(4);
  });

  test('active tab has non-transparent background', () => {
    const { container } = render(
      <SCBottomTabs active="chat" onChange={() => {}} />
    );
    const buttons = container.querySelectorAll('button');
    // Buttons are in order: home, chat, profile, settings
    const chatTab = buttons[1];
    // Active tab gets var(--primary) which jsdom may serialize differently
    // The key check: active tab background is NOT 'transparent'
    expect(chatTab.style.background).not.toBe('transparent');
    // And the non-active home tab IS transparent
    expect(buttons[0].style.background).toBe('transparent');
  });

  test('non-active tabs have transparent background', () => {
    const { container } = render(
      <SCBottomTabs active="home" onChange={() => {}} />
    );
    const buttons = container.querySelectorAll('button');
    // chat (index 1) should be transparent when home is active
    expect(buttons[1].style.background).toBe('transparent');
    expect(buttons[2].style.background).toBe('transparent');
    expect(buttons[3].style.background).toBe('transparent');
  });

  test('clicking a tab fires onChange with correct key', () => {
    const onChange = jest.fn();
    const { container } = render(
      <SCBottomTabs active="home" onChange={onChange} />
    );
    const buttons = container.querySelectorAll('button');
    // Click the SETTINGS tab (index 3)
    fireEvent.click(buttons[3]);
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  test('clicking CHAT tab fires onChange("chat")', () => {
    const onChange = jest.fn();
    const { container } = render(
      <SCBottomTabs active="home" onChange={onChange} />
    );
    const buttons = container.querySelectorAll('button');
    fireEvent.click(buttons[1]);
    expect(onChange).toHaveBeenCalledWith('chat');
  });
});

// Integration tests for SCAvatar (src/components.jsx:6)
// FR coverage: FR2 (user profiles), FR8 (friend display)

const React = require('react');
const { render } = require('@testing-library/react');

const SCAvatar = global.SCAvatar;

describe('SCAvatar', () => {
  test('renders initials for a person with no picture', () => {
    const person = { name: 'Maya Chen', type: 'person', color1: '#FF8A65', color2: '#FF5B47' };
    const { container } = render(<SCAvatar person={person} size={44} />);
    const el = container.firstChild;
    expect(el.textContent).toBe('MC');
  });

  test('renders single initial for single-word name', () => {
    const person = { name: 'Zara', type: 'person', color1: '#aaa', color2: '#bbb' };
    const { container } = render(<SCAvatar person={person} size={44} />);
    expect(container.firstChild.textContent).toBe('Z');
  });

  test('uses square-rounded corners for org type', () => {
    const org = { name: 'UCI Cycling Club', type: 'org' };
    const { container } = render(<SCAvatar person={org} size={44} />);
    const el = container.firstChild;
    // Org avatars use a larger border-radius based on size (~28% of size)
    const radius = parseFloat(el.style.borderRadius);
    expect(radius).toBeGreaterThan(8);
    expect(radius).toBeLessThan(44); // not fully circular
  });

  test('shows no text when person has a picture', () => {
    const person = {
      name: 'Maya Chen', type: 'person',
      picture: 'data:image/png;base64,abc123',
      color1: '#FF8A65', color2: '#FF5B47',
    };
    const { container } = render(<SCAvatar person={person} size={44} />);
    // When picture is set, initials should not render
    expect(container.firstChild.textContent).toBe('');
  });

  test('uses background-image url when person has picture', () => {
    const person = {
      name: 'Maya Chen', type: 'person',
      picture: 'data:image/png;base64,abc123',
      color1: '#FF8A65', color2: '#FF5B47',
    };
    const { container } = render(<SCAvatar person={person} size={44} />);
    const style = container.firstChild.style;
    expect(style.backgroundImage).toContain('url(');
    expect(style.backgroundImage).toContain('abc123');
  });

  test('renders at specified size', () => {
    const person = { name: 'Test User', type: 'person', color1: '#aaa', color2: '#bbb' };
    const { container } = render(<SCAvatar person={person} size={64} />);
    const el = container.firstChild;
    expect(el.style.width).toBe('64px');
    expect(el.style.height).toBe('64px');
  });

  test('handles missing person gracefully', () => {
    const { container } = render(<SCAvatar person={null} size={44} />);
    // Should render "?" as fallback initial
    expect(container.firstChild.textContent).toBe('?');
  });
});

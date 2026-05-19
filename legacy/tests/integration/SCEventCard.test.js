// Integration tests for SCEventCard (src/screens.jsx:139)
// FR coverage: FR4 (event discovery display), FR5 (event info)

const React = require('react');
const { render, fireEvent } = require('@testing-library/react');

const SCEventCard = global.SCEventCard;

// Use real mock events from the data layer
const yourEvent = global.SC_EVENT_BY_ID['e1'];   // kind: 'yours'
const friendEvent = global.SC_EVENT_BY_ID['e2'];  // kind: 'friend'
const recommendedEvent = global.SC_EVENT_BY_ID['e4']; // kind: 'recommended'

describe('SCEventCard', () => {
  test('shows "YOUR EVENT" label for kind:yours', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={() => {}} />
    );
    expect(container.textContent).toContain('YOUR EVENT');
  });

  test('shows "FRIEND HOSTING" label for kind:friend', () => {
    const { container } = render(
      <SCEventCard event={friendEvent} joined={false} onClick={() => {}} />
    );
    expect(container.textContent).toContain('FRIEND HOSTING');
  });

  test('shows "RECOMMENDED" label for kind:recommended', () => {
    const { container } = render(
      <SCEventCard event={recommendedEvent} joined={false} onClick={() => {}} />
    );
    expect(container.textContent).toContain('RECOMMENDED');
  });

  test('shows "JOINED" badge when joined=true', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={true} onClick={() => {}} />
    );
    expect(container.textContent).toContain('JOINED');
  });

  test('does not show "JOINED" badge when joined=false', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={() => {}} />
    );
    // Should not contain "JOINED" as standalone badge text
    // (may contain "YOUR EVENT" which doesn't include "JOINED")
    const spans = container.querySelectorAll('span');
    const joinedSpans = Array.from(spans).filter(s => s.textContent === 'JOINED');
    expect(joinedSpans.length).toBe(0);
  });

  test('displays event title', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={() => {}} />
    );
    expect(container.textContent).toContain('Morning Ride — Back Bay loop');
  });

  test('displays event location', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={() => {}} />
    );
    expect(container.textContent).toContain('Anteater Plaza → Back Bay');
  });

  test('displays attendees/cap count', () => {
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={() => {}} />
    );
    // yourEvent has attendees: 6, cap: 12
    expect(container.textContent).toContain('6');
    expect(container.textContent).toContain('/12');
  });

  test('fires onClick when card is clicked', () => {
    const onClick = jest.fn();
    const { container } = render(
      <SCEventCard event={yourEvent} joined={false} onClick={onClick} />
    );
    fireEvent.click(container.firstChild);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

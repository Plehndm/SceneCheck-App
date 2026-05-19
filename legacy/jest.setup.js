// Jest setup — loads React globally and requires source files in dependency order.
// Each source file calls Object.assign(window, {...}) at the bottom, populating
// globals that downstream files and tests can access.

const React = require('react');
const ReactDOM = require('react-dom');

// Source files do `const { useState } = React;` at the top level,
// so React must be on global before any file loads.
global.React = React;
global.ReactDOM = ReactDOM;

// Minimal localStorage mock (used by app.jsx for picture/prefs persistence)
const store = {};
global.localStorage = {
  getItem: (k) => store[k] ?? null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
};

// Load source files in the same dependency order as index.html.
// Each file's Object.assign(window, {...}) populates global/window in jsdom.
require('./src/ios-frame.jsx');
require('./src/tweaks-panel.jsx');
require('./src/date-time.jsx');
require('./src/data.jsx');
require('./src/components.jsx');
require('./src/additions.jsx');
require('./src/heuristic-fixes.jsx');
require('./src/screens.jsx');
// NOTE: app.jsx is intentionally skipped — its last line calls
// ReactDOM.createRoot(document.getElementById('root')).render(<App/>)
// which would error since there's no #root element in the test DOM.
// The App component's state logic (toggleJoin, etc.) is tested indirectly.

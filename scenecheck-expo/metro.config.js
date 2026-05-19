// Metro config.
//
// The default Expo config is extended with a targeted resolver override
// that routes `zustand` and `zustand/middleware` to the package's CJS
// build on web. The reason: Zustand v5's ESM build (`esm/middleware.mjs`)
// contains `import.meta.env` references in the devtools middleware. Metro
// serves the dev bundle as a classic script (not `<script type="module">`),
// so the browser throws `SyntaxError: Cannot use 'import.meta' outside a
// module` and never hydrates the page. The CJS build uses `process.env`
// instead and parses fine.
//
// Native builds and other packages are unaffected — the override only
// fires on web for these two module ids.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const CJS_OVERRIDES = {
  zustand: 'node_modules/zustand/index.js',
  'zustand/middleware': 'node_modules/zustand/middleware.js',
  'zustand/shallow': 'node_modules/zustand/shallow.js',
  'zustand/vanilla': 'node_modules/zustand/vanilla.js',
  'zustand/react': 'node_modules/zustand/react.js',
  'zustand/traditional': 'node_modules/zustand/traditional.js',
};

const previousResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && Object.prototype.hasOwnProperty.call(CJS_OVERRIDES, moduleName)) {
    return {
      filePath: path.resolve(__dirname, CJS_OVERRIDES[moduleName]),
      type: 'sourceFile',
    };
  }
  if (previousResolveRequest) {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

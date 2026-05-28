// Unit conversion constants — one home so every screen agrees.
//
// History: `MILES_TO_METERS` was declared at the top of `app/(tabs)/map.tsx`
// AND `app/search.tsx`, with the same literal in both places. Extracting
// the constant here removes the duplication and keeps a future change
// (e.g. switching to a different conversion or adding kilometres) from
// having to chase down call sites.

export const MILES_TO_METERS = 1609.34;

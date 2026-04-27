// Plain config constants for the live-trading flow. Lives outside
// live-actions.ts because Next.js requires "use server" files to
// export only async functions — exporting a const from there breaks
// the build.
//
// Bumped when the disclaimer text changes materially. Old
// acknowledgements stop counting; users must re-accept. Keep in
// lockstep with the disclaimer copy in live-disclaimer-card.tsx.
export const LIVE_DISCLAIMER_VERSION = 1;

// Pointer-lock transitions and cursor warps can report bogus movement.
// Reject impossible jumps and bound unusual flicks without filtering normal aim.
export const MAX_RAW_LOOK_DELTA = 240;
export const MAX_APPLIED_LOOK_DELTA = 120;

export function guardedLookDelta(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y) ||
      Math.abs(x) > MAX_RAW_LOOK_DELTA || Math.abs(y) > MAX_RAW_LOOK_DELTA) return null;
  return {
    x: Math.max(-MAX_APPLIED_LOOK_DELTA, Math.min(MAX_APPLIED_LOOK_DELTA, x)),
    y: Math.max(-MAX_APPLIED_LOOK_DELTA, Math.min(MAX_APPLIED_LOOK_DELTA, y)),
  };
}

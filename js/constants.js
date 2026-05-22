export const SEGMENT_PX       = 8;
export const MAX_SEGMENTS     = 80;
export const GROW_EVERY       = 3;
export const RETRACT_SPEED    = 3;
export const SWAY_AMP         = 2.0;
export const SWAY_FREQ        = 0.0016;
export const SWAY_PER_NODE    = 0.38;
export const SMOOTH           = 0.82;
// Verlet physics
export const GRAVITY          = 0.06;  // px/frame² downward pull
export const DAMPING          = 0.97;  // velocity multiplier per frame — controls how long the flow trails
export const CONSTRAINT_ITERS = 3;     // distance-constraint solve passes per frame
